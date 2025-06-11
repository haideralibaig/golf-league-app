"use client";

import { Bell, ChevronRight } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import ContextSwitcher from './ContextSwitcher';

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

interface HeaderProps {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    memberships: UserMembership[];
  };
  currentLeague?: {
    id: string;
    name: string;
    settings: any;
  };
  currentChapter?: {
    id: string;
    name: string;
    memberCount: number;
  };
  currentRole?: string;
}

export default function Header({
  user,
  currentLeague,
  currentChapter,
  currentRole
}: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Context Breadcrumb & Switcher */}
          <div className="flex items-center space-x-4">
            {/* Context Breadcrumb */}
            {currentLeague && currentChapter && (
              <div className="flex items-center text-sm text-gray-600">
                <span className="font-medium text-gray-900">
                  {currentLeague.name}
                </span>
                <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
                <span className="font-medium text-gray-700">
                  {currentChapter.name}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  ({currentChapter.memberCount} members)
                </span>
              </div>
            )}
            
            {/* Context Switcher */}
            <ContextSwitcher
              user={user}
              currentLeague={currentLeague}
              currentChapter={currentChapter}
            />
          </div>

          {/* Right side - Notifications & User Menu */}
          <div className="flex items-center space-x-4">
            {/* Role Badge */}
            {currentRole && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                currentRole === 'LEAGUE_ADMIN' 
                  ? 'bg-purple-100 text-purple-800'
                  : currentRole === 'CHAPTER_ADMIN'
                  ? 'bg-blue-100 text-blue-800'
                  : currentRole === 'TOURNAMENT_DIRECTOR'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {currentRole === 'LEAGUE_ADMIN' && 'League Admin'}
                {currentRole === 'CHAPTER_ADMIN' && 'Chapter Admin'}
                {currentRole === 'TOURNAMENT_DIRECTOR' && 'Tournament Director'}
                {currentRole === 'PLAYER' && 'Player'}
              </span>
            )}

            {/* Notifications */}
            <button className="relative p-2 text-gray-400 hover:text-gray-500 transition-colors">
              <Bell className="h-5 w-5" />
              {/* Notification dot - you can conditionally show this */}
              <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white" />
            </button>

            {/* User Menu */}
            <UserButton 
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8"
                }
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}