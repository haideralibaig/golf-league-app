"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  Check, 
  ChevronsUpDown, 
  Users, 
  MapPin, 
  Clock, 
  DollarSign,
  X,
  UserPlus,
  Edit2
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Course {
  id: string;
  name: string;
  location?: string;
}

interface ChapterMember {
  id: string;
  displayName: string;
  avatar?: string;
  isOnline: boolean;
}

interface GuestPlayer {
  name: string;
  tempId: string;
}

interface CreateGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  chapterId: string;
  defaultCurrency: string;
  onGameCreated: () => void;
}

// Game Types Configuration
const GAME_TYPES = [
  {
    id: "TWO_VS_TWO_AUTO_PRESS",
    name: "2v2 Auto-Press",
    description: "4 players total, teams auto-assigned",
    playerCount: { total: 4, others: 3 }
  },
  {
    id: "INDIVIDUAL_STROKE_PLAY",
    name: "Individual Stroke Play",
    description: "2-8 players, individual scoring",
    playerCount: { total: { min: 2, max: 8 }, others: { min: 1, max: 7 } }
  },
  {
    id: "TEAM_SCRAMBLE",
    name: "Team Scramble",
    description: "4 players total, team format",
    playerCount: { total: 4, others: 3 }
  },
  {
    id: "SKINS_GAME",
    name: "Skins Game",
    description: "2-8 players, hole-by-hole competition",
    playerCount: { total: { min: 2, max: 8 }, others: { min: 1, max: 7 } }
  }
];

