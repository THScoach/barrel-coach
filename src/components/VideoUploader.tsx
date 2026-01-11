import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Upload, X, CheckCircle, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UploadedVideo } from "@/types/analysis";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VideoUploaderProps {
  /**
   * Minimum swings needed to proceed (ex: product requirement)
   * We’ll encourage 5+, but we won’t block above and beyond this.
   */
  swingsRequired: number;

  /**
   * A session can hold multiple swings (up to 15).
   * Default = 15 unless you override.
   */
  swingsMaxAllowed?: number;

  /**
   * Session already created upstream (Analyze.tsx).
   * All swings uploaded here attach to this session.
   */
  sessionId: string;

  /**
   * Called when user hits Continue and minimum requirement is met.
   */
  onComplete: () => void;

  /**
   * If you’re creating checkout, etc.
   */
  isCheckoutLoading?: boolean;
}

type Slot = UploadedVideo | null;

const DEFAULT_MAX_SWINGS = 15;
const ENCOURAGED_MIN_SWINGS = 5;

// Keep this strict. If we add Gumlet later, the validation stays.
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"]; // .mp4, .mov
const MAX_SIZE_BYTES = 250 * 1024 * 1024; // 250MB (more realistic for modern phones)

export function VideoUploader({
  swingsRequired,
  swingsMaxAllowed = DEFAULT_MAX_SWINGS,
  sessionId,
  onComplete,
  isCheckoutLoading,
}: VideoUploaderProps) {
  // Fixed-length slots so indexes never race or shift.
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: swingsMaxAllowed }, () => null));
  const [dragOver, setDragOver] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track in-flight upload controllers so removing a slot cancels that upload.
  const uploadControllersRef = useRef<Map<number, AbortController>>(new Map());

  // Derived counts
  const uploadedCount = useMemo(() => slots.filter((v) => v?.status === "uploaded").length, [slots]);

  const filledCount = useMemo(() => slots.filter(Boolean).length, [slots]);

  const remainingCapacity = useMemo(() => Math.max(0, swingsMaxAllowed - filledCount), [swingsMaxAllowed, filledCount]);

  const canContinue = uploadedCount >= swingsRequired;

  const headline = useMemo(() => {
    // Coach Rick simple: required + max
    if (swingsRequired <= 1) return "UPLOAD YOUR SWING";
    return `UPLOAD YOUR SWINGS`;
  }, [swingsRequired]);

  const subline = useMemo(() => {
    // Encourage 5+, but do not block.
    if (swingsMaxAllowed <= 1) return "One swing, one session.";
    if (swingsRequired >= ENCOURAGED_MIN_SWINGS) {
      return `Same session. Upload ${swingsRequired}–${swingsMaxAllowed} swings.`;
    }
    return `Same session. Minimum ${swingsRequired}. I want 5+ if you can. (Max ${swingsMaxAllowed})`;
  }, [swingsRequired, swingsMaxAllowed]);

  const getFirstEmptySlotIndex = useCallback((currentSlots: Slot[]) => {
    return currentSlots.findIndex((s) => s === null);
  }, []);

  const validateVideo = useCallback(async (file: File): Promise<{ valid: boolean; error?: string }> => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return { valid: false, error: "Upload a .mp4 or .mov." };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { valid: false, error: "That file is too big. Keep it under 250MB." };
    }
    return { valid: true };
  }, []);

  const uploadVideoToBackend = useCallback(
    async (file: File, swingIndex: number): Promise<boolean> => {
      const controller = new AbortController();
      uploadControllersRef.current.set(swingIndex, controller);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", sessionId);
        formData.append("swingIndex", swingIndex.toString()); // stable slot index

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-swing`, {
          method: "POST",
          headers: {
            // NOTE: this is how your codebase currently does it.
            // If your Edge Function expects user JWT instead, we’ll adjust later.
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
          signal: controller.signal,
        });

        if (!response.ok) {
          let msg = "Upload failed";
          try {
            const errorData = await response.json();
            msg = errorData?.error || msg;
          } catch {
            // ignore
          }
          throw new Error(msg);
        }

        return true;
      } catch (error: any) {
        if (error?.name === "AbortError") return false;
        console.error("Upload error:", error);
        return false;
      } finally {
        uploadControllersRef.current.delete(swingIndex);
      }
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

    // Abort upload if it’s in flight
    const ctrl = uploadControllersRef.current.get(slotIndex);
    if (ctrl) ctrl.abort();
    uploadControllersRef.current.delete(slotIndex);
  }, []);

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      slots.forEach((v) => {
        if (v?.previewUrl) URL.revokeObjectURL(v.previewUrl);
      });
      uploadControllersRef.current.forEach((ctrl) => ctrl.abort());
      uploadControllersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFilesToSlots = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      // Capacity guard
      if (remainingCapacity <= 0) {
        toast.error(`Session is full. Max ${swingsMaxAllowed} swings.`);
        return;
      }

      // Only process up to remaining capacity
      const filesToProcess = fileArray.slice(0, remainingCapacity);

      // Sequential upload = fewer weird failures
      for (const file of filesToProcess) {
        const validation = await validateVideo(file);
        if (!validation.valid) {
          toast.error(validation.error);
          continue;
        }

        // Allocate a slot index at the moment we’re about to use it
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
            status: "uploading",
          };
          return next;
        });

        // If no slot, break
        if (slotIndex === -1) break;

        // Upload
        const success = await uploadVideoToBackend(file, slotIndex);

        // Update status
        setSlots((prev) => {
          const v = prev[slotIndex];
          if (!v) return prev; // removed mid-upload
          const next = [...prev];
          next[slotIndex] = { ...v, status: success ? "uploaded" : "error" };
          return next;
        });

        if (!success) {
          toast.error(`Swing ${slotIndex + 1} didn’t upload. Try again.`);
        }
      }

      // Reset input so selecting the same file again triggers change
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [remainingCapacity, swingsMaxAllowed, validateVideo, uploadVideoToBackend, getFirstEmptySlotIndex],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFilesToSlots(e.dataTransfer.files);
    },
    [addFilesToSlots],
  );

  const handleContinue = useCallback(() => {
    if (!canContinue) {
      toast.error(`I need at least ${swingsRequired} uploaded swing${swingsRequired === 1 ? "" : "s"}.`);
      return;
    }
    onComplete();
  }, [canContinue, swingsRequired, onComplete]);

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{headline}</h1>
        <p className="text-muted-foreground">{subline}</p>
      </div>

      {/* Slots grid (always show, up to maxAllowed) */}
      <div className="mb-6">
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: swingsMaxAllowed }).map((_, i) => (
            <VideoThumbnail
              key={i}
              index={i}
              video={slots[i] ?? undefined}
              onRemove={() => removeSlot(i)}
              onClick={() => !slots[i] && fileInputRef.current?.click()}
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
          {uploadedCount < ENCOURAGED_MIN_SWINGS && swingsMaxAllowed > 1 && (
            <div className="mt-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-sm">
                <span className="font-medium">Coach Rick:</span> I can score 1 swing… but I trust it when I’ve got{" "}
                <b>5+</b>. Give me your best reps.
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
  video?: UploadedVideo;
  onRemove: () => void;
  onClick: () => void;
}

function VideoThumbnail({ index, video, onRemove, onClick }: VideoThumbnailProps) {
  if (!video) {
    return (
      <button
        onClick={onClick}
        className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent/50 flex flex-col items-center justify-center gap-1 transition-colors"
      >
        <span className="text-2xl text-muted-foreground">+</span>
        <span className="text-xs text-muted-foreground">Swing {index + 1}</span>
      </button>
    );
  }

  const isUploading = video.status === "uploading";

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-primary/10">
      <video src={video.previewUrl} className="w-full h-full object-cover" muted playsInline />
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

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <div className="flex items-center gap-1">
          {isUploading ? (
            <Loader2 className="w-3 h-3 text-accent animate-spin" />
          ) : video.status === "uploaded" ? (
            <CheckCircle className="w-3 h-3 text-success" />
          ) : (
            <X className="w-3 h-3 text-destructive" />
          )}
          <span className="text-xs text-white font-medium">Swing {index + 1}</span>
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
          <p className="font-medium text-destructive mb-2">❌ DON’T DO THIS:</p>
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
