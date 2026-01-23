/**
 * Start Assessment CTA - Stack-style large action button
 * Primary call-to-action for starting a 4B assessment
 */
import { Loader2, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StartAssessmentCTAProps {
  onStart: () => void;
  isLoading?: boolean;
  hasActiveSession?: boolean;
  variant?: 'primary' | 'secondary';
}

export function StartAssessmentCTA({ 
  onStart, 
  isLoading = false,
  hasActiveSession = false,
  variant = 'primary'
}: StartAssessmentCTAProps) {
  const isPrimary = variant === 'primary';
  
  return (
    <Button
      onClick={onStart}
      disabled={isLoading}
      className={cn(
        "w-full h-14 text-lg font-bold uppercase tracking-wide",
        "transition-all duration-200",
        isPrimary 
          ? "bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/25" 
          : "bg-slate-700 hover:bg-slate-600 text-white"
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Starting...
        </>
      ) : hasActiveSession ? (
        <>
          <Play className="h-5 w-5 mr-2" />
          Continue Session
        </>
      ) : (
        <>
          <Zap className="h-5 w-5 mr-2" />
          Start 4B Assessment
        </>
      )}
    </Button>
  );
}
