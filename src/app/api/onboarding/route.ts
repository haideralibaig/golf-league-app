import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import * as z from "zod";

const prisma = new PrismaClient();

// Validation schema for the request body
const onboardingSchema = z.object({
  handicapIndex: z.number().min(0).max(54),
  homeClub: z.string().min(2).max(100).trim(),
  phoneNumber: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        // Basic phone validation - adjust regex as needed
        return /^[\+]?[\d\s\-\(\)]{10,}$/.test(val.trim());
      },
      {
        message: "Please enter a valid phone number.",
      }
    )
    .transform((val) => val?.trim() || undefined),
  leagueId: z.string().min(1),
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
    const validationResult = onboardingSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { handicapIndex, homeClub, phoneNumber, leagueId } = validationResult.data;

    // Step 3: Find user in database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    // Step 4: Verify league exists
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    // Step 5: Verify user is a player in this league
    const existingPlayer = await prisma.player.findUnique({
      where: {
        userId_leagueId: {
          userId: user.id,
          leagueId: leagueId,
        },
      },
    });

    if (!existingPlayer) {
      return NextResponse.json(
        { error: "You are not a member of this league" },
        { status: 403 }
      );
    }

    // Step 6: Check if already onboarded
    if (existingPlayer.status === "ONBOARDED" || existingPlayer.status === "ACTIVE") {
      return NextResponse.json(
        { error: "You have already completed onboarding for this league" },
        { status: 409 }
      );
    }

    // Step 7: Update User and Player records in database transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Update User model with global handicap and phone
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { 
            phoneNumber: phoneNumber,
            globalHandicapIndex: handicapIndex,
          },
        });

        // Update Player record for this specific league
        const updatedPlayer = await tx.player.update({
          where: { 
            userId_leagueId: { 
              userId: user.id, 
              leagueId: leagueId 
            }
          },
          data: { 
            handicapIndex: handicapIndex, // Copy from global
            homeClub: homeClub,
            status: "ONBOARDED", // Mark onboarding as complete
          },
        });

        return { user: updatedUser, player: updatedPlayer };
      });

      // Step 8: Return success response
      return NextResponse.json(
        { 
          message: "Onboarding completed successfully",
          redirectUrl: `/leagues/${leagueId}/dashboard`,
          globalHandicap: handicapIndex,
          leagueSpecificData: {
            leagueId: leagueId,
            handicapIndex: handicapIndex,
            homeClub: homeClub,
            status: "ONBOARDED"
          }
        },
        { status: 200 }
      );
    } catch (dbError) {
      console.error("Database operation failed:", dbError);
      return NextResponse.json(
        { error: "Failed to complete onboarding" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Unexpected error in onboarding:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}