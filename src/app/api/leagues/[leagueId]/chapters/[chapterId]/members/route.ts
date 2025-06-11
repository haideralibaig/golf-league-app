import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

    // Step 4: Verify user is a member of this chapter
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

    // Step 6: Get all active members of this chapter
    const members = await prisma.player.findMany({
      where: {
        chapterId: chapterId,
        status: {
          in: ["ONBOARDED", "ACTIVE"], // Only include active members
        },
      },
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
      orderBy: {
        displayName: "asc",
      },
    });

    // Step 6: Transform the data for the frontend
    const transformedMembers = members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      avatar: member.avatarUrl,
      isOnline: false, // This would be determined by real-time presence if needed
    }));

    return NextResponse.json(transformedMembers);

  } catch (error) {
    console.error("Unexpected error fetching chapter members:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}