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

      // Get all leagues
      const leagues = await prisma.league.findMany({
        include: {
          chapters: {
            include: {
              players: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      });

      // Get all users
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          clerkId: true,
          firstName: true,
          lastName: true
        }
      });

      await prisma.$disconnect();

      return NextResponse.json({
        totalLeagues: leagues.length,
        totalUsers: users.length,
        users: users,
        leagues: leagues.map(league => ({
          id: league.id,
          name: league.name,
          joinCode: league.joinCode,
          createdAt: league.createdAt,
          chapters: league.chapters.map(chapter => ({
            id: chapter.id,
            name: chapter.name,
            players: chapter.players.map(player => ({
              displayName: player.displayName,
              role: player.role,
              userEmail: player.user.email,
              userId: player.user.id
            }))
          }))
        }))
      });
    } catch (prismaError: any) {
      return NextResponse.json({ 
        error: 'Prisma error', 
        details: prismaError.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error fetching all leagues:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}