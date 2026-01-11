import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  MousePointer2, 
  Square, 
  Trash2, 
  Save, 
  Loader2,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SAM3Mode = "off" | "point" | "box";

interface PointPrompt {
  x: number;
  y: number;
  label: 0 | 1; // 0 = negative (exclude), 1 = positive (include)
}

interface BoxPrompt {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface MaskAnnotation {
  id: string;
  maskUrl: string;
  frameTimeMs: number;
  prompts: {
    points?: PointPrompt[];
    box?: BoxPrompt;
  };
  createdAt: number;
}

interface SAM3OverlayCanvasProps {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  mode: SAM3Mode;
  onModeChange: (mode: SAM3Mode) => void;
  onAnnotationSave?: (annotation: MaskAnnotation) => void;
  savedAnnotations?: MaskAnnotation[];
}

export function SAM3OverlayCanvas({
  videoElement,
  isActive,
  mode,
  onModeChange,
  onAnnotationSave,
  savedAnnotations = [],
}: SAM3OverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMaskUrl, setCurrentMaskUrl] = useState<string | null>(null);
  const [showMask, setShowMask] = useState(true);
  const [points, setPoints] = useState<PointPrompt[]>([]);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<BoxPrompt | null>(null);
  const [maskOpacity, setMaskOpacity] = useState(0.45);

