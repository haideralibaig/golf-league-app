import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import * as z from "zod";

const prisma = new PrismaClient();

// Validation schema for course creation
const createCourseSchema = z.object({
  name: z.string().min(1, "Course name is required").max(100),
  location: z.string().max(200).optional(),
  holeCount: z.number().int().min(1).max(72).default(18),
  localRules: z.string().max(5000).optional(), // Increased from 2000 to 5000
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  architect: z.string().max(100).optional(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  courseRecord: z.number().int().min(1).max(200).optional(),
  courseRecordHolder: z.string().max(100).optional(),
  isOfficial: z.boolean().default(false),
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
    },
    include: {
      chapter: {
        include: {
          league: true
        }
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
    },
    include: {
      chapter: {
        include: {
          league: true
        }
      }
    }
  });

  return player;
}

// GET /api/leagues/[leagueId]/courses
export async function GET(
  req: Request,
  { params }: { params: { leagueId: string } }
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

    const { leagueId } = await params;
    
    // Verify user is a member of this league
    const playerMembership = await checkLeagueMember(userId, leagueId);
    if (!playerMembership) {
      return NextResponse.json(
        { error: "Access denied. You are not a member of this league." },
        { status: 403 }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'all'; // 'official', 'custom', or 'all'
    const search = url.searchParams.get('search') || '';
    const holeCountParam = url.searchParams.get('holeCount');
    const holeCount = holeCountParam ? parseInt(holeCountParam) : undefined;

    // Build where clause based on type filter
    let whereClause: any = {};
    
    if (type === 'official') {
      whereClause.isOfficial = true;
    } else if (type === 'custom') {
      whereClause = {
        leagueId: leagueId,
        isOfficial: false
      };
    } else {
      // 'all' - return both official courses and league-specific courses
      whereClause = {
        OR: [
          { isOfficial: true },
          { leagueId: leagueId, isOfficial: false }
        ]
      };
    }

    // Add search filter if provided
    if (search) {
      const searchFilter = {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { location: { contains: search, mode: 'insensitive' as const } }
        ]
      };
      
      if (whereClause.OR) {
        // If we already have an OR clause, wrap both in AND
        whereClause = {
          AND: [whereClause, searchFilter]
        };
      } else {
        // Add search to existing where clause
        whereClause = {
          ...whereClause,
          ...searchFilter
        };
      }
    }

    // Add hole count filter if provided
    if (holeCount) {
      whereClause.holeCount = holeCount;
    }

    // Fetch courses
    const courses = await prisma.course.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        location: true,
        holeCount: true,
        architect: true,
        yearBuilt: true,
        courseRecord: true,
        courseRecordHolder: true,
        isOfficial: true,
        localRules: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        updatedAt: true,
        // Only include leagueId for non-official courses
        leagueId: true,
      },
      orderBy: [
        { isOfficial: 'desc' }, // Official courses first
        { name: 'asc' }
      ]
    });

    // Transform courses to match UI expectations
    const transformedCourses = courses.map(course => ({
      id: course.id,
      name: course.name,
      location: course.location,
    }));

    return NextResponse.json(transformedCourses);

  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}

// POST /api/leagues/[leagueId]/courses
export async function POST(
  req: Request,
  { params }: { params: { leagueId: string } }
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

    const { leagueId } = await params;

    // Verify user is an admin of this league
    const adminMembership = await checkLeagueAdmin(userId, leagueId);
    if (!adminMembership) {
      return NextResponse.json(
        { error: "Access denied. You must be a league admin to create courses." },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = createCourseSchema.safeParse(body);
    
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

    // Ensure non-official courses are created for the specific league
    if (!courseData.isOfficial) {
      courseData.isOfficial = false; // Force to false for league courses
    }

    // Check if course name already exists in this league (for non-official courses)
    if (!courseData.isOfficial) {
      const existingCourse = await prisma.course.findFirst({
        where: {
          leagueId: leagueId,
          name: courseData.name,
          isOfficial: false
        }
      });

      if (existingCourse) {
        return NextResponse.json(
          { error: "A course with this name already exists in your league" },
          { status: 409 }
        );
      }
    }

    // Create the course
    const newCourse = await prisma.course.create({
      data: {
        ...courseData,
        leagueId: leagueId,
        isOfficial: courseData.isOfficial || false,
      },
      include: {
        league: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`Course "${newCourse.name}" created successfully for league ${leagueId} by user ${userId}`);

    return NextResponse.json(
      {
        message: "Course created successfully",
        course: newCourse
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error creating course:", error);
    
    // Handle specific Prisma errors
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: "A course with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create course" },
      { status: 500 }
    );
  }
}