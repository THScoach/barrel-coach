import { useRef, useEffect, useState, useCallback } from "react";

interface SpotlightCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  maskUrl: string | null;
  mode: "spotlight" | "highlight" | "mute";
  intensity?: number; // 0-1, how much to dim/highlight
  enabled: boolean;
}

/**
 * Canvas overlay that applies SAM3 mask effects to video playback
 * - Spotlight mode: Keeps subject at 100%, dims background
 * - Highlight mode: Adds glow/emphasis to masked region
 * - Mute mode: Dims the masked region (inverse spotlight)
 */
export function SpotlightCanvas({
  videoRef,
  maskUrl,
  mode,
  intensity = 0.7,
  enabled,
}: SpotlightCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskImageRef = useRef<HTMLImageElement | null>(null);
  const animationRef = useRef<number>(0);
  const [maskLoaded, setMaskLoaded] = useState(false);

  // Load mask image when URL changes
  useEffect(() => {
    if (!maskUrl) {
      setMaskLoaded(false);
      maskImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      maskImageRef.current = img;
      setMaskLoaded(true);
    };
    img.onerror = () => {
      console.error("Failed to load mask image:", maskUrl);
      setMaskLoaded(false);
    };
    img.src = maskUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [maskUrl]);

  // Render loop
  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const mask = maskImageRef.current;

    if (!video || !canvas || !enabled) {
      animationRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animationRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    // Match canvas size to video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
    }

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply mask effect if available
    if (mask && maskLoaded) {
      applyMaskEffect(ctx, mask, mode, intensity, canvas.width, canvas.height);
    }

    animationRef.current = requestAnimationFrame(renderFrame);
  }, [videoRef, enabled, maskLoaded, mode, intensity]);

  // Start/stop render loop
  useEffect(() => {
    if (enabled) {
      animationRef.current = requestAnimationFrame(renderFrame);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, renderFrame]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: "normal" }}
    />
  );
}

function applyMaskEffect(
  ctx: CanvasRenderingContext2D,
  mask: HTMLImageElement,
  mode: "spotlight" | "highlight" | "mute",
  intensity: number,
  width: number,
  height: number
) {
  // Create temporary canvas for mask processing
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return;

  // Draw mask scaled to canvas size
  tempCtx.drawImage(mask, 0, 0, width, height);
  const maskData = tempCtx.getImageData(0, 0, width, height);

  // Get current frame data
  const frameData = ctx.getImageData(0, 0, width, height);
  const pixels = frameData.data;
  const maskPixels = maskData.data;

  const dimFactor = 1 - intensity;

  for (let i = 0; i < pixels.length; i += 4) {
    // Mask is typically white (255) for subject, black (0) for background
    // Use red channel as mask value
    const maskValue = maskPixels[i] / 255;

    switch (mode) {
      case "spotlight":
        // Dim background (where mask is black/low)
        if (maskValue < 0.5) {
          pixels[i] *= dimFactor;     // R
          pixels[i + 1] *= dimFactor; // G
          pixels[i + 2] *= dimFactor; // B
        }
        break;

      case "highlight":
        // Add subtle glow to masked region
        if (maskValue > 0.5) {
          const boost = 1 + (intensity * 0.3);
          pixels[i] = Math.min(255, pixels[i] * boost);
          pixels[i + 1] = Math.min(255, pixels[i + 1] * boost);
          pixels[i + 2] = Math.min(255, pixels[i + 2] * boost);
        }
        break;

      case "mute":
        // Dim the masked region (inverse of spotlight)
        if (maskValue > 0.5) {
          pixels[i] *= dimFactor;
          pixels[i + 1] *= dimFactor;
          pixels[i + 2] *= dimFactor;
        }
        break;
    }
  }

  ctx.putImageData(frameData, 0, 0);
}
