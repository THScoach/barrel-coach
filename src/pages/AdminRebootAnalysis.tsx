import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  RefreshCw,
  Brain,
  Dumbbell,
  Target,
  CircleDot,
  Zap,
  AlertTriangle,
  Check,
  Loader2,
  UserPlus,
  Download,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createReferenceAthlete, createReferenceSession } from "@/lib/population-queries";

interface Player {
  id: string;
  name: string;
  level: string | null;
  team: string | null;
  reboot_athlete_id: string | null;
}

type SessionType = string | { name?: string | null } | null | undefined;

interface RebootSession {
  session_id: string;
  session_date: string;
  session_type: SessionType;
  movement_count: number;
}

interface FourBScores {
  brain_score: number;
  body_score: number;
  bat_score: number;
  ball_score: number;
  composite_score: number;
  grade: string;
  ground_flow_score: number;
  core_flow_score: number;
  upper_flow_score: number;
  weakest_link: string;
  // Energy-based metrics (ME-first)
  legs_ke: number;
  torso_ke: number;
  arms_ke: number;
  bat_ke: number;
  total_ke: number;
  legs_to_torso_transfer: number;
  torso_to_arms_transfer: number;
  consistency_cv: number;
  consistency_grade: string;
}

const getScoreColor = (score: number): string => {
  if (score >= 70) return "bg-green-500";
  if (score >= 60) return "bg-green-400";
  if (score >= 55) return "bg-blue-400";
  if (score >= 45) return "bg-slate-500";
  if (score >= 40) return "bg-yellow-500";
  if (score >= 30) return "bg-orange-500";
  return "bg-red-500";
};

const getScoreTextColor = (score: number): string => {
  if (score >= 70) return "text-green-400";
  if (score >= 60) return "text-green-400";
  if (score >= 55) return "text-blue-400";
  if (score >= 45) return "text-slate-400";
  if (score >= 40) return "text-yellow-400";
  if (score >= 30) return "text-orange-400";
  return "text-red-400";
};

const getSessionTypeLabel = (sessionType: SessionType): string => {
  if (!sessionType) return "Unknown";
  if (typeof sessionType === "string") return sessionType;
  if (typeof sessionType === "object") {
    const name = (sessionType as any)?.name;
    return typeof name === "string" && name.trim() ? name : "Unknown";
  }
  return "Unknown";
};

const ScoreCard = ({
  label,
  score,
  grade,
  icon: Icon,
  isWeakest = false,
}: {
  label: string;
  score: number;
  grade: string;
  icon: React.ElementType;
  isWeakest?: boolean;
}) => (
  <Card className={`relative bg-slate-900/80 border-slate-800 ${isWeakest ? "ring-2 ring-red-500" : ""}`}>
    {isWeakest && (
      <div className="absolute -top-2 -right-2">
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Weakest
        </Badge>
      </div>
    )}
    <CardContent className="pt-6 text-center">
      <Icon className={`w-8 h-8 mx-auto mb-2 ${getScoreTextColor(score)}`} />
      <p className="text-sm font-medium text-slate-400 mb-1">{label}</p>
      <p className={`text-4xl font-bold ${getScoreTextColor(score)}`}>{score}</p>
      <Badge className={`mt-2 ${getScoreColor(score)} text-white`}>{grade}</Badge>
    </CardContent>
  </Card>
);

