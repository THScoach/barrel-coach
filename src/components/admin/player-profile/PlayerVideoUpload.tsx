import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Video, Loader2, CheckCircle, XCircle, Clock, Plus, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface PlayerVideoUploadProps {
  playerId: string;
  playerName: string;
}

interface QueuedVideo {
  id: string;
  file: File;
  status: "queued" | "uploading" | "analyzing" | "complete" | "failed";
  progress: number;
  sessionId?: string;
  result?: {
    composite?: number;
    body?: number;
    brain?: number;
    bat?: number;
    ball?: number;
    leak_detected?: string;
    grade?: string;
  };
  error?: string;
}

const FRAME_RATES = [
  { value: "120", label: "120 fps" },
  { value: "240", label: "240 fps (recommended)" },
  { value: "480", label: "480 fps" },
  { value: "600", label: "600 fps" },
];

const SESSION_TYPES = [
  { value: "tee_work", label: "Tee Work" },
  { value: "soft_toss", label: "Soft Toss" },
  { value: "front_toss", label: "Front Toss" },
  { value: "bp", label: "BP" },
  { value: "live_ab", label: "Live ABs" },
  { value: "game", label: "Game" },
];

// Extract key frames from video at specific timestamps
async function extractFramesFromVideo(file: File, numFrames: number = 6): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const frames: string[] = [];
    let currentFrame = 0;
    let timestamps: number[] = [];

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const startTime = duration * 0.1;
      const endTime = duration * 0.9;
      const interval = (endTime - startTime) / (numFrames - 1);
      
      timestamps = Array.from({ length: numFrames }, (_, i) => startTime + (i * interval));
      
      const scale = Math.min(1, 1280 / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      
      video.currentTime = timestamps[0];
    };

    video.onseeked = () => {
      if (currentFrame >= numFrames) {
        URL.revokeObjectURL(video.src);
        resolve(frames);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameData = canvas.toDataURL("image/jpeg", 0.85);
      frames.push(frameData);
      
      currentFrame++;
      
      if (currentFrame < numFrames) {
        video.currentTime = timestamps[currentFrame];
      } else {
        URL.revokeObjectURL(video.src);
        resolve(frames);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video for frame extraction"));
    };

    video.src = URL.createObjectURL(file);
    video.load();
  });
}

const MAX_CONCURRENT = 2; // Process 2 videos at a time
const MAX_FILES = 15;

