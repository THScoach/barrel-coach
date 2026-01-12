import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  X, 
  Loader2,
  Save,
  AlertCircle,
  Activity,
  Target,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { detectCsvType, parseCSV, getBrandDisplayName, getCsvTypeDisplayName, CsvType, LaunchMonitorBrand, DetectionResult } from "@/lib/csv-detector";
import { parseLaunchMonitorData, calculateLaunchMonitorStats, LaunchMonitorSessionStats } from "@/lib/launch-monitor-parser";
import { calculateRebootScores, RebootScores, processRebootIK, processRebootME, RebootIKMetrics, RebootMEMetrics, LeakType } from "@/lib/reboot-parser";
import { TrainingSwingVisualizer } from "@/components/TrainingSwingVisualizer";

interface DetectedFile {
  file: File;
  csvType: CsvType;
  brand?: LaunchMonitorBrand;
  swingCount?: number;  // Only for launch monitor with actual swing data
  rowCount?: number;    // Row count (NOT swing count for biomechanics)
  frameCount?: number;  // For reboot - number of motion frames
  confidence?: 'high' | 'medium' | 'low';
  debugHeaders?: string[];  // First 10 headers for debugging
}

interface UnifiedDataUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string; // This MUST be players.id (not player_profiles.id)
  playerName: string;
  onSuccess: () => void;
  linkVerified?: boolean; // If true, playerId is already verified as valid players.id
}

