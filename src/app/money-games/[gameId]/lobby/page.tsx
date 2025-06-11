"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAblyChannel } from "@/hooks/use-ably-channel";
import {
  CalendarDays,
  Users,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
  UserX,
  Loader2,
  AlertCircle,
  Crown,
  Wifi,
  WifiOff,
} from "lucide-react";
import Ably from "ably";

// Types
interface GameLobbyData {
  game: {
    id: string;
    gameType: string;
    status: "WAITING_FOR_PLAYERS" | "READY_TO_START" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    currency: string;
    course: { name: string; location?: string };
    scheduledDate?: Date;
    description?: string;
    createdBy: { id: string; name: string; avatar?: string };
    createdAt: Date;
  };
  participants: Array<{
    id?: string;
    name: string;
    avatar?: string;
    isGuest: boolean;
    status: "INVITED" | "ACCEPTED" | "DECLINED";
    isOnline: boolean;
    isCurrentUser: boolean;
    isCreator: boolean;
  }>;
  canStart: boolean;
  currentUserStatus: "INVITED" | "ACCEPTED" | "DECLINED";
  isCreator: boolean;
  requiredPlayerCount: number;
}

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

// Status configurations
const STATUS_CONFIG = {
  INVITED: { 
    label: "Invited", 
    variant: "secondary" as const, 
    icon: Clock,
    color: "text-yellow-600"
  },
  ACCEPTED: { 
    label: "Accepted", 
    variant: "default" as const, 
    icon: CheckCircle,
    color: "text-green-600"
  },
  DECLINED: { 
    label: "Declined", 
    variant: "destructive" as const, 
    icon: XCircle,
    color: "text-red-600"
  },
};

