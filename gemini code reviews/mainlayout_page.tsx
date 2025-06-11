import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient } from '@prisma/client';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';

const prisma = new PrismaClient();

interface DashboardPageProps {
  params: Promise<{
    leagueId: string;
    chapterId: string;
  }>;
}

interface UserMembership {
  id: string;
  role: string;
  league: {
    id: string;
    name: string;
  };
  chapter: {
    id: string;
    name: string;
  };
}

async function getLayoutData(userId: string, leagueId: string, chapterId: string) {
  // Fetch user with all memberships
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

  if (!user) {
    throw new Error('User not found in database');
  }

  // Transform memberships
  const memberships: UserMembership[] = user.players.map(player => ({
    id: player.id,
    role: player.role,
    league: {
      id: player.chapter.league.id,
      name: player.chapter.league.name,
    },
    chapter: {
      id: player.chapter.id,
      name: player.chapter.name,
    }
  }));

  // Find current membership
  const membership = memberships.find(
    m => m.league.id === leagueId && m.chapter.id === chapterId
  );

  if (!membership) {
    throw new Error('User does not have access to this league/chapter');
  }

  // Get chapter details
  const chapterDetails = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      _count: {
        select: { players: true }
      }
    }
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      memberships
    },
    currentLeague: {
      id: membership.league.id,
      name: membership.league.name,
      settings: {}
    },
    currentChapter: {
      id: membership.chapter.id,
      name: membership.chapter.name,
      memberCount: chapterDetails?._count.players || 0
    },
    currentRole: membership.role
  };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  const { leagueId, chapterId } = await params;

  try {
    const layoutData = await getLayoutData(userId, leagueId, chapterId);

    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar 
          currentRole={layoutData.currentRole}
          leagueId={leagueId}
          chapterId={chapterId}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header 
            user={layoutData.user}
            currentLeague={layoutData.currentLeague}
            currentChapter={layoutData.currentChapter}
            currentRole={layoutData.currentRole}
          />
          
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white">
            <div className="container mx-auto px-6 py-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-4">League Dashboard</h1>
                <p className="text-gray-600 mb-6">
                  This is the main dashboard for your league and chapter.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Recent Activity</h3>
                    <p className="text-gray-600">Your latest rounds and scores will appear here.</p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Upcoming Events</h3>
                    <p className="text-gray-600">Tournaments and money games will be listed here.</p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Chapter Stats</h3>
                    <p className="text-gray-600">Chapter leaderboard and statistics.</p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Dashboard error:', error);
    
    if (error instanceof Error && error.message === 'User not found in database') {
      redirect('/api/debug/sync-user');
    }
    
    redirect('/app');
  } finally {
    await prisma.$disconnect();
  }
}