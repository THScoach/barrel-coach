import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { analyzeRebootSession, getSessionSummary, SwingAnalysisResult } from './rebootAnalysis';

interface RebootUploaderProps {
  playerId: string;
  sessionId?: string;
  onComplete?: (results: SwingAnalysisResult[]) => void;
}

interface FileState {
  file: File | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
}

const MOTOR_PROFILE_COLORS: Record<string, string> = {
  SPINNER: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
  WHIPPER: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  SLINGSHOTTER: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  TITAN: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
  SEQUENCE_ISSUE: 'bg-red-500/20 text-red-300 border-red-500/50',
  DATA_QUALITY_ISSUE: 'bg-gray-500/20 text-gray-300 border-gray-500/50',
};

export function RebootUploader({ playerId, sessionId, onComplete }: RebootUploaderProps) {
  const [momentumFile, setMomentumFile] = useState<FileState>({ file: null, status: 'idle' });
  const [ikFile, setIkFile] = useState<FileState>({ file: null, status: 'idle' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SwingAnalysisResult[] | null>(null);

  const handleFileChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'momentum' | 'ik'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    const setState = type === 'momentum' ? setMomentumFile : setIkFile;
    setState({ file, status: 'ready' });
  }, []);

  const handleAnalyze = async () => {
    if (!momentumFile.file) {
      toast.error('Momentum-Energy CSV is required');
      return;
    }

    setIsAnalyzing(true);
    setProgress(10);

    try {
      // Read momentum file
      const momentumText = await momentumFile.file.text();
      setProgress(30);

      // Read IK file if provided
      let ikText: string | undefined;
      if (ikFile.file) {
        ikText = await ikFile.file.text();
      }
      setProgress(50);

      // Generate session ID if not provided
      const effectiveSessionId = sessionId || crypto.randomUUID();

      // Analyze and save
      const analysisResults = await analyzeRebootSession(
        momentumText,
        ikText,
        playerId,
        effectiveSessionId,
        momentumFile.file.name
      );
      setProgress(90);

      setResults(analysisResults);
      setProgress(100);

      if (analysisResults.length > 0) {
        toast.success(`Analyzed ${analysisResults.length} swings successfully`);
        onComplete?.(analysisResults);
      } else {
        toast.warning('No valid swings found in the data');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze CSV files');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const summary = results ? getSessionSummary(results) : null;

  return (
    <div className="space-y-4">
      {/* File Upload Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Reboot Motion Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Momentum File (Required) */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Momentum-Energy CSV
              <Badge variant="outline" className="text-xs">Required</Badge>
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileChange(e, 'momentum')}
                className="hidden"
                id="momentum-file"
                disabled={isAnalyzing}
              />
              <label
                htmlFor="momentum-file"
                className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  momentumFile.file 
                    ? 'border-green-500/50 bg-green-500/10' 
                    : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                {momentumFile.file ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm">{momentumFile.file.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload momentum-energy.csv</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* IK File (Optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Inverse Kinematics CSV
              <Badge variant="secondary" className="text-xs">Optional</Badge>
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileChange(e, 'ik')}
                className="hidden"
                id="ik-file"
                disabled={isAnalyzing}
              />
              <label
                htmlFor="ik-file"
                className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  ikFile.file 
                    ? 'border-green-500/50 bg-green-500/10' 
                    : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                {ikFile.file ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm">{ikFile.file.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload inverse-kinematics.csv (for X-Factor)</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Progress */}
          {isAnalyzing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Analyzing swing biomechanics...
              </p>
            </div>
          )}

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={!momentumFile.file || isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Analyze Swings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {summary && summary.totalSwings > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Session Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{summary.totalSwings}</div>
                <div className="text-xs text-muted-foreground">Total Swings</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Badge className={`${MOTOR_PROFILE_COLORS[summary.dominantProfile]} border`}>
                  {summary.dominantProfile}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">Motor Profile</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{summary.avgTimingGap}ms</div>
                <div className="text-xs text-muted-foreground">Avg P→T Gap</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{summary.sequenceRate}%</div>
                <div className="text-xs text-muted-foreground">Sequence Correct</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{summary.decelRate}%</div>
                <div className="text-xs text-muted-foreground">Decel Quality</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{summary.profileConsistency}%</div>
                <div className="text-xs text-muted-foreground">Profile Consistency</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Swings List */}
      {results && results.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Individual Swings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {results.map((swing, idx) => (
                <div
                  key={swing.movement_id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                    <Badge className={`${MOTOR_PROFILE_COLORS[swing.motor_profile]} border`}>
                      {swing.motor_profile}
                    </Badge>
                    <span className="text-sm font-mono">{swing.sequence}</span>
                    {!swing.sequence_correct && (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <span className="text-muted-foreground">Gap: </span>
                      <span className="font-medium">{swing.peak_timing_gap_ms}ms</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground">Transfer: </span>
                      <span className={`font-medium ${
                        swing.transfer_ratio_rating === 'elite' ? 'text-green-400' :
                        swing.transfer_ratio_rating === 'good' ? 'text-blue-400' :
                        swing.transfer_ratio_rating === 'developing' ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {swing.transfer_ratio.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      {swing.all_segments_decel ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
