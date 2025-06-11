import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function AppPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  let user;
  try {
    user = await prisma.user.findUnique({
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
  } catch (error) {
    console.error('Database error in app page:', error);
    redirect('/');
  } finally {
    await prisma.$disconnect();
  }

  if (!user) {
    redirect('/api/debug/sync-user');
  }

  if (user.players.length === 0) {
    redirect('/onboarding');
  }

  // Redirect to first league/chapter
  const firstMembership = user.players[0];
  redirect(`/leagues/${firstMembership.chapter.league.id}/chapters/${firstMembership.chapter.id}/dashboard`);
}