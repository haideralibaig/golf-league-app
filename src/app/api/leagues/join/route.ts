import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import * as z from "zod";

const prisma = new PrismaClient();

// Validation schema for the request body
const joinLeagueSchema = z.object({
  joinCode: z.string().min(1).transform((val) => val.trim()),
});

export async function POST(req: Request) {
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
    const validationResult = joinLeagueSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    const { joinCode } = validationResult.data;

    // Step 3: Find league by join code (case-insensitive) with chapters
    const league = await prisma.league.findFirst({
      where: { 
        joinCode: {
          equals: joinCode,
          mode: 'insensitive'
        }
      },
      include: {
        chapters: true
      }
    });

    if (!league) {
      return NextResponse.json(
        { error: "Invalid join code" },
        { status: 404 }
      );
    }

    // Get default chapter (first chapter or Main Chapter)
    const defaultChapter = league.chapters.find(c => c.name === "Main Chapter") || league.chapters[0];
    
    if (!defaultChapter) {
      return NextResponse.json(
        { error: "League has no available chapters" },
        { status: 500 }
      );
    }

    // Step 4: Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    // Step 5: Check if user is already a player in this chapter
    const existingPlayer = await prisma.player.findUnique({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId: defaultChapter.id,
        },
      },
    });

    if (existingPlayer) {
      return NextResponse.json(
        { error: "You are already a member of this chapter" },
        { status: 409 }
      );
    }

    // Step 6: Add user to Clerk Organization
    const clerkOrganizationId = league.settings?.clerkOrganizationId;
    
    if (!clerkOrganizationId) {
      return NextResponse.json(
        { error: "League configuration error" },
        { status: 500 }
      );
    }

    try {
      const clerk = await clerkClient();
      
      // Try to add user to the Clerk organization
      // If they're already a member, this will fail with a specific error
      try {
        await clerk.organizations.createOrganizationMembership({
          organizationId: clerkOrganizationId,
          userId,
          role: "org:member",
        });
      } catch (membershipError: any) {
        // Check if error is because user is already a member
        if (membershipError.errors?.[0]?.code === "already_a_member_in_organization") {
          // User is already in the org, that's fine - continue
        } else {
          throw membershipError;
        }
      }
    } catch (clerkError) {
      console.error("Failed to add user to Clerk organization:", clerkError);
      return NextResponse.json(
        { error: "Failed to join league organization" },
        { status: 500 }
      );
    }

    // Step 7: Create Player and PlayerStatistics records in database transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Create Player record
        const player = await tx.player.create({
          data: {
            userId: user.id,
            chapterId: defaultChapter.id,
            role: "PLAYER",
            displayName: user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`
              : user.email.split("@")[0], // Fallback to email prefix
          },
        });

        // Create PlayerStatistics record
        await tx.playerStatistics.create({
          data: {
            playerId: player.id,
          },
        });

        return player;
      });

      // Step 8: Return success response
      return NextResponse.json(
        { 
          message: "Successfully joined league",
          leagueId: league.id,
          chapterId: defaultChapter.id,
          leagueName: league.name,
          chapterName: defaultChapter.name,
          redirectUrl: `/leagues/${league.id}/chapters/${defaultChapter.id}/dashboard`,
        },
        { status: 201 }
      );
    } catch (dbError) {
      console.error("Database operation failed:", dbError);
      
      // Attempt to remove user from Clerk organization if DB operation failed
      try {
        const clerk = await clerkClient();
        await clerk.organizations.deleteOrganizationMembership({
          organizationId: clerkOrganizationId,
          userId,
        });
      } catch (cleanupError) {
        console.error("Failed to cleanup Clerk organization membership:", cleanupError);
      }

      return NextResponse.json(
        { error: "Failed to join league" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Unexpected error in join league:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}