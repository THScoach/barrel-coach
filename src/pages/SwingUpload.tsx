import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Video, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type AnalysisStep = "idle" | "uploading" | "processing" | "analyzing" | "building" | "complete" | "error";

const STEP_LABELS: Record<AnalysisStep, string> = {
  idle: "",
  uploading: "Uploading your video…",
  processing: "Processing video…",
  analyzing: "Analyzing swing mechanics…",
  building: "Building your report…",
  complete: "Analysis complete!",
  error: "Something went wrong",
};

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const POLL_INTERVAL = 2000;
const TIMEOUT_MS = 60000;

export default function SwingUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<AnalysisStep>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) return "Please upload an MP4, MOV, or WebM file.";
    if (f.size > MAX_FILE_SIZE) return "File is too large. Maximum size is 100MB.";
    return null;
  };

  const handleFile = useCallback((f: File) => {
    const error = validateFile(f);
    if (error) { toast.error(error); return; }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStep("idle");
    setErrorMessage(null);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const extractFrames = async (videoFile: File): Promise<string[]> => {
    const FRAME_PERCENTAGES = [0.05, 0.20, 0.35, 0.50, 0.65, 0.80, 0.95];
    const TARGET_WIDTH = 800;

    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      const objUrl = URL.createObjectURL(videoFile);
      video.src = objUrl;

      video.onloadedmetadata = async () => {
        const { duration, videoWidth, videoHeight } = video;
        if (!duration || duration === Infinity) {
          URL.revokeObjectURL(objUrl);
          return reject(new Error("Could not read video duration."));
        }

        const scale = TARGET_WIDTH / videoWidth;
        const canvas = document.createElement("canvas");
        canvas.width = TARGET_WIDTH;
        canvas.height = Math.round(videoHeight * scale);
        const ctx = canvas.getContext("2d")!;

        const frames: string[] = [];

        for (const pct of FRAME_PERCENTAGES) {
          const time = pct * duration;
          await new Promise<void>((res) => {
            video.currentTime = time;
            video.onseeked = () => {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              frames.push(canvas.toDataURL("image/jpeg", 0.85));
              res();
            };
          });
        }

        URL.revokeObjectURL(objUrl);
        resolve(frames);
      };

      video.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error("Failed to load video for frame extraction."));
      };
    });
  };

  const startPolling = (sid: string) => {
    pollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("video_2d_sessions" as any)
        .select("processing_status")
        .eq("id", sid)
        .single();

      const status = (data as any)?.processing_status;
      if (status === "processing") setStep("analyzing");
      if (status === "complete") {
        setStep("complete");
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setTimeout(() => navigate(`/report/${sid}`), 1500);
      }
      if (status === "failed") {
        setStep("error");
        setErrorMessage("We couldn't analyze this video. Tips: film from the side, good lighting, full swing visible.");
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    }, POLL_INTERVAL);

    timeoutRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setStep((prev) => {
        if (prev !== "complete" && prev !== "error") {
          toast.info("Analysis is taking longer than expected. We'll notify you when ready.");
          return "building";
        }
        return prev;
      });
    }, TIMEOUT_MS);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setErrorMessage(null);
    setStep("processing");
    setUploadProgress(0);

    try {
      // Step 1: Extract frames from video
      const frames = await extractFrames(file);
      console.log(`[SwingUpload] Extracted ${frames.length} frames`);

      // Step 2: Upload original video
      setStep("uploading");
      const ext = file.name.split(".").pop() || "mp4";
      const storagePath = `2d-analysis/${Date.now()}_${crypto.randomUUID()}.${ext}`;

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 8, 90));
      }, 300);

      const { error: uploadError } = await supabase.storage
        .from("swing-videos")
        .upload(storagePath, file);

      clearInterval(progressInterval);
      if (uploadError) throw new Error("Upload failed. Try again.");
      setUploadProgress(100);

      const { data: urlData } = supabase.storage.from("swing-videos").getPublicUrl(storagePath);
      const videoUrl = urlData.publicUrl;

      // Step 3: Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const playerId = user?.id || "anonymous";

      setStep("analyzing");

      // Step 4: Call analyze-video-2d with frames
      const { data: fnData, error: fnError } = await supabase.functions.invoke("analyze-video-2d", {
        body: {
          player_id: playerId,
          video_url: videoUrl,
          video_filename: file.name,
          video_storage_path: storagePath,
          frames,
          is_paid_user: false,
        },
      });

      if (fnError) {
        console.error("[SwingUpload] Edge function error:", fnError);
        throw new Error("Analysis failed. Please try again.");
      }

      const sid = fnData?.session_id;
      if (!sid) throw new Error("No session ID returned from analysis.");

      setSessionId(sid);
      startPolling(sid);
    } catch (err: any) {
      console.error("[SwingUpload] Error:", err);
      setStep("error");
      setErrorMessage(err.message || "Something went wrong. Please try again.");
    }
  };

  const handleReset = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setStep("idle");
    setUploadProgress(0);
    setErrorMessage(null);
    setSessionId(null);
  };

  const isProcessing = ["uploading", "processing", "analyzing", "building"].includes(step);
  const stepProgress =
    step === "uploading" ? 25 : step === "processing" ? 50 : step === "analyzing" ? 75 : step === "building" ? 90 : step === "complete" ? 100 : 0;

  return (
    <div className="min-h-screen bg-[hsl(var(--navy-900))] flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
          Catching <span className="text-[hsl(var(--accent))]">Barrels</span>
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] mt-2 text-sm">AI-Powered Swing Analysis</p>
      </div>

      <div className="w-full max-w-lg">
        {/* Upload Zone */}
        {!file && step === "idle" && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-12 text-center",
              "hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/5",
              dragActive
                ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 scale-[1.02]"
                : "border-[hsl(var(--navy-600))] bg-[hsl(var(--navy-800))]/50"
            )}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-[hsl(var(--accent))]" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">Drop your swing video here</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">or tap to select a file</p>
              </div>
              <div className="flex gap-2 mt-2">
                {["MP4", "MOV", "WebM"].map((fmt) => (
                  <span key={fmt} className="text-xs px-2 py-1 rounded-full bg-[hsl(var(--navy-700))] text-[hsl(var(--gray-400))]">{fmt}</span>
                ))}
              </div>
              <p className="text-xs text-[hsl(var(--gray-500))]">Max 100MB</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" onChange={handleInputChange} className="hidden" />
          </div>
        )}

        {/* Video Preview + Analysis */}
        {file && (
          <div className="space-y-6">
            {previewUrl && (
              <div className="rounded-2xl overflow-hidden bg-black border border-[hsl(var(--navy-700))]">
                <video src={previewUrl} controls playsInline className="w-full aspect-video object-contain" />
              </div>
            )}

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                <Video className="w-4 h-4" />
                <span className="truncate max-w-[200px]">{file.name}</span>
                <span>({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
              {!isProcessing && step !== "complete" && (
                <button onClick={handleReset} className="text-xs text-[hsl(var(--accent))] hover:underline">Change video</button>
              )}
            </div>

            {isProcessing && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 justify-center">
                  <Loader2 className="w-5 h-5 text-[hsl(var(--accent))] animate-spin" />
                  <span className="text-white font-medium animate-pulse">{STEP_LABELS[step]}</span>
                </div>
                {step === "uploading" && <Progress value={uploadProgress} className="h-2 bg-[hsl(var(--navy-700))]" />}
                <div className="flex items-center justify-center gap-2">
                  {(["uploading", "processing", "analyzing", "building"] as AnalysisStep[]).map((s, i) => (
                    <div key={s} className={cn("w-2 h-2 rounded-full transition-all duration-500", stepProgress >= (i + 1) * 25 ? "bg-[hsl(var(--accent))] scale-110" : "bg-[hsl(var(--navy-600))]")} />
                  ))}
                </div>
              </div>
            )}

            {step === "complete" && (
              <div className="flex items-center gap-3 justify-center py-4">
                <CheckCircle2 className="w-6 h-6 text-[hsl(var(--success))]" />
                <span className="text-[hsl(var(--success))] font-semibold">Analysis complete! Redirecting…</span>
              </div>
            )}

            {step === "error" && (
              <div className="bg-[hsl(var(--destructive))]/10 border border-[hsl(var(--destructive))]/30 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[hsl(var(--destructive))] mt-0.5 shrink-0" />
                  <p className="text-sm text-[hsl(var(--destructive))]">{errorMessage}</p>
                </div>
                <Button onClick={handleReset} variant="outline" size="sm" className="w-full border-[hsl(var(--destructive))]/30 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10">
                  Try again
                </Button>
              </div>
            )}

            {step === "idle" && (
              <Button
                onClick={handleAnalyze}
                className="w-full h-14 text-lg font-bold bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/90 text-white rounded-xl shadow-lg shadow-[hsl(var(--accent))]/20 transition-all hover:shadow-xl hover:shadow-[hsl(var(--accent))]/30"
              >
                Analyze My Swing
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[hsl(var(--gray-500))] mt-12 text-center max-w-sm">
        For best results, film from the side at waist height with the full swing visible. Good lighting helps.
      </p>
    </div>
  );
}
