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
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  X, 
  Loader2,
  Save
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  parseHitTraxCSV, 
  calculateSessionStats, 
  HitTraxRow,
  HitTraxSessionStats 
} from "@/lib/hittrax-parser";

interface HitTraxUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  playerName: string;
  onSuccess: () => void;
}

export function HitTraxUploadModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  onSuccess
}: HitTraxUploadModalProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedRows, setParsedRows] = useState<HitTraxRow[]>([]);
  const [sessionStats, setSessionStats] = useState<HitTraxSessionStats | null>(null);
  
  const resetState = () => {
    setUploadedFiles([]);
    setParsedRows([]);
    setSessionStats(null);
    setSessionDate(new Date().toISOString().split('T')[0]);
  };
  
  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const csvFiles = Array.from(files).filter(f => f.name.endsWith('.csv'));
      setUploadedFiles(prev => [...prev, ...csvFiles]);
      // Reset stats when new files are added
      setSessionStats(null);
      setParsedRows([]);
    }
  }, []);
  
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setSessionStats(null);
    setParsedRows([]);
  };
  
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
      
      toast.success(`Processed ${allRows.length} swings`);
    } catch (error) {
      console.error("Error processing files:", error);
      toast.error("Failed to process CSV files");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const saveToDatabase = async () => {
    if (!sessionStats) {
      toast.error("Please process files first");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const { data: session, error: insertError } = await supabase
        .from("hittrax_sessions")
        .insert({
          player_id: playerId,
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
        .eq("id", playerId);
      
      if (updateError) {
        console.error("Error updating player:", updateError);
      }
      
      toast.success("Session saved!");
      handleClose();
      onSuccess();
      
    } catch (error) {
      console.error("Error saving session:", error);
      toast.error("Failed to save session");
    } finally {
      setIsSaving(false);
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };
  
  const getScoreGrade = (score: number) => {
    if (score >= 70) return 'Plus';
    if (score >= 60) return 'Plus';
    if (score >= 55) return 'Above Avg';
    if (score >= 50) return 'Average';
    if (score >= 45) return 'Below Avg';
    if (score >= 40) return 'Fringe';
    return 'Poor';
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload HitTrax Session</DialogTitle>
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
                id="csv-upload-modal"
              />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Drop files or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Accepts multiple .csv files
              </p>
            </div>
          </div>
          
          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded-lg"
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
              <div className="text-sm text-muted-foreground">
                Total: {uploadedFiles.length} file(s)
              </div>
            </div>
          )}
          
          {/* Process Button */}
          {uploadedFiles.length > 0 && !sessionStats && (
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
          
          {/* Results Preview */}
          {sessionStats && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Ball Score</div>
                <div className={`text-4xl font-bold ${getScoreColor(sessionStats.ballScore)}`}>
                  {sessionStats.ballScore}
                </div>
                <div className="text-sm text-muted-foreground">
                  {getScoreGrade(sessionStats.ballScore)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Swings:</span>
                  <span className="font-medium">{sessionStats.totalSwings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact Rate:</span>
                  <span className="font-medium">{sessionStats.contactRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Exit Velo:</span>
                  <span className="font-medium">{sessionStats.avgExitVelo} mph</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Exit Velo:</span>
                  <span className="font-medium">{sessionStats.maxExitVelo} mph</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Launch Angle:</span>
                  <span className="font-medium">{sessionStats.avgLaunchAngle}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Points/Swing:</span>
                  <span className="font-medium">{sessionStats.pointsPerSwing}</span>
                </div>
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
              disabled={!sessionStats || isSaving}
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
                  Process & Save
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