function ParticipantCard({ participant }: { participant: GameLobbyData["participants"][0] }) {
  const statusConfig = STATUS_CONFIG[participant.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={cn(
      "transition-all duration-200",
      participant.status === "ACCEPTED" && "border-green-200 bg-green-50/50",
      participant.status === "DECLINED" && "border-red-200 bg-red-50/50"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Avatar with online status */}
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={participant.avatar} />
              <AvatarFallback className={participant.isGuest ? "bg-blue-100 text-blue-600" : ""}>
                {participant.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            {/* Online/Offline indicator for registered users */}
            {!participant.isGuest && (
              <div className="absolute -bottom-1 -right-1">
                {participant.isOnline ? (
                  <Wifi className="h-4 w-4 text-green-500 bg-white rounded-full p-0.5" />
                ) : (
                  <WifiOff className="h-4 w-4 text-gray-400 bg-white rounded-full p-0.5" />
                )}
              </div>
            )}

            {/* Guest indicator */}
            {participant.isGuest && (
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">G</span>
              </div>
            )}

            {/* Creator indicator */}
            {participant.isCreator && (
              <div className="absolute -top-1 -left-1 h-4 w-4 bg-yellow-500 border-2 border-white rounded-full flex items-center justify-center">
                <Crown className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>

          {/* Player info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{participant.name}</p>
              {participant.isCurrentUser && (
                <Badge variant="outline" className="text-xs">You</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                variant={statusConfig.variant} 
                className={cn("text-xs", statusConfig.color)}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
              
              {participant.isGuest && (
                <Badge variant="outline" className="text-xs text-blue-600">
                  Guest
                </Badge>
              )}
              
              {participant.isCreator && (
                <Badge variant="outline" className="text-xs text-yellow-600">
                  Creator
                </Badge>
              )}
              
              {!participant.isGuest && !participant.isOnline && (
                <span className="text-xs text-muted-foreground">Offline</span>
              )}
            </div>
          </div>

          {/* Status icon */}
          <div className={cn("flex-shrink-0", statusConfig.color)}>
            <StatusIcon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LobbyPageSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-32" />
      </div>
      
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-20" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function GameLobbyPage({ params }: { params: { gameId: string } }) {
  const [data, setData] = useState<GameLobbyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Real-time channel setup
  const { publish, presence, isChannelAttached } = useAblyChannel({
    channelName: `game-${params.gameId}-lobby`,
    onMessage: useCallback((message: Ably.Message) => {
      console.log("Lobby message received:", message);
      
      switch (message.name) {
        case "player-response":
          handlePlayerResponseUpdate(message.data);
          break;
        case "game-status-change":
          handleGameStatusUpdate(message.data);
          break;
        case "lobby-update":
          fetchLobbyData();
          break;
        default:
          console.log("Unknown message type:", message.name);
      }
    }, []),
    onPresence: useCallback((presence: Ably.PresenceMessage) => {
      console.log("Presence update:", presence);
      // Update online status for participants
      if (data) {
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: prev.participants.map(p => 
              p.id === presence.clientId 
                ? { ...p, isOnline: presence.action === "enter" || presence.action === "update" }
                : p
            )
          };
        });
      }
    }, [data]),
  });

  // Fetch lobby data
  async function fetchLobbyData() {
    try {
      setLoading(true);
      const response = await fetch(`/api/money-games/${params.gameId}/lobby`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch lobby data");
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  // Handle real-time updates
  function handlePlayerResponseUpdate(updateData: any) {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.id === updateData.playerId
            ? { ...p, status: updateData.status }
            : p
        ),
        canStart: updateData.canStart,
      };
    });
  }

  function handleGameStatusUpdate(updateData: any) {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        game: {
          ...prev.game,
          status: updateData.status,
        },
      };
    });
  }

  // Actions
  async function handlePlayerResponse(status: "ACCEPTED" | "DECLINED") {
    if (!data || !data.currentUserStatus) return;

    setActionLoading(status);
    try {
      const response = await fetch(
        `/api/money-games/${params.gameId}/players/me`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      // Update local state immediately
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentUserStatus: status,
          participants: prev.participants.map(p =>
            p.isCurrentUser ? { ...p, status } : p
          ),
        };
      });

      // Broadcast update
      if (isChannelAttached) {
        await publish("player-response", { 
          playerId: "current-user", 
          status,
          gameId: params.gameId 
        });
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStartGame() {
    if (!data || !data.canStart) return;

    setActionLoading("start");
    try {
      const response = await fetch(
        `/api/money-games/${params.gameId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "IN_PROGRESS" }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to start game");
      }

      // Broadcast game start
      if (isChannelAttached) {
        await publish("game-status-change", { 
          status: "IN_PROGRESS",
          gameId: params.gameId 
        });
      }

      // Navigate to game
      window.location.href = `/money-games/${params.gameId}`;
    } catch (err) {
      console.error("Failed to start game:", err);
      alert("Failed to start game. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelGame() {
    if (!data || !data.isCreator) return;

    if (!confirm("Are you sure you want to cancel this game?")) return;

    setActionLoading("cancel");
    try {
      const response = await fetch(
        `/api/money-games/${params.gameId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to cancel game");
      }

      // Broadcast cancellation
      if (isChannelAttached) {
        await publish("game-status-change", { 
          status: "CANCELLED",
          gameId: params.gameId 
        });
      }

      // Navigate back to games list
      window.location.href = `/leagues/${data.game.createdBy.id}/chapters/chapter-id/money-games`;
    } catch (err) {
      console.error("Failed to cancel game:", err);
      alert("Failed to cancel game. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // Enter presence when component mounts
  useEffect(() => {
    if (isChannelAttached && data) {
      presence.enter({
        userId: data.currentUserStatus ? "current-user" : "anonymous",
        name: "Current User",
      });
    }

    return () => {
      if (isChannelAttached) {
        presence.leave();
      }
    };
  }, [isChannelAttached, data, presence]);

  // Initial data fetch
  useEffect(() => {
    fetchLobbyData();
  }, [params.gameId]);

  if (loading) {
    return <LobbyPageSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={fetchLobbyData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const gameTypeName = GAME_TYPE_NAMES[data.game.gameType] || data.game.gameType;
  const currencySymbol = CURRENCY_SYMBOLS[data.game.currency] || data.game.currency;
  const acceptedCount = data.participants.filter(p => p.status === "ACCEPTED").length;
  const readinessProgress = (acceptedCount / data.requiredPlayerCount) * 100;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Game Lobby</h1>
        <Badge variant="outline" className="ml-auto">
          {gameTypeName}
        </Badge>
      </div>

      {/* Game Status Alert */}
      {data.game.status === "CANCELLED" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            This game has been cancelled by the creator.
          </AlertDescription>
        </Alert>
      )}

      {data.game.status === "READY_TO_START" && data.isCreator && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            All players have accepted! You can now start the game.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Game Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Game Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Format</Label>
                  <p className="font-medium">{gameTypeName}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Currency</Label>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">{currencySymbol}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Course</Label>
                <p className="font-medium">{data.game.course.name}</p>
                {data.game.course.location && (
                  <p className="text-sm text-muted-foreground">{data.game.course.location}</p>
                )}
              </div>

              {data.game.scheduledDate ? (
                <div>
                  <Label className="text-sm text-muted-foreground">Scheduled</Label>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span className="font-medium">
                      {new Date(data.game.scheduledDate).toLocaleDateString()} at{" "}
                      {new Date(data.game.scheduledDate).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-sm text-muted-foreground">Start Time</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Play Now</span>
                  </div>
                </div>
              )}

              {data.game.description && (
                <div>
                  <Label className="text-sm text-muted-foreground">Description</Label>
                  <p className="font-medium">{data.game.description}</p>
                </div>
              )}

              <div>
                <Label className="text-sm text-muted-foreground">Created by</Label>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={data.game.createdBy.avatar} />
                    <AvatarFallback>
                      {data.game.createdBy.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{data.game.createdBy.name}</span>
                  <span className="text-sm text-muted-foreground">
                    • {new Date(data.game.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Players Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Players ({acceptedCount} / {data.requiredPlayerCount})
                </div>
                <div className="text-sm text-muted-foreground">
                  {data.canStart ? "Ready to start!" : "Waiting for responses..."}
                </div>
              </CardTitle>
              <Progress value={readinessProgress} className="h-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              {data.participants.map((participant, index) => (
                <ParticipantCard key={participant.id || index} participant={participant} />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Actions Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Player Response Actions */}
              {data.currentUserStatus === "INVITED" && data.game.status === "WAITING_FOR_PLAYERS" && (
                <>
                  <Button
                    onClick={() => handlePlayerResponse("ACCEPTED")}
                    disabled={actionLoading === "ACCEPTED"}
                    className="w-full"
                  >
                    {actionLoading === "ACCEPTED" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Accepting...
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-2" />
                        Accept Invitation
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handlePlayerResponse("DECLINED")}
                    disabled={actionLoading === "DECLINED"}
                    className="w-full"
                  >
                    {actionLoading === "DECLINED" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Declining...
                      </>
                    ) : (
                      <>
                        <UserX className="h-4 w-4 mr-2" />
                        Decline Invitation
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* Creator Actions */}
              {data.isCreator && data.game.status !== "CANCELLED" && (
                <>
                  {data.canStart && data.game.status === "READY_TO_START" && (
                    <Button
                      onClick={handleStartGame}
                      disabled={actionLoading === "start"}
                      className="w-full"
                    >
                      {actionLoading === "start" ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Starting Game...
                        </>
                      ) : (
                        "Start Game"
                      )}
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    onClick={handleCancelGame}
                    disabled={actionLoading === "cancel"}
                    className="w-full"
                  >
                    {actionLoading === "cancel" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      "Cancel Game"
                    )}
                  </Button>
                </>
              )}

              {/* Status Display */}
              {data.currentUserStatus === "ACCEPTED" && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    You've accepted this invitation. Waiting for other players...
                  </AlertDescription>
                </Alert>
              )}

              {data.currentUserStatus === "DECLINED" && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    You've declined this invitation.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function Label({ className, children, ...props }: any) {
  return (
    <label className={cn("text-sm font-medium", className)} {...props}>
      {children}
    </label>
  );
}