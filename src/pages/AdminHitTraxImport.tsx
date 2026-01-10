import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Upload, 
  FileSpreadsheet, 
  Target, 
  Zap, 
  TrendingUp,
  CheckCircle,
  X,
  Loader2,
  Save,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { 
  parseHitTraxCSV, 
  calculateSessionStats, 
  getBallScoreGrade,
  HitTraxRow,
  HitTraxSessionStats 
} from "@/lib/hittrax-parser";

interface Player {
  id: string;
  name: string;
  level: string | null;
  handedness: string | null;
  team: string | null;
}

export default function AdminHitTraxImport() {
  const navigate = useNavigate();
  
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedRows, setParsedRows] = useState<HitTraxRow[]>([]);
  const [sessionStats, setSessionStats] = useState<HitTraxSessionStats | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Search players
  const { data: players = [] } = useQuery({
    queryKey: ["players-hittrax-search", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const { data, error } = await supabase
        .from("players")
        .select("id, name, level, handedness, team")
        .ilike("name", `%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      return data as Player[];
    },
    enabled: searchQuery.length >= 2 && !selectedPlayer,
  });
  
  // Handle file drop/select
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const csvFiles = Array.from(files).filter(f => f.name.endsWith('.csv'));
      setUploadedFiles(prev => [...prev, ...csvFiles]);
    }
  }, []);
  
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // Process CSV files
  const processFiles = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("Please upload at least one CSV file");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const allRows: HitTraxRow[] = [];
      
      for (const file of uploadedFiles) {
        const text = await file.text();
        const rows = parseHitTraxCSV(text);
        allRows.push(...rows);
      }
      
      if (allRows.length === 0) {
        toast.error("No valid swing data found in the uploaded files");
        setIsProcessing(false);
        return;
      }
      
      // Sort by swing number
      allRows.sort((a, b) => a.swingNumber - b.swingNumber);
      
      // Calculate stats
      const stats = calculateSessionStats(allRows);
      
      setParsedRows(allRows);
      setSessionStats(stats);
      
      toast.success(`Processed ${allRows.length} swings from ${uploadedFiles.length} file(s)`);
    } catch (error) {
      console.error("Error processing files:", error);
      toast.error("Failed to process CSV files");
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Save to database
  const saveToDatabase = async () => {
    if (!selectedPlayer || !sessionStats) {
      toast.error("Please select a player and process files first");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Insert session
      const { data: session, error: insertError } = await supabase
        .from("hittrax_sessions")
        .insert({
          player_id: selectedPlayer.id,
          session_date: sessionDate,
          total_swings: sessionStats.totalSwings,
          misses: sessionStats.misses,
          fouls: sessionStats.fouls,
          balls_in_play: sessionStats.ballsInPlay,
          contact_rate: sessionStats.contactRate,
          avg_exit_velo: sessionStats.avgExitVelo,
          max_exit_velo: sessionStats.maxExitVelo,
          min_exit_velo: sessionStats.minExitVelo,
          velo_90_plus: sessionStats.velo90Plus,
          velo_95_plus: sessionStats.velo95Plus,
          velo_100_plus: sessionStats.velo100Plus,
          avg_launch_angle: sessionStats.avgLaunchAngle,
          optimal_la_count: sessionStats.optimalLaCount,
          ground_ball_count: sessionStats.groundBallCount,
          fly_ball_count: sessionStats.flyBallCount,
          max_distance: sessionStats.maxDistance,
          avg_distance: sessionStats.avgDistance,
          quality_hits: sessionStats.qualityHits,
          barrel_hits: sessionStats.barrelHits,
          quality_hit_pct: sessionStats.qualityHitPct,
          barrel_pct: sessionStats.barrelPct,
          total_points: sessionStats.totalPoints,
          points_per_swing: sessionStats.pointsPerSwing,
          ball_score: sessionStats.ballScore,
          results_breakdown: sessionStats.resultsBreakdown,
          hit_types_breakdown: sessionStats.hitTypesBreakdown,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Update player's latest ball score
      const { error: updateError } = await supabase
        .from("players")
        .update({
          latest_ball_score: sessionStats.ballScore,
          latest_hittrax_session_id: session.id,
        })
        .eq("id", selectedPlayer.id);
      
      if (updateError) {
        console.error("Error updating player:", updateError);
      }
      
      toast.success("Session saved to database!");
      
      // Reset form
      setUploadedFiles([]);
      setParsedRows([]);
      setSessionStats(null);
      setSelectedPlayer(null);
      setSearchQuery("");
      
    } catch (error) {
      console.error("Error saving session:", error);
      toast.error("Failed to save session to database");
    } finally {
      setIsSaving(false);
    }
  };
  
  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };
  
  const getScoreBgColor = (score: number) => {
    if (score >= 60) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };
  
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">HitTrax Import</h1>
            <p className="text-muted-foreground">
              Import batting practice data and calculate Ball Score
            </p>
          </div>
        </div>
        
        {/* Step 1: Select Player */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
              Select Player
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPlayer ? (
              <div className="flex items-center justify-between p-4 bg-surface rounded-lg border">
                <div>
                  <div className="font-medium">{selectedPlayer.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedPlayer.level} • {selectedPlayer.handedness}-handed
                    {selectedPlayer.team && ` • ${selectedPlayer.team}`}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setSelectedPlayer(null);
                    setSearchQuery("");
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search players by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
                {players.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {players.map((player) => (
                      <button
                        key={player.id}
                        className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b last:border-b-0"
                        onClick={() => {
                          setSelectedPlayer(player);
                          setSearchQuery("");
                        }}
                      >
                        <div className="font-medium">{player.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {player.level} • {player.handedness}-handed
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Step 2: Upload Files */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
              Upload HitTrax CSV(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                style={{ position: 'relative' }}
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-lg font-medium">Drop files here or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Accepts multiple .csv files from same session
                </p>
              </label>
            </div>
            
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Uploaded Files:
                </div>
                {uploadedFiles.map((file, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 bg-surface rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{file.name}</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Step 3: Process */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
              Process
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Session Date</label>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
              <div className="pt-6">
                <Button
                  onClick={processFiles}
                  disabled={uploadedFiles.length === 0 || isProcessing}
                  className="gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4" />
                      Calculate Quality Hit Score
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Results */}
        {sessionStats && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Ball Score Card */}
              <div className="bg-surface rounded-xl p-8 text-center mb-6">
                <div className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
                  Ball Score
                </div>
                <div className={`text-7xl font-bold ${getScoreColor(sessionStats.ballScore)}`}>
                  {sessionStats.ballScore}
                </div>
                <Badge 
                  className={`mt-3 ${getScoreBgColor(sessionStats.ballScore)} text-white`}
                >
                  {getBallScoreGrade(sessionStats.ballScore)}
                </Badge>
              </div>
              
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-surface rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{sessionStats.totalSwings}</div>
                  <div className="text-sm text-muted-foreground">Total Swings</div>
                </div>
                <div className="bg-surface rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{sessionStats.contactRate}%</div>
                  <div className="text-sm text-muted-foreground">Contact Rate</div>
                </div>
                <div className="bg-surface rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{sessionStats.avgExitVelo}</div>
                  <div className="text-sm text-muted-foreground">Avg Exit Velo</div>
                </div>
                <div className="bg-surface rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{sessionStats.maxExitVelo}</div>
                  <div className="text-sm text-muted-foreground">Max Exit Velo</div>
                </div>
              </div>
              
              {/* Detailed Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Launch Angle</span>
                    <span className="font-medium">{sessionStats.avgLaunchAngle}°</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Quality Hits</span>
                    <span className="font-medium">{sessionStats.qualityHits} ({sessionStats.qualityHitPct}%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Barrels</span>
                    <span className="font-medium">{sessionStats.barrelHits} ({sessionStats.barrelPct}%)</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Points</span>
                    <span className="font-medium">{sessionStats.totalPoints.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Points/Swing</span>
                    <span className="font-medium">{sessionStats.pointsPerSwing}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">90+ mph Hits</span>
                    <span className="font-medium">{sessionStats.velo90Plus}</span>
                  </div>
                </div>
              </div>
              
              {/* View Details Toggle */}
              <Button
                variant="outline"
                className="w-full mb-4"
                onClick={() => setShowDetails(!showDetails)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {showDetails ? "Hide Details" : "View Details"}
              </Button>
              
              {showDetails && (
                <div className="space-y-4 mb-6">
                  {/* Results Breakdown */}
                  <div>
                    <h4 className="font-medium mb-2">Results Breakdown</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(sessionStats.resultsBreakdown).map(([result, count]) => (
                        <Badge key={result} variant="outline">
                          {result}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {/* Hit Types Breakdown */}
                  <div>
                    <h4 className="font-medium mb-2">Hit Types</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(sessionStats.hitTypesBreakdown).map(([type, count]) => (
                        <Badge key={type} variant="secondary">
                          {type}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {/* Velocity Breakdown */}
                  <div>
                    <h4 className="font-medium mb-2">Velocity Breakdown</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-surface rounded p-2 text-center">
                        <div className="font-bold text-green-500">{sessionStats.velo100Plus}</div>
                        <div className="text-xs text-muted-foreground">100+ mph</div>
                      </div>
                      <div className="bg-surface rounded p-2 text-center">
                        <div className="font-bold text-yellow-500">{sessionStats.velo95Plus}</div>
                        <div className="text-xs text-muted-foreground">95+ mph</div>
                      </div>
                      <div className="bg-surface rounded p-2 text-center">
                        <div className="font-bold">{sessionStats.velo90Plus}</div>
                        <div className="text-xs text-muted-foreground">90+ mph</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contact Breakdown */}
                  <div>
                    <h4 className="font-medium mb-2">Contact Breakdown</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-surface rounded p-2 text-center">
                        <div className="font-bold text-green-500">{sessionStats.ballsInPlay}</div>
                        <div className="text-xs text-muted-foreground">In Play</div>
                      </div>
                      <div className="bg-surface rounded p-2 text-center">
                        <div className="font-bold text-yellow-500">{sessionStats.fouls}</div>
                        <div className="text-xs text-muted-foreground">Fouls</div>
                      </div>
                      <div className="bg-surface rounded p-2 text-center">
                        <div className="font-bold text-red-500">{sessionStats.misses}</div>
                        <div className="text-xs text-muted-foreground">Misses</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={saveToDatabase}
                  disabled={!selectedPlayer || isSaving}
                  className="flex-1 gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save to Database
                    </>
                  )}
                </Button>
              </div>
              
              {!selectedPlayer && sessionStats && (
                <p className="text-sm text-amber-500 mt-2 text-center">
                  ⚠️ Select a player to save this session
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
