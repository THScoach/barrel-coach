/**
 * Skeleton Sequence Overlay
 * =========================
 * SVG overlay that shows body segment highlights on the video
 * during momentum-peak events.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  SegmentName,
  IDEAL_SEQUENCE,
  SEGMENT_COLORS,
  SequencePlaybackState,
  SwingSequenceAnalysis,
} from "@/lib/momentum-sequence";

interface SkeletonSequenceOverlayProps {
  /** Video element dimensions */
  videoWidth: number;
  videoHeight: number;
  
  /** Sequence analysis data */
  analysis: SwingSequenceAnalysis | null;
  
  /** Current playback state */
  playbackState: SequencePlaybackState | null;
  
  /** Whether overlay is visible */
  visible?: boolean;
  
  /** Batter handedness for skeleton positioning */
  dominantHand?: 'L' | 'R';
  
  /** Additional class names */
  className?: string;
}

// Skeleton joint positions for overlay (normalized 0-1 relative to video)
// These are rough positions for a side-view batter
const SKELETON_POSITIONS = {
  // Right-handed batter (facing left)
  R: {
    head: { x: 0.52, y: 0.18 },
    neck: { x: 0.50, y: 0.24 },
    pelvis: { x: 0.47, y: 0.50 },
    
    // Rear leg (right leg for RH)
    rear_hip: { x: 0.44, y: 0.52 },
    rear_knee: { x: 0.38, y: 0.68 },
    rear_ankle: { x: 0.33, y: 0.85 },
    
    // Lead leg (left leg for RH)
    lead_hip: { x: 0.50, y: 0.52 },
    lead_knee: { x: 0.52, y: 0.68 },
    lead_ankle: { x: 0.54, y: 0.85 },
    
    // Torso
    left_shoulder: { x: 0.54, y: 0.28 },
    right_shoulder: { x: 0.46, y: 0.28 },
    
    // Bottom arm (lead arm - left for RH)
    lead_elbow: { x: 0.60, y: 0.34 },
    lead_wrist: { x: 0.65, y: 0.28 },
    
    // Top arm (rear arm - right for RH)
    rear_elbow: { x: 0.40, y: 0.32 },
    rear_wrist: { x: 0.45, y: 0.22 },
    
    // Bat
    bat_end: { x: 0.72, y: 0.20 },
  },
  // Left-handed batter (mirrored)
  L: {
    head: { x: 0.48, y: 0.18 },
    neck: { x: 0.50, y: 0.24 },
    pelvis: { x: 0.53, y: 0.50 },
    
    rear_hip: { x: 0.56, y: 0.52 },
    rear_knee: { x: 0.62, y: 0.68 },
    rear_ankle: { x: 0.67, y: 0.85 },
    
    lead_hip: { x: 0.50, y: 0.52 },
    lead_knee: { x: 0.48, y: 0.68 },
    lead_ankle: { x: 0.46, y: 0.85 },
    
    left_shoulder: { x: 0.46, y: 0.28 },
    right_shoulder: { x: 0.54, y: 0.28 },
    
    lead_elbow: { x: 0.40, y: 0.34 },
    lead_wrist: { x: 0.35, y: 0.28 },
    
    rear_elbow: { x: 0.60, y: 0.32 },
    rear_wrist: { x: 0.55, y: 0.22 },
    
    bat_end: { x: 0.28, y: 0.20 },
  },
};

// Segment to skeleton region mapping
const SEGMENT_REGIONS: Record<SegmentName, {
  joints: string[];
  type: 'region' | 'path';
}> = {
  rear_leg: {
    joints: ['rear_hip', 'rear_knee', 'rear_ankle'],
    type: 'path',
  },
  lead_leg: {
    joints: ['lead_hip', 'lead_knee', 'lead_ankle'],
    type: 'path',
  },
  torso: {
    joints: ['pelvis', 'neck', 'left_shoulder', 'right_shoulder'],
    type: 'region',
  },
  bottom_arm: {
    joints: ['left_shoulder', 'lead_elbow', 'lead_wrist'],
    type: 'path',
  },
  top_arm: {
    joints: ['right_shoulder', 'rear_elbow', 'rear_wrist'],
    type: 'path',
  },
  bat: {
    joints: ['lead_wrist', 'bat_end'],
    type: 'path',
  },
};

