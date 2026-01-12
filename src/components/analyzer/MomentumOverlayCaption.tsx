import { useMemo } from "react";
import { 
  MomentumOverlay, 
  getActiveFrame, 
  LEAK_TYPE_LABELS 
} from "@/lib/momentum-overlay-types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface MomentumOverlayCaptionProps {
  overlay: MomentumOverlay | null;
  currentTime: number;
  isEnabled: boolean;
}

export function MomentumOverlayCaption({
  overlay,
  currentTime,
  isEnabled,
}: MomentumOverlayCaptionProps) {
  // Determine if we should show the caption based on current playback time
  const shouldShowCaption = useMemo(() => {
    if (!isEnabled || !overlay) return false;
    return getActiveFrame(overlay, currentTime) !== null;
  }, [overlay, currentTime, isEnabled]);
  
  if (!isEnabled || !overlay) return null;
  
  return (
    <div 
      className={cn(
        "mt-3 transition-all duration-300",
        shouldShowCaption ? "opacity-100" : "opacity-40"
      )}
    >
      <div className="bg-slate-900/90 backdrop-blur-sm rounded-lg p-3 border border-slate-700">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge 
                variant="outline" 
                className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs"
              >
                {LEAK_TYPE_LABELS[overlay.leak_type]}
              </Badge>
              {shouldShowCaption && (
                <span className="text-xs text-green-400 animate-pulse">● Active</span>
              )}
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              {overlay.caption}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
