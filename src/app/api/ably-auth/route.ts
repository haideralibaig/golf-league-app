import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { getAblyServerClient, generateCapabilities } from "@/lib/ably";

const prisma = new PrismaClient();

export async function POST() {
  try {
    // Check authentication
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - must be authenticated" },
        { status: 401 }
      );
    }

    // Get user's league memberships to determine channel access
    const userLeagues = await prisma.player.findMany({
      where: {
        user: { clerkId: userId }
      },
      include: {
        chapter: {
          include: {
            league: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Extract unique league IDs
    const leagueIds = [...new Set(userLeagues.map(player => player.chapter.leagueId))];
    
    if (leagueIds.length === 0) {
      return NextResponse.json(
        { error: "User is not a member of any leagues" },
        { status: 403 }
      );
    }

    // Generate capabilities based on league memberships
    const capabilities = generateCapabilities(userId, leagueIds);
    
    // Create Ably token request
    const ablyClient = getAblyServerClient();
    const tokenRequestData = await ablyClient.auth.createTokenRequest({
      clientId: `user_${userId}`,
      capability: capabilities,
      ttl: 3600000, // 1 hour in milliseconds
    });

    console.log(`Generated Ably token for user ${userId} with access to ${leagueIds.length} league(s)`);

    return NextResponse.json({
      tokenRequest: tokenRequestData,
      leagues: userLeagues.map(player => ({
        leagueId: player.chapter.leagueId,
        leagueName: player.chapter.league.name,
        chapterId: player.chapterId,
        role: player.role
      }))
    });

  } catch (error) {
    console.error("Error generating Ably token:", error);
    
    if (error instanceof Error && error.message.includes('ABLY_API_KEY')) {
      return NextResponse.json(
        { error: "Ably configuration error" },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to generate authentication token" },
      { status: 500 }
    );
  }
}