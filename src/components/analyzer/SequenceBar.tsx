/**
 * Sequence Bar Component
 * ======================
 * Displays the 6-segment momentum sequence with real-time highlighting
 * during video playback. Shows ideal order and lights up segments at peak.
 */

import { cn } from "@/lib/utils";
import {
  IDEAL_SEQUENCE,
  SEGMENT_DISPLAY_NAMES,
  SEGMENT_COLORS,
  SegmentName,
  SwingSequenceAnalysis,
  SequencePlaybackState,
} from "@/lib/momentum-sequence";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SequenceBarProps {
  analysis: SwingSequenceAnalysis | null;
  playbackState: SequencePlaybackState | null;
  className?: string;
  showLabels?: boolean;
  compact?: boolean;
}

// Segment icons/shapes
const SEGMENT_ICONS: Record<SegmentName, React.ReactNode> = {
  rear_leg: (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M12 4v8l-2 2v6h4v-6l-2-2V4z" />
    </svg>
  ),
  lead_leg: (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M12 4v8l2 2v6h-4v-6l2-2V4z" />
    </svg>
  ),
  torso: (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <ellipse cx="12" cy="12" rx="6" ry="8" />
    </svg>
  ),
  bottom_arm: (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M4 8l6 4-4 8h4l4-8-6-4H4z" />
    </svg>
  ),
  top_arm: (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M20 8l-6 4 4 8h-4l-4-8 6-4h4z" />
    </svg>
  ),
  bat: (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <rect x="10" y="2" width="4" height="18" rx="2" />
      <rect x="8" y="18" width="8" height="4" rx="1" />
    </svg>
  ),
};

function getSegmentColor(
  segment: SegmentName,
  analysis: SwingSequenceAnalysis | null,
  playbackState: SequencePlaybackState | null
): string {
  if (!playbackState) return SEGMENT_COLORS.inactive;
  
  const state = playbackState.segmentStates[segment];
  
  // Not yet peaked
  if (state === 'pending') return SEGMENT_COLORS.pending;
  if (state === 'inactive') return SEGMENT_COLORS.inactive;
  
  // Active or peaked - check if in correct order
  if (analysis) {
    const idealIdx = IDEAL_SEQUENCE.indexOf(segment);
    const actualIdx = analysis.actualOrder.indexOf(segment);
    
    if (idealIdx === actualIdx) {
      return SEGMENT_COLORS.in_sequence;
    } else if (Math.abs(idealIdx - actualIdx) === 1) {
      return SEGMENT_COLORS.warning;
    } else {
      return SEGMENT_COLORS.out_of_sequence;
    }
  }
  
  return SEGMENT_COLORS.in_sequence;
}

export function SequenceBar({
  analysis,
  playbackState,
  className,
  showLabels = true,
  compact = false,
}: SequenceBarProps) {
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        {IDEAL_SEQUENCE.map((segment, idx) => {
          const color = getSegmentColor(segment, analysis, playbackState);
          const isActive = playbackState?.segmentStates[segment] === 'active';
          const hasPeaked = playbackState?.segmentStates[segment] === 'peaked';
          const segmentData = analysis?.segments[segment];
          
          return (
            <div key={segment} className="flex items-center">
              {/* Connector arrow */}
              {idx > 0 && (
                <div 
                  className={cn(
                    "text-xs mx-0.5 transition-colors duration-200",
                    hasPeaked || isActive ? "text-muted-foreground" : "text-muted-foreground/30"
                  )}
                >
                  →
                </div>
              )}
              
              {/* Segment indicator */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex flex-col items-center transition-all duration-200",
                      compact ? "gap-0.5" : "gap-1"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-full flex items-center justify-center transition-all duration-200",
                        compact ? "w-6 h-6" : "w-8 h-8",
                        isActive && "ring-2 ring-white ring-offset-2 ring-offset-background animate-pulse scale-110"
                      )}
                      style={{ 
                        backgroundColor: color,
                        opacity: (hasPeaked || isActive) ? 1 : 0.4,
                      }}
                    >
                      <div className={cn(compact ? "w-3 h-3" : "w-4 h-4", "text-white")}>
                        {SEGMENT_ICONS[segment]}
                      </div>
                    </div>
                    
                    {showLabels && !compact && (
                      <span 
                        className={cn(
                          "text-[10px] font-medium whitespace-nowrap transition-colors duration-200",
                          (hasPeaked || isActive) ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {SEGMENT_DISPLAY_NAMES[segment]}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">{SEGMENT_DISPLAY_NAMES[segment]}</p>
                  {segmentData && (
                    <p className="text-muted-foreground">
                      Peak: {segmentData.peakTimeMs.toFixed(0)}ms
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// Summary badge component
interface SequenceSummaryBadgeProps {
  analysis: SwingSequenceAnalysis | null;
  className?: string;
}

export function SequenceSummaryBadge({ analysis, className }: SequenceSummaryBadgeProps) {
  if (!analysis) {
    return (
      <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm", className)}>
        <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
        No sequence data
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        analysis.sequenceMatch 
          ? "bg-green-500/20 text-green-400 border border-green-500/30"
          : "bg-red-500/20 text-red-400 border border-red-500/30",
        className
      )}
    >
      <span 
        className={cn(
          "w-2 h-2 rounded-full",
          analysis.sequenceMatch ? "bg-green-400" : "bg-red-400"
        )} 
      />
      {analysis.sequenceMatch ? "In Sequence" : "Out of Sequence"}
      <span className="text-muted-foreground ml-1">
        ({analysis.sequenceScore}/100)
      </span>
    </div>
  );
}
