import { useRef, useEffect, useMemo } from "react";
import { 
  MomentumOverlay, 
  OverlayFrame, 
  getActiveFrame, 
  SEGMENT_COLORS,
  type OverlaySegment,
  type OverlayStyle
} from "@/lib/momentum-overlay-types";

interface MomentumOverlayCanvasProps {
  videoElement: HTMLVideoElement | null;
  overlay: MomentumOverlay | null;
  currentTime: number;
  isEnabled: boolean;
}

// Default segment regions when no bounding box is provided (normalized 0-1)
const DEFAULT_SEGMENT_BOUNDS: Record<OverlaySegment, { x: number; y: number; width: number; height: number }> = {
  legs: { x: 0.35, y: 0.65, width: 0.30, height: 0.35 },
  torso: { x: 0.30, y: 0.35, width: 0.40, height: 0.30 },
  arms: { x: 0.15, y: 0.25, width: 0.70, height: 0.25 },
  bat: { x: 0.05, y: 0.10, width: 0.90, height: 0.40 },
};

export function MomentumOverlayCanvas({
  videoElement,
  overlay,
  currentTime,
  isEnabled,
}: MomentumOverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Find the active frame based on current playback time
  const activeFrame = useMemo(() => {
    if (!isEnabled || !overlay) return null;
    return getActiveFrame(overlay, currentTime);
  }, [overlay, currentTime, isEnabled]);
  
  // Render the overlay on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx || !videoElement) return;
    
    // Match canvas size to video
    const rect = videoElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);
    
    // Clear previous frame
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // If no active frame or not enabled, nothing to draw
    if (!activeFrame || !isEnabled) return;
    
    // Draw each region in the active frame
    for (const region of activeFrame.regions) {
      const bounds = region.bounds || DEFAULT_SEGMENT_BOUNDS[region.segment];
      const colors = SEGMENT_COLORS[region.segment];
      
      const x = bounds.x * rect.width;
      const y = bounds.y * rect.height;
      const width = bounds.width * rect.width;
      const height = bounds.height * rect.height;
      
      drawSegmentOverlay(ctx, x, y, width, height, region.style, colors);
    }
  }, [videoElement, activeFrame, isEnabled]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Force re-render by updating canvas dimensions
      const canvas = canvasRef.current;
      if (canvas && videoElement) {
        const rect = videoElement.getBoundingClientRect();
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [videoElement]);
  
  if (!isEnabled || !overlay) return null;
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}

// Draw a single segment overlay with the specified style
function drawSegmentOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  style: OverlayStyle,
  colors: { highlight: string; dim: string; outline: string; glow: string }
) {
  const cornerRadius = 8;
  
  ctx.save();
  
  switch (style) {
    case 'highlight':
      // Filled rectangle with rounded corners
      ctx.fillStyle = colors.highlight;
      ctx.beginPath();
      roundRect(ctx, x, y, width, height, cornerRadius);
      ctx.fill();
      
      // Add border
      ctx.strokeStyle = colors.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
      
    case 'dim':
      // Semi-transparent overlay
      ctx.fillStyle = colors.dim;
      ctx.beginPath();
      roundRect(ctx, x, y, width, height, cornerRadius);
      ctx.fill();
      break;
      
    case 'outline':
      // Just the border
      ctx.strokeStyle = colors.outline;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      roundRect(ctx, x, y, width, height, cornerRadius);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
      
    case 'glow':
      // Glowing effect with multiple layers
      for (let i = 3; i >= 0; i--) {
        const alpha = 0.15 - (i * 0.03);
        const expand = i * 4;
        ctx.fillStyle = colors.glow.replace(/[\d.]+\)$/, `${alpha})`);
        ctx.beginPath();
        roundRect(ctx, x - expand, y - expand, width + expand * 2, height + expand * 2, cornerRadius + expand);
        ctx.fill();
      }
      
      // Core highlight
      ctx.fillStyle = colors.highlight;
      ctx.beginPath();
      roundRect(ctx, x, y, width, height, cornerRadius);
      ctx.fill();
      break;
      
    case 'trace':
      // Motion trail effect
      ctx.strokeStyle = colors.outline;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const offset = i * 3;
        ctx.globalAlpha = 1 - (i * 0.3);
        ctx.beginPath();
        roundRect(ctx, x + offset, y, width, height, cornerRadius);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
  }
  
  ctx.restore();
}

// Helper to draw rounded rectangles
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
