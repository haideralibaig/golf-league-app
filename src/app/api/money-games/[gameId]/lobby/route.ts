import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Player count configurations for each game type
const GAME_TYPE_PLAYER_COUNTS = {
  TWO_VS_TWO_AUTO_PRESS: { required: 4 },
  INDIVIDUAL_STROKE_PLAY: { required: { min: 2, max: 8 } },
  TEAM_SCRAMBLE: { required: 4 },
  SKINS_GAME: { required: { min: 2, max: 8 } },
} as const;

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

    // Step 2: Await params to get route parameters
    const { gameId } = await params;

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

    // Step 3: Fetch the money game with all related data
    const moneyGame = await prisma.moneyGame.findUnique({
      where: { id: gameId },
      include: {
        course: {
          select: {
            name: true,
            location: true,
          },
        },
        creator: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            user: {
              select: {
                clerkId: true,
              },
            },
          },
        },
        players: {
          include: {
            player: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                user: {
                  select: {
                    clerkId: true,
                  },
                },
              },
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

    // Step 4: Check if current user is part of this game (as player or creator)
    const currentUserPlayer = await prisma.player.findFirst({
      where: {
        userId: currentUser.id,
        chapterId: moneyGame.chapterId,
      },
    });

    if (!currentUserPlayer) {
      return NextResponse.json(
        { error: "You are not a member of this chapter" },
        { status: 403 }
      );
    }

    // Find current user's game participation
    const currentUserInGame = moneyGame.players.find(
      (gamePlayer) => gamePlayer.player?.userId === currentUser.id
    );

    // Step 5: Calculate game readiness
    const acceptedPlayers = moneyGame.players.filter(p => p.status === "ACCEPTED");
    const gameConfig = GAME_TYPE_PLAYER_COUNTS[moneyGame.gameType];
    
    let canStart = false;
    let requiredPlayerCount = 0;
    
    if (typeof gameConfig.required === "number") {
      requiredPlayerCount = gameConfig.required;
      canStart = acceptedPlayers.length === gameConfig.required;
    } else {
      requiredPlayerCount = gameConfig.required.max;
      canStart = acceptedPlayers.length >= gameConfig.required.min;
    }

    // Step 6: Transform participants data
    const participants = moneyGame.players.map((gamePlayer) => {
      const isCurrentUser = gamePlayer.player?.userId === currentUser.id;
      const isCreator = gamePlayer.playerId === moneyGame.createdBy;
      
      return {
        id: gamePlayer.playerId,
        name: gamePlayer.guestName || gamePlayer.player?.displayName || "Unknown",
        avatar: gamePlayer.player?.avatarUrl,
        isGuest: !gamePlayer.playerId,
        status: gamePlayer.status,
        isOnline: false, // This will be updated by presence in real-time
        isCurrentUser,
        isCreator,
      };
    });

    // Step 7: Build response data
    const lobbyData = {
      game: {
        id: moneyGame.id,
        gameType: moneyGame.gameType,
        status: moneyGame.status,
        currency: moneyGame.currency,
        course: {
          name: moneyGame.course.name,
          location: moneyGame.course.location,
        },
        scheduledDate: moneyGame.scheduledDate,
        description: moneyGame.description,
        createdBy: {
          id: moneyGame.creator.id,
          name: moneyGame.creator.displayName,
          avatar: moneyGame.creator.avatarUrl,
        },
        createdAt: moneyGame.createdAt,
      },
      participants,
      canStart: canStart && moneyGame.status === "READY_TO_START",
      currentUserStatus: currentUserInGame?.status || null,
      isCreator: currentUserPlayer.id === moneyGame.createdBy,
      requiredPlayerCount,
    };

    return NextResponse.json(lobbyData);

  } catch (error) {
    console.error("Unexpected error fetching lobby data:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}