function getSegmentColor(
  segment: SegmentName,
  analysis: SwingSequenceAnalysis | null,
  playbackState: SequencePlaybackState | null
): { stroke: string; opacity: number; glow: boolean } {
  if (!playbackState) {
    return { stroke: SEGMENT_COLORS.inactive, opacity: 0.2, glow: false };
  }
  
  const state = playbackState.segmentStates[segment];
  
  if (state === 'pending') {
    return { stroke: SEGMENT_COLORS.pending, opacity: 0.3, glow: false };
  }
  
  if (state === 'inactive') {
    return { stroke: SEGMENT_COLORS.inactive, opacity: 0.2, glow: false };
  }
  
  // Active or peaked
  if (analysis) {
    const idealIdx = IDEAL_SEQUENCE.indexOf(segment);
    const actualIdx = analysis.actualOrder.indexOf(segment);
    
    if (idealIdx === actualIdx) {
      return { 
        stroke: SEGMENT_COLORS.in_sequence, 
        opacity: state === 'active' ? 1 : 0.8,
        glow: state === 'active',
      };
    } else if (Math.abs(idealIdx - actualIdx) === 1) {
      return { 
        stroke: SEGMENT_COLORS.warning, 
        opacity: state === 'active' ? 1 : 0.8,
        glow: state === 'active',
      };
    } else {
      return { 
        stroke: SEGMENT_COLORS.out_of_sequence, 
        opacity: state === 'active' ? 1 : 0.8,
        glow: state === 'active',
      };
    }
  }
  
  return { stroke: SEGMENT_COLORS.in_sequence, opacity: 0.8, glow: state === 'active' };
}

export function SkeletonSequenceOverlay({
  videoWidth,
  videoHeight,
  analysis,
  playbackState,
  visible = true,
  dominantHand = 'R',
  className,
}: SkeletonSequenceOverlayProps) {
  const positions = SKELETON_POSITIONS[dominantHand];
  
  // Convert normalized positions to pixel coordinates
  const toPixel = (pos: { x: number; y: number }) => ({
    x: pos.x * videoWidth,
    y: pos.y * videoHeight,
  });
  
  // Render segments
  const segments = useMemo(() => {
    return IDEAL_SEQUENCE.map((segment) => {
      const region = SEGMENT_REGIONS[segment];
      const style = getSegmentColor(segment, analysis, playbackState);
      
      const jointPositions = region.joints.map((joint) => {
        const pos = positions[joint as keyof typeof positions];
        return pos ? toPixel(pos) : null;
      }).filter(Boolean) as { x: number; y: number }[];
      
      if (jointPositions.length < 2) return null;
      
      // Create path
      const pathD = jointPositions.map((p, i) => 
        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
      ).join(' ');
      
      return (
        <g key={segment}>
          {/* Glow effect for active segments */}
          {style.glow && (
            <path
              d={pathD}
              fill="none"
              stroke={style.stroke}
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.4}
              className="animate-pulse"
            />
          )}
          
          {/* Main path */}
          <path
            d={pathD}
            fill="none"
            stroke={style.stroke}
            strokeWidth={style.glow ? 6 : 4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={style.opacity}
            className="transition-all duration-150"
          />
          
          {/* Joint circles */}
          {jointPositions.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={style.glow ? 6 : 4}
              fill={style.stroke}
              opacity={style.opacity}
              className="transition-all duration-150"
            />
          ))}
        </g>
      );
    });
  }, [analysis, playbackState, positions, videoWidth, videoHeight]);
  
  if (!visible) return null;
  
  return (
    <svg
      className={cn(
        "absolute inset-0 pointer-events-none",
        className
      )}
      width={videoWidth}
      height={videoHeight}
      viewBox={`0 0 ${videoWidth} ${videoHeight}`}
    >
      <defs>
        {/* Glow filter */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {segments}
    </svg>
  );
}
