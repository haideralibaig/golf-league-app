import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's league (assuming they're admin of the first league)
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        players: {
          include: {
            chapter: {
              include: {
                league: true
              }
            }
          }
        }
      }
    });

    if (!user || user.players.length === 0) {
      return NextResponse.json({ error: 'User or league not found' }, { status: 404 });
    }

    const leagueId = user.players[0].chapter.league.id;

    // Create Lahore chapter
    const lahoreChapter = await prisma.chapter.create({
      data: {
        name: "Lahore",
        leagueId: leagueId,
        description: "Lahore chapter of the league"
      }
    });

    // Create Karachi chapter
    const karachiChapter = await prisma.chapter.create({
      data: {
        name: "Karachi", 
        leagueId: leagueId,
        description: "Karachi chapter of the league"
      }
    });

    // Create player memberships for the user in both new chapters
    await prisma.player.create({
      data: {
        userId: user.id,
        chapterId: lahoreChapter.id,
        role: "LEAGUE_ADMIN",
        displayName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`
          : user.email.split("@")[0]
      }
    });

    await prisma.player.create({
      data: {
        userId: user.id,
        chapterId: karachiChapter.id,
        role: "LEAGUE_ADMIN", 
        displayName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`
          : user.email.split("@")[0]
      }
    });

    return NextResponse.json({
      message: 'Chapters created successfully',
      chapters: [
        { id: lahoreChapter.id, name: 'Lahore' },
        { id: karachiChapter.id, name: 'Karachi' }
      ]
    });

  } catch (error) {
    console.error('Error creating chapters:', error);
    return NextResponse.json({ error: 'Failed to create chapters' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}