export function PlayerVideoUpload({ playerId, playerName }: PlayerVideoUploadProps) {
  const [queue, setQueue] = useState<QueuedVideo[]>([]);
  const [sessionName, setSessionName] = useState("");
  const [sessionType, setSessionType] = useState("tee_work");
  const [frameRate, setFrameRate] = useState("240");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const processingRef = useRef(false);

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validTypes = ["video/mp4", "video/quicktime"];
    const maxSize = 500 * 1024 * 1024;
    
    const validFiles: QueuedVideo[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (queue.length + validFiles.length >= MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} videos per session`);
        break;
      }
      
      if (!validTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid format (MP4/MOV only)`);
        continue;
      }
      
      if (file.size > maxSize) {
        errors.push(`${file.name}: Too large (max 500MB)`);
        continue;
      }

      validFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: "queued",
        progress: 0,
      });
    }

    if (errors.length > 0) {
      toast.error(errors.slice(0, 3).join("\n"));
    }

    if (validFiles.length > 0) {
      setQueue(prev => [...prev, ...validFiles]);
      toast.success(`Added ${validFiles.length} video${validFiles.length > 1 ? 's' : ''} to queue`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const updateQueueItem = useCallback((id: string, updates: Partial<QueuedVideo>) => {
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const pollForCompletion = async (sessionId: string, maxAttempts = 40): Promise<QueuedVideo["result"]> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const { data, error } = await supabase
        .from("video_2d_sessions")
        .select("processing_status, composite_score, body_score, brain_score, bat_score, ball_score, leak_detected, grade, error_message")
        .eq("id", sessionId)
        .single();
      
      if (error) continue;
      
      if (data.processing_status === "complete") {
        return {
          composite: data.composite_score,
          body: data.body_score,
          brain: data.brain_score,
          bat: data.bat_score,
          ball: data.ball_score,
          leak_detected: data.leak_detected,
          grade: data.grade,
        };
      }
      
      if (data.processing_status === "failed") {
        throw new Error(data.error_message || "Analysis failed");
      }
    }
    
    throw new Error("Analysis timed out");
  };

  const processVideo = async (item: QueuedVideo, swingIndex: number) => {
    const { id, file } = item;
    
    try {
      // Step 1: Extract frames
      updateQueueItem(id, { status: "uploading", progress: 10 });
      const frames = await extractFramesFromVideo(file, 6);
      updateQueueItem(id, { progress: 30 });

      // Step 2: Upload to storage
      const timestamp = Date.now();
      const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${playerId}/${timestamp}_swing${swingIndex}_${safeFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("swing-videos")
        .upload(storagePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      updateQueueItem(id, { progress: 50 });

      // Step 3: Get public URL
      const { data: urlData } = supabase.storage
        .from("swing-videos")
        .getPublicUrl(storagePath);

      // Step 4: Call analyze function
      updateQueueItem(id, { status: "analyzing", progress: 60 });
      
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        "analyze-video-2d",
        { 
          body: { 
            player_id: playerId,
            video_url: urlData.publicUrl,
            video_filename: file.name,
            video_storage_path: storagePath,
            context: `${sessionType} - Swing ${swingIndex}`,
            frame_rate: parseInt(frameRate),
            is_paid_user: false,
            frames,
          } 
        }
      );

      if (analysisError || !analysisResult?.success) {
        throw new Error(analysisResult?.error || analysisError?.message || "Analysis failed");
      }

      updateQueueItem(id, { sessionId: analysisResult.session_id, progress: 70 });

      // Step 5: Poll for completion
      const result = await pollForCompletion(analysisResult.session_id);
      
      updateQueueItem(id, { 
        status: "complete", 
        progress: 100, 
        result 
      });

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['player-2d-sessions', playerId] });
      queryClient.invalidateQueries({ queryKey: ['player-upload-history', playerId] });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Processing failed";
      updateQueueItem(id, { status: "failed", error: errorMsg, progress: 0 });
    }
  };

  const startProcessing = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    const queuedItems = queue.filter(item => item.status === "queued");
    let swingIndex = queue.filter(item => item.status === "complete").length + 1;
    
    // Process in batches of MAX_CONCURRENT
    for (let i = 0; i < queuedItems.length; i += MAX_CONCURRENT) {
      const batch = queuedItems.slice(i, i + MAX_CONCURRENT);
      await Promise.all(
        batch.map((item, batchIndex) => processVideo(item, swingIndex + i + batchIndex))
      );
    }

    processingRef.current = false;
    setIsProcessing(false);
    
    // Check final results
    const updatedQueue = queue;
    const completed = updatedQueue.filter(item => item.status === "complete").length;
    const failed = updatedQueue.filter(item => item.status === "failed").length;
    
    if (failed === 0) {
      toast.success(`Session complete! ${completed} swings analyzed.`);
    } else {
      toast.warning(`Session complete: ${completed} succeeded, ${failed} failed.`);
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    setQueue([]);
    setSessionName("");
  };

  // Calculate session aggregates
  const completedSwings = queue.filter(item => item.status === "complete" && item.result);
  const avgComposite = completedSwings.length > 0
    ? Math.round(completedSwings.reduce((sum, s) => sum + (s.result?.composite || 0), 0) / completedSwings.length)
    : null;

  const getStatusIcon = (status: QueuedVideo["status"]) => {
    switch (status) {
      case "queued": return <Clock className="h-4 w-4 text-slate-400" />;
      case "uploading": return <Upload className="h-4 w-4 text-blue-400 animate-pulse" />;
      case "analyzing": return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />;
      case "complete": return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusLabel = (status: QueuedVideo["status"]) => {
    switch (status) {
      case "queued": return "Queued";
      case "uploading": return "Uploading...";
      case "analyzing": return "Analyzing...";
      case "complete": return "Complete";
      case "failed": return "Failed";
    }
  };

  return (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Swing Videos (2D Analysis)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Session Name</Label>
            <Input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder={`${sessionType.replace('_', ' ')} - ${new Date().toLocaleDateString()}`}
              className="bg-slate-800/50 border-slate-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Session Type</Label>
            <Select value={sessionType} onValueChange={setSessionType}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {SESSION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Frame Rate</Label>
            <Select value={frameRate} onValueChange={setFrameRate}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {FRAME_RATES.map((rate) => (
                  <SelectItem key={rate.value} value={rate.value}>
                    {rate.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* File Input / Drop Zone */}
        <div 
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            queue.length > 0 
              ? "border-emerald-500/30 bg-emerald-500/5" 
              : "border-slate-700 hover:border-slate-600 bg-slate-800/30"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,.mp4,.mov"
            multiple
            onChange={handleFilesSelect}
            className="hidden"
          />
          {queue.length === 0 ? (
            <div className="text-slate-400">
              <Video className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="font-medium">Click to select swing videos</p>
              <p className="text-xs mt-1">MP4 or MOV, max 500MB each • Select up to {MAX_FILES} videos</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <Plus className="h-5 w-5" />
              <span className="font-medium">Add more videos ({queue.length}/{MAX_FILES})</span>
            </div>
          )}
        </div>

        {/* Queue List */}
        {queue.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">
                <span className="font-medium text-white">{queue.length}</span> video{queue.length !== 1 ? 's' : ''} in queue
                {avgComposite !== null && (
                  <span className="ml-3 text-emerald-400">
                    Avg Composite: <span className="font-bold">{avgComposite}</span>
                  </span>
                )}
              </div>
              {!isProcessing && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearQueue}
                  className="text-slate-400 hover:text-red-400"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {queue.map((item, index) => (
                <div 
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    item.status === "complete" 
                      ? "bg-emerald-500/10 border-emerald-500/30" 
                      : item.status === "failed"
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-slate-800/50 border-slate-700"
                  }`}
                >
                  <span className="text-slate-500 text-sm font-mono w-6">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      <span className="text-white font-medium truncate text-sm">
                        {item.file.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        ({(item.file.size / (1024 * 1024)).toFixed(1)}MB)
                      </span>
                    </div>
                    
                    {/* Progress bar for active items */}
                    {(item.status === "uploading" || item.status === "analyzing") && (
                      <Progress value={item.progress} className="h-1 mt-2" />
                    )}
                    
                    {/* Result display for completed items */}
                    {item.status === "complete" && item.result && (
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="text-emerald-400 font-medium">
                          Composite: {item.result.composite}
                        </span>
                        <span className="text-slate-400">
                          B/B/B/B: {item.result.body}/{item.result.brain}/{item.result.bat}/{item.result.ball}
                        </span>
                        {item.result.leak_detected && item.result.leak_detected !== "CLEAN_TRANSFER" && (
                          <span className="text-amber-400">
                            Leak: {item.result.leak_detected.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Error display */}
                    {item.status === "failed" && item.error && (
                      <p className="text-xs text-red-400 mt-1 truncate">{item.error}</p>
                    )}
                  </div>

                  {/* Status label */}
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    item.status === "complete" ? "bg-emerald-500/20 text-emerald-400" :
                    item.status === "failed" ? "bg-red-500/20 text-red-400" :
                    item.status === "analyzing" ? "bg-amber-500/20 text-amber-400" :
                    item.status === "uploading" ? "bg-blue-500/20 text-blue-400" :
                    "bg-slate-700 text-slate-400"
                  }`}>
                    {getStatusLabel(item.status)}
                  </span>

                  {/* Remove button for queued items */}
                  {item.status === "queued" && !isProcessing && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFromQueue(item.id); }}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {queue.length > 0 && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={startProcessing}
              disabled={isProcessing || queue.filter(i => i.status === "queued").length === 0}
              className="flex-1 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing {queue.filter(i => ["uploading", "analyzing"].includes(i.status)).length} of {queue.length}...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Start Analysis ({queue.filter(i => i.status === "queued").length} pending)
                </>
              )}
            </Button>
          </div>
        )}

        {/* Session Summary */}
        {completedSwings.length > 0 && !isProcessing && (
          <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Session Summary</h4>
                <p className="text-sm text-slate-400">
                  {completedSwings.length} swing{completedSwings.length !== 1 ? 's' : ''} analyzed
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-emerald-400">{avgComposite}</div>
                <div className="text-xs text-slate-400">Avg Composite</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}