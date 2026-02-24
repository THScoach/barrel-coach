import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Upload, X, CheckCircle, HelpCircle, Loader2, GripVertical, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { UploadedVideo } from "@/types/analysis";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VideoUploaderProps {
  swingsRequired: number;
  swingsMaxAllowed?: number;
  sessionId: string;
  onComplete: () => void;
  isCheckoutLoading?: boolean;
}

interface SlotData extends UploadedVideo {
  uploadProgress?: number; // 0-100 for XHR progress
}

type Slot = SlotData | null;

const DEFAULT_MAX_SWINGS = 15;
const ENCOURAGED_MIN_SWINGS = 5;
const MAX_CONCURRENT_UPLOADS = 2;
const MAX_RETRY_ATTEMPTS = 1;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

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
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: swingsMaxAllowed }, () => null));
  const [dragOver, setDragOver] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  
  // Drag reorder state
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadControllersRef = useRef<Map<number, XMLHttpRequest>>(new Map());
  const retryCountRef = useRef<Map<number, number>>(new Map());
  const isProcessingQueueRef = useRef(false);

  // Derived counts
  const uploadedCount = useMemo(() => slots.filter((v) => v?.status === "uploaded").length, [slots]);
  const uploadingCount = useMemo(() => slots.filter((v) => v?.status === "uploading").length, [slots]);
  const queuedCount = useMemo(() => slots.filter((v) => v?.status === "queued").length, [slots]);
  const filledCount = useMemo(() => slots.filter(Boolean).length, [slots]);
  const remainingCapacity = useMemo(() => Math.max(0, swingsMaxAllowed - filledCount), [swingsMaxAllowed, filledCount]);
  const canContinue = uploadedCount >= swingsRequired && uploadingCount === 0;

  // Bulk progress tracking
  const totalInProgress = uploadingCount + queuedCount;
  const overallProgress = useMemo(() => {
    const uploading = slots.filter((v) => v?.status === "uploading" || v?.status === "queued");
    if (uploading.length === 0) return null;
    
    const totalProgress = uploading.reduce((sum, v) => sum + (v?.uploadProgress ?? 0), 0);
    return Math.round(totalProgress / uploading.length);
  }, [slots]);

  const headline = useMemo(() => {
    if (swingsRequired <= 1) return "UPLOAD YOUR SWING";
    return `UPLOAD YOUR SWINGS`;
  }, [swingsRequired]);

  const subline = useMemo(() => {
    if (swingsMaxAllowed <= 1) return "One swing, one session.";
    if (swingsRequired >= ENCOURAGED_MIN_SWINGS) {
      return `Same session. Upload ${swingsRequired}–${swingsMaxAllowed} swings.`;
    }
    return `Same session. Minimum ${swingsRequired}. I want 5+ if you can. (Max ${swingsMaxAllowed})`;
  }, [swingsRequired, swingsMaxAllowed]);

  const getFirstEmptySlotIndex = useCallback((currentSlots: Slot[]) => {
    return currentSlots.findIndex((s) => s === null);
  }, []);

  const validateVideo = useCallback(async (file: File): Promise<{ valid: boolean; error?: string; duration?: number; isHighSpeed?: boolean }> => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return { valid: false, error: "Upload a .mp4 or .mov." };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { valid: false, error: "That file is too big. Keep it under 2GB." };
    }
    const fpsInfo = await detectFps(file);
    if (fpsInfo.isHighSpeed) {
      toast.info("🎥 High-speed video detected — nice! Upload may take a moment.", { duration: 4000 });
    }
    return { valid: true, duration: fpsInfo.duration, isHighSpeed: fpsInfo.isHighSpeed };
  }, []);

  // Upload with XHR for progress tracking + user JWT
  const uploadVideoToBackend = useCallback(
    (file: File, swingIndex: number): Promise<boolean> => {
      return new Promise((resolve) => {
        (async () => {
          try {
            // Get user JWT
            const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;

            if (sessionErr) {
              console.error("Session error:", sessionErr);
            }

            if (!accessToken) {
              console.error("No access token available");
              toast.error("Please log in to upload videos");
              resolve(false);
              return;
            }

            const xhr = new XMLHttpRequest();
            uploadControllersRef.current.set(swingIndex, xhr);

            // Optional but helpful
            xhr.responseType = "json";
            xhr.timeout = 1800000; // 30 minutes for large uploads

            const formData = new FormData();
            formData.append("file", file);
            formData.append("sessionId", sessionId);
            formData.append("swingIndex", swingIndex.toString());

            // Track upload progress
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                setSlots((prev) => {
                  const v = prev[swingIndex];
                  if (!v) return prev;
                  const next = [...prev];
                  next[swingIndex] = { ...v, uploadProgress: progress };
                  return next;
                });
              }
            };

            xhr.onload = () => {
              uploadControllersRef.current.delete(swingIndex);

              const ok = xhr.status >= 200 && xhr.status < 300;
              if (ok) {
                // Parse response and store stable storagePath + optional signed preview URL
                const data = xhr.response as Record<string, unknown>;
                // videoStoragePath is the STABLE path (e.g., "sessionId/3.mp4") - use for storageUrl
                const videoStoragePath = (data?.videoStoragePath as string) ?? null;
                // videoUrl is a SIGNED URL that expires - only for immediate preview
                const signedPreviewUrl = (data?.videoUrl as string) ?? null;

                setSlots((prev) => {
                  const v = prev[swingIndex];
                  if (!v) return prev;
                  const next = [...prev];
                  next[swingIndex] = { 
                    ...v, 
                    status: "uploaded", // Set final status here to avoid race condition
                    uploadProgress: 100,
                    // STABLE storage path - never expires, use for DB lookups
                    storageUrl: videoStoragePath ?? undefined,
                    // Signed URL for immediate preview (expires in 1hr) - falls back to local blob
                    previewUrl: signedPreviewUrl ?? v.previewUrl,
                  };
                  return next;
                });
                resolve(true);
                return;
              }

              // Better error messaging
              const body = xhr.response as Record<string, unknown>;
              const msg =
                (body && (body.error || body.message)) ||
                (xhr.status === 401 ? "Not logged in." :
                 xhr.status === 403 ? "You don't have access to this session." :
                 "Upload failed");

              console.error("Upload failed:", msg, { status: xhr.status, body });
              toast.error(String(msg));
              resolve(false);
            };

            xhr.onerror = () => {
              uploadControllersRef.current.delete(swingIndex);
              console.error("Upload error (network)");
              toast.error("Upload failed — connection issue.");
              resolve(false);
            };

            xhr.ontimeout = () => {
              uploadControllersRef.current.delete(swingIndex);
              console.error("Upload timeout");
              toast.error("Upload timed out — try again on Wi-Fi.");
              resolve(false);
            };

            xhr.onabort = () => {
              uploadControllersRef.current.delete(swingIndex);
              resolve(false);
            };

            xhr.open("POST", `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-swing`);
            xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
            xhr.send(formData);
          } catch (error) {
            console.error("Upload setup error:", error);
            toast.error("Upload failed — please try again.");
            resolve(false);
          }
        })();
      });
    },
    [sessionId],
  );

  const removeSlot = useCallback((slotIndex: number) => {
    setSlots((prev) => {
      const current = prev[slotIndex];
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      const copy = [...prev];
      copy[slotIndex] = null;
      return copy;
    });

    // Abort upload if it's in flight
    const xhr = uploadControllersRef.current.get(slotIndex);
    if (xhr) xhr.abort();
    uploadControllersRef.current.delete(slotIndex);
  }, []);

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      slots.forEach((v) => {
        if (v?.previewUrl) URL.revokeObjectURL(v.previewUrl);
      });
      uploadControllersRef.current.forEach((xhr) => xhr.abort());
      uploadControllersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Process upload queue with concurrency limit + retry
  const processUploadQueue = useCallback(async () => {
    // Prevent multiple queue processors running simultaneously
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    try {
      while (true) {
        // Get current state snapshot
        const currentSlots = slots;
        const uploadingCount = currentSlots.filter((s) => s?.status === "uploading").length;
        
        // Find queued slots that can start
        const queuedSlots = currentSlots
          .map((slot, index) => ({ slot, index }))
          .filter(({ slot }) => slot?.status === "queued");

        // Check if we can start more uploads
        const availableSlots = MAX_CONCURRENT_UPLOADS - uploadingCount;
        if (availableSlots <= 0 || queuedSlots.length === 0) {
          break;
        }

        // Start up to MAX_CONCURRENT_UPLOADS at once
        const toStart = queuedSlots.slice(0, availableSlots);
        
        await Promise.all(
          toStart.map(async ({ slot, index }) => {
            if (!slot?.file) return;
            
            // Mark as uploading
            setSlots((prev) => {
              const v = prev[index];
              if (!v || v.status !== "queued") return prev;
              const next = [...prev];
              next[index] = { ...v, status: "uploading", uploadProgress: 0 };
              return next;
            });

            const success = await uploadVideoToBackend(slot.file, index);

            if (!success) {
              // Check retry count
              const currentRetries = retryCountRef.current.get(index) || 0;
              
              if (currentRetries < MAX_RETRY_ATTEMPTS) {
                // Retry: set back to queued
                retryCountRef.current.set(index, currentRetries + 1);
                console.log(`Retrying upload for swing ${index + 1} (attempt ${currentRetries + 2})`);
                
                setSlots((prev) => {
                  const v = prev[index];
                  if (!v) return prev;
                  const next = [...prev];
                  next[index] = { ...v, status: "queued", uploadProgress: 0 };
                  return next;
                });
              } else {
                // Max retries reached, mark as error
                setSlots((prev) => {
                  const v = prev[index];
                  if (!v) return prev;
                  const next = [...prev];
                  next[index] = { ...v, status: "error", uploadProgress: 0 };
                  return next;
                });
                toast.error(`Swing ${index + 1} didn't upload after retries. Try again.`);
                retryCountRef.current.delete(index);
              }
            } else {
              // Success - clear retry count
              retryCountRef.current.delete(index);
            }
          })
        );
        
        // Small delay to allow state to settle before next iteration
        await new Promise((r) => setTimeout(r, 100));
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [slots, uploadVideoToBackend]);

  // Start processing queue when new queued items appear or uploading finishes
  useEffect(() => {
    const hasQueued = slots.some((s) => s?.status === "queued");
    const uploadingCount = slots.filter((s) => s?.status === "uploading").length;
    
    // Start processing if we have queued items and capacity
    if (hasQueued && uploadingCount < MAX_CONCURRENT_UPLOADS) {
      processUploadQueue();
    }
  }, [slots, processUploadQueue]);

  const addFilesToSlots = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      // Coach Rick voice for max swings exceeded
      if (fileArray.length > swingsMaxAllowed) {
        toast.error(`🔥 ${swingsMaxAllowed} max. Pick your best 5–15 swings.`, {
          duration: 5000,
        });
      }

      if (remainingCapacity <= 0) {
        toast.error(`Session is full. Max ${swingsMaxAllowed} swings.`);
        return;
      }

      const filesToProcess = fileArray.slice(0, remainingCapacity);
      const validatedFiles: { file: File; slotIndex: number }[] = [];

      // First pass: validate and allocate slots (queued status)
      for (const file of filesToProcess) {
        const validation = await validateVideo(file);
        if (!validation.valid) {
          toast.error(validation.error);
          continue;
        }

        let slotIndex = -1;
        setSlots((prev) => {
          const idx = getFirstEmptySlotIndex(prev);
          slotIndex = idx;
          if (idx === -1) return prev;

          const id = crypto.randomUUID();
          const previewUrl = URL.createObjectURL(file);

          const next = [...prev];
          next[idx] = {
            id,
            index: idx,
            file,
            previewUrl,
            duration: 0,
            status: "queued",
            uploadProgress: 0,
          };
          return next;
        });

        if (slotIndex === -1) break;
        validatedFiles.push({ file, slotIndex });
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [remainingCapacity, swingsMaxAllowed, validateVideo, getFirstEmptySlotIndex],
  );

  // Drag & Drop reordering (only for queued/error slots, not uploaded)
  const canDragSlot = useCallback((slot: Slot | null) => {
    return slot && (slot.status === "queued" || slot.status === "error");
  }, []);

  const handleSlotDragStart = useCallback((e: React.DragEvent, index: number) => {
    const slot = slots[index];
    if (!canDragSlot(slot)) {
      e.preventDefault();
      return;
    }
    setDraggedSlotIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }, [slots, canDragSlot]);

  const handleSlotDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    const targetSlot = slots[index];
    
    // Can only drop onto empty slots or other queued/error slots
    if (targetSlot && !canDragSlot(targetSlot)) {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    
    e.dataTransfer.dropEffect = "move";
    setDragOverSlotIndex(index);
  }, [slots, canDragSlot]);

  const handleSlotDragEnd = useCallback(() => {
    setDraggedSlotIndex(null);
    setDragOverSlotIndex(null);
  }, []);

  const handleSlotDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (draggedSlotIndex === null || draggedSlotIndex === targetIndex) {
      handleSlotDragEnd();
      return;
    }

    const sourceSlot = slots[draggedSlotIndex];
    const targetSlot = slots[targetIndex];

    // Validate: source must be draggable
    if (!canDragSlot(sourceSlot)) {
      handleSlotDragEnd();
      return;
    }

    // Validate: target must be empty or draggable
    if (targetSlot && !canDragSlot(targetSlot)) {
      toast.error("Can't swap with an uploaded swing");
      handleSlotDragEnd();
      return;
    }

    // Swap slots
    setSlots((prev) => {
      const next = [...prev];
      const sourceData = prev[draggedSlotIndex];
      const targetData = prev[targetIndex];
      
      // Update index references
      if (sourceData) {
        next[targetIndex] = { ...sourceData, index: targetIndex };
      } else {
        next[targetIndex] = null;
      }
      
      if (targetData) {
        next[draggedSlotIndex] = { ...targetData, index: draggedSlotIndex };
      } else {
        next[draggedSlotIndex] = null;
      }
      
      return next;
    });

    handleSlotDragEnd();
  }, [draggedSlotIndex, slots, canDragSlot, handleSlotDragEnd]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      
      // Ignore if this is a slot reorder drag
      if (draggedSlotIndex !== null) return;
      
      addFilesToSlots(e.dataTransfer.files);
    },
    [addFilesToSlots, draggedSlotIndex],
  );

  const handleContinue = useCallback(() => {
    if (!canContinue) {
      if (uploadingCount > 0) {
        toast.error("Wait for uploads to complete.");
      } else {
        toast.error(`I need at least ${swingsRequired} uploaded swing${swingsRequired === 1 ? "" : "s"}.`);
      }
      return;
    }
    onComplete();
  }, [canContinue, uploadingCount, swingsRequired, onComplete]);

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{headline}</h1>
        <p className="text-muted-foreground">{subline}</p>
      </div>

      {/* Bulk upload progress */}
      {totalInProgress > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-accent/5 border border-accent/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Uploading {uploadingCount} of {totalInProgress} videos...
            </span>
            <span className="text-sm text-muted-foreground">{overallProgress ?? 0}%</span>
          </div>
          <Progress value={overallProgress ?? 0} className="h-2" />
        </div>
      )}

      {/* Slots grid */}
      <div className="mb-6">
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: swingsMaxAllowed }).map((_, i) => (
            <VideoThumbnail
              key={i}
              index={i}
              video={slots[i] ?? undefined}
              onRemove={() => removeSlot(i)}
              onClick={() => !slots[i] && fileInputRef.current?.click()}
              isDragging={draggedSlotIndex === i}
              isDragOver={dragOverSlotIndex === i}
              canDrag={canDragSlot(slots[i])}
              onDragStart={(e) => handleSlotDragStart(e, i)}
              onDragOver={(e) => handleSlotDragOver(e, i)}
              onDragEnd={handleSlotDragEnd}
              onDrop={(e) => handleSlotDrop(e, i)}
            />
          ))}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              Uploaded: {uploadedCount} / {swingsRequired} required
            </span>
            <span className="text-muted-foreground">
              {filledCount} / {swingsMaxAllowed} in session
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, (uploadedCount / Math.max(1, swingsRequired)) * 100)}%` }}
            />
          </div>

          {/* Coach Rick nudge */}
          {uploadedCount < ENCOURAGED_MIN_SWINGS && swingsMaxAllowed > 1 && uploadingCount === 0 && (
            <div className="mt-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-sm">
                <span className="font-medium">Coach Rick:</span> I can score 1 swing… but I trust it when I've got{" "}
                <b>5+</b>. Give me your best reps.
              </p>
            </div>
          )}
          
          {/* Drag hint */}
          {queuedCount > 1 && (
            <div className="mt-3 p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">
                💡 Drag queued videos to reorder before upload
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload zone */}
      {filledCount < swingsMaxAllowed && (
        <div
          className={cn("upload-zone p-8 md:p-12 text-center cursor-pointer", dragOver && "drag-over")}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedSlotIndex === null) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime"
            multiple={swingsMaxAllowed > 1}
            className="hidden"
            onChange={(e) => addFilesToSlots(e.target.files)}
          />

          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-accent" />
            </div>
            <div>
              <p className="font-medium mb-1">Drop your swing video{swingsMaxAllowed > 1 ? "s" : ""} here</p>
              <p className="text-sm text-muted-foreground">or click to select</p>
            </div>
            <p className="text-xs text-muted-foreground">.mp4 or .mov • Max 250MB • Up to {swingsMaxAllowed} swings</p>
          </div>
        </div>
      )}

      {/* Guidelines button */}
      <Dialog open={showGuidelines} onOpenChange={setShowGuidelines}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="mt-4 w-full gap-2 text-muted-foreground">
            <HelpCircle className="w-4 h-4" />
            HOW TO RECORD YOUR SWING
          </Button>
        </DialogTrigger>
        <RecordingGuidelinesModal onClose={() => setShowGuidelines(false)} />
      </Dialog>

      <Button
        variant="accent"
        size="lg"
        className="w-full mt-6"
        disabled={!canContinue || isCheckoutLoading}
        onClick={handleContinue}
      >
        {isCheckoutLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating checkout...
          </>
        ) : uploadingCount > 0 ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            UPLOADING...
          </>
        ) : canContinue ? (
          "CONTINUE →"
        ) : (
          `UPLOAD ${Math.max(0, swingsRequired - uploadedCount)} MORE TO CONTINUE →`
        )}
      </Button>
    </div>
  );
}

interface VideoThumbnailProps {
  index: number;
  video?: SlotData;
  onRemove: () => void;
  onClick: () => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  canDrag?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

function VideoThumbnail({ 
  index, 
  video, 
  onRemove, 
  onClick,
  isDragging,
  isDragOver,
  canDrag,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: VideoThumbnailProps) {
  if (!video) {
    return (
      <button
        onClick={onClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          "aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent/50 flex flex-col items-center justify-center gap-1 transition-colors",
          isDragOver && "border-accent bg-accent/10"
        )}
      >
        <span className="text-2xl text-muted-foreground">+</span>
        <span className="text-xs text-muted-foreground">Swing {index + 1}</span>
      </button>
    );
  }

  const isUploading = video.status === "uploading";
  const isQueued = video.status === "queued";
  const isError = video.status === "error";
  const isUploaded = video.status === "uploaded";

  return (
    <div 
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden bg-primary/10 transition-all",
        isDragging && "opacity-50 scale-95",
        isDragOver && "ring-2 ring-accent",
        canDrag && "cursor-grab active:cursor-grabbing"
      )}
      draggable={canDrag}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      <video src={video.previewUrl} className="w-full h-full object-cover" muted playsInline />
      
      {/* Drag handle for queued items */}
      {canDrag && (
        <div className="absolute top-1 left-1 w-5 h-5 rounded bg-background/80 flex items-center justify-center">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
      
      {/* Remove button - not during upload */}
      {!isUploading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
          title="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Progress bar for uploading */}
      {isUploading && video.uploadProgress !== undefined && (
        <div className="absolute inset-x-0 bottom-8 px-2">
          <Progress value={video.uploadProgress} className="h-1" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <div className="flex items-center gap-1">
          {isUploading ? (
            <Loader2 className="w-3 h-3 text-accent animate-spin" />
          ) : isQueued ? (
            <div className="w-3 h-3 rounded-full bg-warning animate-pulse" />
          ) : isUploaded ? (
            <CheckCircle className="w-3 h-3 text-success" />
          ) : isError ? (
            <AlertCircle className="w-3 h-3 text-destructive" />
          ) : (
            <X className="w-3 h-3 text-destructive" />
          )}
          <span className="text-xs text-white font-medium">
            {isQueued ? "Queued" : isUploading ? `${video.uploadProgress ?? 0}%` : `Swing ${index + 1}`}
          </span>
        </div>
      </div>
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