  // Get video dimensions and compute letterbox offset
  const getVideoLayout = useCallback(() => {
    if (!videoElement || !containerRef.current) return null;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    if (!videoWidth || !videoHeight) return null;

    const containerAspect = containerRect.width / containerRect.height;
    const videoAspect = videoWidth / videoHeight;

    let displayWidth: number;
    let displayHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > videoAspect) {
      // Container is wider - video is letterboxed horizontally
      displayHeight = containerRect.height;
      displayWidth = displayHeight * videoAspect;
      offsetX = (containerRect.width - displayWidth) / 2;
    } else {
      // Container is taller - video is letterboxed vertically
      displayWidth = containerRect.width;
      displayHeight = displayWidth / videoAspect;
      offsetY = (containerRect.height - displayHeight) / 2;
    }

    return {
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
      displayWidth,
      displayHeight,
      offsetX,
      offsetY,
      videoWidth,
      videoHeight,
      scaleX: videoWidth / displayWidth,
      scaleY: videoHeight / displayHeight,
    };
  }, [videoElement]);

  // Convert container coords to native video pixel coords
  const containerToVideoCoords = useCallback((clientX: number, clientY: number) => {
    const layout = getVideoLayout();
    if (!layout || !containerRef.current) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const containerX = clientX - rect.left;
    const containerY = clientY - rect.top;

    // Subtract letterbox offset
    const videoDisplayX = containerX - layout.offsetX;
    const videoDisplayY = containerY - layout.offsetY;

    // Check if click is within video bounds
    if (
      videoDisplayX < 0 || 
      videoDisplayX > layout.displayWidth ||
      videoDisplayY < 0 || 
      videoDisplayY > layout.displayHeight
    ) {
      return null;
    }

    // Scale to native video resolution
    const nativeX = Math.round(videoDisplayX * layout.scaleX);
    const nativeY = Math.round(videoDisplayY * layout.scaleY);

    return { x: nativeX, y: nativeY };
  }, [getVideoLayout]);

  // Capture current frame as base64
  const captureFrame = useCallback((): string | null => {
    if (!videoElement) return null;

    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(videoElement, 0, 0);
    return canvas.toDataURL("image/png");
  }, [videoElement]);

  // Handle canvas click for point mode
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== "point" || isProcessing) return;

    const coords = containerToVideoCoords(e.clientX, e.clientY);
    if (!coords) return;

    // Shift+click = negative point (exclude)
    const label: 0 | 1 = e.shiftKey ? 0 : 1;
    const newPoint: PointPrompt = { x: coords.x, y: coords.y, label };
    
    setPoints(prev => [...prev, newPoint]);
  }, [mode, isProcessing, containerToVideoCoords]);

  // Handle mouse down for box mode
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== "box" || isProcessing) return;

    const coords = containerToVideoCoords(e.clientX, e.clientY);
    if (!coords) return;

    setBoxStart(coords);
    setCurrentBox(null);
  }, [mode, isProcessing, containerToVideoCoords]);

  // Handle mouse move for box mode
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== "box" || !boxStart || isProcessing) return;

    const coords = containerToVideoCoords(e.clientX, e.clientY);
    if (!coords) return;

    setCurrentBox({
      x1: Math.min(boxStart.x, coords.x),
      y1: Math.min(boxStart.y, coords.y),
      x2: Math.max(boxStart.x, coords.x),
      y2: Math.max(boxStart.y, coords.y),
    });
  }, [mode, boxStart, isProcessing, containerToVideoCoords]);

  // Handle mouse up for box mode
  const handleMouseUp = useCallback(() => {
    if (mode !== "box") return;
    setBoxStart(null);
  }, [mode]);

  // Run SAM3 segmentation
  const runSegmentation = useCallback(async () => {
    if (!videoElement || (points.length === 0 && !currentBox)) {
      toast.error("Add points or draw a box first");
      return;
    }

    setIsProcessing(true);
    try {
      const imageDataUrl = captureFrame();
      if (!imageDataUrl) throw new Error("Failed to capture frame");

      const { data, error } = await supabase.functions.invoke("sam3-segment", {
        body: {
          imageDataUrl,
          mode: "custom",
          points: points.length > 0 ? points : undefined,
          box: currentBox || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Prefer maskDataUrl (base64) to avoid CORS issues with remote URLs
      const maskResult = data.maskDataUrl || data.maskUrl;
      if (maskResult) {
        setCurrentMaskUrl(maskResult);
        toast.success(`Segmentation complete (${data.processingTime}ms)`);
      } else {
        toast.error("No mask returned");
      }
    } catch (err) {
      console.error("SAM3 error:", err);
      toast.error(err instanceof Error ? err.message : "Segmentation failed");
    } finally {
      setIsProcessing(false);
    }
  }, [videoElement, points, currentBox, captureFrame]);

  // Clear all prompts and mask
  const clearAll = useCallback(() => {
    setPoints([]);
    setCurrentBox(null);
    setBoxStart(null);
    setCurrentMaskUrl(null);
  }, []);

  // Save current annotation
  const saveAnnotation = useCallback(() => {
    if (!currentMaskUrl || !videoElement) {
      toast.error("No mask to save");
      return;
    }

    const annotation: MaskAnnotation = {
      id: crypto.randomUUID(),
      maskUrl: currentMaskUrl,
      frameTimeMs: Math.round(videoElement.currentTime * 1000),
      prompts: {
        points: points.length > 0 ? points : undefined,
        box: currentBox || undefined,
      },
      createdAt: Date.now(),
    };

    onAnnotationSave?.(annotation);
    toast.success("Mask saved");
  }, [currentMaskUrl, videoElement, points, currentBox, onAnnotationSave]);

  // Draw overlay (points, box, mask)
  useEffect(() => {
    const canvas = canvasRef.current;
    const layout = getVideoLayout();
    if (!canvas || !layout) return;

    // Resize canvas to match container
    canvas.width = layout.containerWidth;
    canvas.height = layout.containerHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw mask if available
    if (currentMaskUrl && showMask) {
      const maskImg = new Image();
      maskImg.crossOrigin = "anonymous";
      maskImg.onload = () => {
        ctx.globalAlpha = maskOpacity;
        ctx.drawImage(
          maskImg,
          layout.offsetX,
          layout.offsetY,
          layout.displayWidth,
          layout.displayHeight
        );
        ctx.globalAlpha = 1.0;
        
        // Redraw prompts on top
        drawPrompts(ctx, layout);
      };
      maskImg.src = currentMaskUrl;
    } else {
      drawPrompts(ctx, layout);
    }

    function drawPrompts(ctx: CanvasRenderingContext2D, layout: NonNullable<ReturnType<typeof getVideoLayout>>) {
      // Draw points
      for (const point of points) {
        const displayX = (point.x / layout.scaleX) + layout.offsetX;
        const displayY = (point.y / layout.scaleY) + layout.offsetY;

        ctx.beginPath();
        ctx.arc(displayX, displayY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = point.label === 1 ? "#22c55e" : "#ef4444";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw + or - symbol
        ctx.fillStyle = "white";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(point.label === 1 ? "+" : "−", displayX, displayY);
      }

      // Draw box
      if (currentBox) {
        const x1 = (currentBox.x1 / layout.scaleX) + layout.offsetX;
        const y1 = (currentBox.y1 / layout.scaleY) + layout.offsetY;
        const x2 = (currentBox.x2 / layout.scaleX) + layout.offsetX;
        const y2 = (currentBox.y2 / layout.scaleY) + layout.offsetY;

        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.setLineDash([]);

        // Fill with low opacity
        ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      }
    }
  }, [points, currentBox, currentMaskUrl, showMask, maskOpacity, getVideoLayout]);

  // Auto-run segmentation when prompts change
  useEffect(() => {
    if (mode === "off") return;
    
    // Debounce: wait for user to finish adding prompts
    const hasPrompts = points.length > 0 || currentBox;
    if (!hasPrompts) return;

    const timer = setTimeout(() => {
      runSegmentation();
    }, 500);

    return () => clearTimeout(timer);
  }, [points, currentBox, mode, runSegmentation]);

  if (!isActive) return null;

  return (
    <>
      {/* Overlay Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-10"
        style={{ pointerEvents: mode !== "off" ? "auto" : "none" }}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 w-full h-full",
            mode === "point" && "cursor-crosshair",
            mode === "box" && "cursor-crosshair"
          )}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* SAM3 Toolbar */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/80 rounded-lg p-1">
        <Button
          variant={mode === "point" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onModeChange(mode === "point" ? "off" : "point")}
          disabled={isProcessing}
          className="h-8 px-2 text-xs"
          title="Point mode (click to add, Shift+click to exclude)"
        >
          <MousePointer2 className="h-4 w-4 mr-1" />
          Point
        </Button>
        
        <Button
          variant={mode === "box" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onModeChange(mode === "box" ? "off" : "box")}
          disabled={isProcessing}
          className="h-8 px-2 text-xs"
          title="Box mode (drag to select region)"
        >
          <Square className="h-4 w-4 mr-1" />
          Box
        </Button>

        <div className="w-px h-6 bg-white/20 mx-1" />

        {currentMaskUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMask(!showMask)}
            className="h-8 px-2 text-xs"
            title={showMask ? "Hide mask" : "Show mask"}
          >
            {showMask ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          disabled={isProcessing || (points.length === 0 && !currentBox && !currentMaskUrl)}
          className="h-8 px-2 text-xs"
          title="Clear all"
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={saveAnnotation}
          disabled={isProcessing || !currentMaskUrl}
          className="h-8 px-2 text-xs text-green-400 hover:text-green-300"
          title="Save mask"
        >
          <Save className="h-4 w-4" />
        </Button>

        {isProcessing && (
          <Loader2 className="h-4 w-4 animate-spin text-blue-400 ml-1" />
        )}
      </div>

      {/* Instructions */}
      {mode !== "off" && !currentMaskUrl && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 bg-black/80 text-white text-xs px-3 py-1.5 rounded-full">
          {mode === "point" && "Click to add point • Shift+Click to exclude"}
          {mode === "box" && "Click and drag to draw box"}
        </div>
      )}
    </>
  );
}
