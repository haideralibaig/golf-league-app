import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import * as z from "zod";

const prisma = new PrismaClient();

// Validation schema for course update
const updateCourseSchema = z.object({
  name: z.string().min(1, "Course name is required").max(100).optional(),
  location: z.string().max(200).optional(),
  holeCount: z.number().int().min(1).max(72).optional(),
  localRules: z.string().max(5000).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  architect: z.string().max(100).optional(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  courseRecord: z.number().int().min(1).max(200).optional(),
  courseRecordHolder: z.string().max(100).optional(),
});

// Helper function to check if user is admin of the league
async function checkLeagueAdmin(userId: string, leagueId: string) {
  const player = await prisma.player.findFirst({
    where: {
      user: { clerkId: userId },
      chapter: { leagueId: leagueId },
      role: {
        in: ["LEAGUE_ADMIN", "CHAPTER_ADMIN"]
      }
    }
  });

  return player;
}

// Helper function to check if user is member of the league
async function checkLeagueMember(userId: string, leagueId: string) {
  const player = await prisma.player.findFirst({
    where: {
      user: { clerkId: userId },
      chapter: { leagueId: leagueId }
    }
  });

  return player;
}

// GET /api/leagues/[leagueId]/courses/[courseId]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ leagueId: string; courseId: string }> }
) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { leagueId, courseId } = await params;
    
    // Verify user is a member of this league
    const playerMembership = await checkLeagueMember(userId, leagueId);
    if (!playerMembership) {
      return NextResponse.json(
        { error: "Access denied. You are not a member of this league." },
        { status: 403 }
      );
    }

    // Fetch the course
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        league: {
          select: {
            id: true,
            name: true
          }
        },
        holes: true,
        teeSets: true
      }
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Verify the course belongs to the requested league (unless it's official)
    if (!course.isOfficial && course.leagueId !== leagueId) {
      return NextResponse.json(
        { error: "Course not found in this league" },
        { status: 404 }
      );
    }

    return NextResponse.json({ course });

  } catch (error) {
    console.error("Error fetching course:", error);
    return NextResponse.json(
      { error: "Failed to fetch course" },
      { status: 500 }
    );
  }
}

// PUT /api/leagues/[leagueId]/courses/[courseId]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ leagueId: string; courseId: string }> }
) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { leagueId, courseId } = await params;

    // Verify user is an admin of this league
    const adminMembership = await checkLeagueAdmin(userId, leagueId);
    if (!adminMembership) {
      return NextResponse.json(
        { error: "Access denied. You must be a league admin to update courses." },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = updateCourseSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid course data", 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const courseData = validationResult.data;

    // Verify the course exists and belongs to this league
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!existingCourse) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    if (existingCourse.leagueId !== leagueId) {
      return NextResponse.json(
        { error: "Course not found in this league" },
        { status: 404 }
      );
    }

    // Don't allow updating official courses
    if (existingCourse.isOfficial) {
      return NextResponse.json(
        { error: "Cannot modify official courses" },
        { status: 403 }
      );
    }

    // Update the course
    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: courseData,
      include: {
        league: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`Course "${updatedCourse.name}" updated successfully by user ${userId}`);

    return NextResponse.json({
      message: "Course updated successfully",
      course: updatedCourse
    });

  } catch (error) {
    console.error("Error updating course:", error);
    return NextResponse.json(
      { error: "Failed to update course" },
      { status: 500 }
    );
  }
}

// DELETE /api/leagues/[leagueId]/courses/[courseId]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ leagueId: string; courseId: string }> }
) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { leagueId, courseId } = await params;

    // Verify user is a LEAGUE_ADMIN (higher permission for deletion)
    const adminMembership = await prisma.player.findFirst({
      where: {
        user: { clerkId: userId },
        chapter: { leagueId: leagueId },
        role: "LEAGUE_ADMIN"
      }
    });

    if (!adminMembership) {
      return NextResponse.json(
        { error: "Access denied. Only league admins can delete courses." },
        { status: 403 }
      );
    }

    // Verify the course exists and belongs to this league
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!existingCourse) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    if (existingCourse.leagueId !== leagueId) {
      return NextResponse.json(
        { error: "Course not found in this league" },
        { status: 404 }
      );
    }

    // Don't allow deleting official courses
    if (existingCourse.isOfficial) {
      return NextResponse.json(
        { error: "Cannot delete official courses" },
        { status: 403 }
      );
    }

    // TODO: Check if course is being used in any tournaments or rounds
    // For now, we'll allow deletion but in production you'd want to check

    // Delete the course (cascade will handle related records)
    await prisma.course.delete({
      where: { id: courseId }
    });

    console.log(`Course "${existingCourse.name}" deleted by user ${userId}`);

    return NextResponse.json({
      message: "Course deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting course:", error);
    return NextResponse.json(
      { error: "Failed to delete course" },
      { status: 500 }
    );
  }
}