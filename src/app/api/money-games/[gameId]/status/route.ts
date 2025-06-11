import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient, MoneyGameStatus } from "@prisma/client";
import { getAblyServerClient } from "@/lib/ably";
import * as z from "zod";

const prisma = new PrismaClient();

// Validation schema for game status update
const gameStatusSchema = z.object({
  status: z.nativeEnum(MoneyGameStatus),
});

type GameStatusRequest = z.infer<typeof gameStatusSchema>;

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

    // Step 2: Await params to get route parameters
    const { gameId } = await params;

    // Step 3: Validate request body
    const body = await req.json();
    const validationResult = gameStatusSchema.safeParse(body);
    
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

    // Step 4: Find the money game and verify permissions
    const moneyGame = await prisma.moneyGame.findUnique({
      where: { id: gameId },
      include: {
        creator: {
          include: {
            user: true,
          },
        },
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

    // Step 5: Verify user is the creator of the game
    if (moneyGame.creator.user.clerkId !== userId) {
      return NextResponse.json(
        { error: "Only the game creator can update the game status" },
        { status: 403 }
      );
    }

    // Step 6: Validate status transition
    const currentStatus = moneyGame.status;
    const newStatus = status;

    // Define valid status transitions
    const validTransitions: Record<MoneyGameStatus, MoneyGameStatus[]> = {
      WAITING_FOR_PLAYERS: [MoneyGameStatus.CANCELLED],
      READY_TO_START: [MoneyGameStatus.IN_PROGRESS, MoneyGameStatus.CANCELLED],
      IN_PROGRESS: [MoneyGameStatus.COMPLETED, MoneyGameStatus.CANCELLED],
      COMPLETED: [], // Terminal state
      CANCELLED: [], // Terminal state
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${currentStatus} to ${newStatus}` },
        { status: 400 }
      );
    }

    // Step 7: Additional validation for starting a game
    if (newStatus === MoneyGameStatus.IN_PROGRESS) {
      // Check if all required players have accepted
      const acceptedPlayers = moneyGame.players.filter(p => p.status === "ACCEPTED");
      
      // For fixed player count games, all must be accepted
      // For variable player count games, at least minimum must be accepted
      const gameTypeRequirements = {
        TWO_VS_TWO_AUTO_PRESS: 4,
        TEAM_SCRAMBLE: 4,
        INDIVIDUAL_STROKE_PLAY: { min: 2 },
        SKINS_GAME: { min: 2 },
      };

      const requirement = gameTypeRequirements[moneyGame.gameType];
      let hasEnoughPlayers = false;

      if (typeof requirement === "number") {
        hasEnoughPlayers = acceptedPlayers.length === requirement;
      } else {
        hasEnoughPlayers = acceptedPlayers.length >= requirement.min;
      }

      if (!hasEnoughPlayers) {
        return NextResponse.json(
          { error: "Cannot start game: not all required players have accepted" },
          { status: 400 }
        );
      }
    }

    // Step 8: Update the game status
    const updatedGame = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date(),
      };

      // Set timestamps for certain status changes
      if (newStatus === MoneyGameStatus.IN_PROGRESS) {
        updateData.startedAt = new Date();
      } else if (newStatus === MoneyGameStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }

      return await tx.moneyGame.update({
        where: { id: gameId },
        data: updateData,
      });
    });

    // Step 9: Publish real-time update to the lobby channel
    try {
      const ablyClient = getAblyServerClient();
      const lobbyChannel = ablyClient.channels.get(`game-${gameId}-lobby`);
      
      await lobbyChannel.publish("game-status-change", {
        gameId: gameId,
        status: newStatus,
        previousStatus: currentStatus,
        updatedBy: moneyGame.creator.displayName,
        updatedAt: new Date().toISOString(),
        startedAt: updatedGame.startedAt?.toISOString(),
        completedAt: updatedGame.completedAt?.toISOString(),
      });

      console.log(`Published game status change for game ${gameId}: ${currentStatus} -> ${newStatus}`);
    } catch (ablyError) {
      console.error("Failed to publish game status update:", ablyError);
      // Don't fail the request if real-time update fails
    }

    // Step 10: Send notifications to all participants if game is starting or being cancelled
    if (newStatus === MoneyGameStatus.IN_PROGRESS || newStatus === MoneyGameStatus.CANCELLED) {
      try {
        const ablyClient = getAblyServerClient();
        
        // Get all registered players (not guests) to send notifications
        const registeredPlayers = moneyGame.players.filter(p => p.playerId && p.player);
        
        const notificationPromises = registeredPlayers.map(async (gamePlayer) => {
          if (!gamePlayer.player?.user?.clerkId) return;
          
          const channel = ablyClient.channels.get(`private-user-${gamePlayer.player.user.clerkId}`);
          
          const eventType = newStatus === MoneyGameStatus.IN_PROGRESS ? "game-started" : "game-cancelled";
          
          await channel.publish(eventType, {
            gameId: gameId,
            gameType: moneyGame.gameType,
            courseName: "Course", // Would need to include course in query
            status: newStatus,
            message: newStatus === MoneyGameStatus.IN_PROGRESS 
              ? "Your money game has started!"
              : "Your money game has been cancelled.",
            updatedAt: new Date().toISOString(),
          });
        });

        await Promise.all(notificationPromises);
        
        console.log(`Sent ${newStatus} notifications for game ${gameId} to ${registeredPlayers.length} players`);
      } catch (ablyError) {
        console.error("Failed to send game notifications:", ablyError);
      }
    }

    // Step 11: Return success response
    return NextResponse.json(
      {
        message: `Game status updated to ${newStatus}`,
        gameId: gameId,
        status: newStatus,
        previousStatus: currentStatus,
        startedAt: updatedGame.startedAt,
        completedAt: updatedGame.completedAt,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Unexpected error updating game status:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}