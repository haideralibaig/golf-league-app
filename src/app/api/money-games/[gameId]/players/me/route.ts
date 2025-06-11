import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient, PlayerInvitationStatus, MoneyGameStatus } from "@prisma/client";
import { getAblyServerClient } from "@/lib/ably";
import * as z from "zod";

const prisma = new PrismaClient();

// Player count configurations for each game type
const GAME_TYPE_PLAYER_COUNTS = {
  TWO_VS_TWO_AUTO_PRESS: { required: 4 },
  INDIVIDUAL_STROKE_PLAY: { required: { min: 2, max: 8 } },
  TEAM_SCRAMBLE: { required: 4 },
  SKINS_GAME: { required: { min: 2, max: 8 } },
} as const;

// Validation schema for player response
const playerResponseSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

type PlayerResponseRequest = z.infer<typeof playerResponseSchema>;

export async function PUT(
  req: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    // Step 1: Check authentication
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Step 2: Validate request body
    const body = await req.json();
    const validationResult = playerResponseSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { status } = validationResult.data;

    // Step 3: Find the current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Step 4: Find the money game and verify it exists
    const moneyGame = await prisma.moneyGame.findUnique({
      where: { id: params.gameId },
      include: {
        players: {
          include: {
            player: true,
          },
        },
      },
    });

    if (!moneyGame) {
      return NextResponse.json(
        { error: "Money game not found" },
        { status: 404 }
      );
    }

    // Step 5: Check if game is still in a state where responses are allowed
    if (moneyGame.status !== MoneyGameStatus.WAITING_FOR_PLAYERS && 
        moneyGame.status !== MoneyGameStatus.READY_TO_START) {
      return NextResponse.json(
        { error: "This game is no longer accepting player responses" },
        { status: 400 }
      );
    }

    // Step 6: Find the current user's player record in this game
    const currentPlayerInGame = moneyGame.players.find(
      (gamePlayer) => gamePlayer.player?.userId === currentUser.id
    );

    if (!currentPlayerInGame) {
      return NextResponse.json(
        { error: "You are not invited to this game" },
        { status: 403 }
      );
    }

    // Step 7: Check if player is a guest (guests can't respond via this endpoint)
    if (!currentPlayerInGame.playerId) {
      return NextResponse.json(
        { error: "Guest players cannot respond to invitations via this endpoint" },
        { status: 400 }
      );
    }

    // Step 8: Check if already responded with the same status
    if (currentPlayerInGame.status === status) {
      return NextResponse.json(
        { error: `You have already ${status.toLowerCase()} this invitation` },
        { status: 400 }
      );
    }

    // Step 9: Update player status and check if game is ready to start
    const updatedGame = await prisma.$transaction(async (tx) => {
      // Update the player's status
      await tx.moneyGamePlayer.update({
        where: { id: currentPlayerInGame.id },
        data: { 
          status: status as PlayerInvitationStatus,
          updatedAt: new Date(),
        },
      });

      // Get updated game with all players to check readiness
      const gameWithPlayers = await tx.moneyGame.findUnique({
        where: { id: params.gameId },
        include: {
          players: true,
        },
      });

      if (!gameWithPlayers) {
        throw new Error("Game not found after update");
      }

      // Check if all required players have accepted
      const acceptedPlayers = gameWithPlayers.players.filter(p => p.status === PlayerInvitationStatus.ACCEPTED);
      const gameConfig = GAME_TYPE_PLAYER_COUNTS[gameWithPlayers.gameType];
      
      let shouldBeReadyToStart = false;
      if (typeof gameConfig.required === "number") {
        // Fixed player count games
        shouldBeReadyToStart = acceptedPlayers.length === gameConfig.required;
      } else {
        // Variable player count games - check if we have at least minimum
        shouldBeReadyToStart = acceptedPlayers.length >= gameConfig.required.min;
      }

      // Update game status if all players have accepted
      let updatedGameStatus = gameWithPlayers.status;
      if (shouldBeReadyToStart && gameWithPlayers.status === MoneyGameStatus.WAITING_FOR_PLAYERS) {
        updatedGameStatus = MoneyGameStatus.READY_TO_START;
        await tx.moneyGame.update({
          where: { id: params.gameId },
          data: { status: MoneyGameStatus.READY_TO_START },
        });
      } else if (!shouldBeReadyToStart && gameWithPlayers.status === MoneyGameStatus.READY_TO_START) {
        // If someone declined and we no longer have enough players, go back to waiting
        updatedGameStatus = MoneyGameStatus.WAITING_FOR_PLAYERS;
        await tx.moneyGame.update({
          where: { id: params.gameId },
          data: { status: MoneyGameStatus.WAITING_FOR_PLAYERS },
        });
      }

      return {
        ...gameWithPlayers,
        status: updatedGameStatus,
        canStart: shouldBeReadyToStart,
        acceptedCount: acceptedPlayers.length,
      };
    });

    // Step 10: Publish real-time update to the lobby channel
    try {
      const ablyClient = getAblyServerClient();
      const lobbyChannel = ablyClient.channels.get(`game-${params.gameId}-lobby`);
      
      await lobbyChannel.publish("player-response", {
        gameId: params.gameId,
        playerId: currentPlayerInGame.playerId,
        playerName: currentPlayerInGame.player?.displayName,
        status: status,
        canStart: updatedGame.canStart,
        acceptedCount: updatedGame.acceptedCount,
        gameStatus: updatedGame.status,
        updatedAt: new Date().toISOString(),
      });

      console.log(`Published player response update for game ${params.gameId}: ${status}`);
    } catch (ablyError) {
      console.error("Failed to publish real-time update:", ablyError);
      // Don't fail the request if real-time update fails
    }

    // Step 11: If game status changed, also publish game status update
    if (updatedGame.status !== moneyGame.status) {
      try {
        const ablyClient = getAblyServerClient();
        const lobbyChannel = ablyClient.channels.get(`game-${params.gameId}-lobby`);
        
        await lobbyChannel.publish("game-status-change", {
          gameId: params.gameId,
          status: updatedGame.status,
          canStart: updatedGame.canStart,
          updatedAt: new Date().toISOString(),
        });

        console.log(`Published game status change for game ${params.gameId}: ${updatedGame.status}`);
      } catch (ablyError) {
        console.error("Failed to publish game status update:", ablyError);
      }
    }

    // Step 12: Return success response
    return NextResponse.json(
      {
        message: `Successfully ${status.toLowerCase()} the invitation`,
        status: status,
        gameStatus: updatedGame.status,
        canStart: updatedGame.canStart,
        acceptedCount: updatedGame.acceptedCount,
        totalRequired: typeof GAME_TYPE_PLAYER_COUNTS[updatedGame.gameType].required === "number"
          ? GAME_TYPE_PLAYER_COUNTS[updatedGame.gameType].required
          : GAME_TYPE_PLAYER_COUNTS[updatedGame.gameType].required.max,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Unexpected error in player response:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// GET endpoint to get current user's status in this game
export async function GET(
  req: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    // Step 1: Check authentication
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Step 2: Find the current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Step 3: Find the money game and current user's participation
    const moneyGame = await prisma.moneyGame.findUnique({
      where: { id: params.gameId },
      include: {
        players: {
          where: {
            player: {
              userId: currentUser.id,
            },
          },
        },
      },
    });

    if (!moneyGame) {
      return NextResponse.json(
        { error: "Money game not found" },
        { status: 404 }
      );
    }

    const currentPlayerInGame = moneyGame.players[0];

    if (!currentPlayerInGame) {
      return NextResponse.json(
        { error: "You are not part of this game" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      gameId: params.gameId,
      status: currentPlayerInGame.status,
      joinedAt: currentPlayerInGame.joinedAt,
      canRespond: moneyGame.status === MoneyGameStatus.WAITING_FOR_PLAYERS || 
                  moneyGame.status === MoneyGameStatus.READY_TO_START,
    });

  } catch (error) {
    console.error("Unexpected error getting player status:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}