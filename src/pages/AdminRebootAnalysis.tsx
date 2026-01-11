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
  pelvis_velocity: number;
  torso_velocity: number;
  x_factor: number;
  bat_ke: number;
  transfer_efficiency: number;
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
  <Card className={`relative bg-slate-900/80 border-slate-800 ${isWeakest ? 'ring-2 ring-red-500' : ''}`}>
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
      <Badge 
        className={`mt-2 ${getScoreColor(score)} text-white`}
      >
        {grade}
      </Badge>
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

  // Fetch sessions from Reboot
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
        toast.info("No sessions found for this player");
      } else {
        toast.success(`Found ${sessions.length} sessions`);
      }
    } catch (error: any) {
      console.error("Error fetching sessions:", error);
      toast.error(`Failed to fetch sessions: ${error.message}`);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Process session
  const processSession = async () => {
    if (!selectedPlayer || !selectedSessionId) return;

    setIsProcessing(true);
    setResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("process-reboot-session", {
        body: {
          session_id: selectedSessionId,
          org_player_id: selectedPlayer.reboot_athlete_id,
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
      toast.warning("This player is not linked to Reboot Motion. They will need a Reboot Athlete ID to process sessions.");
    }
    
    setSelectedPlayer(player);
    setSearchQuery("");
    setShowPlayerSearch(false);
    setRebootSessions([]);
    setSelectedSessionId(null);
    setResults(null);
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
          <p className="text-slate-400">
            Process Reboot Motion sessions and calculate 4B scores
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Selection */}
          <div className="space-y-6">
            {/* Step 1: Select Player */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                  Select Player
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
                                  <p className="text-xs text-green-400">
                                    Has Reboot ID
                                  </p>
                                ) : (
                                  <p className="text-xs text-yellow-400">
                                    No Reboot ID
                                  </p>
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

            {/* Step 2: Select Session */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                  Select Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={fetchRebootSessions}
                  disabled={!selectedPlayer?.reboot_athlete_id || isLoadingSessions}
                  className="w-full mb-4 border-slate-700 text-slate-300 hover:bg-slate-800"
                  variant="outline"
                >
                  {isLoadingSessions ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Fetch Sessions from Reboot
                </Button>

                {!selectedPlayer && (
                  <p className="text-sm text-slate-400 text-center">
                    Select a player first
                  </p>
                )}

                {selectedPlayer && !selectedPlayer.reboot_athlete_id && (
                  <p className="text-sm text-yellow-400 text-center">
                    This player has no Reboot Athlete ID
                  </p>
                )}

                {rebootSessions.length > 0 && (
                  <div className="space-y-2">
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
                            {new Date(session.session_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
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
              </CardContent>
            </Card>

            {/* Step 3: Process */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                  Process
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={processSession}
                  disabled={!selectedSessionId || isProcessing}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
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
                      <p className="text-sm uppercase tracking-wider text-slate-400 mb-2">
                        Composite Score
                      </p>
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
                    isWeakest={results.weakest_link === 'brain'}
                  />
                  <ScoreCard
                    label="Body"
                    score={results.body_score}
                    grade={getGradeFromScore(results.body_score)}
                    icon={Dumbbell}
                    isWeakest={results.weakest_link === 'body'}
                  />
                  <ScoreCard
                    label="Bat"
                    score={results.bat_score}
                    grade={getGradeFromScore(results.bat_score)}
                    icon={Target}
                    isWeakest={results.weakest_link === 'bat'}
                  />
                  <ScoreCard
                    label="Ball"
                    score={results.ball_score}
                    grade={getGradeFromScore(results.ball_score)}
                    icon={CircleDot}
                    isWeakest={results.weakest_link === 'ball'}
                  />
                </div>

                {/* Detailed Metrics */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white">Biomechanical Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Pelvis Velocity</span>
                          <span className="font-medium text-white">{results.pelvis_velocity}°/s</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Torso Velocity</span>
                          <span className="font-medium text-white">{results.torso_velocity}°/s</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">X-Factor</span>
                          <span className="font-medium text-white">{results.x_factor}°</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Bat KE</span>
                          <span className="font-medium text-white">{results.bat_ke} J</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Transfer Eff.</span>
                          <span className="font-medium text-white">{results.transfer_efficiency}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Consistency</span>
                          <span className="font-medium text-white">{results.consistency_grade} ({results.consistency_cv}%)</span>
                        </div>
                      </div>
                    </div>
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
