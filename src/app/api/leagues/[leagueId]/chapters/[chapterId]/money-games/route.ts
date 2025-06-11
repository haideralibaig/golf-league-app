import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient, GameType, Currency, PlayerInvitationStatus } from "@prisma/client";
import { getAblyServerClient } from "@/lib/ably";
import * as z from "zod";

const prisma = new PrismaClient();

// Player count configurations for each game type
const GAME_TYPE_PLAYER_COUNTS = {
  TWO_VS_TWO_AUTO_PRESS: { required: 4, others: 3 },
  INDIVIDUAL_STROKE_PLAY: { required: { min: 2, max: 8 }, others: { min: 1, max: 7 } },
  TEAM_SCRAMBLE: { required: 4, others: 3 },
  SKINS_GAME: { required: { min: 2, max: 8 }, others: { min: 1, max: 7 } },
} as const;

// Validation schema for creating a money game
const createMoneyGameSchema = z.object({
  gameType: z.nativeEnum(GameType),
  courseId: z.string().min(1, "Course is required"),
  currency: z.nativeEnum(Currency),
  scheduledDate: z.string().datetime().optional().nullable(),
  description: z.string().max(500).optional(),
  invitedPlayerIds: z.array(z.string()).min(0),
  guests: z.array(z.object({
    name: z.string().min(1, "Guest name is required").max(50),
    tempId: z.string(),
  })).min(0),
});

type CreateMoneyGameRequest = z.infer<typeof createMoneyGameSchema>;

