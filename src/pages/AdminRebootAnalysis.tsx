import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  UserPlus
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Player {
  id: string;
  name: string;
  level: string | null;
  team: string | null;
  reboot_athlete_id: string | null;
}

type SessionType =
  | string
  | { name?: string | null }
  | null
  | undefined;

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
  isWeakest = false 
}: { 
  label: string; 
  score: number; 
  grade: string; 
  icon: React.ElementType;
  isWeakest?: boolean;
}) => (
  <div className={`relative p-4 rounded-xl border ${isWeakest ? 'border-red-500/50 bg-red-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
    {isWeakest && (
      <div className="absolute -top-2 -right-2">
        <div className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Weakest
        </div>
      </div>
    )}
    <div className="flex flex-col items-center gap-2">
      <Icon className={`w-6 h-6 ${getScoreTextColor(score)}`} />
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`text-2xl font-bold ${getScoreTextColor(score)}`}>{score}</div>
      <Badge variant="outline" className={`${getScoreColor(score)} text-white border-0`}>
        {grade}
      </Badge>
    </div>
  </div>
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

  // Search players
  const { data: players = [], isLoading: isLoadingPlayers } = useQuery({
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
      const { data: { session } } = await supabase.auth.getSession();
      
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
        // Extract session type name if it's an object
        let sessionTypeName = "Practice";
        if (s.session_type) {
          if (typeof s.session_type === 'object' && s.session_type.name) {
            sessionTypeName = s.session_type.name;
          } else if (typeof s.session_type === 'string') {
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

  // Process session
  const processSession = async () => {
    if (!selectedPlayer || !selectedSessionId) return;

    // Use manual org_player_id if provided, otherwise fall back to player's reboot_athlete_id
    const orgPlayerId = manualOrgPlayerId.trim() || selectedPlayer.reboot_athlete_id;
    
    if (!orgPlayerId) {
      toast.error("No Reboot Player ID available. Please enter one manually.");
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log("[Process Session] Processing:", {
        session_id: selectedSessionId,
        org_player_id: orgPlayerId,
        player_id: selectedPlayer.id,
      });
      
      const response = await supabase.functions.invoke("process-reboot-session", {
        body: {
          session_id: selectedSessionId,
          org_player_id: orgPlayerId,
          player_id: selectedPlayer.id,
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
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Reboot Analysis</h1>
          <p className="text-slate-400">
            Process Reboot Motion sessions and calculate 4B scores
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Selection */}
          <div className="space-y-6">
            {/* Step 1: Select Player */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center">1</span>
                  Select Player
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPlayer ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{selectedPlayer.name}</p>
                      <p className="text-slate-400 text-sm">
                        {selectedPlayer.level} • {selectedPlayer.team}
                      </p>
                      {selectedPlayer.reboot_athlete_id && (
                        <p className="text-green-400 text-xs flex items-center gap-1 mt-1">
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
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        placeholder="Search players..."
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
                      <div className="bg-slate-800 rounded-lg border border-slate-700 max-h-60 overflow-y-auto">
                        {isLoadingPlayers ? (
                          <div className="p-4 text-center text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                          </div>
                        ) : players.length > 0 ? (
                          <>
                            {players.map((player) => (
                              <div
                                key={player.id}
                                className="p-3 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700 last:border-0"
                                onClick={() => selectPlayer(player)}
                              >
                                <p className="text-white font-medium">{player.name}</p>
                                <p className="text-slate-400 text-sm">
                                  {player.level} • {player.team}
                                </p>
                                {player.reboot_athlete_id ? (
                                  <p className="text-green-400 text-xs mt-1">
                                    Has Reboot ID
                                  </p>
                                ) : (
                                  <p className="text-yellow-400 text-xs mt-1">
                                    No Reboot ID
                                  </p>
                                )}
                              </div>
                            ))}
                            <div
                              className="p-3 hover:bg-slate-700/50 cursor-pointer text-blue-400 flex items-center gap-2"
                              onClick={() => navigate("/admin/players")}
                            >
                              <UserPlus className="w-4 h-4" />
                              Add New Player
                            </div>
                          </>
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-slate-400 mb-2">No players found</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate("/admin/players")}
                            >
                              <UserPlus className="w-4 h-4 mr-2" />
                              Add New Player
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Select Session - UPDATED WITH MANUAL IMPORT */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center">2</span>
                  Select Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Auto-fetch option */}
                <Button
                  variant="outline"
                  onClick={fetchRebootSessions}
                  disabled={!selectedPlayer?.reboot_athlete_id || isLoadingSessions}
                  className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  {isLoadingSessions ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Fetch Sessions from Reboot
                </Button>
                
                <p className="text-xs text-slate-500 text-center">
                  (May not work for all API tiers)
                </p>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-slate-900 px-2 text-slate-500">
                      OR Import Manually
                    </span>
                  </div>
                </div>

                {/* Manual Import */}
                <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">
                      Reboot Session ID
                    </label>
                    <Input
                      placeholder="e.g., abc123-def456-..."
                      value={manualSessionId}
                      onChange={(e) => setManualSessionId(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Find this in the Reboot Motion URL or session details
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">
                      Reboot Player ID (org_player_id)
                    </label>
                    <Input
                      placeholder="e.g., xyz789-..."
                      value={manualOrgPlayerId}
                      onChange={(e) => setManualOrgPlayerId(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                    {selectedPlayer?.reboot_athlete_id && manualOrgPlayerId === selectedPlayer.reboot_athlete_id && (
                      <p className="text-xs text-green-400 mt-1">
                        ✓ Pre-filled from player profile
                      </p>
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
                {!selectedPlayer && (
                  <p className="text-yellow-400 text-sm text-center">
                    Select a player first
                  </p>
                )}

                {selectedPlayer && !selectedPlayer.reboot_athlete_id && (
                  <p className="text-yellow-400 text-sm text-center">
                    This player has no Reboot Athlete ID - use manual import above
                  </p>
                )}

                {/* Auto-fetched sessions list */}
                {rebootSessions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-400">Sessions from Reboot:</p>
                    {rebootSessions.map((session) => (
                      <label
                        key={session.session_id}
                        className="flex items-center p-3 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:border-slate-600"
                      >
                        <input
                          type="radio"
                          name="session"
                          checked={selectedSessionId === session.session_id}
                          onChange={() => setSelectedSessionId(session.session_id)}
                          className="mr-3"
                        />
                        <div>
                          <p className="text-white font-medium">
                            {new Date(session.session_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-slate-400 text-sm">
                            {getSessionTypeLabel(session.session_type)} • {session.movement_count} swings
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Selected session indicator */}
                {selectedSessionId && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-green-400 text-sm flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Session selected: {selectedSessionId.substring(0, 20)}...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Process */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center">3</span>
                  Process
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={processSession}
                  disabled={!selectedPlayer || !selectedSessionId || isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Calculate 4B Scores
                    </>
                  )}
                </Button>
                
                {!selectedPlayer && (
                  <p className="text-yellow-400 text-sm text-center mt-2">
                    Select a player first
                  </p>
                )}
                {selectedPlayer && !selectedSessionId && (
                  <p className="text-yellow-400 text-sm text-center mt-2">
                    Select or enter a session ID
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div>
            {results ? (
              <div className="space-y-6">
                {/* Composite Score */}
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-slate-400 text-sm mb-2">
                        Composite Score
                      </p>
                      <p className={`text-6xl font-bold ${getScoreTextColor(results.composite_score)}`}>
                        {results.composite_score}
                      </p>
                      <Badge className={`${getScoreColor(results.composite_score)} text-white mt-2`}>
                        {results.grade}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* 4B Scores Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <ScoreCard label="Brain" score={results.brain_score} grade={getGradeFromScore(results.brain_score)} icon={Brain} isWeakest={results.weakest_link === 'brain'} />
                  <ScoreCard label="Body" score={results.body_score} grade={getGradeFromScore(results.body_score)} icon={Dumbbell} isWeakest={results.weakest_link === 'body'} />
                  <ScoreCard label="Bat" score={results.bat_score} grade={getGradeFromScore(results.bat_score)} icon={Target} isWeakest={results.weakest_link === 'bat'} />
                  <ScoreCard label="Ball" score={results.ball_score} grade={getGradeFromScore(results.ball_score)} icon={CircleDot} isWeakest={results.weakest_link === 'ball'} />
                </div>

                {/* Energy Transfer (Primary) */}
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      Energy Transfer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-slate-800 rounded">
                          <p className="text-xs text-slate-400">Legs KE</p>
                          <p className="text-white font-bold">{results.legs_ke || '--'} J</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded">
                          <p className="text-xs text-slate-400">Torso KE</p>
                          <p className="text-white font-bold">{results.torso_ke || '--'} J</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded">
                          <p className="text-xs text-slate-400">Arms KE</p>
                          <p className="text-white font-bold">{results.arms_ke || '--'} J</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded">
                          <p className="text-xs text-slate-400">Bat KE</p>
                          <p className={`font-bold ${results.bat_ke ? 'text-white' : 'text-slate-500'}`}>
                            {results.bat_ke ? `${results.bat_ke} J` : 'Not Measured'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                          <p className="text-xs text-blue-400">Total KE</p>
                          <p className="text-blue-400 font-bold">{results.total_ke || '--'} J</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded">
                          <p className="text-xs text-slate-400">Legs → Torso</p>
                          <p className="text-white font-bold">{results.legs_to_torso_transfer || '--'}%</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded">
                          <p className="text-xs text-slate-400">Torso → Arms</p>
                          <p className="text-white font-bold">{results.torso_to_arms_transfer || '--'}%</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded">
                          <p className="text-xs text-slate-400">Consistency</p>
                          <p className="text-white font-bold">{results.consistency_grade} ({results.consistency_cv}%)</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 text-center">
                      This report measures how energy moves through your body — not joint angles or bat sensors.
                    </p>
                  </CardContent>
                </Card>

                {/* Flow Scores */}
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white">Kinetic Chain Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Ground Flow</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getScoreColor(results.ground_flow_score)}`}
                              style={{ width: `${results.ground_flow_score}%` }}
                            />
                          </div>
                          <span className="text-white font-medium w-8">{results.ground_flow_score}</span>
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
                          <span className="text-white font-medium w-8">{results.core_flow_score}</span>
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
                          <span className="text-white font-medium w-8">{results.upper_flow_score}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="bg-slate-900 border-slate-800 h-full min-h-[400px] flex items-center justify-center">
                <CardContent className="text-center">
                  <Zap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">No Results Yet</p>
                  <p className="text-slate-500 text-sm mt-2">
                    Select a player and session, then click "Calculate 4B Scores" to see results
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
