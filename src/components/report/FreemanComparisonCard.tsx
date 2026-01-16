import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Target, Trophy } from "lucide-react";
import type { FreemanComparison } from "@/lib/unified-metrics-types";
import { FREEMAN_BENCHMARKS } from "@/lib/unified-metrics-types";
import { cn } from "@/lib/utils";

interface FreemanComparisonCardProps {
  comparison: FreemanComparison;
  className?: string;
}

type ComparisonStatus = 'similar' | 'above' | 'below' | 'room_to_grow';

function getStatusConfig(status: ComparisonStatus) {
  if (status === 'similar' || status === 'above') {
    return {
      Icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      label: status === 'above' ? 'Above' : 'Similar'
    };
  }
  return {
    Icon: Target,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    label: 'Room to Grow'
  };
}

interface MetricRowProps {
  label: string;
  playerValue: number;
  playerRaw: string;
  benchmarkValue: number;
  benchmarkRaw: string;
  status: ComparisonStatus;
  min: number;
  max: number;
}

function MetricRow({ 
  label, 
  playerValue, 
  playerRaw, 
  benchmarkValue, 
  benchmarkRaw, 
  status,
  min,
  max 
}: MetricRowProps) {
  const config = getStatusConfig(status);
  
  // Calculate positions for visual bar (0-100%)
  const playerPos = ((playerValue - min) / (max - min)) * 100;
  const benchmarkPos = ((benchmarkValue - min) / (max - min)) * 100;
  const clampedPlayerPos = Math.max(2, Math.min(98, playerPos));
  const clampedBenchmarkPos = Math.max(2, Math.min(98, benchmarkPos));

  return (
    <div className="space-y-2">
      {/* Data Row */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex-1">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
          <div className="text-lg font-bold text-slate-200 tabular-nums">{playerRaw}</div>
        </div>
        
        <div className="flex items-center gap-2 px-3">
          <Badge 
            variant="outline" 
            className={cn("text-[10px] gap-1 border-0", config.bgColor, config.color)}
          >
            <config.Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
        
        <div className="flex-1 text-right">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Freeman</div>
          <div className="text-lg font-bold text-emerald-400 tabular-nums">{benchmarkRaw}</div>
        </div>
      </div>
      
      {/* Visual Comparison Bar */}
      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
        {/* Player bar */}
        <div 
          className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-red-500/80 to-red-400/80 rounded-full"
          style={{ width: `${clampedPlayerPos}%` }}
        />
        
        {/* Freeman marker line */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-10"
          style={{ left: `${clampedBenchmarkPos}%` }}
        />
        <div 
          className="absolute w-2 h-2 bg-emerald-400 rounded-full z-10"
          style={{ left: `${clampedBenchmarkPos}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
        />
      </div>
    </div>
  );
}

export function FreemanComparisonCard({ comparison, className }: FreemanComparisonCardProps) {
  if (!comparison.present) {
    return (
      <Card className={cn("bg-slate-900 border-slate-800", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <Trophy className="h-5 w-5 text-yellow-400" />
            VS FREEMAN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Freeman comparison not available for this session.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <Trophy className="h-5 w-5 text-yellow-400" />
            VS FREEMAN
          </CardTitle>
          <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
            MVP • .341 BA • Elite Consistency
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-5">
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 bg-gradient-to-r from-red-500 to-red-400 rounded-sm" />
            <span className="text-slate-400">Your Value</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
            <span className="text-slate-400">Freeman</span>
          </div>
        </div>

        {/* Metrics Comparison */}
        <div className="space-y-4">
          <MetricRow
            label="Load Sequence"
            playerValue={comparison.load_sequence.player_value}
            playerRaw={comparison.load_sequence.player_raw}
            benchmarkValue={FREEMAN_BENCHMARKS.load_sequence.value}
            benchmarkRaw={FREEMAN_BENCHMARKS.load_sequence.raw}
            status={comparison.load_sequence.status}
            min={0}
            max={150}
          />
          
          <MetricRow
            label="Tempo"
            playerValue={comparison.tempo.player_value}
            playerRaw={comparison.tempo.player_raw}
            benchmarkValue={FREEMAN_BENCHMARKS.tempo.value}
            benchmarkRaw={FREEMAN_BENCHMARKS.tempo.raw}
            status={comparison.tempo.status}
            min={1.0}
            max={3.5}
          />
          
          <MetricRow
            label="Separation"
            playerValue={comparison.separation.player_value}
            playerRaw={comparison.separation.player_raw}
            benchmarkValue={FREEMAN_BENCHMARKS.separation.value}
            benchmarkRaw={FREEMAN_BENCHMARKS.separation.raw}
            status={comparison.separation.status}
            min={10}
            max={45}
          />
        </div>

        {/* Optional Note */}
        {comparison.note && (
          <p className="text-xs text-slate-400 italic border-l-2 border-yellow-500/50 pl-3">
            {comparison.note}
          </p>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 text-center text-[10px] text-slate-600">
          Benchmarks from 2023 MVP season swing analysis
        </div>
      </CardContent>
    </Card>
  );
}

export default FreemanComparisonCard;
