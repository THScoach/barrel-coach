/**
 * Momentum Sequence Visualizer
 * ============================
 * Main component that integrates with video playback to show
 * real-time momentum sequence analysis.
 * 
 * Features:
 * - Sequence bar with segment indicators
 * - Real-time highlighting during playback
 * - Optional skeleton overlay on video
 * - Summary feedback panel
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  SwingSequenceAnalysis,
  SequencePlaybackState,
  getPlaybackState,
  generateMockSequenceData,
  IDEAL_SEQUENCE,
  SEGMENT_DISPLAY_NAMES,
  SEGMENT_COLORS,
  SegmentName,
} from "@/lib/momentum-sequence";
import { SequenceBar, SequenceSummaryBadge } from "./SequenceBar";
import { SequenceSummaryCard, SequenceInlineSummary } from "./SequenceSummaryCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, RotateCcw, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MomentumSequenceVisualizerProps {
  /** Pre-computed sequence analysis (if available) */
  analysis?: SwingSequenceAnalysis | null;
  
  /** Current video playback time in milliseconds */
  currentTimeMs?: number;
  
  /** Video duration in milliseconds */
  durationMs?: number;
  
  /** Callback when user seeks to a segment's peak time */
  onSeekToTime?: (timeMs: number) => void;
  
  /** Whether to show the skeleton overlay controls */
  showOverlayControls?: boolean;
  
  /** Additional class names */
  className?: string;
  
  /** Compact mode for embedding in video controls */
  compact?: boolean;
}

export function MomentumSequenceVisualizer({
  analysis: externalAnalysis,
  currentTimeMs = 0,
  durationMs,
  onSeekToTime,
  showOverlayControls = false,
  className,
  compact = false,
}: MomentumSequenceVisualizerProps) {
  // Use external analysis or generate mock for demo
  const [useMockData, setUseMockData] = useState(!externalAnalysis);
  const [mockSequenceErrors, setMockSequenceErrors] = useState(false);
  
  const analysis = useMemo(() => {
    if (externalAnalysis) return externalAnalysis;
    if (!useMockData) return null;
    
    // Generate mock data for demonstration
    const errors = mockSequenceErrors 
      ? [
          { segment: 'lead_leg' as SegmentName, offset: -80 }, // Fires early
          { segment: 'top_arm' as SegmentName, offset: 60 },   // Fires late
        ]
      : undefined;
    
    return generateMockSequenceData('demo-swing', {
      durationMs: durationMs || 500,
      sequenceErrors: errors,
    });
  }, [externalAnalysis, useMockData, mockSequenceErrors, durationMs]);
  
  // Calculate playback state
  const playbackState = useMemo(() => {
    if (!analysis) return null;
    return getPlaybackState(analysis, currentTimeMs);
  }, [analysis, currentTimeMs]);
  
  // Handle segment click to seek
  const handleSegmentClick = useCallback((segment: SegmentName) => {
    if (!analysis || !onSeekToTime) return;
    const segmentData = analysis.segments[segment];
    if (segmentData) {
      onSeekToTime(segmentData.peakTimeMs);
    }
  }, [analysis, onSeekToTime]);
  
  // Compact mode for video controls
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <SequenceBar 
          analysis={analysis} 
          playbackState={playbackState}
          showLabels={false}
          compact={true}
        />
        <SequenceSummaryBadge analysis={analysis} />
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Main visualization panel */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-white">4B Momentum Sequence</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5">
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">
                      Shows the momentum-peak order of body segments during the swing.
                      The ideal sequence is: Rear Leg → Lead Leg → Torso → Bottom Arm → Top Arm → Bat
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <SequenceSummaryBadge analysis={analysis} />
          </div>
          
          {/* Sequence Bar */}
          <div className="flex justify-center py-2">
            <SequenceBar 
              analysis={analysis} 
              playbackState={playbackState}
              showLabels={true}
            />
          </div>
          
          {/* Timeline with peaks */}
          {analysis && (
            <div className="relative h-8 bg-slate-800 rounded overflow-hidden">
              {/* Timeline track */}
              <div className="absolute inset-0 flex items-center px-2">
                <div className="w-full h-0.5 bg-slate-700 rounded" />
              </div>
              
              {/* Peak markers */}
              {IDEAL_SEQUENCE.map((segment) => {
                const segmentData = analysis.segments[segment];
                if (!segmentData) return null;
                
                const position = (segmentData.peakTimeMs / (durationMs || 500)) * 100;
                const idealIdx = IDEAL_SEQUENCE.indexOf(segment);
                const actualIdx = analysis.actualOrder.indexOf(segment);
                const isCorrect = idealIdx === actualIdx;
                
                return (
                  <button
                    key={segment}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 w-3 h-6 rounded-sm transition-all",
                      "hover:scale-125 cursor-pointer",
                      isCorrect ? "bg-green-500" : "bg-red-500"
                    )}
                    style={{ left: `${position}%`, marginLeft: '-6px' }}
                    onClick={() => handleSegmentClick(segment)}
                    title={`${SEGMENT_DISPLAY_NAMES[segment]}: ${segmentData.peakTimeMs.toFixed(0)}ms`}
                  />
                );
              })}
              
              {/* Current time indicator */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                style={{ left: `${(currentTimeMs / (durationMs || 500)) * 100}%` }}
              />
            </div>
          )}
          
          {/* Inline summary */}
          <SequenceInlineSummary analysis={analysis} />
          
          {/* Demo controls (only if no external analysis) */}
          {!externalAnalysis && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <p className="text-xs text-muted-foreground">Demo Controls:</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="mock-data"
                    checked={useMockData}
                    onCheckedChange={setUseMockData}
                  />
                  <Label htmlFor="mock-data" className="text-xs">Show Mock Data</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="sequence-errors"
                    checked={mockSequenceErrors}
                    onCheckedChange={setMockSequenceErrors}
                    disabled={!useMockData}
                  />
                  <Label htmlFor="sequence-errors" className="text-xs">Simulate Errors</Label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Detailed summary card */}
      {analysis && <SequenceSummaryCard analysis={analysis} />}
    </div>
  );
}

// Standalone sequence overlay for video
interface SequenceOverlayProps {
  analysis: SwingSequenceAnalysis | null;
  playbackState: SequencePlaybackState | null;
  className?: string;
}

export function SequenceOverlay({ analysis, playbackState, className }: SequenceOverlayProps) {
  if (!analysis || !playbackState) return null;
  
  // Find currently active segment
  const activeSegment = IDEAL_SEQUENCE.find(
    seg => playbackState.segmentStates[seg] === 'active'
  );
  
  return (
    <div className={cn(
      "absolute bottom-20 left-1/2 -translate-x-1/2 z-10",
      "bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2",
      className
    )}>
      <div className="flex items-center gap-3">
        <SequenceBar 
          analysis={analysis}
          playbackState={playbackState}
          showLabels={false}
          compact={true}
        />
        {activeSegment && (
          <span className="text-white text-sm font-medium animate-pulse">
            {SEGMENT_DISPLAY_NAMES[activeSegment]}
          </span>
        )}
      </div>
    </div>
  );
}