export default function AdminRebootAnalysis() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [rebootSessions, setRebootSessions] = useState<RebootSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<FourBScores | null>(null);
  const [showPlayerSearch, setShowPlayerSearch] = useState(false);

  // NEW: Manual import state
  const [manualSessionId, setManualSessionId] = useState("");
  const [manualOrgPlayerId, setManualOrgPlayerId] = useState("");

  // NEW: Sync players state
  const [isSyncingPlayers, setIsSyncingPlayers] = useState(false);

  // Reference athlete import state
  const [isReferenceImport, setIsReferenceImport] = useState(false);
  const [referenceLevel, setReferenceLevel] = useState<'MLB' | 'MiLB' | 'NCAA' | 'Indy' | 'International'>('MLB');
  const [referenceDisplayName, setReferenceDisplayName] = useState("");

  // Search players
  const {
    data: players = [],
    isLoading: isLoadingPlayers,
    refetch: refetchPlayers,
  } = useQuery({
    queryKey: ["players-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      console.log(`[Player Search] Searching for: "${searchQuery}"`);

      const { data, error } = await supabase
        .from("players")
        .select("id, name, level, team, reboot_athlete_id")
        .ilike("name", `%${searchQuery}%`)
        .limit(10);

      if (error) {
        console.error("[Player Search] Error:", error);
        throw error;
      }

      console.log(`[Player Search] Found ${data?.length || 0} players:`, data);
      return data as Player[];
    },
    enabled: searchQuery.length >= 2,
  });

  // NEW: Sync players from Reboot Motion
  const syncPlayersFromReboot = async () => {
    setIsSyncingPlayers(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log("[Sync Players] Starting sync from Reboot Motion...");

      const response = await supabase.functions.invoke("fetch-reboot-players", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      console.log("[Sync Players] Response:", response);

      if (response.error) throw new Error(response.error.message);

      if (response.data?.success) {
        toast.success(response.data.message || `Synced ${response.data.synced} players from Reboot Motion`);

        // Show details if available
        if (response.data.created > 0 || response.data.updated > 0) {
          toast.info(`${response.data.created} new, ${response.data.updated} updated`);
        }

        // Refetch players if there's a search query
        if (searchQuery.length >= 2) {
          refetchPlayers();
        }
      } else {
        throw new Error(response.data?.error || "Sync failed");
      }
    } catch (error: any) {
      console.error("[Sync Players] Error:", error);
      toast.error(`Failed to sync players: ${error.message}`);
    } finally {
      setIsSyncingPlayers(false);
    }
  };

  // Fetch sessions from Reboot (may not work for all API tiers)
  const fetchRebootSessions = async () => {
    if (!selectedPlayer?.reboot_athlete_id) {
      toast.error("Player has no Reboot Athlete ID");
      return;
    }

    setIsLoadingSessions(true);
    setRebootSessions([]);
    setSelectedSessionId(null);
    setResults(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log("[Fetch Sessions] Fetching for player:", selectedPlayer.reboot_athlete_id);

      const response = await supabase.functions.invoke("fetch-reboot-sessions", {
        body: { org_player_id: selectedPlayer.reboot_athlete_id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      console.log("[Fetch Sessions] Raw response:", response);

      if (response.error) throw new Error(response.error.message);

      const sessions = response.data?.sessions || [];
      console.log("[Fetch Sessions] Raw sessions data:", sessions);

      // Map sessions and handle session_type being an object or string
      const mappedSessions = sessions.map((s: any) => {
        let sessionTypeName = "Practice";
        if (s.session_type) {
          if (typeof s.session_type === "object" && s.session_type.name) {
            sessionTypeName = s.session_type.name;
          } else if (typeof s.session_type === "string") {
            sessionTypeName = s.session_type;
          }
        }

        return {
          session_id: s.session_id || s.id,
          session_date: s.session_date || s.created_at,
          session_type: sessionTypeName,
          movement_count: s.movement_count || 0,
        };
      });

      console.log("[Fetch Sessions] Mapped sessions:", mappedSessions);
      setRebootSessions(mappedSessions);

      if (sessions.length === 0) {
        toast.info("No sessions found - try manual import instead");
      } else {
        toast.success(`Found ${sessions.length} sessions`);
      }
    } catch (error: any) {
      console.error("Error fetching sessions:", error);
      toast.error(`Auto-fetch failed: ${error.message}. Use manual import instead.`);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Process session (regular or reference)
  const processSession = async () => {
    // For reference imports, we don't need a selected player
    if (!isReferenceImport && !selectedPlayer) return;
    if (!selectedSessionId) return;

    // Use manual org_player_id if provided, otherwise fall back to player's reboot_athlete_id
    const orgPlayerId = manualOrgPlayerId.trim() || selectedPlayer?.reboot_athlete_id;

    if (!orgPlayerId) {
      toast.error("No Reboot Player ID available. Please enter one manually.");
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Handle reference athlete import
      if (isReferenceImport) {
        const displayName = referenceDisplayName.trim() || `Reference ${referenceLevel} Athlete`;
        
        console.log("[Process Reference] Creating reference athlete:", {
          display_name: displayName,
          level: referenceLevel,
          session_id: selectedSessionId,
          org_player_id: orgPlayerId,
        });

        // First, create or find the reference athlete
        const refAthlete = await createReferenceAthlete({
          display_name: displayName,
          level: referenceLevel,
          reboot_athlete_id: orgPlayerId,
        });

        // Process the session to get scores
        const response = await supabase.functions.invoke("process-reboot-session", {
          body: {
            session_id: selectedSessionId,
            org_player_id: orgPlayerId,
            // Don't attach to any regular player
            player_id: null,
            // Flag for reference processing (edge function can use this)
            is_reference: true,
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        if (response.error) throw new Error(response.error.message);

        if (response.data?.success) {
          // Save to reference_sessions instead of swing_4b_scores
          const scores = response.data.scores;
          
          await createReferenceSession({
            reference_athlete_id: refAthlete.id,
            reboot_session_id: selectedSessionId,
            session_date: new Date().toISOString().split('T')[0],
            body_score: scores.body_score,
            brain_score: scores.brain_score,
            bat_score: scores.bat_score,
            ball_score: scores.ball_score,
            composite_score: scores.composite_score,
            pelvis_velocity: scores.pelvis_velocity,
            torso_velocity: scores.torso_velocity,
            x_factor: scores.x_factor,
            transfer_efficiency: scores.transfer_efficiency,
            bat_ke: scores.bat_ke,
            ground_flow_score: scores.ground_flow_score,
            core_flow_score: scores.core_flow_score,
            upper_flow_score: scores.upper_flow_score,
            consistency_cv: scores.consistency_cv,
            consistency_grade: scores.consistency_grade,
            weakest_link: scores.weakest_link,
            grade: scores.grade,
          });

          setResults(scores);
          toast.success(`Reference session imported for ${displayName}`);
        } else {
          throw new Error(response.data?.error || "Processing failed");
        }
      } else {
        // Regular player import
        console.log("[Process Session] Processing:", {
          session_id: selectedSessionId,
          org_player_id: orgPlayerId,
          player_id: selectedPlayer?.id,
        });

        const response = await supabase.functions.invoke("process-reboot-session", {
          body: {
            session_id: selectedSessionId,
            org_player_id: orgPlayerId,
            player_id: selectedPlayer?.id,
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        if (response.error) throw new Error(response.error.message);

        if (response.data?.success) {
          setResults(response.data.scores);
          toast.success(response.data.message);
        } else {
          throw new Error(response.data?.error || "Processing failed");
        }
      }
    } catch (error: any) {
      console.error("Error processing session:", error);
      toast.error(`Failed to process: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectPlayer = (player: Player) => {
    console.log("[Player Select] Selected player:", player);

    if (!player.reboot_athlete_id) {
      toast.warning("This player has no Reboot Athlete ID. You can still use manual import if you know the IDs.");
    }

    setSelectedPlayer(player);
    setSearchQuery("");
    setShowPlayerSearch(false);
    setRebootSessions([]);
    setSelectedSessionId(null);
    setResults(null);

    // Pre-fill manual org_player_id if available
    if (player.reboot_athlete_id) {
      setManualOrgPlayerId(player.reboot_athlete_id);
    }
  };

  const getGradeFromScore = (score: number): string => {
    if (score >= 70) return "Plus-Plus";
    if (score >= 60) return "Plus";
    if (score >= 55) return "Above Avg";
    if (score >= 45) return "Average";
    if (score >= 40) return "Below Avg";
    if (score >= 30) return "Fringe";
    return "Poor";
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Reboot Analysis</h1>
          <p className="text-slate-400">Process Reboot Motion sessions and calculate 4B scores</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Selection */}
          <div className="space-y-6">
            {/* Step 1: Select Player */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                      1
                    </span>
                    Select Player
                  </div>
                  {/* SYNC PLAYERS BUTTON */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={syncPlayersFromReboot}
                    disabled={isSyncingPlayers}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    {isSyncingPlayers ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    {isSyncingPlayers ? "Syncing..." : "Sync from Reboot"}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPlayer ? (
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{selectedPlayer.name}</p>
                      <p className="text-sm text-slate-400">
                        {selectedPlayer.level} • {selectedPlayer.team}
                      </p>
                      {selectedPlayer.reboot_athlete_id && (
                        <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                          <Check className="w-3 h-3" />
                          Reboot ID: {selectedPlayer.reboot_athlete_id}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPlayer(null);
                        setShowPlayerSearch(true);
                        setManualSessionId("");
                        setManualOrgPlayerId("");
                      }}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        placeholder="Search players by name..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowPlayerSearch(true);
                        }}
                        onFocus={() => setShowPlayerSearch(true)}
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>

                    {showPlayerSearch && searchQuery.length >= 2 && (
                      <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-auto">
                        {isLoadingPlayers ? (
                          <div className="p-4 text-center text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          </div>
                        ) : players.length > 0 ? (
                          <>
                            {players.map((player) => (
                              <button
                                key={player.id}
                                className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors border-b border-slate-700 last:border-b-0"
                                onClick={() => selectPlayer(player)}
                              >
                                <p className="font-medium text-white">{player.name}</p>
                                <p className="text-sm text-slate-400">
                                  {player.level} • {player.team}
                                </p>
                                {player.reboot_athlete_id ? (
                                  <p className="text-xs text-green-400">Has Reboot ID</p>
                                ) : (
                                  <p className="text-xs text-yellow-400">No Reboot ID</p>
                                )}
                              </button>
                            ))}
                            <button
                              className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors flex items-center gap-2 text-red-400"
                              onClick={() => navigate("/admin/players")}
                            >
                              <UserPlus className="w-4 h-4" />
                              Add New Player
                            </button>
                          </>
                        ) : (
                          <div className="p-4">
                            <p className="text-slate-400 text-sm">No players found</p>
                            <p className="text-slate-500 text-xs mt-1">Click "Sync from Reboot" to import players</p>
                            <button
                              className="mt-2 text-red-400 text-sm flex items-center gap-1"
                              onClick={() => navigate("/admin/players")}
                            >
                              <UserPlus className="w-4 h-4" />
                              Add New Player
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Select Session - WITH MANUAL IMPORT */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                    2
                  </span>
                  Select Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Auto-fetch option */}
                <Button
                  onClick={fetchRebootSessions}
                  disabled={!selectedPlayer?.reboot_athlete_id || isLoadingSessions}
                  className="w-full mb-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                  variant="outline"
                >
                  {isLoadingSessions ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Fetch Sessions from Reboot
                </Button>

                <p className="text-xs text-slate-500 text-center mb-4">(May not work for all API tiers)</p>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-slate-900 text-slate-400">OR Import Manually</span>
                  </div>
                </div>

                {/* Manual Import */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Reboot Session ID</label>
                    <Input
                      placeholder="e.g., 47b50ead-36b6-4299-94be-beaac6a27837"
                      value={manualSessionId}
                      onChange={(e) => setManualSessionId(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Find this in the Reboot Motion URL or session details</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Reboot Player ID (org_player_id)
                    </label>
                    <Input
                      placeholder="e.g., player_987..."
                      value={manualOrgPlayerId}
                      onChange={(e) => setManualOrgPlayerId(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                    {selectedPlayer?.reboot_athlete_id && manualOrgPlayerId === selectedPlayer.reboot_athlete_id && (
                      <p className="text-xs text-green-400 mt-1">✓ Pre-filled from player profile</p>
                    )}
                  </div>
                  <Button
                    onClick={() => {
                      if (!manualSessionId.trim()) {
                        toast.error("Please enter a Session ID");
                        return;
                      }
                      if (!manualOrgPlayerId.trim()) {
                        toast.error("Please enter a Reboot Player ID");
                        return;
                      }
                      setSelectedSessionId(manualSessionId.trim());
                      toast.success("Session ID set - click Calculate 4B Scores to process");
                    }}
                    disabled={!manualSessionId.trim() || !manualOrgPlayerId.trim()}
                    className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                    variant="outline"
                  >
                    Use This Session
                  </Button>
                </div>

                {/* Messages */}
                {!selectedPlayer && <p className="text-sm text-slate-400 text-center mt-4">Select a player first</p>}

                {selectedPlayer && !selectedPlayer.reboot_athlete_id && (
                  <p className="text-sm text-yellow-400 text-center mt-4">
                    This player has no Reboot Athlete ID - use manual import above
                  </p>
                )}

                {/* Auto-fetched sessions list */}
                {rebootSessions.length > 0 && (
                  <div className="space-y-2 mt-6">
                    <p className="text-sm text-slate-400 mb-2">Sessions from Reboot:</p>
                    {rebootSessions.map((session) => (
                      <label
                        key={session.session_id}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSessionId === session.session_id
                            ? "border-red-500 bg-red-500/10"
                            : "border-slate-700 hover:bg-slate-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name="session"
                          value={session.session_id}
                          checked={selectedSessionId === session.session_id}
                          onChange={() => setSelectedSessionId(session.session_id)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-white">
                            {new Date(session.session_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-sm text-slate-400">
                            {getSessionTypeLabel(session.session_type)} • {session.movement_count} swings
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Selected session indicator */}
                {selectedSessionId && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-sm text-green-400 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Session selected: {selectedSessionId.substring(0, 20)}...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Process */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                    3
                  </span>
                  Process
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reference Athlete Import Option */}
                <div className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="reference-import"
                      checked={isReferenceImport}
                      onCheckedChange={(checked) => setIsReferenceImport(checked === true)}
                    />
                    <Label 
                      htmlFor="reference-import" 
                      className="text-amber-400 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Import as Reference Athlete (Internal)
                    </Label>
                  </div>
                  
                  {isReferenceImport && (
                    <div className="space-y-3 pt-2 border-t border-amber-500/20">
                      <p className="text-xs text-amber-300/70">
                        Reference athletes are internal validation models (MLB/Pro).
                        They will NOT appear in player leaderboards, averages, or youth comparisons.
                      </p>
                      
                      <div>
                        <Label className="text-sm text-slate-400 mb-1 block">Display Name</Label>
                        <Input
                          placeholder="e.g., MLB Reference Swing #1"
                          value={referenceDisplayName}
                          onChange={(e) => setReferenceDisplayName(e.target.value)}
                          className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm text-slate-400 mb-1 block">Level</Label>
                        <Select 
                          value={referenceLevel} 
                          onValueChange={(v) => setReferenceLevel(v as typeof referenceLevel)}
                        >
                          <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MLB">MLB</SelectItem>
                            <SelectItem value="MiLB">MiLB</SelectItem>
                            <SelectItem value="NCAA">NCAA</SelectItem>
                            <SelectItem value="Indy">Independent</SelectItem>
                            <SelectItem value="International">International</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={processSession}
                  disabled={(!isReferenceImport && !selectedPlayer) || !selectedSessionId || isProcessing}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isReferenceImport ? (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Import as Reference Athlete
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Calculate 4B Scores
                    </>
                  )}
                </Button>

                {!isReferenceImport && !selectedPlayer && (
                  <p className="text-xs text-slate-500 text-center">Select a player first (or enable Reference Import)</p>
                )}
                {(selectedPlayer || isReferenceImport) && !selectedSessionId && (
                  <p className="text-xs text-slate-500 text-center">Select or enter a session ID</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div>
            {results ? (
              <div className="space-y-6">
                {/* Composite Score */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm uppercase tracking-wider text-slate-400 mb-2">Composite Score</p>
                      <p className={`text-7xl font-bold ${getScoreTextColor(results.composite_score)}`}>
                        {results.composite_score}
                      </p>
                      <Badge className={`mt-3 ${getScoreColor(results.composite_score)} text-white`}>
                        {results.grade}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* 4B Scores Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <ScoreCard
                    label="Brain"
                    score={results.brain_score}
                    grade={getGradeFromScore(results.brain_score)}
                    icon={Brain}
                    isWeakest={results.weakest_link === "brain"}
                  />
                  <ScoreCard
                    label="Body"
                    score={results.body_score}
                    grade={getGradeFromScore(results.body_score)}
                    icon={Dumbbell}
                    isWeakest={results.weakest_link === "body"}
                  />
                  <ScoreCard
                    label="Bat"
                    score={results.bat_score}
                    grade={getGradeFromScore(results.bat_score)}
                    icon={Target}
                    isWeakest={results.weakest_link === "bat"}
                  />
                  <ScoreCard
                    label="Ball"
                    score={results.ball_score}
                    grade={getGradeFromScore(results.ball_score)}
                    icon={CircleDot}
                    isWeakest={results.weakest_link === "ball"}
                  />
                </div>

                {/* Energy Transfer (Primary) */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Zap className="h-5 w-5 text-orange-500" />
                      Energy Transfer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Legs KE</span>
                          <span className="font-medium text-white">{results.legs_ke || "--"} J</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Torso KE</span>
                          <span className="font-medium text-white">{results.torso_ke || "--"} J</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Arms KE</span>
                          <span className="font-medium text-white">{results.arms_ke || "--"} J</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Bat KE</span>
                          <span className="font-medium text-white">
                            {results.bat_ke ? `${results.bat_ke} J` : "Not Measured"}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total KE</span>
                          <span className="font-medium text-white">{results.total_ke || "--"} J</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Legs → Torso</span>
                          <span className="font-medium text-white">{results.legs_to_torso_transfer || "--"}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Torso → Arms</span>
                          <span className="font-medium text-white">{results.torso_to_arms_transfer || "--"}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Consistency</span>
                          <span className="font-medium text-white">
                            {results.consistency_grade} ({results.consistency_cv}%)
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-blue-400 text-center mt-4 pt-3 border-t border-slate-700">
                      This report measures how energy moves through your body — not joint angles or bat sensors.
                    </p>
                  </CardContent>
                </Card>

                {/* Flow Scores */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white">Kinetic Chain Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Ground Flow</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getScoreColor(results.ground_flow_score)}`}
                              style={{ width: `${results.ground_flow_score}%` }}
                            />
                          </div>
                          <span className="font-medium text-white w-8">{results.ground_flow_score}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Core Flow</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getScoreColor(results.core_flow_score)}`}
                              style={{ width: `${results.core_flow_score}%` }}
                            />
                          </div>
                          <span className="font-medium text-white w-8">{results.core_flow_score}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Upper Flow</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getScoreColor(results.upper_flow_score)}`}
                              style={{ width: `${results.upper_flow_score}%` }}
                            />
                          </div>
                          <span className="font-medium text-white w-8">{results.upper_flow_score}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="bg-slate-900/80 border-slate-800 h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <Target className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <h3 className="text-xl font-medium mb-2 text-white">No Results Yet</h3>
                  <p className="text-slate-400">
                    Select a player and session, then click "Calculate 4B Scores" to see results
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
