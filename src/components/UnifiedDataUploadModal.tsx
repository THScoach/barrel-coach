import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
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
import { detectCsvType, parseCSV, getBrandDisplayName, CsvType, LaunchMonitorBrand } from "@/lib/csv-detector";
import { parseLaunchMonitorData, calculateLaunchMonitorStats, LaunchMonitorSessionStats } from "@/lib/launch-monitor-parser";
import { calculateRebootScores, RebootScores, processRebootIK, processRebootME, RebootIKMetrics, RebootMEMetrics } from "@/lib/reboot-parser";

interface DetectedFile {
  file: File;
  csvType: CsvType;
  brand?: LaunchMonitorBrand;
  swingCount?: number;
  rowCount?: number;
}

interface UnifiedDataUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  playerName: string;
  onSuccess: () => void;
}

export function UnifiedDataUploadModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  onSuccess
}: UnifiedDataUploadModalProps) {
  const [detectedFiles, setDetectedFiles] = useState<DetectedFile[]>([]);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Processed results
  const [launchMonitorStats, setLaunchMonitorStats] = useState<LaunchMonitorSessionStats | null>(null);
  const [rebootScores, setRebootScores] = useState<RebootScores | null>(null);
  const [ikData, setIkData] = useState<Record<string, any>[] | null>(null);
  const [meData, setMeData] = useState<Record<string, any>[] | null>(null);
  
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
        const detection = detectCsvType(headers);
        
        newDetectedFiles.push({
          file,
          csvType: detection.csvType,
          brand: detection.brand,
          swingCount: detection.csvType === 'launch-monitor' ? rows.length : undefined,
          rowCount: rows.length
        });
      } catch (error) {
        console.error(`Error parsing ${file.name}:`, error);
        newDetectedFiles.push({
          file,
          csvType: 'unknown'
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
          const detection = detectCsvType(headers);
          
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
          const scores = calculateRebootScores(parsedIkData, parsedMeData);
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
    if (!launchMonitorStats && !rebootScores) {
      toast.error("Please process files first");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Save launch monitor session
      if (launchMonitorStats) {
        const { error: lmError } = await supabase
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
          });
        
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
      
    } catch (error) {
      console.error("Error saving session:", error);
      toast.error("Failed to save session");
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
        return `${getBrandDisplayName(detected.brand || 'generic')} (${detected.swingCount} swings)`;
      case 'reboot-ik':
        return `Reboot Motion - Inverse Kinematics (${detected.rowCount} rows)`;
      case 'reboot-me':
        return `Reboot Motion - Momentum Energy (${detected.rowCount} rows)`;
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
                            {detected.csvType === 'reboot-ik' && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">Body Analysis</Badge>
                            )}
                            {detected.csvType === 'reboot-me' && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">Energy Transfer</Badge>
                            )}
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-amber-500" />
                            <span className="text-xs text-amber-600">Unknown format</span>
                          </>
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
          
          {/* Reboot Results Preview */}
          {rebootScores && (
            <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-500" />
                  <span className="font-medium">Reboot Motion Data</span>
                </div>
                {rebootScores.swingCount && (
                  <Badge variant="outline">{rebootScores.swingCount} swings</Badge>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Brain</div>
                  <div className={`text-xl font-bold ${getScoreColor(rebootScores.brainScore)}`}>
                    {rebootScores.brainScore}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Body</div>
                  <div className={`text-xl font-bold ${getScoreColor(rebootScores.bodyScore)}`}>
                    {rebootScores.bodyScore}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Bat</div>
                  <div className={`text-xl font-bold ${getScoreColor(rebootScores.batScore)}`}>
                    {rebootScores.batScore}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Composite</div>
                  <div className={`text-xl font-bold ${getScoreColor(rebootScores.compositeScore)}`}>
                    {rebootScores.compositeScore}
                  </div>
                </div>
              </div>
              
              {/* Detailed Metrics */}
              <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-purple-200 dark:border-purple-800">
                {rebootScores.ikMetrics && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg X-Factor:</span>
                      <span className="font-medium">{rebootScores.ikMetrics.avgXFactor.toFixed(1)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Pelvis Rot:</span>
                      <span className="font-medium">{rebootScores.ikMetrics.avgPelvisRot.toFixed(1)}°</span>
                    </div>
                  </>
                )}
                {rebootScores.meMetrics && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Energy Efficiency:</span>
                      <span className="font-medium">{rebootScores.meMetrics.avgEnergyEfficiency.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Bat Energy:</span>
                      <span className="font-medium">{rebootScores.meMetrics.avgBatEnergy.toFixed(0)} J</span>
                    </div>
                  </>
                )}
              </div>
              
              <div className="text-sm text-center text-muted-foreground">
                Weakest Link: <span className="font-medium capitalize text-orange-500">{rebootScores.weakestLink}</span> • 
                Grade: <span className="font-medium">{rebootScores.grade}</span>
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
