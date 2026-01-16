import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footprints, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { LeadLegBrakingMetrics, BraceStatus } from "@/lib/unified-metrics-types";
import { cn } from "@/lib/utils";

interface ThreeDPreciseMetrics {
  grf_peak_n?: number;
  grf_timing_ms?: number;
  pelvis_decel_rate?: number;
  knee_valgus_deg?: number;
  ankle_stiffness?: number;
}

interface LeadLegBrakingCardProps {
  metrics: LeadLegBrakingMetrics;
  threeDPrecise?: ThreeDPreciseMetrics;
  className?: string;
}

const braceStatusConfig: Record<BraceStatus, { 
  label: string; 
  color: string; 
  bgColor: string;
  icon: typeof CheckCircle2;
}> = {
  early_brace: { 
    label: 'Elite', 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-500/20',
    icon: CheckCircle2 
  },
  on_time: { 
    label: 'On Time', 
    color: 'text-yellow-400', 
    bgColor: 'bg-yellow-500/20',
    icon: TrendingUp 
  },
  late_brace: { 
    label: 'Late', 
    color: 'text-red-400', 
    bgColor: 'bg-red-500/20',
    icon: AlertTriangle 
  },
};

function TimingTimeline({ timingMs }: { timingMs: number }) {
  // Map -100ms to +100ms onto 0-100%
  const position = ((timingMs + 100) / 200) * 100;
  const clampedPosition = Math.max(0, Math.min(100, position));
  
  return (
    <div className="space-y-2">
      <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
        {/* Gradient zones */}
        <div className="absolute inset-0 flex">
          <div className="w-1/4 bg-emerald-500/30" /> {/* -100 to -50: Elite */}
          <div className="w-1/4 bg-yellow-500/20" />  {/* -50 to 0: Good */}
          <div className="w-1/4 bg-orange-500/20" />  {/* 0 to +50: Borderline */}
          <div className="w-1/4 bg-red-500/20" />     {/* +50 to +100: Late */}
        </div>
        {/* Center line (hip peak = 0ms) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600 -translate-x-1/2" />
        {/* Player marker */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-cyan-400"
          style={{ left: `${clampedPosition}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      {/* Scale labels */}
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>-100ms</span>
        <span>-50ms</span>
        <span className="text-slate-400">0 (Hip Peak)</span>
        <span>+50ms</span>
        <span>+100ms</span>
      </div>
    </div>
  );
}

function MetricCell({ label, value, unit }: { label: string; value?: number; unit: string }) {
  if (value === undefined) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
        <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="text-lg text-slate-600">—</div>
      </div>
    );
  }
  
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold text-slate-200 tabular-nums">
        {value.toFixed(1)}<span className="text-xs text-slate-400 ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

export function LeadLegBrakingCard({ metrics, threeDPrecise, className }: LeadLegBrakingCardProps) {
  if (!metrics.present) {
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

  const statusConfig = braceStatusConfig[metrics.brace_timing_status];
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-200">
          <Footprints className="h-5 w-5 text-cyan-400" />
          Lead Leg Braking
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Brace Timing Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-bold tabular-nums", statusConfig.color)}>
              {metrics.brace_timing_ms > 0 ? '+' : ''}{metrics.brace_timing_ms}
            </span>
            <span className="text-sm text-slate-400">ms</span>
          </div>
          <Badge className={cn("border-0 gap-1", statusConfig.bgColor, statusConfig.color)}>
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Visual Timeline */}
        <TimingTimeline timingMs={metrics.brace_timing_ms} />

        {/* Knee Angles Grid */}
        <div className="grid grid-cols-3 gap-2">
          <MetricCell 
            label="Knee @ FFS" 
            value={metrics.knee_angle_at_ffs} 
            unit="°" 
          />
          <MetricCell 
            label="Knee @ Contact" 
            value={metrics.knee_angle_at_contact} 
            unit="°" 
          />
          <MetricCell 
            label="Hip Rise" 
            value={metrics.lead_hip_rise_inches} 
            unit="in" 
          />
        </div>

        {/* Knee Extension Range */}
        {metrics.knee_extension_range !== undefined && (
          <div className="flex items-center justify-between text-sm bg-slate-800/30 rounded px-3 py-2">
            <span className="text-slate-400">Knee Extension Range</span>
            <span className="font-medium text-slate-200 tabular-nums">
              {metrics.knee_extension_range.toFixed(1)}°
            </span>
          </div>
        )}

        {/* Interpretation */}
        {metrics.interpretation && (
          <p className="text-xs text-slate-400 italic border-l-2 border-cyan-500/50 pl-3">
            {metrics.interpretation}
          </p>
        )}

        {/* 3D Precise Metrics (if available) */}
        {threeDPrecise && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="text-xs text-cyan-400 uppercase tracking-wide">3D Precise</div>
            <div className="grid grid-cols-2 gap-2">
              {threeDPrecise.grf_peak_n !== undefined && (
                <div className="bg-slate-800/30 rounded px-2 py-1.5 flex justify-between text-xs">
                  <span className="text-slate-500">Peak GRF</span>
                  <span className="text-slate-200 tabular-nums">{threeDPrecise.grf_peak_n.toFixed(0)} N</span>
                </div>
              )}
              {threeDPrecise.grf_timing_ms !== undefined && (
                <div className="bg-slate-800/30 rounded px-2 py-1.5 flex justify-between text-xs">
                  <span className="text-slate-500">GRF Timing</span>
                  <span className="text-slate-200 tabular-nums">{threeDPrecise.grf_timing_ms > 0 ? '+' : ''}{threeDPrecise.grf_timing_ms} ms</span>
                </div>
              )}
              {threeDPrecise.pelvis_decel_rate !== undefined && (
                <div className="bg-slate-800/30 rounded px-2 py-1.5 flex justify-between text-xs">
                  <span className="text-slate-500">Pelvis Decel</span>
                  <span className="text-slate-200 tabular-nums">{threeDPrecise.pelvis_decel_rate.toFixed(1)}°/s²</span>
                </div>
              )}
              {threeDPrecise.knee_valgus_deg !== undefined && (
                <div className="bg-slate-800/30 rounded px-2 py-1.5 flex justify-between text-xs">
                  <span className="text-slate-500">Knee Valgus</span>
                  <span className="text-slate-200 tabular-nums">{threeDPrecise.knee_valgus_deg.toFixed(1)}°</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confidence Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-center text-xs text-slate-500">
          <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500">
            {metrics.confidence === 'measured' ? 'Measured' : 'Estimated'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default LeadLegBrakingCard;
