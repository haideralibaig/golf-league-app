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

    // Get user
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
      return NextResponse.json({ error: 'User has no league memberships' }, { status: 404 });
    }

    // Get the league from user's first membership
    const leagueId = user.players[0].chapter.league.id;

    // Get all chapters in this league
    const allChapters = await prisma.chapter.findMany({
      where: { leagueId: leagueId }
    });

    // Get chapters user is NOT already a member of
    const userChapterIds = user.players.map(p => p.chapter.id);
    const chaptersToJoin = allChapters.filter(chapter => !userChapterIds.includes(chapter.id));

    if (chaptersToJoin.length === 0) {
      return NextResponse.json({ 
        message: 'User is already a member of all chapters',
        currentChapters: user.players.map(p => p.chapter.name)
      });
    }

    // Add user to remaining chapters
    const newMemberships = [];
    for (const chapter of chaptersToJoin) {
      const player = await prisma.player.create({
        data: {
          userId: user.id,
          chapterId: chapter.id,
          role: "PLAYER", // Regular player role in additional chapters
          displayName: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}`
            : user.email.split("@")[0]
        }
      });

      newMemberships.push({
        chapterId: chapter.id,
        chapterName: chapter.name
      });
    }

    return NextResponse.json({
      message: 'Successfully joined additional chapters',
      newChapters: newMemberships,
      totalChapters: allChapters.length
    });

  } catch (error) {
    console.error('Error joining chapters:', error);
    return NextResponse.json({ error: 'Failed to join chapters' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}