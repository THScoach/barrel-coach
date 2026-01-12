/**
 * Sequence Summary Card
 * =====================
 * Displays the full sequence analysis summary with 4B alignment.
 * Shows actual vs ideal order, errors, and training recommendations.
 */

import { cn } from "@/lib/utils";
import {
  IDEAL_SEQUENCE,
  SEGMENT_DISPLAY_NAMES,
  SwingSequenceAnalysis,
  SequenceError,
} from "@/lib/momentum-sequence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Zap, ArrowRight } from "lucide-react";

interface SequenceSummaryCardProps {
  analysis: SwingSequenceAnalysis;
  className?: string;
}

export function SequenceSummaryCard({ analysis, className }: SequenceSummaryCardProps) {
  const { sequenceMatch, sequenceScore, sequenceErrors, actualOrder, summary } = analysis;
  
  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <CardTitle className="text-base">Body-to-Bat Sequence</CardTitle>
          </div>
          <Badge 
            variant={sequenceMatch ? "default" : "destructive"}
            className={cn(
              sequenceMatch 
                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                : "bg-red-500/20 text-red-400 border-red-500/30"
            )}
          >
            {sequenceScore}/100
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {sequenceMatch ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <span className="text-green-400 font-medium">In Sequence</span>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-red-400" />
              <span className="text-red-400 font-medium">Out of Sequence</span>
            </>
          )}
        </div>
        
        {/* Sequence comparison */}
        <div className="space-y-2">
          {/* Ideal order */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-12">Ideal:</span>
            <div className="flex items-center gap-1 flex-wrap">
              {IDEAL_SEQUENCE.map((seg, idx) => (
                <div key={seg} className="flex items-center">
                  {idx > 0 && <ArrowRight className="h-3 w-3 mx-1 text-slate-500" />}
                  <span className="text-xs text-slate-400">
                    {SEGMENT_DISPLAY_NAMES[seg]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Actual order */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-12">Actual:</span>
            <div className="flex items-center gap-1 flex-wrap">
              {actualOrder.map((seg, idx) => {
                const idealIdx = IDEAL_SEQUENCE.indexOf(seg);
                const isCorrectPosition = idealIdx === idx;
                const isOffByOne = Math.abs(idealIdx - idx) === 1;
                
                return (
                  <div key={seg} className="flex items-center">
                    {idx > 0 && <ArrowRight className="h-3 w-3 mx-1 text-slate-500" />}
                    <span 
                      className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded",
                        isCorrectPosition && "text-green-400 bg-green-500/10",
                        isOffByOne && "text-amber-400 bg-amber-500/10",
                        !isCorrectPosition && !isOffByOne && "text-red-400 bg-red-500/10"
                      )}
                    >
                      {SEGMENT_DISPLAY_NAMES[seg]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Errors list */}
        {sequenceErrors.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Sequence Issues:
            </p>
            {sequenceErrors.map((error, idx) => (
              <SequenceErrorItem key={idx} error={error} />
            ))}
          </div>
        )}
        
        {/* Summary text */}
        <p className="text-sm text-slate-300 pt-2 border-t border-slate-800">
          {summary}
        </p>
        
        {/* 4B connection note */}
        <div className="pt-2 border-t border-slate-800">
          <p className="text-xs text-slate-400 italic">
            4B Framework: This analyzes the Body → Bat energy transfer sequence.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SequenceErrorItem({ error }: { error: SequenceError }) {
  const isEarly = error.actualPosition < error.expectedPosition;
  
  return (
    <div 
      className={cn(
        "text-xs px-2 py-1 rounded flex items-center gap-2",
        isEarly 
          ? "bg-amber-500/10 text-amber-400"
          : "bg-red-500/10 text-red-400"
      )}
    >
      <span className="w-2 h-2 rounded-full bg-current" />
      <span>{error.description}</span>
    </div>
  );
}

// Compact inline version for video player overlay
interface SequenceInlineSummaryProps {
  analysis: SwingSequenceAnalysis | null;
  className?: string;
}

export function SequenceInlineSummary({ analysis, className }: SequenceInlineSummaryProps) {
  if (!analysis) {
    return (
      <div className={cn("text-sm text-slate-400", className)}>
        No sequence analysis available
      </div>
    );
  }
  
  return (
    <div className={cn("text-sm", className)}>
      <span 
        className={cn(
          "font-medium",
          analysis.sequenceMatch ? "text-green-400" : "text-red-400"
        )}
      >
        {analysis.sequenceMatch ? "✓ In Sequence" : "✗ Out of Sequence"}
      </span>
      <span className="text-slate-300 ml-2">
        Score: {analysis.sequenceScore}/100
      </span>
      {!analysis.sequenceMatch && analysis.sequenceErrors.length > 0 && (
        <span className="text-slate-400 ml-2">
          — {analysis.sequenceErrors[0].description}
        </span>
      )}
    </div>
  );
}
