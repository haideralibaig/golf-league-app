import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to import Prisma dynamically
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      // Get user from database
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

      await prisma.$disconnect();

      if (!user) {
        return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
      }

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        leagues: user.players.map(player => ({
          leagueId: player.chapter.league.id,
          leagueName: player.chapter.league.name,
          joinCode: player.chapter.league.joinCode,
          chapterId: player.chapter.id,
          chapterName: player.chapter.name,
          playerRole: player.role,
          playerDisplayName: player.displayName,
          joinedAt: player.joinedAt
        }))
      });
    } catch (prismaError: any) {
      return NextResponse.json({ 
        error: 'Prisma error', 
        details: prismaError.message,
        hint: 'Run: npx prisma generate'
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error fetching leagues:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}