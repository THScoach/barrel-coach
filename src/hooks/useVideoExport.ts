import { useRef, useState, useCallback } from "react";

interface ExportOptions {
  width: number;
  height: number;
  aspectRatio: string;
  frameRate?: number;
  videoBitsPerSecond?: number;
}

interface ExportProgress {
  phase: "preparing" | "recording" | "encoding" | "complete" | "error";
  progress: number; // 0-100
  message: string;
}

interface UseVideoExportReturn {
  exportVideo: (
    videoElement: HTMLVideoElement,
    overlayCanvases: HTMLCanvasElement[],
    options: ExportOptions,
    contactFrameTime?: number | null,
    freezeDuration?: number
  ) => Promise<Blob | null>;
  isExporting: boolean;
  progress: ExportProgress | null;
  cancelExport: () => void;
}

/**
 * Hook for exporting video with canvas overlays using MediaRecorder
 * Composites video + all effect canvases into a single output
 */
export function useVideoExport(): UseVideoExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const cancelledRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const cancelExport = useCallback(() => {
    cancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const exportVideo = useCallback(async (
    videoElement: HTMLVideoElement,
    overlayCanvases: HTMLCanvasElement[],
    options: ExportOptions,
    contactFrameTime?: number | null,
    freezeDuration: number = 1.0
  ): Promise<Blob | null> => {
    cancelledRef.current = false;
    setIsExporting(true);
    setProgress({ phase: "preparing", progress: 0, message: "Setting up export..." });

    try {
      const { width, height, frameRate = 30, videoBitsPerSecond = 8_000_000 } = options;

      // Create composite canvas for final output
      const compositeCanvas = document.createElement("canvas");
      compositeCanvas.width = width;
      compositeCanvas.height = height;
      const compositeCtx = compositeCanvas.getContext("2d");
      
      if (!compositeCtx) {
        throw new Error("Failed to create composite canvas context");
      }

      // Calculate video source dimensions and positioning for aspect ratio crop/fit
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      const videoAspect = videoWidth / videoHeight;
      const outputAspect = width / height;

      let sourceX = 0, sourceY = 0, sourceWidth = videoWidth, sourceHeight = videoHeight;
      
      // Crop to fit output aspect ratio (cover mode)
      if (videoAspect > outputAspect) {
        // Video is wider - crop sides
        sourceWidth = videoHeight * outputAspect;
        sourceX = (videoWidth - sourceWidth) / 2;
      } else {
        // Video is taller - crop top/bottom
        sourceHeight = videoWidth / outputAspect;
        sourceY = (videoHeight - sourceHeight) / 2;
      }

      // Get canvas stream for recording
      const stream = compositeCanvas.captureStream(frameRate);
      
      // Try different MIME types
      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ];
      
      let mimeType = mimeTypes[0];
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond,
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Create promise that resolves when recording is complete
      const recordingComplete = new Promise<Blob>((resolve, reject) => {
        mediaRecorder.onstop = () => {
          if (cancelledRef.current) {
            reject(new Error("Export cancelled"));
            return;
          }
          
          setProgress({ phase: "encoding", progress: 95, message: "Finalizing video..." });
          
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };

        mediaRecorder.onerror = (e) => {
          reject(new Error("MediaRecorder error: " + e));
        };
      });

      setProgress({ phase: "recording", progress: 5, message: "Recording frames..." });

      // Store original video state
      const originalTime = videoElement.currentTime;
      const wasPlaying = !videoElement.paused;
      
      // Pause original video for controlled frame capture
      videoElement.pause();
      videoElement.currentTime = 0;

      // Wait for video to seek
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          videoElement.removeEventListener("seeked", onSeeked);
          resolve();
        };
        videoElement.addEventListener("seeked", onSeeked);
      });

      // Start recording
      mediaRecorder.start();

      const duration = videoElement.duration;
      const frameInterval = 1000 / frameRate;
      let currentTime = 0;

      // Render loop - capture frame by frame
      while (currentTime <= duration && !cancelledRef.current) {
        // Seek video to current time
        videoElement.currentTime = currentTime;
        
        // Wait for seek to complete
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            videoElement.removeEventListener("seeked", onSeeked);
            resolve();
          };
          if (Math.abs(videoElement.currentTime - currentTime) < 0.01) {
            resolve();
          } else {
            videoElement.addEventListener("seeked", onSeeked);
          }
        });

        // Small delay to ensure frame is rendered
        await new Promise(r => setTimeout(r, 10));

        // Composite frame: clear, draw video, draw overlays
        compositeCtx.fillStyle = "#000000";
        compositeCtx.fillRect(0, 0, width, height);
        
        // Draw video frame (cropped to aspect ratio)
        compositeCtx.drawImage(
          videoElement,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, width, height
        );

        // Draw each overlay canvas
        for (const canvas of overlayCanvases) {
          if (canvas.width > 0 && canvas.height > 0) {
            compositeCtx.drawImage(
              canvas,
              sourceX, sourceY, sourceWidth, sourceHeight,
              0, 0, width, height
            );
          }
        }

        // Handle contact frame freeze - duplicate frames
        if (
          contactFrameTime !== null && 
          contactFrameTime !== undefined &&
          Math.abs(currentTime - contactFrameTime) < (1 / frameRate)
        ) {
          // Draw contact flash effect
          compositeCtx.fillStyle = "rgba(245, 158, 11, 0.3)"; // Amber flash
          compositeCtx.fillRect(0, 0, width, height);
          
          // Draw "CONTACT" label
          compositeCtx.font = "bold 48px system-ui";
          compositeCtx.textAlign = "center";
          compositeCtx.fillStyle = "#f59e0b";
          compositeCtx.strokeStyle = "#000000";
          compositeCtx.lineWidth = 3;
          const text = "CONTACT";
          compositeCtx.strokeText(text, width / 2, height - 60);
          compositeCtx.fillText(text, width / 2, height - 60);
          
          // Hold this frame for freeze duration
          const freezeFrames = Math.floor(freezeDuration * frameRate);
          for (let f = 0; f < freezeFrames && !cancelledRef.current; f++) {
            await new Promise(r => setTimeout(r, frameInterval));
          }
        }

        // Update progress
        const progressPercent = 5 + (currentTime / duration) * 85;
        setProgress({ 
          phase: "recording", 
          progress: Math.min(90, progressPercent), 
          message: `Recording: ${Math.floor(currentTime)}s / ${Math.floor(duration)}s` 
        });

        currentTime += 1 / frameRate;
      }

      // Stop recording
      mediaRecorder.stop();

      // Restore original video state
      videoElement.currentTime = originalTime;
      if (wasPlaying) {
        videoElement.play();
      }

      // Wait for recording to complete
      const blob = await recordingComplete;

      setProgress({ phase: "complete", progress: 100, message: "Export complete!" });
      setIsExporting(false);

      return blob;

    } catch (error) {
      console.error("Export error:", error);
      setProgress({ 
        phase: "error", 
        progress: 0, 
        message: error instanceof Error ? error.message : "Export failed" 
      });
      setIsExporting(false);
      return null;
    }
  }, []);

  return {
    exportVideo,
    isExporting,
    progress,
    cancelExport,
  };
}

/**
 * Trigger download of a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
