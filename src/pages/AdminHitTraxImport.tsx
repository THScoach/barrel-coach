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
  
  // Process CSV files - HARDENED with better error handling
  const processFiles = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("Please upload at least one CSV file");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const allRows: HitTraxRow[] = [];
      let fileWarnings: string[] = [];
      
      for (const file of uploadedFiles) {
        try {
          const text = await file.text();
          const rows = parseHitTraxCSV(text);
          
          if (rows.length === 0) {
            fileWarnings.push(`${file.name}: No valid data found`);
            console.warn(`File ${file.name}: No valid data - check column headers`);
          } else {
            console.log(`File ${file.name}: Parsed ${rows.length} swings`);
            allRows.push(...rows);
          }
        } catch (fileError) {
          console.warn(`Error parsing ${file.name}:`, fileError);
          fileWarnings.push(`${file.name}: Parse error - skipped`);
        }
      }
      
      if (allRows.length === 0) {
        const message = fileWarnings.length > 0 
          ? `No valid swing data found. Check CSV column headers match HitTrax format.`
          : "No valid swing data found in the uploaded files";
        toast.error(message);
        setIsProcessing(false);
        return;
      }
      
      // Sort by swing number
      allRows.sort((a, b) => a.swingNumber - b.swingNumber);
      
      // Calculate stats
      const stats = calculateSessionStats(allRows);
      
      setParsedRows(allRows);
      setSessionStats(stats);
      
      // Show appropriate success message
      if (fileWarnings.length > 0) {
        toast.warning(`Processed ${allRows.length} swings from ${uploadedFiles.length - fileWarnings.length} file(s). Some files had issues.`);
      } else {
        toast.success(`Processed ${allRows.length} swings from ${uploadedFiles.length} file(s)`);
      }
    } catch (error) {
      console.error("Error processing files:", error);
      toast.error("Failed to process CSV files. Check file format and try again.");
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
    if (score >= 60) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };
  
  const getScoreBgColor = (score: number) => {
    if (score >= 60) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };
  
  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">HitTrax Import</h1>
            <p className="text-slate-400">
              Import batting practice data and calculate Ball Score
            </p>
          </div>
        </div>
        
        {/* Step 1: Select Player */}
        <Card className="mb-6 bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
              Select Player
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPlayer ? (
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div>
                  <div className="font-medium text-white">{selectedPlayer.name}</div>
                  <div className="text-sm text-slate-400">
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
                  className="text-slate-400 hover:text-white hover:bg-slate-700"
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
                  className="w-full bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
                {players.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {players.map((player) => (
                      <button
                        key={player.id}
                        className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors border-b border-slate-700 last:border-b-0"
                        onClick={() => {
                          setSelectedPlayer(player);
                          setSearchQuery("");
                        }}
                      >
                        <div className="font-medium text-white">{player.name}</div>
                        <div className="text-sm text-slate-400">
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
        <Card className="mb-6 bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
              Upload HitTrax CSV(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-red-500/50 transition-colors">
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
                <Upload className="h-10 w-10 mx-auto text-slate-500 mb-3" />
                <p className="text-lg font-medium text-white">Drop files here or click to browse</p>
                <p className="text-sm text-slate-400 mt-1">
                  Accepts multiple .csv files from same session
                </p>
              </label>
            </div>
            
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium text-slate-400">
                  Uploaded Files:
                </div>
                {uploadedFiles.map((file, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-white">{file.name}</span>
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-red-400 hover:bg-slate-700"
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
        <Card className="mb-6 bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
              Process
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block text-slate-300">Session Date</label>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <div className="pt-6">
                <Button
                  onClick={processFiles}
                  disabled={uploadedFiles.length === 0 || isProcessing}
                  className="gap-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
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
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Results</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Ball Score Card */}
              <div className="bg-slate-800/50 rounded-xl p-8 text-center mb-6">
                <div className="text-sm uppercase tracking-wider text-slate-400 mb-2">
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
                <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{sessionStats.totalSwings}</div>
                  <div className="text-sm text-slate-400">Total Swings</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{sessionStats.contactRate}%</div>
                  <div className="text-sm text-slate-400">Contact Rate</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{sessionStats.avgExitVelo}</div>
                  <div className="text-sm text-slate-400">Avg Exit Velo</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{sessionStats.maxExitVelo}</div>
                  <div className="text-sm text-slate-400">Max Exit Velo</div>
                </div>
              </div>
              
              {/* Detailed Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Avg Launch Angle</span>
                    <span className="font-medium text-white">{sessionStats.avgLaunchAngle}°</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Quality Hits</span>
                    <span className="font-medium text-white">{sessionStats.qualityHits} ({sessionStats.qualityHitPct}%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Barrels</span>
                    <span className="font-medium text-white">{sessionStats.barrelHits} ({sessionStats.barrelPct}%)</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Points</span>
                    <span className="font-medium text-white">{sessionStats.totalPoints.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Points/Swing</span>
                    <span className="font-medium text-white">{sessionStats.pointsPerSwing}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">90+ MPH</span>
                    <span className="font-medium text-white">{sessionStats.velo90Plus}</span>
                  </div>
                </div>
              </div>
              
              {/* Save Button */}
              <Button
                onClick={saveToDatabase}
                disabled={!selectedPlayer || isSaving}
                className="w-full gap-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
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
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
