"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Trophy, 
  Users, 
  DollarSign, 
  BarChart3, 
  MapPin,
  Settings,
  Building2,
  Calendar
} from 'lucide-react';

interface SidebarProps {
  currentRole?: string;
  leagueId: string;
  chapterId: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

export default function Sidebar({ currentRole, leagueId, chapterId }: SidebarProps) {
  const pathname = usePathname();

  const baseUrl = `/leagues/${leagueId}/chapters/${chapterId}`;
  const leagueUrl = `/leagues/${leagueId}`;

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: `${baseUrl}/dashboard`,
      icon: Home,
    },
    {
      label: 'My Rounds',
      href: `${baseUrl}/rounds`,
      icon: Calendar,
    },
    {
      label: 'Money Games',
      href: `${baseUrl}/money-games`,
      icon: DollarSign,
    },
    {
      label: 'Leaderboards',
      href: `${baseUrl}/leaderboards`,
      icon: BarChart3,
    },
    {
      label: 'Members',
      href: `${baseUrl}/members`,
      icon: Users,
    },
    {
      label: 'Tournaments',
      href: `${baseUrl}/tournaments`,
      icon: Trophy,
      roles: ['CHAPTER_ADMIN', 'TOURNAMENT_DIRECTOR', 'LEAGUE_ADMIN'],
    },
  ];

  const leagueNavItems: NavItem[] = [
    {
      label: 'All Chapters',
      href: `${leagueUrl}/chapters`,
      icon: Building2,
      roles: ['LEAGUE_ADMIN'],
    },
    {
      label: 'League Courses',
      href: `${leagueUrl}/courses`,
      icon: MapPin,
      roles: ['LEAGUE_ADMIN', 'CHAPTER_ADMIN'],
    },
    {
      label: 'League Settings',
      href: `${leagueUrl}/settings`,
      icon: Settings,
      roles: ['LEAGUE_ADMIN'],
    },
  ];

  const isActive = (href: string) => {
    return pathname === href;
  };

  const canAccessItem = (item: NavItem) => {
    if (!item.roles) return true;
    return currentRole && item.roles.includes(currentRole);
  };

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">The Bogey Club</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6">
        <div className="space-y-1">
          {/* Chapter Navigation */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Chapter
            </h3>
            {navItems.map((item) => {
              if (!canAccessItem(item)) return null;
              
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${active 
                      ? 'bg-gray-800 text-white' 
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <item.icon 
                    className={`mr-3 h-5 w-5 ${
                      active ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                    }`} 
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* League Navigation (for admins) */}
          {leagueNavItems.some(item => canAccessItem(item)) && (
            <div>
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                League Management
              </h3>
              {leagueNavItems.map((item) => {
                if (!canAccessItem(item)) return null;
                
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                      ${active 
                        ? 'bg-gray-800 text-white' 
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }
                    `}
                  >
                    <item.icon 
                      className={`mr-3 h-5 w-5 ${
                        active ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                      }`} 
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-gray-700">
        <div className="text-xs text-gray-400">
          {currentRole && (
            <div className="mb-2">
              Role: {currentRole.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
            </div>
          )}
          <div>Version 1.0.0</div>
        </div>
      </div>
    </div>
  );
}