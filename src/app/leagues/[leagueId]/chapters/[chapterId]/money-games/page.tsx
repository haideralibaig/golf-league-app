"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateGameDialog } from "@/components/money-games/create-game-dialog";
import { CalendarDays, Users, MapPin, DollarSign } from "lucide-react";

// Types
interface MoneyGameSummary {
  id: string;
  gameType: string;
  status: "WAITING_FOR_PLAYERS" | "READY_TO_START" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  course: { name: string; location?: string };
  scheduledDate?: Date;
  currency: string;
  createdBy: { name: string; avatar?: string };
  participants: Array<{
    id?: string;
    name: string;
    avatar?: string;
    isGuest: boolean;
    status: "INVITED" | "ACCEPTED" | "DECLINED";
  }>;
  playerCount: { current: number; required: number };
  createdAt: Date;
}

interface MoneyGameListData {
  activeGames: MoneyGameSummary[];
  completedGames: MoneyGameSummary[];
  leagueDefaultCurrency: string;
}

// Game status configurations
const STATUS_CONFIG = {
  WAITING_FOR_PLAYERS: { label: "Waiting", variant: "secondary" as const, color: "text-yellow-600" },
  READY_TO_START: { label: "Ready", variant: "default" as const, color: "text-green-600" },
  IN_PROGRESS: { label: "Active", variant: "default" as const, color: "text-blue-600" },
  COMPLETED: { label: "Completed", variant: "outline" as const, color: "text-gray-600" },
  CANCELLED: { label: "Cancelled", variant: "destructive" as const, color: "text-red-600" },
};

// Game type display names
const GAME_TYPE_NAMES: Record<string, string> = {
  TWO_VS_TWO_AUTO_PRESS: "2v2 Auto-Press",
  INDIVIDUAL_STROKE_PLAY: "Individual Stroke Play",
  TEAM_SCRAMBLE: "Team Scramble",
  SKINS_GAME: "Skins Game",
};

// Currency symbols
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
};

function GameCard({ game }: { game: MoneyGameSummary }) {
  const statusConfig = STATUS_CONFIG[game.status];
  const gameTypeName = GAME_TYPE_NAMES[game.gameType] || game.gameType;
  const currencySymbol = CURRENCY_SYMBOLS[game.currency] || game.currency;
  
  const acceptedPlayers = game.participants.filter(p => p.status === "ACCEPTED");
  const allPlayersAccepted = acceptedPlayers.length === game.playerCount.required;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{gameTypeName}</h3>
            <Badge variant={statusConfig.variant} className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-sm font-medium">
            <DollarSign className="h-4 w-4" />
            {currencySymbol}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Course Information */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{game.course.name}</span>
          {game.course.location && (
            <span className="text-xs">• {game.course.location}</span>
          )}
        </div>

        {/* Schedule Information */}
        {game.scheduledDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>
              {new Date(game.scheduledDate).toLocaleDateString()} at{" "}
              {new Date(game.scheduledDate).toLocaleTimeString([], { 
                hour: "2-digit", 
                minute: "2-digit" 
              })}
            </span>
          </div>
        )}

        {/* Players Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            <span>
              {acceptedPlayers.length} / {game.playerCount.required} players
            </span>
            {allPlayersAccepted && game.status === "READY_TO_START" && (
              <Badge variant="outline" className="text-green-600">
                Ready!
              </Badge>
            )}
          </div>

          {/* Player Avatars */}
          <div className="flex items-center gap-2">
            {game.participants.slice(0, 4).map((participant, index) => (
              <div key={participant.id || index} className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={participant.avatar} />
                  <AvatarFallback className="text-xs">
                    {participant.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {participant.isGuest && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 border border-white rounded-full" 
                       title="Guest player" />
                )}
                {participant.status === "DECLINED" && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 border border-white rounded-full" 
                       title="Declined" />
                )}
                {participant.status === "ACCEPTED" && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 border border-white rounded-full" 
                       title="Accepted" />
                )}
              </div>
            ))}
            {game.participants.length > 4 && (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                +{game.participants.length - 4}
              </div>
            )}
          </div>
        </div>

        {/* Creator Info */}
        <div className="text-xs text-muted-foreground">
          Created by {game.createdBy.name} • {new Date(game.createdAt).toLocaleDateString()}
        </div>
      </CardContent>

      <CardFooter className="pt-3">
        <div className="flex gap-2 w-full">
          {game.status === "WAITING_FOR_PLAYERS" || game.status === "READY_TO_START" ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => window.location.href = `/money-games/${game.id}/lobby`}
              >
                View Lobby
              </Button>
              {game.status === "READY_TO_START" && (
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => window.location.href = `/money-games/${game.id}/lobby`}
                >
                  Start Game
                </Button>
              )}
            </>
          ) : game.status === "IN_PROGRESS" ? (
            <Button 
              variant="default" 
              size="sm" 
              className="w-full"
              onClick={() => window.location.href = `/money-games/${game.id}`}
            >
              Resume Game
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => window.location.href = `/money-games/${game.id}`}
            >
              View Results
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

function GameCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-5 w-8" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-3 w-56" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-8 w-full" />
      </CardFooter>
    </Card>
  );
}

export default function MoneyGamesPage({ 
  params 
}: { 
  params: { leagueId: string; chapterId: string } 
}) {
  const [data, setData] = useState<MoneyGameListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    async function fetchGames() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/leagues/${params.leagueId}/chapters/${params.chapterId}/money-games`
        );
        
        if (!response.ok) {
          throw new Error("Failed to fetch money games");
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchGames();
  }, [params.leagueId, params.chapterId]);

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active Games</TabsTrigger>
            <TabsTrigger value="completed">Completed Games</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <GameCardSkeleton key={i} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Money Games</h1>
          <p className="text-muted-foreground">
            Manage your chapter's money games and tournaments
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          Start New Game
        </Button>
      </div>

      {/* Games List */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Active Games ({data.activeGames.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed Games ({data.completedGames.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {data.activeGames.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">No active games</h3>
                  <p className="text-muted-foreground">
                    Start a new money game to get your chapter playing!
                  </p>
                </div>
                <Button onClick={() => setShowCreateDialog(true)}>
                  Start New Game
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.activeGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {data.completedGames.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <CalendarDays className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">No completed games</h3>
                  <p className="text-muted-foreground">
                    Your completed money games will appear here.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.completedGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Game Dialog */}
      <CreateGameDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        leagueId={params.leagueId}
        chapterId={params.chapterId}
        defaultCurrency={data.leagueDefaultCurrency}
        onGameCreated={() => {
          setShowCreateDialog(false);
          // Refresh the games list
          window.location.reload();
        }}
      />
    </div>
  );
}