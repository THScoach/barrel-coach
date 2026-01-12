/**
 * 4B Momentum Sequence Visualizer - Component Exports
 * ===================================================
 * 
 * Usage:
 * 1. Import MomentumSequenceVisualizer for full panel
 * 2. Import SequenceBar for compact inline display
 * 3. Import SkeletonSequenceOverlay for video overlay
 * 
 * Example:
 * ```tsx
 * import { MomentumSequenceVisualizer, SequenceOverlay } from '@/components/analyzer/sequence';
 * 
 * // In video player context:
 * <MomentumSequenceVisualizer
 *   analysis={sequenceAnalysis}
 *   currentTimeMs={videoCurrentTime * 1000}
 *   durationMs={videoDuration * 1000}
 *   onSeekToTime={(ms) => videoRef.current.currentTime = ms / 1000}
 * />
 * ```
 */

export { MomentumSequenceVisualizer, SequenceOverlay } from '../MomentumSequenceVisualizer';
export { SequenceBar, SequenceSummaryBadge } from '../SequenceBar';
export { SequenceSummaryCard, SequenceInlineSummary } from '../SequenceSummaryCard';
export { SkeletonSequenceOverlay } from '../SkeletonSequenceOverlay';

// Momentum Leak Overlay Components
export { MomentumOverlayCanvas } from '../MomentumOverlayCanvas';
export { MomentumOverlayCaption } from '../MomentumOverlayCaption';

// Re-export types and utilities from the library
export {
  type SegmentName,
  type SwingSequenceAnalysis,
  type SequencePlaybackState,
  type FramePoseData,
  type SwingPoseSequence,
  IDEAL_SEQUENCE,
  SEGMENT_DISPLAY_NAMES,
  SEGMENT_COLORS,
  computeSegmentMomentum,
  analyzeSequence,
  getPlaybackState,
  generateMockSequenceData,
} from '@/lib/momentum-sequence';

// Re-export momentum overlay types
export {
  type MomentumOverlay,
  type OverlaySegment,
  type OverlayStyle,
  type OverlayFrame,
  type OverlayRegion,
  type LeakType,
  SEGMENT_COLORS as OVERLAY_SEGMENT_COLORS,
  LEAK_TYPE_LABELS,
  getActiveFrame,
  getActiveCaption,
  generateMockOverlay,
} from '@/lib/momentum-overlay-types';
