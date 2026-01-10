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

interface RebootSession {
  session_id: string;
  session_date: string;
  session_type: string;
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
  if (score >= 45) return "bg-gray-400";
  if (score >= 40) return "bg-yellow-400";
  if (score >= 30) return "bg-orange-400";
  return "bg-red-400";
};

const getScoreTextColor = (score: number): string => {
  if (score >= 70) return "text-green-500";
  if (score >= 60) return "text-green-400";
  if (score >= 55) return "text-blue-400";
  if (score >= 45) return "text-gray-500";
  if (score >= 40) return "text-yellow-500";
  if (score >= 30) return "text-orange-500";
  return "text-red-500";
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
  <Card className={`relative ${isWeakest ? 'ring-2 ring-red-500' : ''}`}>
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
      <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
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
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Reboot Analysis</h1>
          <p className="text-muted-foreground">
            Process Reboot Motion sessions and calculate 4B scores
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Selection */}
          <div className="space-y-6">
            {/* Step 1: Select Player */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                  Select Player
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPlayer ? (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{selectedPlayer.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPlayer.level} • {selectedPlayer.team}
                      </p>
                      {selectedPlayer.reboot_athlete_id && (
                        <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
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
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search players by name..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowPlayerSearch(true);
                        }}
                        onFocus={() => setShowPlayerSearch(true)}
                        className="pl-10"
                      />
                    </div>
                    
                    {showPlayerSearch && searchQuery.length >= 2 && (
                      <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                        {isLoadingPlayers ? (
                          <div className="p-4 text-center text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          </div>
                        ) : players.length > 0 ? (
                          <>
                            {players.map((player) => (
                              <button
                                key={player.id}
                                className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                                onClick={() => selectPlayer(player)}
                              >
                                <p className="font-medium">{player.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {player.level} • {player.team}
                                </p>
                                {player.reboot_athlete_id ? (
                                  <p className="text-xs text-green-600">
                                    Has Reboot ID
                                  </p>
                                ) : (
                                  <p className="text-xs text-yellow-600">
                                    No Reboot ID
                                  </p>
                                )}
                              </button>
                            ))}
                            <button
                              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-2 text-primary"
                              onClick={() => navigate("/admin/players")}
                            >
                              <UserPlus className="w-4 h-4" />
                              Add New Player
                            </button>
                          </>
                        ) : (
                          <div className="p-4">
                            <p className="text-muted-foreground text-sm">No players found</p>
                            <button
                              className="mt-2 text-primary text-sm flex items-center gap-1"
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                  Select Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={fetchRebootSessions}
                  disabled={!selectedPlayer?.reboot_athlete_id || isLoadingSessions}
                  className="w-full mb-4"
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
                  <p className="text-sm text-muted-foreground text-center">
                    Select a player first
                  </p>
                )}

                {selectedPlayer && !selectedPlayer.reboot_athlete_id && (
                  <p className="text-sm text-yellow-600 text-center">
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
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted"
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
                          <p className="font-medium">
                            {new Date(session.session_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {session.session_type} • {session.movement_count} movements
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Process */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                  Process
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={processSession}
                  disabled={!selectedPlayer || !selectedSessionId || isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Calculate 4B Scores
                </Button>

                {/* Test Button */}
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">🧪 Test with hardcoded values:</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isProcessing}
                    onClick={async () => {
                      setIsProcessing(true);
                      setResults(null);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const response = await supabase.functions.invoke("process-reboot-session", {
                          body: {
                            session_id: "841e4aec-0ded-4445-95e9-9b0d3fc27adb",
                            org_player_id: "a293f033-6ebd-47ad-8af9-81a68ab35406",
                          },
                          headers: {
                            Authorization: `Bearer ${session?.access_token}`,
                          },
                        });
                        console.log("Test response:", response);
                        if (response.error) throw new Error(response.error.message);
                        if (response.data?.success) {
                          setResults(response.data.scores);
                          toast.success("Test processed successfully!");
                        } else {
                          throw new Error(response.data?.error || "Test failed");
                        }
                      } catch (error: any) {
                        console.error("Test error:", error);
                        toast.error(`Test failed: ${error.message}`);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Test Process Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent>
                {results ? (
                  <div className="space-y-6">
                    {/* Score Cards Grid */}
                    <div className="grid grid-cols-5 gap-2">
                      <ScoreCard
                        label="BRAIN"
                        score={results.brain_score}
                        grade={getGradeFromScore(results.brain_score)}
                        icon={Brain}
                        isWeakest={results.weakest_link === "brain"}
                      />
                      <ScoreCard
                        label="BODY"
                        score={results.body_score}
                        grade={getGradeFromScore(results.body_score)}
                        icon={Dumbbell}
                        isWeakest={results.weakest_link === "body"}
                      />
                      <ScoreCard
                        label="BAT"
                        score={results.bat_score}
                        grade={getGradeFromScore(results.bat_score)}
                        icon={Target}
                        isWeakest={results.weakest_link === "bat"}
                      />
                      <ScoreCard
                        label="BALL"
                        score={results.ball_score}
                        grade={getGradeFromScore(results.ball_score)}
                        icon={CircleDot}
                        isWeakest={results.weakest_link === "ball"}
                      />
                      <ScoreCard
                        label="4B"
                        score={results.composite_score}
                        grade={results.grade}
                        icon={Zap}
                      />
                    </div>

                    {/* Weakest Link */}
                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        Weakest Link: <span className="uppercase">{results.weakest_link}</span>
                        {results.weakest_link === "brain" && " (Consistency)"}
                        {results.weakest_link === "body" && " (Kinetic Chain)"}
                        {results.weakest_link === "bat" && " (Bat Speed/Efficiency)"}
                        {results.weakest_link === "ball" && " (Contact Quality)"}
                      </p>
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Pelvis Velocity</p>
                        <p className="text-lg font-bold">{results.pelvis_velocity}°/s</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Torso Velocity</p>
                        <p className="text-lg font-bold">{results.torso_velocity}°/s</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">X-Factor</p>
                        <p className="text-lg font-bold">{results.x_factor}°</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Bat Kinetic Energy</p>
                        <p className="text-lg font-bold">{results.bat_ke}J</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Transfer Efficiency</p>
                        <p className="text-lg font-bold">{results.transfer_efficiency}%</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Consistency</p>
                        <p className="text-lg font-bold">
                          {results.consistency_cv}% CV
                          <span className="text-sm text-muted-foreground ml-1">
                            ({results.consistency_grade})
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Flow Scores */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Flow Breakdown</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 bg-muted rounded text-center">
                          <p className="text-xs text-muted-foreground">Ground</p>
                          <p className="font-bold">{results.ground_flow_score}</p>
                        </div>
                        <div className="p-2 bg-muted rounded text-center">
                          <p className="text-xs text-muted-foreground">Core</p>
                          <p className="font-bold">{results.core_flow_score}</p>
                        </div>
                        <div className="p-2 bg-muted rounded text-center">
                          <p className="text-xs text-muted-foreground">Upper</p>
                          <p className="font-bold">{results.upper_flow_score}</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1">
                        Save to Profile
                      </Button>
                      <Button variant="outline" className="flex-1">
                        Generate Report
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Zap className="w-12 h-12 mb-4 opacity-20" />
                    <p>Select a player and session to analyze</p>
                    <p className="text-sm">Results will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
