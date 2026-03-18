import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Upload, X, CheckCircle, HelpCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { UploadedVideo } from "@/types/analysis";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface UploadedSwingData {
  file: File;
  storagePath: string;
  swingIndex: number;
}

interface VideoUploaderProps {
  swingsRequired: number;
  swingsMaxAllowed?: number;
  sessionId: string;
  onComplete: (uploadedSwings?: UploadedSwingData[]) => void;
  isCheckoutLoading?: boolean;
}

interface SlotData extends UploadedVideo {
  uploadProgress?: number;
}

type Phase = "selecting" | "uploading" | "done";

const DEFAULT_MAX_SWINGS = 15;
const MAX_CONCURRENT_UPLOADS = 2;
const MAX_RETRY_ATTEMPTS = 1;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

const detectFps = (file: File): Promise<{ duration: number; isHighSpeed: boolean }> =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      const result = {
        duration: video.duration,
        isHighSpeed: file.size > 50 * 1024 * 1024 || video.duration < 3,
      };
      URL.revokeObjectURL(video.src);
      resolve(result);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve({ duration: 0, isHighSpeed: false });
    };
  });

export function VideoUploader({
  swingsRequired,
  swingsMaxAllowed = DEFAULT_MAX_SWINGS,
  sessionId,
  onComplete,
  isCheckoutLoading,
}: VideoUploaderProps) {
  // Simple list of selected files (no fixed-slot grid)
  const [files, setFiles] = useState<SlotData[]>([]);
  const [phase, setPhase] = useState<Phase>("selecting");
  const [dragOver, setDragOver] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadControllersRef = useRef<Map<number, XMLHttpRequest>>(new Map());
  const retryCountRef = useRef<Map<number, number>>(new Map());

  // Derived counts
  const uploadedCount = useMemo(() => files.filter((f) => f.status === "uploaded").length, [files]);
  const uploadingCount = useMemo(() => files.filter((f) => f.status === "uploading").length, [files]);
  const errorCount = useMemo(() => files.filter((f) => f.status === "error").length, [files]);
  const totalSelected = files.length;

  const allDone = uploadedCount === totalSelected && totalSelected > 0;
  const canStartUpload = totalSelected >= swingsRequired && phase === "selecting";
  const canContinue = allDone && phase === "done";

  // Overall progress during upload phase
  const overallProgress = useMemo(() => {
    if (phase !== "uploading") return 0;
    if (totalSelected === 0) return 0;
    const total = files.reduce((sum, f) => {
      if (f.status === "uploaded") return sum + 100;
      return sum + (f.uploadProgress ?? 0);
    }, 0);
    return Math.round(total / totalSelected);
  }, [files, phase, totalSelected]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      uploadControllersRef.current.forEach((xhr) => xhr.abort());
      uploadControllersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateVideo = useCallback(async (file: File): Promise<{ valid: boolean; error?: string }> => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return { valid: false, error: `"${file.name}" — upload a .mp4 or .mov.` };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { valid: false, error: `"${file.name}" is too big. Keep it under 2GB.` };
    }
    return { valid: true };
  }, []);

  // Add files to the selection list (no upload yet)
  const addFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;

      const remaining = swingsMaxAllowed - totalSelected;
      if (remaining <= 0) {
        toast.error(`Session full — max ${swingsMaxAllowed} swings.`);
        return;
      }

      const toProcess = incoming.slice(0, remaining);
      if (incoming.length > remaining) {
        toast(`Only adding ${remaining} more (max ${swingsMaxAllowed}).`);
      }

      const newFiles: SlotData[] = [];
      for (const file of toProcess) {
        const v = await validateVideo(file);
        if (!v.valid) {
          toast.error(v.error);
          continue;
        }
        newFiles.push({
          id: crypto.randomUUID(),
          index: totalSelected + newFiles.length,
          file,
          previewUrl: URL.createObjectURL(file),
          duration: 0,
          status: "queued",
          uploadProgress: 0,
        });
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [totalSelected, swingsMaxAllowed, validateVideo],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, index: i }));
    });
  }, []);

  // Upload a single file via XHR
  const uploadOne = useCallback(
    (file: File, swingIndex: number, fileId: string): Promise<boolean> => {
      return new Promise((resolve) => {
        (async () => {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;
            if (!accessToken) {
              toast.error("Please log in to upload videos");
              resolve(false);
              return;
            }

            const xhr = new XMLHttpRequest();
            uploadControllersRef.current.set(swingIndex, xhr);
            xhr.responseType = "json";
            xhr.timeout = 1800000;

            const formData = new FormData();
            formData.append("file", file);
            formData.append("sessionId", sessionId);
            formData.append("swingIndex", swingIndex.toString());

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                setFiles((prev) =>
                  prev.map((f) => (f.id === fileId ? { ...f, uploadProgress: progress } : f)),
                );
              }
            };

            xhr.onload = () => {
              uploadControllersRef.current.delete(swingIndex);
              const ok = xhr.status >= 200 && xhr.status < 300;
              if (ok) {
                const data = xhr.response as Record<string, unknown>;
                const videoStoragePath = (data?.videoStoragePath as string) ?? undefined;
                const signedPreviewUrl = (data?.videoUrl as string) ?? undefined;

                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === fileId
                      ? {
                          ...f,
                          status: "uploaded" as const,
                          uploadProgress: 100,
                          storageUrl: videoStoragePath,
                          previewUrl: signedPreviewUrl ?? f.previewUrl,
                        }
                      : f,
                  ),
                );
                resolve(true);
              } else {
                const body = xhr.response as Record<string, unknown>;
                const msg = (body?.error || body?.message || "Upload failed") as string;
                console.error("Upload failed:", msg);
                toast.error(msg);
                resolve(false);
              }
            };

            xhr.onerror = () => {
              uploadControllersRef.current.delete(swingIndex);
              toast.error("Upload failed — connection issue.");
              resolve(false);
            };
            xhr.ontimeout = () => {
              uploadControllersRef.current.delete(swingIndex);
              toast.error("Upload timed out.");
              resolve(false);
            };
            xhr.onabort = () => {
              uploadControllersRef.current.delete(swingIndex);
              resolve(false);
            };

            xhr.open("POST", `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-swing`);
            xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
            xhr.send(formData);
          } catch {
            toast.error("Upload failed — please try again.");
            resolve(false);
          }
        })();
      });
    },
    [sessionId],
  );

  // Process all files sequentially with concurrency limit
  const startUploadAll = useCallback(async () => {
    if (totalSelected < swingsRequired) {
      toast.error(`Select at least ${swingsRequired} swings first.`);
      return;
    }

    setPhase("uploading");

    // Mark all as queued (in case of retry)
    setFiles((prev) => prev.map((f) => (f.status !== "uploaded" ? { ...f, status: "queued" as const, uploadProgress: 0 } : f)));

    // Process with concurrency limit
    const queue = [...files].filter((f) => f.status !== "uploaded");
    let idx = 0;

    const worker = async () => {
      while (idx < queue.length) {
        const currentIdx = idx++;
        const item = queue[currentIdx];
        if (!item?.file) continue;

        // Mark uploading
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "uploading" as const, uploadProgress: 0 } : f)),
        );

        const success = await uploadOne(item.file, item.index, item.id);

        if (!success) {
          const retries = retryCountRef.current.get(item.index) || 0;
          if (retries < MAX_RETRY_ATTEMPTS) {
            retryCountRef.current.set(item.index, retries + 1);
            // Push back to queue for retry
            queue.push(item);
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, status: "queued" as const, uploadProgress: 0 } : f)),
            );
          } else {
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, status: "error" as const } : f)),
            );
            retryCountRef.current.delete(item.index);
          }
        } else {
          retryCountRef.current.delete(item.index);
        }
      }
    };

    // Start N workers
    const workers = Array.from({ length: MAX_CONCURRENT_UPLOADS }, () => worker());
    await Promise.all(workers);

    setPhase("done");
  }, [files, totalSelected, swingsRequired, uploadOne]);

  // Check if all done after phase changes
  useEffect(() => {
    if (phase === "done" && allDone) {
      toast.success("All swings uploaded!");
    }
  }, [phase, allDone]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (phase !== "selecting") return;
      addFiles(e.dataTransfer.files);
    },
    [addFiles, phase],
  );

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">UPLOAD YOUR SWINGS</h1>
        <p className="text-muted-foreground">
          Select {swingsRequired}–{swingsMaxAllowed} swings, then upload them all at once.
        </p>
      </div>

      {/* Upload progress bar (during upload phase) */}
      {phase === "uploading" && (
        <div className="mb-6 p-4 rounded-lg bg-accent/5 border border-accent/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Uploading {uploadedCount} of {totalSelected} swings...
            </span>
            <span className="text-sm text-muted-foreground">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      )}

      {/* Selected files grid */}
      {totalSelected > 0 && (
        <div className="mb-6">
          <div className="grid grid-cols-5 gap-2">
            {files.map((f, i) => (
              <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden bg-primary/10">
                <video src={f.previewUrl} className="w-full h-full object-cover" muted playsInline />

                {/* Remove button (only during selection) */}
                {phase === "selecting" && (
                  <button
                    onClick={() => removeFile(f.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {/* Upload progress overlay */}
                {f.status === "uploading" && f.uploadProgress !== undefined && (
                  <div className="absolute inset-x-0 bottom-8 px-2">
                    <Progress value={f.uploadProgress} className="h-1" />
                  </div>
                )}

                {/* Status badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <div className="flex items-center gap-1">
                    {f.status === "uploading" ? (
                      <Loader2 className="w-3 h-3 text-accent animate-spin" />
                    ) : f.status === "queued" && phase === "uploading" ? (
                      <div className="w-3 h-3 rounded-full bg-warning animate-pulse" />
                    ) : f.status === "uploaded" ? (
                      <CheckCircle className="w-3 h-3 text-success" />
                    ) : f.status === "error" ? (
                      <AlertCircle className="w-3 h-3 text-destructive" />
                    ) : null}
                    <span className="text-xs text-white font-medium">
                      {f.status === "uploading"
                        ? `${f.uploadProgress ?? 0}%`
                        : f.status === "queued" && phase === "uploading"
                          ? "Waiting..."
                          : f.status === "uploaded"
                            ? `Swing ${i + 1} ✓`
                            : f.status === "error"
                              ? "Failed"
                              : `Swing ${i + 1}`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Count summary */}
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {phase === "selecting"
                ? `${totalSelected} selected`
                : `${uploadedCount} / ${totalSelected} uploaded`}
            </span>
            <span>
              {swingsRequired} required · {swingsMaxAllowed} max
            </span>
          </div>

          {/* Selection hint */}
          {phase === "selecting" && totalSelected < swingsRequired && (
            <div className="mt-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-sm">
                <span className="font-medium">Coach Rick:</span> I need at least{" "}
                <b>{swingsRequired}</b> swings. Give me your best {swingsRequired}–{swingsMaxAllowed} reps.
              </p>
            </div>
          )}

          {phase === "selecting" && totalSelected >= swingsRequired && totalSelected < 5 && (
            <div className="mt-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-sm">
                <span className="font-medium">Coach Rick:</span> I can work with{" "}
                {totalSelected}… but I trust it more with <b>5+</b>. Got more?
              </p>
            </div>
          )}
        </div>
      )}

      {/* Drop zone (only during selection phase) */}
      {phase === "selecting" && totalSelected < swingsMaxAllowed && (
        <div
          className={cn("upload-zone p-8 md:p-12 text-center cursor-pointer", dragOver && "drag-over")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-accent" />
            </div>
            <div>
              <p className="font-medium mb-1">Drop your swing videos here</p>
              <p className="text-sm text-muted-foreground">or click to select</p>
            </div>
            <p className="text-xs text-muted-foreground">
              .mp4 or .mov · Max 2GB · {swingsRequired}–{swingsMaxAllowed} swings
            </p>
          </div>
        </div>
      )}

      {/* Guidelines */}
      <Dialog open={showGuidelines} onOpenChange={setShowGuidelines}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="mt-4 w-full gap-2 text-muted-foreground">
            <HelpCircle className="w-4 h-4" />
            HOW TO RECORD YOUR SWING
          </Button>
        </DialogTrigger>
        <RecordingGuidelinesModal onClose={() => setShowGuidelines(false)} />
      </Dialog>

      {/* Action button */}
      {phase === "selecting" && (
        <Button
          variant="accent"
          size="lg"
          className="w-full mt-6"
          disabled={!canStartUpload}
          onClick={startUploadAll}
        >
          {totalSelected < swingsRequired
            ? `SELECT ${swingsRequired - totalSelected} MORE SWING${swingsRequired - totalSelected === 1 ? "" : "S"}`
            : `UPLOAD ${totalSelected} SWING${totalSelected === 1 ? "" : "S"} →`}
        </Button>
      )}

      {phase === "uploading" && (
        <Button variant="accent" size="lg" className="w-full mt-6" disabled>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          UPLOADING...
        </Button>
      )}

      {phase === "done" && (
        <Button
          variant="accent"
          size="lg"
          className="w-full mt-6"
          disabled={!canContinue || isCheckoutLoading}
          onClick={onComplete}
        >
          {isCheckoutLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : errorCount > 0 ? (
            `CONTINUE WITH ${uploadedCount} SWING${uploadedCount === 1 ? "" : "S"} →`
          ) : (
            "CONTINUE →"
          )}
        </Button>
      )}
    </div>
  );
}

function RecordingGuidelinesModal({ onClose }: { onClose: () => void }) {
  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">📹 HOW TO RECORD YOUR SWING</DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-surface border border-border">
          <p className="text-sm font-medium mb-3">CAMERA POSITION</p>
          <div className="text-center py-4 font-mono text-sm">
            <div className="space-y-2">
              <p>⚾ ←── Pitcher</p>
              <p className="text-2xl">│</p>
              <p>🧍 ←── Hitter</p>
              <p className="text-2xl">│</p>
              <p>📱 ←── Camera (10–15 ft away, hip height)</p>
            </div>
          </div>
        </div>

        <div>
          <p className="font-medium text-success mb-2">✅ DO THIS:</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Side angle (perpendicular to hitter)</li>
            <li>• Camera at hip/waist height</li>
            <li>• 10–15 feet away</li>
            <li>• Full body visible (head to feet)</li>
            <li>• Landscape mode</li>
            <li>• 60fps+ if your phone supports it</li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-destructive mb-2">❌ DON'T DO THIS:</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Behind-home-plate angle</li>
            <li>• Portrait mode</li>
            <li>• Too far away or too close</li>
            <li>• Multiple swings in one video</li>
          </ul>
        </div>

        <Button variant="accent" className="w-full" onClick={onClose}>
          GOT IT
        </Button>
      </div>
    </DialogContent>
  );
}