export async function POST(
  req: Request,
  { params }: { params: { leagueId: string; chapterId: string } }
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
    const { leagueId, chapterId } = await params;

    // Step 3: Validate request body
    const body = await req.json();
    const validationResult = createMoneyGameSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { 
      gameType, 
      courseId, 
      currency, 
      scheduledDate, 
      description, 
      invitedPlayerIds, 
      guests 
    } = validationResult.data;

    // Step 3: Validate player count based on game type
    const totalOtherPlayers = invitedPlayerIds.length + guests.length;
    const gameConfig = GAME_TYPE_PLAYER_COUNTS[gameType];
    
    let isValidPlayerCount = false;
    if (typeof gameConfig.others === "number") {
      // Fixed player count games
      isValidPlayerCount = totalOtherPlayers === gameConfig.others;
    } else {
      // Variable player count games
      isValidPlayerCount = totalOtherPlayers >= gameConfig.others.min && 
                          totalOtherPlayers <= gameConfig.others.max;
    }

    if (!isValidPlayerCount) {
      const expectedCount = typeof gameConfig.others === "number" 
        ? `exactly ${gameConfig.others}`
        : `${gameConfig.others.min}-${gameConfig.others.max}`;
      
      return NextResponse.json(
        { error: `${gameType} requires ${expectedCount} other players. You selected ${totalOtherPlayers}.` },
        { status: 400 }
      );
    }

    // Step 4: Verify user is a player in this chapter
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const currentPlayer = await prisma.player.findUnique({
      where: {
        userId_chapterId: {
          userId: currentUser.id,
          chapterId: chapterId,
        },
      },
    });

    if (!currentPlayer) {
      return NextResponse.json(
        { error: "You are not a member of this chapter" },
        { status: 403 }
      );
    }

    // Step 5: Verify chapter belongs to the league
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        leagueId: leagueId,
      },
    });

    if (!chapter) {
      return NextResponse.json(
        { error: "Chapter not found or doesn't belong to this league" },
        { status: 404 }
      );
    }

    // Step 6: Verify course belongs to the league
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        leagueId: leagueId,
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found or doesn't belong to this league" },
        { status: 404 }
      );
    }

    // Step 7: Verify all invited players exist and belong to this chapter
    if (invitedPlayerIds.length > 0) {
      const invitedPlayers = await prisma.player.findMany({
        where: {
          id: { in: invitedPlayerIds },
          chapterId: chapterId,
        },
      });

      if (invitedPlayers.length !== invitedPlayerIds.length) {
        return NextResponse.json(
          { error: "One or more invited players not found in this chapter" },
          { status: 400 }
        );
      }

      // Check for duplicate invites (creator can't invite themselves)
      if (invitedPlayerIds.includes(currentPlayer.id)) {
        return NextResponse.json(
          { error: "You cannot invite yourself to a game" },
          { status: 400 }
        );
      }
    }

    // Step 8: Create the money game and all player records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the money game
      const moneyGame = await tx.moneyGame.create({
        data: {
          gameType,
          courseId,
          chapterId: chapterId,
          currency,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          description: description || null,
          createdBy: currentPlayer.id,
        },
      });

      // Create MoneyGamePlayer record for the creator (auto-accepted)
      await tx.moneyGamePlayer.create({
        data: {
          gameId: moneyGame.id,
          playerId: currentPlayer.id,
          status: PlayerInvitationStatus.ACCEPTED,
        },
      });

      // Create MoneyGamePlayer records for invited players (status: INVITED)
      if (invitedPlayerIds.length > 0) {
        await tx.moneyGamePlayer.createMany({
          data: invitedPlayerIds.map(playerId => ({
            gameId: moneyGame.id,
            playerId,
            status: PlayerInvitationStatus.INVITED,
          })),
        });
      }

      // Create MoneyGamePlayer records for guests (auto-accepted)
      if (guests.length > 0) {
        await tx.moneyGamePlayer.createMany({
          data: guests.map(guest => ({
            gameId: moneyGame.id,
            playerId: null,
            guestName: guest.name,
            status: PlayerInvitationStatus.ACCEPTED,
          })),
        });
      }

      return moneyGame;
    });

    // Step 9: Send real-time invitations to invited players via Ably
    if (invitedPlayerIds.length > 0) {
      try {
        const ablyClient = getAblyServerClient();
        
        // Get user IDs for the invited players to send notifications to their private channels
        const invitedPlayers = await prisma.player.findMany({
          where: {
            id: { in: invitedPlayerIds },
          },
          include: {
            user: true,
          },
        });

        // Send invitation notifications to each invited player's private channel
        const notificationPromises = invitedPlayers.map(async (player) => {
          const channel = ablyClient.channels.get(`private-user-${player.user.clerkId}`);
          
          await channel.publish("game-invitation", {
            gameId: result.id,
            gameType,
            courseName: course.name,
            creatorName: currentPlayer.displayName,
            scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null,
            currency,
            lobbyUrl: `/money-games/${result.id}/lobby`,
            invitedAt: new Date().toISOString(),
          });
        });

        // Wait for all notifications to be sent
        await Promise.all(notificationPromises);
        
        console.log(`Sent game invitations for game ${result.id} to ${invitedPlayerIds.length} players`);
      } catch (ablyError) {
        console.error("Failed to send real-time invitations:", ablyError);
        // Don't fail the entire request if notifications fail
        // The game was created successfully, notifications are a bonus
      }
    }

    // Step 10: Return success response
    return NextResponse.json(
      {
        message: "Money game created successfully",
        gameId: result.id,
        lobbyUrl: `/money-games/${result.id}/lobby`,
        playersInvited: invitedPlayerIds.length,
        guestsAdded: guests.length,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Unexpected error in money game creation:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// GET endpoint to list money games for a chapter
export async function GET(
  req: Request,
  { params }: { params: { leagueId: string; chapterId: string } }
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
    const { leagueId, chapterId } = await params;

    // Step 3: Verify user is a member of this chapter
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const currentPlayer = await prisma.player.findUnique({
      where: {
        userId_chapterId: {
          userId: currentUser.id,
          chapterId: chapterId,
        },
      },
    });

    if (!currentPlayer) {
      return NextResponse.json(
        { error: "You are not a member of this chapter" },
        { status: 403 }
      );
    }

    // Step 3: Get league's default currency
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { defaultCurrency: true },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    // Step 4: Fetch money games for this chapter
    const moneyGames = await prisma.moneyGame.findMany({
      where: {
        chapterId: chapterId,
      },
      include: {
        course: {
          select: {
            name: true,
            location: true,
          },
        },
        creator: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
        players: {
          include: {
            player: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: [
        { status: "asc" }, // Active games first
        { createdAt: "desc" }, // Most recent first
      ],
    });

    // Step 5: Transform and categorize games
    const activeGames: any[] = [];
    const completedGames: any[] = [];

    moneyGames.forEach((game) => {
      const gameData = {
        id: game.id,
        gameType: game.gameType,
        status: game.status,
        course: {
          name: game.course.name,
          location: game.course.location,
        },
        scheduledDate: game.scheduledDate,
        currency: game.currency,
        createdBy: {
          name: game.creator.displayName,
          avatar: game.creator.avatarUrl,
        },
        participants: game.players.map((participant) => ({
          id: participant.playerId,
          name: participant.guestName || participant.player?.displayName || "Unknown",
          avatar: participant.player?.avatarUrl,
          isGuest: !participant.playerId,
          status: participant.status,
        })),
        playerCount: {
          current: game.players.filter(p => p.status === "ACCEPTED").length,
          required: typeof GAME_TYPE_PLAYER_COUNTS[game.gameType].required === "number"
            ? GAME_TYPE_PLAYER_COUNTS[game.gameType].required
            : GAME_TYPE_PLAYER_COUNTS[game.gameType].required.max,
        },
        createdAt: game.createdAt,
      };

      if (game.status === "COMPLETED" || game.status === "CANCELLED") {
        completedGames.push(gameData);
      } else {
        activeGames.push(gameData);
      }
    });

    return NextResponse.json({
      activeGames,
      completedGames,
      leagueDefaultCurrency: league.defaultCurrency,
    });

  } catch (error) {
    console.error("Unexpected error fetching money games:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}