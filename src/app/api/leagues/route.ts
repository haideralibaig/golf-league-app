import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import * as z from "zod";

const prisma = new PrismaClient();

// Validation schema for the request body
const createLeagueSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().max(500).optional(),
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
    const validationResult = createLeagueSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { name, description } = validationResult.data;

    // Step 3: Create Clerk Organization
    let clerkOrganization;
    try {
      const clerk = await clerkClient();
      clerkOrganization = await clerk.organizations.createOrganization({
        name,
        createdBy: userId,
      });
    } catch (clerkError: any) {
      console.error("Failed to create Clerk organization:", clerkError);
      return NextResponse.json(
        { error: "Failed to create organization" },
        { status: 500 }
      );
    }

    // Step 4: Create League, Chapter, and Player records in database transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get user from database
        const user = await tx.user.findUnique({
          where: { clerkId: userId },
        });

        if (!user) {
          throw new Error("User not found in database");
        }

        // Create League record
        const league = await tx.league.create({
          data: {
            name,
            description: description ?? null,
            settings: {
              clerkOrganizationId: clerkOrganization.id,
            },
          },
        });

        // Create default Chapter for the league
        const chapter = await tx.chapter.create({
          data: {
            name: "Main Chapter", // Default chapter name
            leagueId: league.id,
            description: "Default chapter for this league",
          },
        });

        // Create Player record for the league creator with LEAGUE_ADMIN role
        const player = await tx.player.create({
          data: {
            userId: user.id,
            chapterId: chapter.id,
            role: "LEAGUE_ADMIN",
            displayName: user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`
              : user.email.split("@")[0], // Fallback to email prefix
          },
        });

        // Initialize PlayerStatistics for the admin
        await tx.playerStatistics.create({
          data: {
            playerId: player.id,
          },
        });

        return { league, chapter };
      });

      // Step 5: Return success response
      return NextResponse.json(
        { 
          message: "League created successfully",
          leagueId: result.league.id,
          chapterId: result.chapter.id,
          joinCode: result.league.joinCode,
        },
        { status: 201 }
      );
    } catch (dbError) {
      // If database operation fails, attempt to clean up Clerk organization
      console.error("Database operation failed:", dbError);
      
      try {
        const clerk = await clerkClient();
        await clerk.organizations.deleteOrganization(clerkOrganization.id);
      } catch (cleanupError) {
        console.error("Failed to cleanup Clerk organization:", cleanupError);
      }

      return NextResponse.json(
        { error: "Failed to create league in database" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Unexpected error in league creation:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}