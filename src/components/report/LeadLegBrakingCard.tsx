import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footprints, CheckCircle2, AlertTriangle, Minus } from "lucide-react";
import type { LeadLegBraking } from "@/lib/unified-metrics-types";
import { cn } from "@/lib/utils";

interface LeadLegBrakingCardProps {
  braking: LeadLegBraking;
  className?: string;
}

/**
 * Get brace status based on timing
 * Negative timing = GOOD (brace happens BEFORE hip peak)
 * Positive timing = BAD (brace happens AFTER hip peak)
 */
function getBraceConfig(timingMs: number) {
  if (timingMs < -30) {
    return { 
      label: 'ELITE BRACE', 
      color: 'text-emerald-400', 
      bgColor: 'bg-emerald-500/20',
      Icon: CheckCircle2 
    };
  } else if (timingMs <= 30) {
    return { 
      label: 'BORDERLINE', 
      color: 'text-yellow-400', 
      bgColor: 'bg-yellow-500/20',
      Icon: Minus 
    };
  } else {
    return { 
      label: 'LATE BRACE', 
      color: 'text-red-400', 
      bgColor: 'bg-red-500/20',
      Icon: AlertTriangle 
    };
  }
}

function TimingTimeline({ timingMs }: { timingMs: number }) {
  // Map -100ms to +100ms onto 0-100%
  const position = ((timingMs + 100) / 200) * 100;
  const clampedPosition = Math.max(4, Math.min(96, position));
  
  return (
    <div className="space-y-2">
      <div className="relative h-6 bg-slate-800 rounded-full overflow-hidden">
        {/* Color zones: Elite -> Good -> Borderline -> Late */}
        <div className="absolute inset-0 flex">
          <div className="flex-[25] bg-emerald-500/30" />   {/* -100 to -50: Elite */}
          <div className="flex-[10] bg-emerald-500/15" />   {/* -50 to -30: Good */}
          <div className="flex-[30] bg-yellow-500/15" />    {/* -30 to +30: Borderline */}
          <div className="flex-[35] bg-red-500/20" />       {/* +30 to +100: Late */}
        </div>
        
        {/* Hip peak marker at center (0ms) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/60 -translate-x-1/2 z-10" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="w-2 h-2 bg-white rounded-full shadow" />
        </div>
        
        {/* Player's brace timing dot */}
        <div 
          className="absolute top-1/2 w-4 h-4 bg-cyan-400 rounded-full shadow-lg border-2 border-white z-20 transition-all"
          style={{ left: `${clampedPosition}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      
      {/* Scale labels */}
      <div className="flex justify-between text-[10px] px-1">
        <span className="text-emerald-400 font-medium">-100ms</span>
        <span className="text-emerald-400/70">-50</span>
        <span className="text-yellow-400/70">-30</span>
        <span className="text-slate-300 font-semibold">0</span>
        <span className="text-orange-400/70">+30</span>
        <span className="text-red-400">+100ms</span>
      </div>
      
      {/* Direction labels */}
      <div className="flex justify-between text-[9px] text-slate-500 px-1">
        <span className="text-emerald-500">← Early (Good)</span>
        <span className="text-slate-600">Hip Peak</span>
        <span className="text-red-500">Late (Bad) →</span>
      </div>
    </div>
  );
}

function MetricCell({ label, value, unit }: { label: string; value?: number; unit: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-2.5 text-center">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">{label}</div>
      {value !== undefined ? (
        <div className="text-lg font-bold text-slate-200 tabular-nums">
          {value.toFixed(1)}<span className="text-xs text-slate-500 ml-0.5">{unit}</span>
        </div>
      ) : (
        <div className="text-lg text-slate-600">—</div>
      )}
    </div>
  );
}

export function LeadLegBrakingCard({ braking, className }: LeadLegBrakingCardProps) {
  if (!braking.present) {
    return (
      <Card className={cn("bg-slate-900 border-slate-800", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <Footprints className="h-5 w-5 text-cyan-400" />
            Lead Leg Braking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Lead leg data not available for this session.</p>
        </CardContent>
      </Card>
    );
  }

  const config = getBraceConfig(braking.brace_timing_ms);
  const timingDisplay = `${braking.brace_timing_ms > 0 ? '+' : ''}${braking.brace_timing_ms}ms`;

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <Footprints className="h-5 w-5 text-cyan-400" />
            Lead Leg Braking
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] border-slate-700",
              braking.confidence === 'measured' ? 'text-emerald-400' : 'text-slate-500'
            )}
          >
            {braking.confidence === 'measured' ? 'Measured' : 'Estimated'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Primary Brace Timing Display */}
        <div className="flex items-center justify-between">
          <span className={cn("text-4xl font-bold tabular-nums tracking-tight", config.color)}>
            {timingDisplay}
          </span>
          <Badge className={cn("border-0 gap-1.5 text-xs font-semibold uppercase tracking-wide", config.bgColor, config.color)}>
            <config.Icon className="h-3.5 w-3.5" />
            {config.label}
          </Badge>
        </div>

        {/* Visual Timeline */}
        <TimingTimeline timingMs={braking.brace_timing_ms} />

        {/* Metrics Grid */}
        <div className="grid grid-cols-4 gap-2">
          <MetricCell label="Knee @ FFS" value={braking.knee_angle_at_ffs} unit="°" />
          <MetricCell label="Knee @ Contact" value={braking.knee_angle_at_contact} unit="°" />
          <MetricCell label="Extension" value={braking.knee_extension_range} unit="°" />
          <MetricCell label="Hip Rise" value={braking.lead_hip_rise_inches} unit="in" />
        </div>

        {/* Interpretation */}
        {braking.interpretation && (
          <p className="text-xs text-slate-400 italic border-l-2 border-cyan-500/50 pl-3">
            {braking.interpretation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default LeadLegBrakingCard;
