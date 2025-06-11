"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Building2, Users, Plus, ArrowLeft, Check } from 'lucide-react';

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

interface ContextSwitcherProps {
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
}

type DropdownState = 'closed' | 'leagues' | 'chapters';

export default function ContextSwitcher({
  user,
  currentLeague,
  currentChapter
}: ContextSwitcherProps) {
  const [dropdownState, setDropdownState] = useState<DropdownState>('closed');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownState('closed');
        setSelectedLeagueId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group memberships by league
  const leagueGroups = user.memberships.reduce((acc, membership) => {
    const leagueId = membership.league.id;
    if (!acc[leagueId]) {
      acc[leagueId] = {
        league: membership.league,
        chapters: []
      };
    }
    acc[leagueId].chapters.push({
      id: membership.chapter.id,
      name: membership.chapter.name,
      role: membership.role
    });
    return acc;
  }, {} as Record<string, { league: { id: string; name: string }; chapters: Array<{ id: string; name: string; role: string }> }>);

  const leagues = Object.values(leagueGroups);

  const handleLeagueSelect = (leagueId: string) => {
    const league = leagueGroups[leagueId];
    
    // If user only has one chapter in this league, navigate directly
    if (league.chapters.length === 1) {
      const chapter = league.chapters[0];
      router.push(`/leagues/${leagueId}/chapters/${chapter.id}/dashboard`);
      setDropdownState('closed');
      return;
    }

    // If it's the current league, show chapters immediately
    if (leagueId === currentLeague?.id) {
      setDropdownState('chapters');
      setSelectedLeagueId(leagueId);
      return;
    }

    // Otherwise, set the selected league and show chapters
    setSelectedLeagueId(leagueId);
    setDropdownState('chapters');
  };

  const handleChapterSelect = (chapterId: string) => {
    const leagueId = selectedLeagueId || currentLeague?.id;
    if (leagueId) {
      router.push(`/leagues/${leagueId}/chapters/${chapterId}/dashboard`);
    }
    setDropdownState('closed');
    setSelectedLeagueId(null);
  };

  const handleBackToLeagues = () => {
    setDropdownState('leagues');
    setSelectedLeagueId(null);
  };

  const selectedLeague = selectedLeagueId ? leagueGroups[selectedLeagueId] : null;
  const chaptersToShow = selectedLeague?.chapters || leagueGroups[currentLeague?.id || '']?.chapters || [];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setDropdownState(dropdownState === 'closed' ? 'leagues' : 'closed')}
        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
        <Building2 className="h-4 w-4 mr-2" />
        Switch Context
        <ChevronDown className="h-4 w-4 ml-2" />
      </button>

      {/* Dropdown Menu */}
      {dropdownState !== 'closed' && (
        <div className="absolute left-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="py-1">
            {/* League Selection View */}
            {dropdownState === 'leagues' && (
              <>
                <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  My Leagues
                </div>
                
                {leagues.map((leagueGroup) => (
                  <button
                    key={leagueGroup.league.id}
                    onClick={() => handleLeagueSelect(leagueGroup.league.id)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group"
                  >
                    <div className="flex items-center">
                      {currentLeague?.id === leagueGroup.league.id && (
                        <Check className="h-4 w-4 text-blue-600 mr-3" />
                      )}
                      <div className={currentLeague?.id === leagueGroup.league.id ? '' : 'ml-7'}>
                        <div className="text-sm font-medium text-gray-900">
                          {leagueGroup.league.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {leagueGroup.chapters.length} chapter{leagueGroup.chapters.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400 rotate-[-90deg]" />
                  </button>
                ))}

                <div className="border-t border-gray-100 mt-1">
                  <button
                    onClick={() => router.push('/leagues/new')}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center text-sm text-gray-700"
                  >
                    <Plus className="h-4 w-4 mr-3" />
                    Create New League
                  </button>
                  <button
                    onClick={() => router.push('/leagues/join')}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center text-sm text-gray-700"
                  >
                    <Users className="h-4 w-4 mr-3" />
                    Join a League
                  </button>
                </div>
              </>
            )}

            {/* Chapter Selection View */}
            {dropdownState === 'chapters' && (
              <>
                <div className="px-4 py-2 flex items-center border-b border-gray-100">
                  <button
                    onClick={handleBackToLeagues}
                    className="mr-3 p-1 hover:bg-gray-100 rounded"
                  >
                    <ArrowLeft className="h-4 w-4 text-gray-500" />
                  </button>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Select Chapter in
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {selectedLeague?.league.name || currentLeague?.name}
                    </div>
                  </div>
                </div>

                {chaptersToShow.map((chapter) => (
                  <button
                    key={chapter.id}
                    onClick={() => handleChapterSelect(chapter.id)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      {currentChapter?.id === chapter.id && (
                        <Check className="h-4 w-4 text-blue-600 mr-3" />
                      )}
                      <div className={currentChapter?.id === chapter.id ? '' : 'ml-7'}>
                        <div className="text-sm font-medium text-gray-900">
                          {chapter.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {chapter.role === 'LEAGUE_ADMIN' && 'League Admin'}
                          {chapter.role === 'CHAPTER_ADMIN' && 'Chapter Admin'}
                          {chapter.role === 'TOURNAMENT_DIRECTOR' && 'Tournament Director'}
                          {chapter.role === 'PLAYER' && 'Player'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                <div className="border-t border-gray-100 mt-1">
                  <button
                    onClick={() => {
                      const leagueId = selectedLeague?.league.id || currentLeague?.id;
                      router.push(`/leagues/${leagueId}/chapters/join`);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center text-sm text-gray-700"
                  >
                    <Plus className="h-4 w-4 mr-3" />
                    Join Different Chapter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}