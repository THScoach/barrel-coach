/**
 * Momentum Leak Overlay Types
 * 
 * These types define the structure for rendering visual overlays on swing videos
 * that highlight momentum leak patterns detected by KRS analysis + SAM3 segmentation.
 * 
 * The overlay data is stored in video_swing_sessions.momentum_overlays (JSONB)
 * and will be populated by a backend process using KRS leak detection + SAM3.
 */

// Body segment types that can be highlighted
export type OverlaySegment = 'legs' | 'torso' | 'arms' | 'bat';

// Visual style for how a segment should be displayed
export type OverlayStyle = 'highlight' | 'dim' | 'outline' | 'glow' | 'trace';

// Known leak types from KRS analysis
export type LeakType = 
  | 'torso_bypass'      // Torso rotates before legs fully engage
  | 'early_arms'        // Arms fire before torso rotation peaks
  | 'late_legs'         // Legs don't initiate the sequence
  | 'disconnection'     // Break in kinetic chain
  | 'energy_leak'       // General energy transfer issue
  | 'sequence_error';   // Generic sequence order problem

// A region within a single frame to highlight
export interface OverlayRegion {
  segment: OverlaySegment;
  style: OverlayStyle;
  // Optional bounding box for more precise highlighting (normalized 0-1 coordinates)
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// A single frame in the overlay timeline
export interface OverlayFrame {
  time: number; // Time in seconds
  regions: OverlayRegion[];
}

// Complete overlay data for a swing/session
export interface MomentumOverlay {
  leak_type: LeakType;
  caption: string;
  frames: OverlayFrame[];
}

// Segment color configuration for rendering
export const SEGMENT_COLORS: Record<OverlaySegment, { highlight: string; dim: string; outline: string; glow: string }> = {
  legs: {
    highlight: 'rgba(59, 130, 246, 0.6)',   // Blue
    dim: 'rgba(59, 130, 246, 0.2)',
    outline: 'rgba(59, 130, 246, 0.9)',
    glow: 'rgba(59, 130, 246, 0.4)',
  },
  torso: {
    highlight: 'rgba(34, 197, 94, 0.6)',    // Green
    dim: 'rgba(34, 197, 94, 0.2)',
    outline: 'rgba(34, 197, 94, 0.9)',
    glow: 'rgba(34, 197, 94, 0.4)',
  },
  arms: {
    highlight: 'rgba(249, 115, 22, 0.6)',   // Orange
    dim: 'rgba(249, 115, 22, 0.2)',
    outline: 'rgba(249, 115, 22, 0.9)',
    glow: 'rgba(249, 115, 22, 0.4)',
  },
  bat: {
    highlight: 'rgba(239, 68, 68, 0.6)',    // Red
    dim: 'rgba(239, 68, 68, 0.2)',
    outline: 'rgba(239, 68, 68, 0.9)',
    glow: 'rgba(239, 68, 68, 0.4)',
  },
};

// Human-readable labels for leak types
export const LEAK_TYPE_LABELS: Record<LeakType, string> = {
  torso_bypass: 'Torso Bypass',
  early_arms: 'Early Arms',
  late_legs: 'Late Legs',
  disconnection: 'Kinetic Disconnection',
  energy_leak: 'Energy Leak',
  sequence_error: 'Sequence Error',
};

// Helper to find the active frame based on current playback time
export function getActiveFrame(overlay: MomentumOverlay | null, currentTime: number): OverlayFrame | null {
  if (!overlay || !overlay.frames.length) return null;
  
  // Find the closest frame that is at or before the current time
  let activeFrame: OverlayFrame | null = null;
  let minDiff = Infinity;
  
  for (const frame of overlay.frames) {
    const diff = currentTime - frame.time;
    // Frame must be at or before current time, and within 0.2 seconds
    if (diff >= 0 && diff < 0.2 && diff < minDiff) {
      minDiff = diff;
      activeFrame = frame;
    }
  }
  
  return activeFrame;
}

// Helper to get the closest frame's caption for display
export function getActiveCaption(overlay: MomentumOverlay | null, currentTime: number): string | null {
  if (!overlay) return null;
  
  const activeFrame = getActiveFrame(overlay, currentTime);
  if (activeFrame) {
    return overlay.caption;
  }
  
  return null;
}

// Generate mock overlay data for testing/demo purposes
export function generateMockOverlay(durationSeconds: number = 1): MomentumOverlay {
  const leakTypes: LeakType[] = ['torso_bypass', 'early_arms', 'late_legs'];
  const leak = leakTypes[Math.floor(Math.random() * leakTypes.length)];
  
  const captions: Record<LeakType, string> = {
    torso_bypass: "Your legs create energy, but your core isn't catching it before your arms take over.",
    early_arms: "Arms are firing before your torso rotation reaches peak velocity.",
    late_legs: "Ground force isn't initiating the kinetic chain—torso is starting without full leg drive.",
    disconnection: "There's a break in energy transfer between body segments.",
    energy_leak: "Energy is being lost in the transfer from lower to upper body.",
    sequence_error: "Body segments are firing out of optimal sequence.",
  };
  
  // Create frames based on leak type
  const frames: OverlayFrame[] = [];
  
  if (leak === 'torso_bypass') {
    frames.push(
      { time: 0.15, regions: [{ segment: 'legs', style: 'highlight' }, { segment: 'torso', style: 'dim' }] },
      { time: 0.25, regions: [{ segment: 'torso', style: 'highlight' }, { segment: 'legs', style: 'dim' }] },
      { time: 0.35, regions: [{ segment: 'arms', style: 'highlight' }] },
    );
  } else if (leak === 'early_arms') {
    frames.push(
      { time: 0.20, regions: [{ segment: 'legs', style: 'highlight' }] },
      { time: 0.30, regions: [{ segment: 'arms', style: 'highlight' }, { segment: 'torso', style: 'dim' }] },
      { time: 0.40, regions: [{ segment: 'bat', style: 'highlight' }] },
    );
  } else {
    frames.push(
      { time: 0.18, regions: [{ segment: 'torso', style: 'highlight' }, { segment: 'legs', style: 'dim' }] },
      { time: 0.28, regions: [{ segment: 'arms', style: 'highlight' }] },
      { time: 0.38, regions: [{ segment: 'bat', style: 'highlight' }] },
    );
  }
  
  return {
    leak_type: leak,
    caption: captions[leak],
    frames,
  };
}
