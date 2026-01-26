/**
 * useDualPathAnalysis Hook
 * ============================================================================
 * Reusable hook for running client-side + server-side swing analysis
 * 
 * Usage:
 *   const { analyze, clientResult, serverResult, state, progress } = useDualPathAnalysis({
 *     playerId: "abc123",
 *     isPaidUser: true,
 *   });
 *   
 *   // Trigger analysis
 *   await analyze(videoFile);
 *   
 *   // Results available in clientResult (instant) and serverResult (accurate)
 */

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeSwingVideo, type SwingVideoAnalysisResult } from "@/lib/video-analysis";

export type AnalysisState = 
  | "idle"
  | "client_analyzing"
  | "uploading"
  | "server_analyzing"
  | "complete"
  | "error";

export type StepStatus = "pending" | "running" | "complete" | "error";

export interface ProgressStep {
  status: StepStatus;
  progress: number;
  message?: string;
}

export interface AnalysisProgress {
  client: ProgressStep;
  upload: ProgressStep;
  server: ProgressStep;
}

export interface DualPathAnalysisOptions {
  playerId: string;
  playerAge?: number;
  playerLevel?: string;
  isPaidUser?: boolean;
  /** Skip server analysis - client only */
  clientOnly?: boolean;
  /** Skip client analysis - server only */
  serverOnly?: boolean;
  /** Callback when client analysis completes */
  onClientComplete?: (result: SwingVideoAnalysisResult) => void;
  /** Callback when server analysis completes */
  onServerComplete?: (result: any) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface DualPathAnalysisResult {
  /** Current analysis state */
  state: AnalysisState;
  /** Progress for each step */
  progress: AnalysisProgress;
  /** Client-side analysis result (instant preview) */
  clientResult: SwingVideoAnalysisResult | null;
  /** Server-side analysis result (accurate) */
  serverResult: any | null;
  /** Session ID from server */
  sessionId: string | null;
  /** Error message if failed */
  error: string | null;
  /** Start analysis on a video file */
  analyze: (file: File) => Promise<void>;
  /** Reset state */
  reset: () => void;
  /** Check if analysis is running */
  isAnalyzing: boolean;
}

const initialProgress: AnalysisProgress = {
  client: { status: "pending", progress: 0 },
  upload: { status: "pending", progress: 0 },
  server: { status: "pending", progress: 0 },
};

export function useDualPathAnalysis(options: DualPathAnalysisOptions): DualPathAnalysisResult {
  const {
    playerId,
    playerAge,
    playerLevel,
    isPaidUser = false,
    clientOnly = false,
    serverOnly = false,
    onClientComplete,
    onServerComplete,
    onError,
  } = options;

  const [state, setState] = useState<AnalysisState>("idle");
  const [progress, setProgress] = useState<AnalysisProgress>(initialProgress);
  const [clientResult, setClientResult] = useState<SwingVideoAnalysisResult | null>(null);
  const [serverResult, setServerResult] = useState<any | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const abortRef = useRef<AbortController | null>(null);

  // =========================================================================
  // CLIENT-SIDE ANALYSIS
  // =========================================================================

  const runClientAnalysis = useCallback(async (file: File): Promise<SwingVideoAnalysisResult | null> => {
    try {
      setProgress(prev => ({
        ...prev,
        client: { status: "running", progress: 0, message: "Loading video..." },
      }));

      const result = await analyzeSwingVideo(file, {
        targetFps: 30,
        modelComplexity: 1,
        onProgress: (pct, msg) => {
          setProgress(prev => ({
            ...prev,
            client: { status: "running", progress: pct, message: msg },
          }));
        },
      });

      setClientResult(result);
      setProgress(prev => ({
        ...prev,
        client: { status: "complete", progress: 100, message: "Preview ready" },
      }));
      
      onClientComplete?.(result);
      return result;
    } catch (err) {
      console.error("[Client Analysis] Failed:", err);
      setProgress(prev => ({
        ...prev,
        client: { status: "error", progress: 0, message: "Preview failed" },
      }));
      return null;
    }
  }, [onClientComplete]);

  // =========================================================================
  // SERVER-SIDE ANALYSIS
  // =========================================================================

  const runServerAnalysis = useCallback(async (file: File): Promise<any | null> => {
    try {
      // Upload
      setProgress(prev => ({
        ...prev,
        upload: { status: "running", progress: 0, message: "Uploading..." },
      }));
      setState("uploading");

      const fileName = `${playerId}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("swing-videos")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      setProgress(prev => ({
        ...prev,
        upload: { status: "complete", progress: 100, message: "Uploaded" },
      }));

      // Get URL
      const { data: urlData } = supabase.storage
        .from("swing-videos")
        .getPublicUrl(fileName);

      // Extract frames
      const frames = await extractFrames(file);

      // Call server
      setProgress(prev => ({
        ...prev,
        server: { status: "running", progress: 0, message: "Analyzing..." },
      }));
      setState("server_analyzing");

      const { data, error: fnError } = await supabase.functions.invoke(
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
            frames,
          },
        }
      );

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error || "Analysis failed");

      setSessionId(data.session_id);

      // Poll if async
      if (data.status === "processing") {
        return await pollForResults(data.session_id);
      }

      setServerResult(data);
      setProgress(prev => ({
        ...prev,
        server: { status: "complete", progress: 100, message: "Complete" },
      }));
      onServerComplete?.(data);
      return data;
    } catch (err) {
      console.error("[Server Analysis] Failed:", err);
      const message = err instanceof Error ? err.message : "Server analysis failed";
      setProgress(prev => ({
        ...prev,
        upload: prev.upload.status === "running" 
          ? { status: "error", progress: 0, message: "Upload failed" }
          : prev.upload,
        server: { status: "error", progress: 0, message },
      }));
      return null;
    }
  }, [playerId, playerAge, playerLevel, isPaidUser, onServerComplete]);

  // =========================================================================
  // HELPERS
  // =========================================================================

  const extractFrames = async (file: File): Promise<string[]> => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.muted = true;
    
    await new Promise<void>(resolve => { video.onloadedmetadata = () => resolve(); });
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 640;
    canvas.height = 360;
    
    const frames: string[] = [];
    const duration = video.duration;
    const frameCount = Math.min(8, Math.ceil(duration * 4));
    const interval = duration / frameCount;
    
    for (let i = 0; i < frameCount; i++) {
      video.currentTime = i * interval;
      await new Promise<void>(resolve => { video.onseeked = () => resolve(); });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    
    URL.revokeObjectURL(video.src);
    return frames;
  };

  const pollForResults = async (sid: string, maxAttempts = 20): Promise<any> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 3000));
      
      const { data } = await supabase
        .from("video_2d_sessions")
        .select("*")
        .eq("id", sid)
        .single();
      
      if (data?.processing_status === "complete") {
        const result = { success: true, analysis: data.analysis_json, ...data };
        setServerResult(result);
        setProgress(prev => ({
          ...prev,
          server: { status: "complete", progress: 100, message: "Complete" },
        }));
        onServerComplete?.(result);
        return result;
      }
      
      if (data?.processing_status === "failed") {
        throw new Error(data.error_message || "Analysis failed");
      }
      
      setProgress(prev => ({
        ...prev,
        server: { 
          status: "running", 
          progress: Math.min(90, (i / maxAttempts) * 100),
          message: `Analyzing... (${i + 1}/${maxAttempts})`,
        },
      }));
    }
    throw new Error("Analysis timed out");
  };

  // =========================================================================
  // MAIN ANALYZE FUNCTION
  // =========================================================================

  const analyze = useCallback(async (file: File) => {
    // Reset
    setError(null);
    setClientResult(null);
    setServerResult(null);
    setSessionId(null);
    setProgress(initialProgress);
    
    abortRef.current = new AbortController();
    setState("client_analyzing");

    try {
      // Run in parallel (unless one is disabled)
      const promises: Promise<any>[] = [];
      
      if (!serverOnly) {
        promises.push(runClientAnalysis(file));
      }
      if (!clientOnly) {
        promises.push(runServerAnalysis(file));
      }

      await Promise.all(promises);
      setState("complete");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
      setState("error");
      onError?.(err instanceof Error ? err : new Error(message));
    }
  }, [clientOnly, serverOnly, runClientAnalysis, runServerAnalysis, onError]);

  // =========================================================================
  // RESET
  // =========================================================================

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState("idle");
    setProgress(initialProgress);
    setClientResult(null);
    setServerResult(null);
    setSessionId(null);
    setError(null);
  }, []);

  return {
    state,
    progress,
    clientResult,
    serverResult,
    sessionId,
    error,
    analyze,
    reset,
    isAnalyzing: state !== "idle" && state !== "complete" && state !== "error",
  };
}