// Currencies
const CURRENCIES = [
  { id: "USD", name: "US Dollar", symbol: "$" },
  { id: "EUR", name: "Euro", symbol: "€" },
  { id: "GBP", name: "British Pound", symbol: "£" },
  { id: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { id: "AUD", name: "Australian Dollar", symbol: "A$" },
  { id: "JPY", name: "Japanese Yen", symbol: "¥" },
];

// Form Schemas
const gameSetupSchema = z.object({
  gameType: z.string().min(1, "Please select a game type"),
  courseId: z.string().min(1, "Please select a course"),
  currency: z.string().min(1, "Please select a currency"),
  playNow: z.boolean(),
  scheduledDate: z.date().optional(),
  scheduledTime: z.string().optional(),
  description: z.string().optional(),
});

const playerSelectionSchema = z.object({
  invitedPlayerIds: z.array(z.string()),
  guests: z.array(z.object({
    name: z.string().min(1),
    tempId: z.string(),
  })),
});

type GameSetupData = z.infer<typeof gameSetupSchema>;
type PlayerSelectionData = z.infer<typeof playerSelectionSchema>;

export function CreateGameDialog({
  open,
  onOpenChange,
  leagueId,
  chapterId,
  defaultCurrency,
  onGameCreated,
}: CreateGameDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [members, setMembers] = useState<ChapterMember[]>([]);
  const [gameSetupData, setGameSetupData] = useState<GameSetupData | null>(null);
  const [playerSelectionData, setPlayerSelectionData] = useState<PlayerSelectionData | null>(null);

  // Forms
  const gameSetupForm = useForm<GameSetupData>({
    resolver: zodResolver(gameSetupSchema),
    defaultValues: {
      gameType: "",
      courseId: "",
      currency: defaultCurrency,
      playNow: true,
      description: "",
    },
  });

  const playerSelectionForm = useForm<PlayerSelectionData>({
    resolver: zodResolver(playerSelectionSchema),
    defaultValues: {
      invitedPlayerIds: [],
      guests: [],
    },
  });

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadCourses();
      loadMembers();
    }
  }, [open, leagueId, chapterId]);

  async function loadCourses() {
    try {
      const response = await fetch(`/api/leagues/${leagueId}/courses`);
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
      }
    } catch (error) {
      console.error("Failed to load courses:", error);
    }
  }

  async function loadMembers() {
    try {
      const response = await fetch(`/api/leagues/${leagueId}/chapters/${chapterId}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Failed to load members:", error);
    }
  }

  // Helper functions
  function getSelectedGameType() {
    return GAME_TYPES.find(type => type.id === gameSetupData?.gameType);
  }

  function validatePlayerCount() {
    if (!gameSetupData || !playerSelectionData) return { isValid: false, message: "" };
    
    const gameType = getSelectedGameType();
    if (!gameType) return { isValid: false, message: "Invalid game type" };

    const totalSelected = playerSelectionData.invitedPlayerIds.length + playerSelectionData.guests.length;
    
    if (typeof gameType.playerCount.others === "number") {
      // Fixed player count games
      const required = gameType.playerCount.others;
      if (totalSelected !== required) {
        return {
          isValid: false,
          message: `This game requires exactly ${required} other players. You have selected ${totalSelected}.`
        };
      }
    } else {
      // Variable player count games
      const min = gameType.playerCount.others.min;
      const max = gameType.playerCount.others.max;
      if (totalSelected < min || totalSelected > max) {
        return {
          isValid: false,
          message: `This game requires ${min}-${max} other players. You have selected ${totalSelected}.`
        };
      }
    }

    return { isValid: true, message: "" };
  }

  // Step handlers
  async function handleGameSetupSubmit(data: GameSetupData) {
    setGameSetupData(data);
    setCurrentStep(2);
  }

  async function handlePlayerSelectionSubmit(data: PlayerSelectionData) {
    setPlayerSelectionData(data);
    setCurrentStep(3);
  }

  async function handleFinalSubmit() {
    if (!gameSetupData || !playerSelectionData) return;

    setLoading(true);
    try {
      const payload = {
        gameType: gameSetupData.gameType,
        courseId: gameSetupData.courseId,
        currency: gameSetupData.currency,
        scheduledDate: gameSetupData.playNow ? null : gameSetupData.scheduledDate,
        description: gameSetupData.description,
        invitedPlayerIds: playerSelectionData.invitedPlayerIds,
        guests: playerSelectionData.guests,
      };

      const response = await fetch(
        `/api/leagues/${leagueId}/chapters/${chapterId}/money-games`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create game");
      }

      const result = await response.json();
      onGameCreated();
      
      // Navigate to lobby
      window.location.href = `/money-games/${result.gameId}/lobby`;
      
    } catch (error) {
      console.error("Failed to create game:", error);
      alert("Failed to create game. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setGameSetupData(null);
      setPlayerSelectionData(null);
      gameSetupForm.reset();
      playerSelectionForm.reset();
    }
  }, [open]);

  const progress = (currentStep / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Money Game</DialogTitle>
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span className={currentStep >= 1 ? "text-primary" : ""}>Game Setup</span>
              <span className={currentStep >= 2 ? "text-primary" : ""}>Select Players</span>
              <span className={currentStep >= 3 ? "text-primary" : ""}>Review & Confirm</span>
            </div>
          </div>
        </DialogHeader>

        {/* Step 1: Game Setup */}
        {currentStep === 1 && (
          <Form {...gameSetupForm}>
            <form onSubmit={gameSetupForm.handleSubmit(handleGameSetupSubmit)} className="space-y-6">
              {/* Game Type Selection */}
              <FormField
                control={gameSetupForm.control}
                name="gameType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Game Format</FormLabel>
                    <div className="grid gap-3">
                      {GAME_TYPES.map((type) => (
                        <Card
                          key={type.id}
                          className={cn(
                            "cursor-pointer transition-colors hover:border-primary",
                            field.value === type.id && "border-primary bg-primary/5"
                          )}
                          onClick={() => field.onChange(type.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{type.name}</h4>
                                <p className="text-sm text-muted-foreground">{type.description}</p>
                              </div>
                              <Badge variant="outline">
                                {typeof type.playerCount.total === "number" 
                                  ? `${type.playerCount.total} players`
                                  : `${type.playerCount.total.min}-${type.playerCount.total.max} players`
                                }
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Course Selection */}
              <FormField
                control={gameSetupForm.control}
                name="courseId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Course</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {field.value
                              ? courses.find((course) => course.id === field.value)?.name
                              : "Select course..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search courses..." />
                          <CommandEmpty>No course found.</CommandEmpty>
                          <CommandGroup>
                            {courses.map((course) => (
                              <CommandItem
                                value={course.name}
                                key={course.id}
                                onSelect={() => field.onChange(course.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    course.id === field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div>{course.name}</div>
                                    {course.location && (
                                      <div className="text-xs text-muted-foreground">{course.location}</div>
                                    )}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency Selection */}
              <FormField
                control={gameSetupForm.control}
                name="currency"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Currency</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {field.value ? (
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                {CURRENCIES.find(c => c.id === field.value)?.name} 
                                ({CURRENCIES.find(c => c.id === field.value)?.symbol})
                              </div>
                            ) : (
                              "Select currency..."
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search currencies..." />
                          <CommandEmpty>No currency found.</CommandEmpty>
                          <CommandGroup>
                            {CURRENCIES.map((currency) => (
                              <CommandItem
                                value={currency.name}
                                key={currency.id}
                                onSelect={() => field.onChange(currency.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    currency.id === field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">{currency.symbol}</span>
                                  <span>{currency.name}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Play Now Toggle */}
              <FormField
                control={gameSetupForm.control}
                name="playNow"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Play Now</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Start the game immediately without scheduling
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Scheduled Date/Time (shown when Play Now is off) */}
              {!gameSetupForm.watch("playNow") && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={gameSetupForm.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={gameSetupForm.control}
                    name="scheduledTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            placeholder="Select time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Description */}
              <FormField
                control={gameSetupForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any additional details about this game..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit">Next: Select Players</Button>
              </div>
            </form>
          </Form>
        )}

        {/* Step 2: Player Selection */}
        {currentStep === 2 && gameSetupData && (
          <PlayerSelectionStep
            form={playerSelectionForm}
            members={members}
            gameType={getSelectedGameType()!}
            onSubmit={handlePlayerSelectionSubmit}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {/* Step 3: Review & Confirm */}
        {currentStep === 3 && gameSetupData && playerSelectionData && (
          <ReviewStep
            gameSetupData={gameSetupData}
            playerSelectionData={playerSelectionData}
            courses={courses}
            members={members}
            onSubmit={handleFinalSubmit}
            onBack={() => setCurrentStep(2)}
            onEdit={(step) => setCurrentStep(step)}
            loading={loading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Player Selection Step Component
function PlayerSelectionStep({
  form,
  members,
  gameType,
  onSubmit,
  onBack,
}: {
  form: any;
  members: ChapterMember[];
  gameType: any;
  onSubmit: (data: PlayerSelectionData) => void;
  onBack: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [showGuestInput, setShowGuestInput] = useState(false);

  const selectedPlayerIds = form.watch("invitedPlayerIds") || [];
  const guests = form.watch("guests") || [];

  const filteredMembers = members.filter(member =>
    member.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedPlayerIds.includes(member.id)
  );

  function addGuest() {
    if (!newGuestName.trim()) return;
    
    const newGuest = {
      name: newGuestName.trim(),
      tempId: `guest-${Date.now()}-${Math.random()}`,
    };
    
    form.setValue("guests", [...guests, newGuest]);
    setNewGuestName("");
    setShowGuestInput(false);
  }

  function removeGuest(tempId: string) {
    form.setValue("guests", guests.filter((g: GuestPlayer) => g.tempId !== tempId));
  }

  function togglePlayer(playerId: string) {
    const currentIds = form.getValues("invitedPlayerIds");
    if (currentIds.includes(playerId)) {
      form.setValue("invitedPlayerIds", currentIds.filter((id: string) => id !== playerId));
    } else {
      form.setValue("invitedPlayerIds", [...currentIds, playerId]);
    }
  }

  function validatePlayerCount() {
    const totalSelected = selectedPlayerIds.length + guests.length;
    
    if (typeof gameType.playerCount.others === "number") {
      // Fixed player count games
      const required = gameType.playerCount.others;
      if (totalSelected !== required) {
        return {
          isValid: false,
          message: `This game requires exactly ${required} other players. You have selected ${totalSelected}.`
        };
      }
    } else {
      // Variable player count games
      const min = gameType.playerCount.others.min;
      const max = gameType.playerCount.others.max;
      if (totalSelected < min || totalSelected > max) {
        return {
          isValid: false,
          message: `This game requires ${min}-${max} other players. You have selected ${totalSelected}.`
        };
      }
    }

    return { isValid: true, message: "" };
  }

  const validation = validatePlayerCount();
  const totalSelected = selectedPlayerIds.length + guests.length;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2">Select Players</h3>
          <p className="text-sm text-muted-foreground">
            {gameType.name} requires{" "}
            {typeof gameType.playerCount.others === "number"
              ? `exactly ${gameType.playerCount.others} other players`
              : `${gameType.playerCount.others.min}-${gameType.playerCount.others.max} other players`
            }
          </p>
        </div>

        {/* Player Count Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">Players Selected</span>
              </div>
              <Badge variant={validation.isValid ? "default" : "destructive"}>
                {totalSelected} / {typeof gameType.playerCount.others === "number" 
                  ? gameType.playerCount.others 
                  : `${gameType.playerCount.others.min}-${gameType.playerCount.others.max}`
                }
              </Badge>
            </div>
            {!validation.isValid && validation.message && (
              <p className="text-sm text-destructive mt-2">{validation.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Search Members */}
        <div>
          <Label>Chapter Members</Label>
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-2"
          />
        </div>

        {/* Member Selection */}
        <div className="grid gap-2 max-h-48 overflow-y-auto">
          {filteredMembers.map((member) => (
            <Card
              key={member.id}
              className={cn(
                "cursor-pointer transition-colors hover:border-primary",
                selectedPlayerIds.includes(member.id) && "border-primary bg-primary/5"
              )}
              onClick={() => togglePlayer(member.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>
                      {member.displayName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{member.displayName}</p>
                    {member.isOnline && (
                      <Badge variant="outline" className="text-green-600">
                        Online
                      </Badge>
                    )}
                  </div>
                  {selectedPlayerIds.includes(member.id) && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Guest Players Section */}
        <Separator />
        
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Guest Players</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowGuestInput(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Guest
            </Button>
          </div>

          {/* Guest Input */}
          {showGuestInput && (
            <Card className="mb-3">
              <CardContent className="p-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Guest player name"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addGuest()}
                  />
                  <Button type="button" size="sm" onClick={addGuest}>
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowGuestInput(false);
                      setNewGuestName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Guest List */}
          {guests.map((guest: GuestPlayer) => (
            <Card key={guest.tempId} className="mb-2">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 bg-blue-100">
                      <AvatarFallback className="text-blue-600">
                        {guest.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{guest.name}</p>
                      <Badge variant="outline" className="text-blue-600">
                        Guest
                      </Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGuest(guest.tempId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" disabled={!validation.isValid}>
            Next: Review
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Review Step Component
function ReviewStep({
  gameSetupData,
  playerSelectionData,
  courses,
  members,
  onSubmit,
  onBack,
  onEdit,
  loading,
}: {
  gameSetupData: GameSetupData;
  playerSelectionData: PlayerSelectionData;
  courses: Course[];
  members: ChapterMember[];
  onSubmit: () => void;
  onBack: () => void;
  onEdit: (step: number) => void;
  loading: boolean;
}) {
  const selectedCourse = courses.find(c => c.id === gameSetupData.courseId);
  const selectedGameType = GAME_TYPES.find(t => t.id === gameSetupData.gameType);
  const selectedCurrency = CURRENCIES.find(c => c.id === gameSetupData.currency);
  const selectedMembers = members.filter(m => playerSelectionData.invitedPlayerIds.includes(m.id));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Review & Confirm</h3>
        <p className="text-sm text-muted-foreground">
          Please review your game details before creating
        </p>
      </div>

      {/* Game Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Game Details</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEdit(1)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Format</Label>
              <p className="font-medium">{selectedGameType?.name}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Currency</Label>
              <p className="font-medium">
                {selectedCurrency?.symbol} {selectedCurrency?.name}
              </p>
            </div>
          </div>
          
          <div>
            <Label className="text-sm text-muted-foreground">Course</Label>
            <p className="font-medium">{selectedCourse?.name}</p>
            {selectedCourse?.location && (
              <p className="text-sm text-muted-foreground">{selectedCourse.location}</p>
            )}
          </div>

          {!gameSetupData.playNow && gameSetupData.scheduledDate && (
            <div>
              <Label className="text-sm text-muted-foreground">Scheduled</Label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                <p className="font-medium">
                  {format(gameSetupData.scheduledDate, "PPP")}
                  {gameSetupData.scheduledTime && ` at ${gameSetupData.scheduledTime}`}
                </p>
              </div>
            </div>
          )}

          {gameSetupData.playNow && (
            <div>
              <Label className="text-sm text-muted-foreground">Start Time</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <p className="font-medium">Play Now</p>
              </div>
            </div>
          )}

          {gameSetupData.description && (
            <div>
              <Label className="text-sm text-muted-foreground">Description</Label>
              <p className="font-medium">{gameSetupData.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Players */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">
            Players ({selectedMembers.length + playerSelectionData.guests.length + 1})
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEdit(2)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* You (creator) */}
          <div className="flex items-center gap-3 p-2 bg-primary/5 rounded-lg">
            <Avatar className="h-8 w-8">
              <AvatarFallback>ME</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">You</p>
              <Badge variant="outline">Creator</Badge>
            </div>
          </div>

          {/* Selected Members */}
          {selectedMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg border">
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.avatar} />
                <AvatarFallback>
                  {member.displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{member.displayName}</p>
                <Badge variant="outline">Member</Badge>
              </div>
            </div>
          ))}

          {/* Guest Players */}
          {playerSelectionData.guests.map((guest) => (
            <div key={guest.tempId} className="flex items-center gap-3 p-2 rounded-lg border">
              <Avatar className="h-8 w-8 bg-blue-100">
                <AvatarFallback className="text-blue-600">
                  {guest.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{guest.name}</p>
                <Badge variant="outline" className="text-blue-600">
                  Guest
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? "Creating Game..." : "Create Game"}
        </Button>
      </div>
    </div>
  );
}