import { useRef, useEffect, useState, useCallback } from "react";

interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  frame: number;
}

interface BatPathTrailProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  isRecording: boolean;
  barrelPosition?: { x: number; y: number } | null; // From SAM3 segmentation
  trailColor?: string;
  trailWidth?: number;
  trailLength?: number; // Max points to keep
  glowEnabled?: boolean;
  onTrailUpdate?: (points: TrailPoint[]) => void;
}

/**
 * Canvas overlay that draws the bat barrel trajectory across frames.
 * Can work in two modes:
 * 1. Manual mode: User clicks to mark barrel position each frame
 * 2. Auto mode: Uses SAM3 barrel segmentation centroid
 */
export function BatPathTrail({
  videoRef,
  enabled,
  isRecording,
  barrelPosition,
  trailColor = "#f59e0b", // Amber
  trailWidth = 4,
  trailLength = 60,
  glowEnabled = true,
  onTrailUpdate,
}: BatPathTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailPointsRef = useRef<TrailPoint[]>([]);
  const animationRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(-1);

  // Add point to trail
  const addTrailPoint = useCallback((x: number, y: number) => {
    const video = videoRef.current;
    if (!video) return;

    const frame = Math.floor(video.currentTime * 30); // Assume 30fps for frame index
    
    // Only add if we're on a new frame
    if (frame === lastFrameRef.current) return;
    lastFrameRef.current = frame;

    const point: TrailPoint = {
      x,
      y,
      timestamp: video.currentTime,
      frame,
    };

    trailPointsRef.current = [
      ...trailPointsRef.current.slice(-trailLength + 1),
      point,
    ];

    onTrailUpdate?.(trailPointsRef.current);
  }, [trailLength, onTrailUpdate, videoRef]);

  // Handle manual click to mark barrel position
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isRecording || !enabled) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    addTrailPoint(x, y);
  }, [isRecording, enabled, addTrailPoint, videoRef]);

  // Auto-add points from SAM3 barrel position
  useEffect(() => {
    if (!isRecording || !enabled || !barrelPosition) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Convert normalized coordinates to canvas coordinates
    const x = barrelPosition.x * canvas.width;
    const y = barrelPosition.y * canvas.height;

    addTrailPoint(x, y);
  }, [barrelPosition, isRecording, enabled, addTrailPoint, videoRef]);

  // Render trail
  const renderTrail = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video || !enabled) {
      animationRef.current = requestAnimationFrame(renderTrail);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animationRef.current = requestAnimationFrame(renderTrail);
      return;
    }

    // Match canvas size to video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const points = trailPointsRef.current;
    if (points.length < 2) {
      animationRef.current = requestAnimationFrame(renderTrail);
      return;
    }

    // Draw trail with gradient opacity (older = more transparent)
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw glow effect first (if enabled)
    if (glowEnabled) {
      ctx.save();
      ctx.shadowColor = trailColor;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = trailColor;
      ctx.lineWidth = trailWidth * 2;
      ctx.globalAlpha = 0.3;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw main trail with gradient
    for (let i = 1; i < points.length; i++) {
      const progress = i / points.length;
      const alpha = 0.2 + (progress * 0.8); // Fade from 0.2 to 1.0

      ctx.beginPath();
      ctx.strokeStyle = trailColor;
      ctx.lineWidth = trailWidth * (0.5 + progress * 0.5); // Thinner at start
      ctx.globalAlpha = alpha;
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }

    // Draw barrel head indicator at latest position
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      
      // Outer glow
      ctx.beginPath();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = trailColor;
      ctx.shadowColor = trailColor;
      ctx.shadowBlur = 15;
      ctx.arc(lastPoint.x, lastPoint.y, trailWidth * 3, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright point
      ctx.beginPath();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.arc(lastPoint.x, lastPoint.y, trailWidth * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    animationRef.current = requestAnimationFrame(renderTrail);
  }, [enabled, trailColor, trailWidth, glowEnabled, videoRef]);

  // Start/stop render loop
  useEffect(() => {
    if (enabled) {
      animationRef.current = requestAnimationFrame(renderTrail);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, renderTrail]);

  // Clear trail when disabled
  useEffect(() => {
    if (!enabled) {
      trailPointsRef.current = [];
      lastFrameRef.current = -1;
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      className={`absolute inset-0 w-full h-full ${isRecording ? 'cursor-crosshair' : 'pointer-events-none'}`}
      style={{ mixBlendMode: "screen" }}
    />
  );
}

/**
 * Clears the trail points - exposed for external control
 */
export function clearTrailPoints(ref: React.RefObject<{ clear: () => void }>) {
  ref.current?.clear();
}
