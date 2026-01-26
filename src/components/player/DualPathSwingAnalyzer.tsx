/**
 * Dual-Path Swing Analyzer
 * ============================================================================
 * Client-side for instant preview → Server-side for accurate analysis
 * 
 * Flow:
 * 1. User captures/selects video
 * 2. IMMEDIATELY run client-side MediaPipe → show preview metrics
 * 3. SIMULTANEOUSLY upload video to storage
 * 4. Once uploaded, trigger server-side analysis for final results
 * 5. Update UI with accurate server results when ready
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Video, 
  X, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  Server,
  Camera,
  RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  analyzeSwingVideo, 
  type SwingVideoAnalysisResult 
} from "@/lib/video-analysis";
import { VideoRecorder } from "@/components/VideoRecorder";

interface DualPathSwingAnalyzerProps {
  playerId: string;
  playerName: string;
  playerAge?: number;
  playerLevel?: string;
  isPaidUser?: boolean;
  onComplete?: (result: AnalysisResult) => void;
}

interface AnalysisResult {
  clientPreview: SwingVideoAnalysisResult | null;
  serverAnalysis: any | null;
  sessionId: string | null;
}

type AnalysisState = 
  | "idle"           // No video selected
  | "recording"      // Camera is recording
  | "client_analyzing" // Running client-side MediaPipe
  | "uploading"      // Uploading to storage
  | "server_analyzing" // Waiting for server response
  | "complete"       // Both analyses done
  | "error";

interface ProgressState {
  client: { status: "pending" | "running" | "complete" | "error"; progress: number; message?: string };
  upload: { status: "pending" | "running" | "complete" | "error"; progress: number; message?: string };
  server: { status: "pending" | "running" | "complete" | "error"; progress: number; message?: string };
}

export function DualPathSwingAnalyzer({
  playerId,
  playerName,
  playerAge,
  playerLevel,
  isPaidUser = false,
  onComplete,
}: DualPathSwingAnalyzerProps) {
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  
  // Results
  const [clientResult, setClientResult] = useState<SwingVideoAnalysisResult | null>(null);
  const [serverResult, setServerResult] = useState<any | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Progress tracking
  const [progress, setProgress] = useState<ProgressState>({
    client: { status: "pending", progress: 0 },
    upload: { status: "pending", progress: 0 },
    server: { status: "pending", progress: 0 },
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // =========================================================================
  // FILE HANDLING
  // =========================================================================

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const handleVideoRecorded = (blob: Blob) => {
    const file = new File([blob], `swing_${Date.now()}.webm`, { type: blob.type });
    setShowRecorder(false);
    processSelectedFile(file);
  };

  const processSelectedFile = async (file: File) => {
    // Validate
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("Video must be under 500MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setClientResult(null);
    setServerResult(null);
    setErrorMessage(null);
    
    // Start dual-path analysis immediately
    runDualPathAnalysis(file);
  };

  // =========================================================================
  // DUAL-PATH ANALYSIS
  // =========================================================================

  const runDualPathAnalysis = async (file: File) => {
    setAnalysisState("client_analyzing");
    abortControllerRef.current = new AbortController();
    
    // Reset progress
    setProgress({
      client: { status: "running", progress: 0, message: "Starting pose extraction..." },
      upload: { status: "pending", progress: 0 },
      server: { status: "pending", progress: 0 },
    });

    // Run client and upload in parallel
    const [clientAnalysisResult] = await Promise.all([
      runClientAnalysis(file),
      runUploadAndServerAnalysis(file),
    ]);

    // Check if we got results
    if (clientAnalysisResult || serverResult) {
      setAnalysisState("complete");
      onComplete?.({
        clientPreview: clientAnalysisResult,
        serverAnalysis: serverResult,
        sessionId,
      });
    }
  };

  // =========================================================================
  // CLIENT-SIDE ANALYSIS (Instant Preview)
  // =========================================================================

  const runClientAnalysis = async (file: File): Promise<SwingVideoAnalysisResult | null> => {
    try {
      console.log("[Client] Starting MediaPipe analysis...");
      
      const result = await analyzeSwingVideo(file, {
        targetFps: 30,
        modelComplexity: 1,
        onProgress: (pct, status) => {
          setProgress(prev => ({
            ...prev,
            client: { status: "running", progress: pct, message: status },
          }));
        },
      });

      console.log("[Client] Analysis complete:", result.bodyAnalysis.fourBInputs);
      
      setClientResult(result);
      setProgress(prev => ({
        ...prev,
        client: { status: "complete", progress: 100, message: "Preview ready!" },
      }));
      
      // Show instant feedback
      if (result.quality.isUsable) {
        toast.success("Quick preview ready!", { 
          description: `Pelvis: ${result.bodyAnalysis.fourBInputs.pelvis_velocity}°/s`
        });
      } else {
        toast.warning("Video may have issues", {
          description: result.quality.issues.join(", ")
        });
      }
      
      return result;
    } catch (error) {
      console.error("[Client] Analysis failed:", error);
      setProgress(prev => ({
        ...prev,
        client: { status: "error", progress: 0, message: "Preview failed - server analysis will continue" },
      }));
      return null;
    }
  };

  // =========================================================================
  // SERVER-SIDE ANALYSIS (Accurate)
  // =========================================================================

  const runUploadAndServerAnalysis = async (file: File) => {
    try {
      // UPLOAD
      setProgress(prev => ({
        ...prev,
        upload: { status: "running", progress: 0, message: "Uploading video..." },
      }));
      setAnalysisState("uploading");

      const fileName = `${playerId}/${Date.now()}_${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("swing-videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setProgress(prev => ({
        ...prev,
        upload: { status: "complete", progress: 100, message: "Uploaded!" },
      }));

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("swing-videos")
        .getPublicUrl(fileName);

      // Extract frames for server analysis
      const frames = await extractFramesForServer(file);
      
      // SERVER ANALYSIS
      setProgress(prev => ({
        ...prev,
        server: { status: "running", progress: 0, message: "Running AI analysis..." },
      }));
      setAnalysisState("server_analyzing");

      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        "analyze-video-2d",
        {
          body: {
            player_id: playerId,
            video_url: urlData.publicUrl,
            video_filename: file.name,
            video_storage_path: fileName,
            is_paid_user: isPaidUser,
            player_age: playerAge,
            player_level: playerLevel,
            frames: frames,
          },
        }
      );

      if (analysisError) throw analysisError;

      if (!analysisData.success) {
        throw new Error(analysisData.error || "Analysis failed");
      }

      // Store session ID for polling
      setSessionId(analysisData.session_id);

      // Poll for results if async
      if (analysisData.status === "processing") {
        await pollForServerResults(analysisData.session_id);
      } else {
        setServerResult(analysisData);
        setProgress(prev => ({
          ...prev,
          server: { status: "complete", progress: 100, message: "Analysis complete!" },
        }));
      }

    } catch (error) {
      console.error("[Server] Analysis failed:", error);
      setProgress(prev => ({
        ...prev,
        upload: prev.upload.status === "running" 
          ? { status: "error", progress: 0, message: "Upload failed" }
          : prev.upload,
        server: { status: "error", progress: 0, message: error instanceof Error ? error.message : "Server analysis failed" },
      }));
      
      // If we have client results, still mark as complete
      if (clientResult) {
        setAnalysisState("complete");
        toast.warning("Server analysis failed, showing preview results");
      } else {
        setAnalysisState("error");
        setErrorMessage(error instanceof Error ? error.message : "Analysis failed");
      }
    }
  };

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  const extractFramesForServer = async (file: File): Promise<string[]> => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.muted = true;
    
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
    });
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 640;  // Reduced for server efficiency
    canvas.height = 360;
    
    const frames: string[] = [];
    const duration = video.duration;
    const frameCount = Math.min(8, Math.ceil(duration * 4)); // Max 8 frames, ~4fps
    const interval = duration / frameCount;
    
    for (let i = 0; i < frameCount; i++) {
      video.currentTime = i * interval;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    
    URL.revokeObjectURL(video.src);
    return frames;
  };

  const pollForServerResults = async (sessionId: string, maxAttempts = 20) => {
    const pollInterval = 3000; // 3 seconds
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const { data, error } = await supabase
        .from("video_2d_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      
      if (error) continue;
      
      if (data.processing_status === "complete") {
        setServerResult({
          success: true,
          analysis: data.analysis_json,
          session_id: sessionId,
          ...data,
        });
        setProgress(prev => ({
          ...prev,
          server: { status: "complete", progress: 100, message: "Analysis complete!" },
        }));
        setAnalysisState("complete");
        toast.success("Full analysis complete!");
        return;
      }
      
      if (data.processing_status === "failed") {
        throw new Error(data.error_message || "Server analysis failed");
      }
      
      // Update progress
      setProgress(prev => ({
        ...prev,
        server: { 
          status: "running", 
          progress: Math.min(90, (attempt / maxAttempts) * 100), 
          message: `Analyzing... (${attempt + 1}/${maxAttempts})` 
        },
      }));
    }
    
    throw new Error("Analysis timed out");
  };

  const handleReset = () => {
    abortControllerRef.current?.abort();
    setSelectedFile(null);
    setPreviewUrl(null);
    setClientResult(null);
    setServerResult(null);
    setSessionId(null);
    setErrorMessage(null);
    setShowRecorder(false);
    setAnalysisState("idle");
    setProgress({
      client: { status: "pending", progress: 0 },
      upload: { status: "pending", progress: 0 },
      server: { status: "pending", progress: 0 },
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  // Recording mode
  if (showRecorder) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Record Swing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VideoRecorder
            onVideoRecorded={handleVideoRecorded}
            onCancel={() => setShowRecorder(false)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Swing Analyzer
          <Badge variant="outline" className="ml-auto text-xs">
            <Zap className="h-3 w-3 mr-1" />
            Instant Preview + Full Analysis
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* IDLE STATE: Upload/Record Options */}
        {analysisState === "idle" && !selectedFile && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Upload swing video</p>
              <p className="text-sm text-muted-foreground mt-1">
                MP4, MOV, or WebM up to 500MB
              </p>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setShowRecorder(true)}
            >
              <Camera className="h-4 w-4 mr-2" />
              Record with Camera
            </Button>
          </div>
        )}

        {/* ANALYZING STATE: Show progress + preview */}
        {selectedFile && analysisState !== "idle" && (
          <div className="space-y-4">
            {/* Video Preview */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={previewUrl || undefined}
                className="w-full h-full object-contain"
                controls
                muted
                loop
              />
              {analysisState !== "complete" && analysisState !== "error" && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </div>

            {/* Progress Indicators */}
            <div className="space-y-3">
              {/* Client-side (instant) */}
              <ProgressRow
                icon={<Zap className="h-4 w-4" />}
                label="Instant Preview"
                state={progress.client}
              />
              
              {/* Upload */}
              <ProgressRow
                icon={<Upload className="h-4 w-4" />}
                label="Upload"
                state={progress.upload}
              />
              
              {/* Server (accurate) */}
              <ProgressRow
                icon={<Server className="h-4 w-4" />}
                label="Full Analysis"
                state={progress.server}
              />
            </div>

            {/* Client Preview Results (show immediately when ready) */}
            {clientResult && progress.client.status === "complete" && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium text-sm">Quick Preview</span>
                  {progress.server.status !== "complete" && (
                    <Badge variant="outline" className="text-xs ml-auto">
                      Full results loading...
                    </Badge>
                  )}
                </div>
                <ClientPreviewMetrics result={clientResult} />
              </div>
            )}

            {/* Server Results (final) */}
            {serverResult?.analysis && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">Full Analysis Complete</span>
                </div>
                <ServerResultsSummary result={serverResult} />
              </div>
            )}

            {/* Error State */}
            {analysisState === "error" && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Analysis Failed</p>
                  <p className="text-xs text-muted-foreground">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                Analyze Another
              </Button>
            </div>
          </div>
        )}

        {/* Tips */}
        {analysisState === "idle" && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>For best results:</strong></p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Film from the side, full body visible</li>
              <li>Good lighting, minimal background clutter</li>
              <li>Include complete swing from setup to finish</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =========================================================================
// SUB-COMPONENTS
// =========================================================================

interface ProgressRowProps {
  icon: React.ReactNode;
  label: string;
  state: { status: "pending" | "running" | "complete" | "error"; progress: number; message?: string };
}

function ProgressRow({ icon, label, state }: ProgressRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <span className={
          state.status === "complete" ? "text-green-500" :
          state.status === "error" ? "text-destructive" :
          state.status === "running" ? "text-primary" :
          "text-muted-foreground"
        }>
          {icon}
        </span>
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {state.status === "complete" && <CheckCircle className="h-3 w-3 text-green-500" />}
          {state.status === "error" && <AlertCircle className="h-3 w-3 text-destructive" />}
          {state.status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
          {state.status === "pending" && "Waiting..."}
        </span>
      </div>
      {state.status === "running" && (
        <>
          <Progress value={state.progress} className="h-1" />
          {state.message && (
            <p className="text-xs text-muted-foreground">{state.message}</p>
          )}
        </>
      )}
    </div>
  );
}

function ClientPreviewMetrics({ result }: { result: SwingVideoAnalysisResult }) {
  const { fourBInputs } = result.bodyAnalysis;
  
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <MetricBadge 
        label="Pelvis Velocity" 
        value={`${fourBInputs.pelvis_velocity}°/s`}
        good={fourBInputs.pelvis_velocity >= 600}
      />
      <MetricBadge 
        label="Torso Velocity" 
        value={`${fourBInputs.torso_velocity}°/s`}
        good={fourBInputs.torso_velocity >= 800}
      />
      <MetricBadge 
        label="X-Factor" 
        value={`${fourBInputs.x_factor}°`}
        good={fourBInputs.x_factor >= 35}
      />
      <MetricBadge 
        label="Sequence" 
        value={fourBInputs.sequencing_quality}
        good={fourBInputs.sequencing_quality === "good"}
      />
      {!result.quality.isUsable && (
        <div className="col-span-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
          ⚠️ {result.quality.issues.join(", ")}
        </div>
      )}
    </div>
  );
}

function MetricBadge({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className={`p-2 rounded ${good ? "bg-green-50" : "bg-gray-50"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono font-medium ${good ? "text-green-700" : ""}`}>{value}</p>
    </div>
  );
}

function ServerResultsSummary({ result }: { result: any }) {
  const analysis = result.analysis;
  if (!analysis) return null;
  
  return (
    <div className="space-y-3">
      {/* 4B Scores */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <ScoreBox label="Body" score={analysis.body} />
        <ScoreBox label="Brain" score={analysis.brain} />
        <ScoreBox label="Bat" score={analysis.bat} />
        <ScoreBox label="Ball" score={analysis.ball} />
      </div>
      
      {/* Motor Profile */}
      {analysis.motor_profile && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{analysis.motor_profile}</Badge>
          <span className="text-xs text-muted-foreground">{analysis.profile_evidence}</span>
        </div>
      )}
      
      {/* Leak Detected */}
      {analysis.leak_detected && analysis.leak_detected !== "CLEAN_TRANSFER" && (
        <div className="text-sm">
          <span className="font-medium text-orange-600">Leak: {analysis.leak_detected}</span>
          <p className="text-xs text-muted-foreground">{analysis.leak_evidence}</p>
        </div>
      )}
      
      {/* Coach Rick Take */}
      {analysis.coach_rick_take && (
        <div className="bg-muted p-3 rounded text-sm italic">
          "{analysis.coach_rick_take}"
        </div>
      )}
    </div>
  );
}

function ScoreBox({ label, score }: { label: string; score: number }) {
  const getColor = (s: number) => {
    if (s >= 65) return "text-green-600 bg-green-50";
    if (s >= 50) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };
  
  return (
    <div className={`p-2 rounded ${getColor(score)}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-lg font-bold">{score}</p>
    </div>
  );
}
