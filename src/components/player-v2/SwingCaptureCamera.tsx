/**
 * SwingCaptureCamera — rolling-buffer in-app camera capture for swing recording.
 * Uses MediaRecorder with timeslice chunks to maintain a 4-second rolling buffer.
 * On capture tap: saves 2s before + 2s after = 4s clip.
 * Falls back gracefully on unsupported browsers.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Circle, Check, X, Upload, Trash2, Play, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AspectRatio } from "@/components/ui/aspect-ratio";

// FUTURE: Auto-capture using motion detection
// Analyze camera frames for sudden movement (swing start)
// or audio spike (bat contact) to automatically trigger
// capture without manual tap.
// This requires frame-by-frame canvas analysis which is
// CPU-intensive. Build as a toggle: "Auto-detect: ON/OFF"
// For now, manual tap is the capture trigger.

type CaptureCapability = "rolling_buffer" | "simple_record" | "file_input";
type CaptureState = "idle" | "capturing" | "preview" | "error";

interface CapturedSwing {
  id: string;
  blob: Blob;
  thumbnailUrl: string;
  file: File;
}

interface SwingCaptureCameraProps {
  maxSwings?: number;
  onSwingsReady: (files: File[]) => void;
  onCancel: () => void;
}

const BUFFER_DURATION_MS = 4000;
const CHUNK_INTERVAL_MS = 200;
const CHUNKS_TO_KEEP = BUFFER_DURATION_MS / CHUNK_INTERVAL_MS;
const POST_CAPTURE_MS = 2000;
const MAX_SWINGS_DEFAULT = 15;

function getCaptureCapability(): CaptureCapability {
  if (typeof MediaRecorder !== "undefined") {
    if (MediaRecorder.isTypeSupported("video/mp4")) return "rolling_buffer";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) return "rolling_buffer";
    if (MediaRecorder.isTypeSupported("video/webm")) return "rolling_buffer";
  }
  if (navigator.mediaDevices?.getUserMedia) return "simple_record";
  return "file_input";
}

function getPreferredMimeType(): string {
  if (typeof MediaRecorder !== "undefined") {
    if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) return "video/webm;codecs=vp8";
    if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
  }
  return "video/webm";
}

function getFileExtension(mimeType: string): string {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

export function SwingCaptureCamera({
  maxSwings = MAX_SWINGS_DEFAULT,
  onSwingsReady,
  onCancel,
}: SwingCaptureCameraProps) {
  const [capability] = useState<CaptureCapability>(() => getCaptureCapability());
  const [state, setState] = useState<CaptureState>("idle");
  const [frameRate, setFrameRate] = useState<30 | 60>(60);
  const [capturedSwings, setCapturedSwings] = useState<CapturedSwing[]>([]);
  const [previewSwing, setPreviewSwing] = useState<CapturedSwing | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isCapturingRef = useRef(false);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mimeType = getPreferredMimeType();
  const ext = getFileExtension(mimeType);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: frameRate },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Start rolling buffer recorder
      if (capability === "rolling_buffer") {
        chunksRef.current = [];
        isCapturingRef.current = false;
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 8_000_000,
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
            if (!isCapturingRef.current && chunksRef.current.length > CHUNKS_TO_KEEP) {
              chunksRef.current.shift();
            }
          }
        };

        recorder.start(CHUNK_INTERVAL_MS);
        recorderRef.current = recorder;
      }

      setCameraError(null);
      setState("idle");
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(err.message || "Camera access denied");
      setState("error");
    }
  }, [frameRate, capability, mimeType]);

  // Initialize camera on mount / frame rate change
  useEffect(() => {
    if (capability !== "file_input") {
      startCamera();
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch { }
      }
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [startCamera, capability]);

  // Generate thumbnail from blob
  const generateThumbnail = (blob: Blob): Promise<string> =>
    new Promise((resolve) => {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(blob);
      video.muted = true;
      video.currentTime = 1; // grab frame at 1s
      video.onloadeddata = () => {
        video.currentTime = 1;
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 120;
        canvas.height = 68;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, 120, 68);
        const url = canvas.toDataURL("image/jpeg", 0.7);
        URL.revokeObjectURL(video.src);
        resolve(url);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve("");
      };
    });

  // Capture tap handler (rolling buffer mode)
  const handleCaptureTap = useCallback(() => {
    if (state !== "idle" || capturedSwings.length >= maxSwings) return;

    if (capability === "rolling_buffer" && recorderRef.current) {
      isCapturingRef.current = true;
      setState("capturing");
      setCountdown(2);

      let remaining = 2;
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 1000);

      captureTimeoutRef.current = setTimeout(async () => {
        // Stop recorder to finalize
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        }

        // Small delay for final chunk
        await new Promise((r) => setTimeout(r, 100));

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const thumbnailUrl = await generateThumbnail(blob);
        const timestamp = Date.now();
        const file = new File([blob], `swing_capture_${timestamp}.${ext}`, { type: mimeType });

        const swing: CapturedSwing = {
          id: `capture_${timestamp}`,
          blob,
          thumbnailUrl,
          file,
        };

        setPreviewSwing(swing);
        setState("preview");
        setCountdown(null);
        isCapturingRef.current = false;
      }, POST_CAPTURE_MS);
    } else if (capability === "simple_record") {
      // Simple record: start recording for 4 seconds
      if (!streamRef.current) return;
      setState("capturing");
      setCountdown(4);
      const simpleChunks: Blob[] = [];
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: 8_000_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) simpleChunks.push(e.data);
      };
      recorder.start(CHUNK_INTERVAL_MS);
      recorderRef.current = recorder;

      let remaining = 4;
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 1000);

      captureTimeoutRef.current = setTimeout(async () => {
        recorder.stop();
        await new Promise((r) => setTimeout(r, 100));
        const blob = new Blob(simpleChunks, { type: mimeType });
        const thumbnailUrl = await generateThumbnail(blob);
        const timestamp = Date.now();
        const file = new File([blob], `swing_capture_${timestamp}.${ext}`, { type: mimeType });
        const swing: CapturedSwing = {
          id: `capture_${timestamp}`,
          blob,
          thumbnailUrl,
          file,
        };
        setPreviewSwing(swing);
        setState("preview");
        setCountdown(null);
      }, BUFFER_DURATION_MS);
    }
  }, [state, capturedSwings.length, maxSwings, capability, mimeType, ext]);

  // Keep / discard preview
  const handleKeep = useCallback(async () => {
    if (!previewSwing) return;
    setCapturedSwings((prev) => [...prev, previewSwing]);
    setPreviewSwing(null);
    toast.success(`Swing ${capturedSwings.length + 1} captured! 💪`);
    // Restart camera + buffer
    await startCamera();
  }, [previewSwing, capturedSwings.length, startCamera]);

  const handleDiscard = useCallback(async () => {
    setPreviewSwing(null);
    await startCamera();
  }, [startCamera]);

  // Remove a captured swing
  const handleRemoveSwing = (id: string) => {
    setCapturedSwings((prev) => prev.filter((s) => s.id !== id));
  };

  // Upload all captured swings
  const handleUploadAll = () => {
    const files = capturedSwings.map((s) => s.file);
    onSwingsReady(files);
  };

  // File input fallback handler
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const blob = file.slice();
    const thumbnailUrl = await generateThumbnail(blob);
    const swing: CapturedSwing = {
      id: `capture_${Date.now()}`,
      blob,
      thumbnailUrl,
      file,
    };
    setCapturedSwings((prev) => [...prev, swing]);
    toast.success(`Swing ${capturedSwings.length + 1} added!`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── FILE INPUT FALLBACK ───
  if (capability === "file_input") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl p-6 text-center" style={{ background: "#111", border: "1px solid #222" }}>
          <Smartphone className="h-12 w-12 mx-auto mb-3" style={{ color: "#555" }} />
          <p className="text-[15px] font-bold mb-1" style={{ color: "#fff" }}>
            In-app recording not supported
          </p>
          <p className="text-[12px] mb-4" style={{ color: "#a0a0a0" }}>
            Your browser doesn't support live capture. Tap below to open your camera.
          </p>
          <label
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold cursor-pointer"
            style={{ background: "#E63946", color: "#fff" }}
          >
            <Camera className="h-4 w-4" />
            Open Camera
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={handleFileInput}
            />
          </label>
        </div>

        {/* Captured swings thumbnails */}
        {capturedSwings.length > 0 && (
          <SwingThumbnailStrip swings={capturedSwings} onRemove={handleRemoveSwing} />
        )}

        {capturedSwings.length > 0 && (
          <button
            onClick={handleUploadAll}
            className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "#E63946", color: "#fff" }}
          >
            <Upload className="h-4 w-4" />
            Upload {capturedSwings.length} Swing{capturedSwings.length !== 1 ? "s" : ""} →
          </button>
        )}

        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-lg text-xs font-semibold"
          style={{ background: "#222", color: "#a0a0a0", border: "1px solid #333" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // ─── CAMERA ERROR ───
  if (state === "error" || cameraError) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl p-6 text-center" style={{ background: "#111", border: "1px solid rgba(230,57,70,0.3)" }}>
          <Camera className="h-12 w-12 mx-auto mb-3" style={{ color: "#E63946" }} />
          <p className="text-[15px] font-bold mb-1" style={{ color: "#fff" }}>Camera Access Denied</p>
          <p className="text-[12px] mb-4" style={{ color: "#a0a0a0" }}>
            {cameraError || "Please allow camera access in your browser settings and try again."}
          </p>
          <button
            onClick={startCamera}
            className="px-6 py-2.5 rounded-lg text-sm font-bold"
            style={{ background: "#E63946", color: "#fff" }}
          >
            Retry
          </button>
        </div>
        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-lg text-xs font-semibold"
          style={{ background: "#222", color: "#a0a0a0", border: "1px solid #333" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // ─── PREVIEW STATE ───
  if (state === "preview" && previewSwing) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl overflow-hidden" style={{ border: "2px solid #4ecdc4" }}>
          <AspectRatio ratio={16 / 9}>
            <video
              src={URL.createObjectURL(previewSwing.blob)}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </AspectRatio>
        </div>

        <p className="text-center text-[13px] font-semibold" style={{ color: "#fff" }}>
          Keep this swing?
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleDiscard}
            className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "#222", color: "#a0a0a0", border: "1px solid #333" }}
          >
            <X className="h-4 w-4" /> Discard
          </button>
          <button
            onClick={handleKeep}
            className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "#4ecdc4", color: "#000" }}
          >
            <Check className="h-4 w-4" /> Keep
          </button>
        </div>
      </div>
    );
  }

  // ─── MAIN CAMERA VIEW (IDLE / CAPTURING) ───
  return (
    <div className="space-y-4">
      {/* Viewfinder */}
      <div
        className="rounded-xl overflow-hidden relative transition-all"
        style={{
          border: state === "capturing" ? "2px solid #E63946" : "2px solid #222",
          boxShadow: state === "capturing" ? "0 0 20px rgba(230,57,70,0.3)" : "none",
        }}
      >
        <AspectRatio ratio={16 / 9}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(1)" }}
          />
        </AspectRatio>

        {state === "capturing" && countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-6xl font-black" style={{ color: "#E63946" }}>
              {countdown}
            </span>
          </div>
        )}
      </div>

      {/* Frame rate selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {([30, 60] as const).map((fps) => (
            <button
              key={fps}
              onClick={() => {
                if (state === "idle") setFrameRate(fps);
              }}
              disabled={state !== "idle"}
              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: frameRate === fps ? "#E63946" : "#222",
                color: frameRate === fps ? "#fff" : "#777",
                border: `1px solid ${frameRate === fps ? "#E63946" : "#333"}`,
                opacity: state !== "idle" ? 0.5 : 1,
              }}
            >
              {fps}fps
            </button>
          ))}
        </div>
        <span className="text-[11px]" style={{ color: "#555" }}>
          {capturedSwings.length} / {maxSwings} swings
        </span>
      </div>

      <p className="text-[11px] text-center" style={{ color: "#555" }}>
        {state === "idle"
          ? "Camera is watching. Swing, then tap at contact."
          : "Capturing…"
        }
      </p>

      {/* Capture Button */}
      <div className="flex justify-center">
        <button
          onClick={handleCaptureTap}
          disabled={state !== "idle" || capturedSwings.length >= maxSwings}
          className="relative flex items-center justify-center transition-all active:scale-95"
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: state === "idle" ? "#E63946" : "#555",
            boxShadow: state === "idle" ? "0 0 0 4px rgba(230,57,70,0.25)" : "none",
            opacity: capturedSwings.length >= maxSwings ? 0.4 : 1,
          }}
        >
          <Circle className="h-8 w-8 text-white fill-white" />
          {state === "idle" && (
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "rgba(230,57,70,0.2)" }}
            />
          )}
        </button>
      </div>

      {/* Thumbnails */}
      {capturedSwings.length > 0 && (
        <SwingThumbnailStrip swings={capturedSwings} onRemove={handleRemoveSwing} />
      )}

      {/* Upload / Cancel buttons */}
      <div className="space-y-2">
        {capturedSwings.length > 0 && (
          <button
            onClick={handleUploadAll}
            className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "#E63946", color: "#fff" }}
          >
            <Upload className="h-4 w-4" />
            Upload {capturedSwings.length} Swing{capturedSwings.length !== 1 ? "s" : ""} →
          </button>
        )}
        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-lg text-xs font-semibold"
          style={{ background: "#222", color: "#a0a0a0", border: "1px solid #333" }}
        >
          Cancel
        </button>
      </div>

      <p className="text-[10px] text-center" style={{ color: "#444" }}>
        60fps recommended. For 120fps+ slo-mo, use your camera app and upload the video.
      </p>
    </div>
  );
}

// ─── Thumbnail Strip Sub-component ───
function SwingThumbnailStrip({
  swings,
  onRemove,
}: {
  swings: CapturedSwing[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto py-1 px-1">
      {swings.map((s, i) => (
        <div
          key={s.id}
          className="relative shrink-0 rounded-lg overflow-hidden"
          style={{ width: 60, height: 60, border: "1px solid #333" }}
        >
          {s.thumbnailUrl ? (
            <img src={s.thumbnailUrl} alt={`Swing ${i + 1}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: "#222" }}>
              <Play className="h-3 w-3" style={{ color: "#555" }} />
            </div>
          )}
          <span
            className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-bold py-0.5"
            style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
          >
            {i + 1}
          </span>
          <button
            onClick={() => onRemove(s.id)}
            className="absolute top-0 right-0 p-0.5"
            style={{ background: "rgba(0,0,0,0.7)" }}
          >
            <X className="h-2.5 w-2.5" style={{ color: "#E63946" }} />
          </button>
        </div>
      ))}
    </div>
  );
}