// Helper to parse height string like "5'9"" to inches
function parseHeightToInches(heightStr: string | null | undefined): number | null {
  if (!heightStr) return null;
  
  // Try to match formats like "5'9"", "5'9", "5' 9"", "5-9", "69" (already inches)
  const ftInMatch = heightStr.match(/(\d+)['\-\s]+(\d+)/);
  if (ftInMatch) {
    const feet = parseInt(ftInMatch[1], 10);
    const inches = parseInt(ftInMatch[2], 10);
    return feet * 12 + inches;
  }
  
  // If it's just a number, assume it's already inches
  const numMatch = heightStr.match(/^(\d+)$/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    // If > 12, likely already inches; if <= 12, could be feet only
    return val > 12 ? val : val * 12;
  }
  
  return null;
}

interface PlayerPhysicalData {
  heightInches: number | null;
  weightLbs: number | null;
}

export function UnifiedDataUploadModal({
  open,
  onOpenChange,
  playerId, // This MUST be players.id (not player_profiles.id)
  playerName,
  onSuccess,
  linkVerified = false
}: UnifiedDataUploadModalProps) {
  const [detectedFiles, setDetectedFiles] = useState<DetectedFile[]>([]);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Player physical data from database
  const [playerPhysicalData, setPlayerPhysicalData] = useState<PlayerPhysicalData>({
    heightInches: null,
    weightLbs: null
  });
  
  // Processed results
  const [launchMonitorStats, setLaunchMonitorStats] = useState<LaunchMonitorSessionStats | null>(null);
  const [rebootScores, setRebootScores] = useState<RebootScores | null>(null);
  const [ikData, setIkData] = useState<Record<string, any>[] | null>(null);
  const [meData, setMeData] = useState<Record<string, any>[] | null>(null);
  
  // Fetch player physical data when modal opens
  useEffect(() => {
    async function fetchPlayerData() {
      if (!open || !playerId) return;
      
      try {
        // First try players table (has height_inches, weight_lbs as numbers)
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('height_inches, weight_lbs')
          .eq('id', playerId)
          .maybeSingle();
        
        if (playerData) {
          setPlayerPhysicalData({
            heightInches: playerData.height_inches ? Number(playerData.height_inches) : null,
            weightLbs: playerData.weight_lbs ? Number(playerData.weight_lbs) : null
          });
          return;
        }
        
        // Fallback: check player_profiles (has height as string, weight as number)
        const { data: profileData } = await supabase
          .from('player_profiles')
          .select('height, weight, players_id')
          .eq('players_id', playerId)
          .maybeSingle();
        
        if (profileData) {
          setPlayerPhysicalData({
            heightInches: parseHeightToInches(profileData.height),
            weightLbs: profileData.weight ? Number(profileData.weight) : null
          });
        }
      } catch (error) {
        console.error('Error fetching player physical data:', error);
      }
    }
    
    fetchPlayerData();
  }, [open, playerId]);
  
  const resetState = () => {
    setDetectedFiles([]);
    setLaunchMonitorStats(null);
    setRebootScores(null);
    setIkData(null);
    setMeData(null);
    setSessionDate(new Date().toISOString().split('T')[0]);
  };
  
  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };
  
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const csvFiles = Array.from(files).filter(f => f.name.endsWith('.csv'));
    const newDetectedFiles: DetectedFile[] = [];
    
    for (const file of csvFiles) {
      try {
        const text = await file.text();
        const { headers, rows } = parseCSV(text);
        
        // Pass filename to detection for hints
        const detection = detectCsvType(headers, file.name);
        
        // Determine appropriate counts based on file type
        let swingCount: number | undefined;
        let frameCount: number | undefined;
        
        if (detection.csvType === 'launch-monitor') {
          // For launch monitor, row count = swing count
          swingCount = rows.length;
        } else if (detection.csvType === 'reboot-ik' || detection.csvType === 'reboot-me') {
          // For reboot, rows are frames NOT swings
          frameCount = rows.length;
          // Try to count unique movement IDs if available
          const movementIdCol = headers.find(h => 
            h.toLowerCase().includes('movement_id') || 
            h.toLowerCase().includes('org_movement_id')
          );
          if (movementIdCol) {
            const uniqueMovements = new Set(rows.map(r => r[movementIdCol]).filter(Boolean));
            swingCount = uniqueMovements.size;
          }
        }
        
        newDetectedFiles.push({
          file,
          csvType: detection.csvType,
          brand: detection.brand,
          swingCount,
          rowCount: rows.length,
          frameCount,
          confidence: detection.confidence,
          debugHeaders: detection.debugInfo?.firstHeaders
        });
      } catch (error) {
        console.error(`Error parsing ${file.name}:`, error);
        newDetectedFiles.push({
          file,
          csvType: 'unknown',
          confidence: 'low'
        });
      }
    }
    
    setDetectedFiles(prev => [...prev, ...newDetectedFiles]);
    // Reset processed results when new files are added
    setLaunchMonitorStats(null);
    setRebootScores(null);
  }, []);
  
  const removeFile = (index: number) => {
    setDetectedFiles(prev => prev.filter((_, i) => i !== index));
    setLaunchMonitorStats(null);
    setRebootScores(null);
  };
  
  const processFiles = async () => {
    if (detectedFiles.length === 0) {
      toast.error("Please upload at least one CSV file");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Separate files by type
      const launchMonitorFiles = detectedFiles.filter(f => f.csvType === 'launch-monitor');
      const ikFiles = detectedFiles.filter(f => f.csvType === 'reboot-ik');
      const meFiles = detectedFiles.filter(f => f.csvType === 'reboot-me');
      
      // Process launch monitor data
      if (launchMonitorFiles.length > 0) {
        const allSwings: any[] = [];
        let brand: LaunchMonitorBrand = 'generic';
        
        for (const detected of launchMonitorFiles) {
          const text = await detected.file.text();
          const { headers, rows } = parseCSV(text);
          // Pass filename for better detection
          const detection = detectCsvType(headers, detected.file.name);
          
          // Double-check this is actually launch monitor data
          if (detection.csvType !== 'launch-monitor') {
            console.warn(`File ${detected.file.name} was misclassified, skipping launch monitor processing`);
            continue;
          }
          
          if (detection.columnMap) {
            const swings = parseLaunchMonitorData(rows, detection.columnMap);
            allSwings.push(...swings);
            brand = detection.brand || 'generic';
          }
        }
        
        if (allSwings.length > 0) {
          const stats = calculateLaunchMonitorStats(allSwings, brand);
          setLaunchMonitorStats(stats);
        }
      }
      
      // Process Reboot data
      if (ikFiles.length > 0 || meFiles.length > 0) {
        let parsedIkData: Record<string, any>[] = [];
        let parsedMeData: Record<string, any>[] = [];
        
        for (const detected of ikFiles) {
          const text = await detected.file.text();
          const { rows } = parseCSV(text);
          parsedIkData.push(...rows);
        }
        
        for (const detected of meFiles) {
          const text = await detected.file.text();
          const { rows } = parseCSV(text);
          parsedMeData.push(...rows);
        }
        
        setIkData(parsedIkData.length > 0 ? parsedIkData : null);
        setMeData(parsedMeData.length > 0 ? parsedMeData : null);
        
        if (parsedIkData.length > 0 && parsedMeData.length > 0) {
          // Pass player physical data to calculations
          const scores = calculateRebootScores(
            parsedIkData, 
            parsedMeData,
            'R', // dominantHand default
            'hs', // playerLevel default
            playerPhysicalData.weightLbs,
            playerPhysicalData.heightInches
          );
          setRebootScores(scores);
        } else if (parsedIkData.length > 0 || parsedMeData.length > 0) {
          toast.warning("Reboot scoring requires both IK and ME files");
        }
      }
      
      toast.success("Files processed successfully");
    } catch (error) {
      console.error("Error processing files:", error);
      toast.error("Failed to process files");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const saveToDatabase = async () => {
    // CRITICAL: playerId MUST be players.id (NOT player_profiles.id)
    if (!playerId) {
      toast.error("Player link missing - cannot save");
      return;
    }
    
    if (!launchMonitorStats && !rebootScores) {
      toast.error("Please process files first");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Save launch monitor session - uses players.id
      if (launchMonitorStats) {
        const { data: sessionData, error: lmError } = await supabase
          .from("launch_monitor_sessions")
          .insert({
            player_id: playerId,
            session_date: sessionDate,
            source: launchMonitorStats.source,
            total_swings: launchMonitorStats.totalSwings,
            misses: launchMonitorStats.misses,
            fouls: launchMonitorStats.fouls,
            balls_in_play: launchMonitorStats.ballsInPlay,
            contact_rate: launchMonitorStats.contactRate,
            avg_exit_velo: launchMonitorStats.avgExitVelo,
            max_exit_velo: launchMonitorStats.maxExitVelo,
            min_exit_velo: launchMonitorStats.minExitVelo,
            velo_90_plus: launchMonitorStats.velo90Plus,
            velo_95_plus: launchMonitorStats.velo95Plus,
            velo_100_plus: launchMonitorStats.velo100Plus,
            avg_launch_angle: launchMonitorStats.avgLaunchAngle,
            optimal_la_count: launchMonitorStats.optimalLaCount,
            ground_ball_count: launchMonitorStats.groundBallCount,
            fly_ball_count: launchMonitorStats.flyBallCount,
            max_distance: launchMonitorStats.maxDistance,
            avg_distance: launchMonitorStats.avgDistance,
            quality_hits: launchMonitorStats.qualityHits,
            barrel_hits: launchMonitorStats.barrelHits,
            quality_hit_pct: launchMonitorStats.qualityHitPct,
            barrel_pct: launchMonitorStats.barrelPct,
            total_points: launchMonitorStats.totalPoints,
            points_per_swing: launchMonitorStats.pointsPerSwing,
            ball_score: launchMonitorStats.ballScore,
            results_breakdown: launchMonitorStats.resultsBreakdown,
            hit_types_breakdown: launchMonitorStats.hitTypesBreakdown,
          })
          .select('id')
          .single();
        
        if (lmError) throw lmError;
        
        // Update player's latest ball score
        await supabase
          .from("players")
          .update({ latest_ball_score: launchMonitorStats.ballScore })
          .eq("id", playerId);
      }
      
      // Save Reboot upload
      if (rebootScores) {
        const { error: rebootError } = await supabase
          .from("reboot_uploads")
          .insert({
            player_id: playerId,
            session_date: sessionDate,
            ik_file_uploaded: ikData !== null,
            me_file_uploaded: meData !== null,
            brain_score: rebootScores.brainScore,
            body_score: rebootScores.bodyScore,
            bat_score: rebootScores.batScore,
            composite_score: rebootScores.compositeScore,
            grade: rebootScores.grade,
            ground_flow_score: rebootScores.groundFlowScore,
            core_flow_score: rebootScores.coreFlowScore,
            upper_flow_score: rebootScores.upperFlowScore,
            pelvis_velocity: rebootScores.pelvisVelocity,
            torso_velocity: rebootScores.torsoVelocity,
            x_factor: rebootScores.xFactor,
            bat_ke: rebootScores.batKE,
            transfer_efficiency: rebootScores.transferEfficiency,
            consistency_cv: rebootScores.consistencyCV,
            consistency_grade: rebootScores.consistencyGrade,
            weakest_link: rebootScores.weakestLink,
            ik_data: ikData,
            me_data: meData,
          });
        
        if (rebootError) throw rebootError;
        
        // Update player's latest scores
        await supabase
          .from("players")
          .update({
            latest_brain_score: rebootScores.brainScore,
            latest_body_score: rebootScores.bodyScore,
            latest_bat_score: rebootScores.batScore,
            latest_composite_score: rebootScores.compositeScore,
          })
          .eq("id", playerId);
      }
      
      toast.success("Session data saved!");
      handleClose();
      onSuccess();
      
    } catch (error: any) {
      console.error("Error saving session:", error);
      const message = error?.message || error?.details || "Failed to save session";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };
  
  const getFileIcon = (csvType: CsvType) => {
    switch (csvType) {
      case 'launch-monitor': return <Target className="h-4 w-4 text-blue-500" />;
      case 'reboot-ik': return <Activity className="h-4 w-4 text-purple-500" />;
      case 'reboot-me': return <Zap className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };
  
  const getFileLabel = (detected: DetectedFile) => {
    switch (detected.csvType) {
      case 'launch-monitor':
        return `${getBrandDisplayName(detected.brand || 'generic')} (${detected.swingCount || detected.rowCount} swings)`;
      case 'reboot-ik': {
        const swingInfo = detected.swingCount ? `${detected.swingCount} swings, ` : '';
        return `Reboot Motion — Inverse Kinematics (${swingInfo}${detected.frameCount || detected.rowCount} frames)`;
      }
      case 'reboot-me': {
        const swingInfo = detected.swingCount ? `${detected.swingCount} swings, ` : '';
        return `Reboot Motion — Momentum/Energy (${swingInfo}${detected.frameCount || detected.rowCount} frames)`;
      }
      default:
        return 'Unknown format';
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };
  
  const hasProcessedData = launchMonitorStats || rebootScores;
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Session Data</DialogTitle>
          <DialogDescription>
            Upload CSV files from HitTrax, Trackman, Rapsodo, or Reboot Motion to calculate player metrics.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Player: <span className="font-medium text-foreground">{playerName}</span>
          </div>
          
          {/* Session Date */}
          <div className="space-y-2">
            <Label>Session Date</Label>
            <Input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>
          
          {/* File Upload */}
          <div className="space-y-2">
            <Label>CSV Files</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors relative">
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Drop files or click to browse</p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Launch Monitors:</strong> HitTrax, Trackman, Rapsodo, FlightScope
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Biomechanics:</strong> Reboot Motion (IK + ME files)
              </p>
            </div>
          </div>
          
          {/* Detected Files List */}
          {detectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Detected Files</Label>
              {detectedFiles.map((detected, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {getFileIcon(detected.csvType)}
                    <div>
                      <span className="text-sm font-medium">{detected.file.name}</span>
                      <div className="flex items-center gap-2">
                        {detected.csvType !== 'unknown' ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-muted-foreground">
                              {getFileLabel(detected)}
                            </span>
                            {detected.confidence === 'low' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-400">Low Confidence</Badge>
                            )}
                            {detected.csvType === 'reboot-ik' && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">Body Analysis</Badge>
                            )}
                            {detected.csvType === 'reboot-me' && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Energy Transfer</Badge>
                            )}
                          </>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 text-amber-500" />
                              <span className="text-xs text-amber-600">Unknown format — check headers</span>
                            </div>
                            {detected.debugHeaders && detected.debugHeaders.length > 0 && (
                              <div className="text-[10px] text-muted-foreground font-mono bg-muted/50 p-1 rounded max-w-xs overflow-x-auto">
                                Headers: {detected.debugHeaders.slice(0, 5).join(', ')}...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
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
          
          {/* Process Button */}
          {detectedFiles.length > 0 && !hasProcessedData && (
            <Button
              onClick={processFiles}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Process Files"
              )}
            </Button>
          )}
          
          {/* Launch Monitor Results Preview */}
          {launchMonitorStats && (
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Launch Monitor Data</span>
                <Badge variant="outline">{getBrandDisplayName(launchMonitorStats.source)}</Badge>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Ball Score</div>
                <div className={`text-4xl font-bold ${getScoreColor(launchMonitorStats.ballScore)}`}>
                  {launchMonitorStats.ballScore}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Swings:</span>
                  <span className="font-medium">{launchMonitorStats.totalSwings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact Rate:</span>
                  <span className="font-medium">{launchMonitorStats.contactRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Exit Velo:</span>
                  <span className="font-medium">{launchMonitorStats.avgExitVelo} mph</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Exit Velo:</span>
                  <span className="font-medium">{launchMonitorStats.maxExitVelo} mph</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Reboot Partial Data Preview (only IK or only ME uploaded) */}
          {(ikData || meData) && !rebootScores && (
            <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-500" />
                <span className="font-medium">Reboot Motion Data</span>
                <Badge variant="outline" className="text-amber-600 border-amber-400">Partial</Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                {ikData && (
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      <span className="font-medium text-purple-700 dark:text-purple-300">Inverse Kinematics</span>
                    </div>
                    <div className="text-muted-foreground">
                      <div>Frames: {ikData.length.toLocaleString()}</div>
                      <div className="text-xs">Body movement data</div>
                    </div>
                  </div>
                )}
                
                {meData && (
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium text-yellow-700 dark:text-yellow-300">Momentum/Energy</span>
                    </div>
                    <div className="text-muted-foreground">
                      <div>Frames: {meData.length.toLocaleString()}</div>
                      <div className="text-xs">Energy transfer data</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-amber-600 dark:text-amber-400 text-center bg-amber-100 dark:bg-amber-900/30 p-2 rounded">
                ⚠️ Upload both IK and ME files to calculate 4B scores
              </div>
            </div>
          )}
          
          {/* Reboot Results Preview */}
          {rebootScores && (
            <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-500" />
                  <span className="font-medium">4B Bio Engine Results</span>
                </div>
                {rebootScores.swingCount && (
                  <Badge variant="outline">{rebootScores.swingCount} swings</Badge>
                )}
              </div>
              
              {/* Catch Barrel Score - Main Number */}
              <div className="text-center py-2">
                <div className="text-sm text-muted-foreground">Catch Barrel Score</div>
                <div className={`text-4xl font-bold ${getScoreColor(rebootScores.catchBarrelScore)}`}>
                  {rebootScores.catchBarrelScore}
                </div>
                <div className="text-sm font-medium text-muted-foreground">{rebootScores.grades.overall}</div>
              </div>
              
              {/* 4B Grid */}
              <div className="grid grid-cols-4 gap-2 text-center border-t border-purple-200 dark:border-purple-800 pt-3">
                <div>
                  <div className="text-xs text-muted-foreground">Brain</div>
                  <div className={`text-xl font-bold ${getScoreColor(rebootScores.brainScore)}`}>
                    {rebootScores.brainScore}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{rebootScores.grades.brain}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Body</div>
                  <div className={`text-xl font-bold ${getScoreColor(rebootScores.bodyScore)}`}>
                    {rebootScores.bodyScore}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{rebootScores.grades.body}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Bat</div>
                  <div className={`text-xl font-bold ${getScoreColor(rebootScores.batScore)}`}>
                    {rebootScores.batScore}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{rebootScores.grades.bat}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Ball</div>
                  <div className={`text-xl font-bold ${getScoreColor(rebootScores.ballScore)}`}>
                    {rebootScores.ballScore}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{rebootScores.grades.ball}</div>
                </div>
              </div>
              
              {/* Flow Components */}
              <div className="grid grid-cols-3 gap-2 text-center border-t border-purple-200 dark:border-purple-800 pt-3">
                <div>
                  <div className="text-xs text-muted-foreground">Ground Flow</div>
                  <div className="text-lg font-semibold">{rebootScores.groundFlowScore}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Core Flow</div>
                  <div className="text-lg font-semibold">{rebootScores.coreFlowScore}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Upper Flow</div>
                  <div className="text-lg font-semibold">{rebootScores.upperFlowScore}</div>
                </div>
              </div>
              
              {/* Detailed Metrics - Conditionally show based on data source */}
              <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-purple-200 dark:border-purple-800">
                {/* IK-specific metrics: only show when IK data is present */}
                {rebootScores.ikMetrics && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">X-Factor:</span>
                      <span className="font-medium">{rebootScores.xFactor}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sequence:</span>
                      <span className="font-medium">{rebootScores.properSequencePct}%</span>
                    </div>
                  </>
                )}
                {/* ME-specific metrics: only show when ME data is present */}
                {rebootScores.meMetrics && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Arms KE:</span>
                      <span className="font-medium">{rebootScores.armsKE} J</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transfer Eff:</span>
                      <span className="font-medium">{rebootScores.transferEfficiency}%</span>
                    </div>
                  </>
                )}
              </div>
              
              {/* Kinetic Exit Velocity Potential - LOCKED DISPLAY (ME-only) */}
              {rebootScores.kineticPotential?.hasProjections && (
                <div className="border-t border-purple-200 dark:border-purple-800 pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Kinetic Exit Velocity Potential</span>
                  </div>
                  
                  {/* Main Exit Velocity Projection - Prominently Displayed */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-3 rounded-lg">
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-amber-600">
                          {rebootScores.kineticPotential.estimatedCurrentBatSpeedMph}
                        </div>
                        <div className="text-xs text-muted-foreground">mph EV</div>
                        <div className="text-[10px] text-muted-foreground font-medium">Current Potential</div>
                      </div>
                      <div className="text-xl text-muted-foreground">→</div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {rebootScores.kineticPotential.projectedBatSpeedCeilingMph}
                        </div>
                        <div className="text-xs text-muted-foreground">mph EV</div>
                        <div className="text-[10px] text-muted-foreground font-medium">Ceiling if leaks close</div>
                      </div>
                      <div className="text-center border-l pl-4 border-orange-200 dark:border-orange-800">
                        <div className="text-xl font-bold text-green-600">
                          +{rebootScores.kineticPotential.mphLeftOnTable}
                        </div>
                        <div className="text-xs text-muted-foreground">mph</div>
                        <div className="text-[10px] text-muted-foreground font-medium">Untapped EV</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Derived Metrics with Tooltips */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-muted/50 rounded group relative">
                      <div className="font-medium">{rebootScores.kineticPotential.massAdjustedEnergy}</div>
                      <div className="text-muted-foreground">MAE (J/kg)</div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 w-40 p-1.5 bg-popover text-popover-foreground text-[10px] rounded shadow-lg border">
                        How much engine output you generate for your body size.
                      </div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded group relative">
                      <div className="font-medium">{rebootScores.kineticPotential.leverIndex}</div>
                      <div className="text-muted-foreground">Lever Index</div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 w-40 p-1.5 bg-popover text-popover-foreground text-[10px] rounded shadow-lg border">
                        How your height affects your exit velocity potential.
                      </div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded group relative">
                      <div className="font-medium">{Math.round(rebootScores.kineticPotential.efficiency * 100)}%</div>
                      <div className="text-muted-foreground">Efficiency</div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 w-40 p-1.5 bg-popover text-popover-foreground text-[10px] rounded shadow-lg border">
                        How much of your body's energy actually reaches the barrel.
                      </div>
                    </div>
                  </div>
                  
                  {/* MPH Left Caption - Exact Language */}
                  <p className="text-xs text-muted-foreground text-center italic">
                    Speed that becomes available as energy transfer improves.
                  </p>
                  
                  {/* Warnings if any */}
                  {rebootScores.kineticPotential.warnings?.length > 0 && (
                    <div className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {rebootScores.kineticPotential.warnings.join(', ')}
                    </div>
                  )}
                </div>
              )}
              
              {/* Training Visualizer - Show the leak */}
              {rebootScores.leak && rebootScores.leak.type !== LeakType.UNKNOWN && (
                <div className="border-t border-purple-200 dark:border-purple-800 pt-3">
                  <TrainingSwingVisualizer
                    leakType={rebootScores.leak.type}
                    swingCount={rebootScores.swingCount || 0}
                    hasContactEvent={rebootScores.dataQuality?.hasContactEvent ?? true}
                  />
                </div>
              )}
              
              <div className="text-sm text-center text-muted-foreground">
                Weakest Link: <span className="font-medium capitalize text-orange-500">{rebootScores.weakestLink}</span>
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={saveToDatabase}
              disabled={!hasProcessedData || isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Session
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
