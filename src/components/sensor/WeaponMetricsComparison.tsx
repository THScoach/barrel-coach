/**
 * WeaponMetricsComparison - Compare player weapon metrics against population benchmarks
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { WeaponMetrics, getWeaponGrade } from '@/lib/weapon-metrics';
import { 
  Zap, 
  Target, 
  ArrowRightLeft, 
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Users,
  Trophy,
  Star
} from 'lucide-react';

// Population benchmarks based on 20-80 scout scale
const BENCHMARKS = {
  population: {
    label: 'Average',
    icon: Users,
    color: 'slate',
    wipIndex: 50,
    planeIntegrity: 50,
    squareUpConsistency: 50,
    impactMomentum: 50,
  },
  aboveAverage: {
    label: 'Above Avg',
    icon: TrendingUp,
    color: 'blue',
    wipIndex: 55,
    planeIntegrity: 55,
    squareUpConsistency: 55,
    impactMomentum: 55,
  },
  plus: {
    label: 'Plus',
    icon: Star,
    color: 'teal',
    wipIndex: 65,
    planeIntegrity: 65,
    squareUpConsistency: 65,
    impactMomentum: 65,
  },
  elite: {
    label: 'Elite',
    icon: Trophy,
    color: 'amber',
    wipIndex: 70,
    planeIntegrity: 70,
    squareUpConsistency: 70,
    impactMomentum: 70,
  },
};

type BenchmarkLevel = keyof typeof BENCHMARKS;

interface WeaponMetricsComparisonProps {
  metrics: WeaponMetrics;
  playerName?: string;
  className?: string;
}

const metricConfig = {
  wipIndex: {
    name: 'WIP Index',
    shortName: 'WIP',
    icon: Zap,
    color: '#f97316',
    description: 'Wrist-to-Impact Power - bat whip efficiency',
  },
  planeIntegrity: {
    name: 'Plane Integrity',
    shortName: 'Plane',
    icon: ArrowRightLeft,
    color: '#3b82f6',
    description: 'Swing plane consistency',
  },
  squareUpConsistency: {
    name: 'Square-Up',
    shortName: 'SQ-Up',
    icon: Target,
    color: '#10b981',
    description: 'Barrel contact repeatability',
  },
  impactMomentum: {
    name: 'Impact Momentum',
    shortName: 'Impact',
    icon: Gauge,
    color: '#8b5cf6',
    description: 'Power delivered at contact',
  },
};

type MetricKey = keyof typeof metricConfig;

function getComparisonStatus(value: number | null, benchmark: number): {
  label: string;
  delta: number | null;
  status: 'above' | 'below' | 'at' | null;
} {
  if (value === null) return { label: 'No data', delta: null, status: null };
  
  const delta = value - benchmark;
  if (delta >= 3) return { label: `+${delta} above`, delta, status: 'above' };
  if (delta <= -3) return { label: `${delta} below`, delta, status: 'below' };
  return { label: 'At benchmark', delta, status: 'at' };
}

function getPercentile(value: number | null): number | null {
  if (value === null) return null;
  // Approximate percentile based on 20-80 scale
  // 50 = 50th percentile, 60 = ~75th, 70 = ~95th
  if (value >= 70) return 95 + ((value - 70) / 10) * 4;
  if (value >= 60) return 75 + ((value - 60) / 10) * 20;
  if (value >= 50) return 50 + ((value - 50) / 10) * 25;
  if (value >= 40) return 25 + ((value - 40) / 10) * 25;
  return Math.max(1, ((value - 20) / 20) * 25);
}

interface ComparisonBarProps {
  metricKey: MetricKey;
  value: number | null;
  benchmarks: typeof BENCHMARKS;
}

function ComparisonBar({ metricKey, value, benchmarks }: ComparisonBarProps) {
  const config = metricConfig[metricKey];
  const Icon = config.icon;
  const percentile = getPercentile(value);
  
  // Calculate position on the bar (20-80 scale mapped to 0-100%)
  const getPosition = (score: number) => ((score - 20) / 60) * 100;
  const playerPosition = value !== null ? getPosition(value) : null;
  
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: config.color }} />
          <span className="text-sm font-medium text-white">{config.shortName}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[180px]">
              <p className="text-xs">{config.description}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-lg font-bold",
            value !== null && value >= 55 ? "text-teal-400" : "text-slate-300"
          )}>
            {value ?? '—'}
          </span>
          {percentile !== null && (
            <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
              {Math.round(percentile)}th %ile
            </Badge>
          )}
        </div>
      </div>
      
      {/* Comparison Bar */}
      <div className="relative h-8 bg-slate-800 rounded-lg overflow-hidden">
        {/* Benchmark markers */}
        {Object.entries(benchmarks).map(([key, benchmark]) => {
          const position = getPosition(benchmark[metricKey as keyof typeof benchmark] as number);
          return (
            <div
              key={key}
              className="absolute top-0 bottom-0 w-px"
              style={{ left: `${position}%` }}
            >
              <div className={cn(
                "h-full w-px",
                key === 'population' && "bg-slate-600",
                key === 'aboveAverage' && "bg-blue-500/50",
                key === 'plus' && "bg-teal-500/50",
                key === 'elite' && "bg-amber-500/50"
              )} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="absolute -top-0.5 -translate-x-1/2 w-2 h-2 rounded-full cursor-help"
                    style={{ 
                      left: '50%',
                      backgroundColor: key === 'population' ? '#64748b' :
                        key === 'aboveAverage' ? '#3b82f6' :
                        key === 'plus' ? '#14b8a6' : '#f59e0b'
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs font-medium">{benchmark.label}: {(benchmark as any)[metricKey]}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
        
        {/* Player marker */}
        {playerPosition !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-10"
            style={{ left: `${playerPosition}%` }}
          >
            <div 
              className="w-4 h-4 rounded-full border-2 border-white shadow-lg -translate-x-1/2"
              style={{ backgroundColor: config.color }}
            />
          </div>
        )}
        
        {/* Fill bar up to player position */}
        {playerPosition !== null && (
          <div 
            className="absolute top-0 bottom-0 left-0 opacity-30"
            style={{ 
              width: `${playerPosition}%`,
              background: `linear-gradient(90deg, transparent, ${config.color})`
            }}
          />
        )}
      </div>
    </div>
  );
}

function SummaryCard({ metrics }: { metrics: WeaponMetrics }) {
  const metricKeys = Object.keys(metricConfig) as MetricKey[];
  const validMetrics = metricKeys.filter(k => metrics[k] !== null);
  
  if (validMetrics.length === 0) return null;
  
  const avgScore = validMetrics.reduce((sum, k) => sum + (metrics[k] ?? 0), 0) / validMetrics.length;
  const avgPercentile = getPercentile(avgScore);
  
  const aboveAvgCount = validMetrics.filter(k => (metrics[k] ?? 0) >= 55).length;
  const plusCount = validMetrics.filter(k => (metrics[k] ?? 0) >= 65).length;
  
  let overallGrade: string;
  let gradeColor: string;
  if (avgScore >= 65) {
    overallGrade = 'Plus Tool';
    gradeColor = 'text-teal-400';
  } else if (avgScore >= 55) {
    overallGrade = 'Above Average';
    gradeColor = 'text-blue-400';
  } else if (avgScore >= 50) {
    overallGrade = 'Average';
    gradeColor = 'text-slate-300';
  } else if (avgScore >= 45) {
    overallGrade = 'Below Average';
    gradeColor = 'text-orange-400';
  } else {
    overallGrade = 'Developing';
    gradeColor = 'text-red-400';
  }
  
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
        <p className="text-[10px] text-muted-foreground uppercase mb-1">Weapon Grade</p>
        <p className={cn("text-lg font-bold", gradeColor)}>{overallGrade}</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
        <p className="text-[10px] text-muted-foreground uppercase mb-1">Avg Score</p>
        <p className="text-lg font-bold text-white">{Math.round(avgScore)}</p>
        {avgPercentile !== null && (
          <p className="text-[10px] text-slate-400">{Math.round(avgPercentile)}th %ile</p>
        )}
      </div>
      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
        <p className="text-[10px] text-muted-foreground uppercase mb-1">Plus Tools</p>
        <p className="text-lg font-bold text-teal-400">{plusCount}/{validMetrics.length}</p>
        <p className="text-[10px] text-slate-400">{aboveAvgCount} above avg</p>
      </div>
    </div>
  );
}

export function WeaponMetricsComparison({ 
  metrics, 
  playerName,
  className 
}: WeaponMetricsComparisonProps) {
  const hasAnyData = Object.values(metrics).some(v => v !== null);
  
  if (!hasAnyData) {
    return (
      <Card className={cn("bg-slate-900/50 border-slate-800 p-6", className)}>
        <div className="text-center py-8">
          <Users className="h-12 w-12 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Comparison Data</h3>
          <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
            Connect your Diamond Kinetics sensor to compare your metrics against population benchmarks.
          </p>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className={cn("bg-slate-900/50 border-slate-800 p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Users className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">
              {playerName ? `${playerName}'s ` : ''}Weapon Comparison
            </h3>
            <p className="text-xs text-muted-foreground">vs. Population Benchmarks</p>
          </div>
        </div>
      </div>
      
      {/* Summary Stats */}
      <SummaryCard metrics={metrics} />
      
      {/* Comparison Bars */}
      <div className="space-y-4">
        {(Object.keys(metricConfig) as MetricKey[]).map((key) => (
          <ComparisonBar
            key={key}
            metricKey={key}
            value={metrics[key]}
            benchmarks={BENCHMARKS}
          />
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 pt-4 border-t border-slate-800">
        {Object.entries(BENCHMARKS).map(([key, benchmark]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div 
              className="w-2 h-2 rounded-full"
              style={{ 
                backgroundColor: key === 'population' ? '#64748b' :
                  key === 'aboveAverage' ? '#3b82f6' :
                  key === 'plus' ? '#14b8a6' : '#f59e0b'
              }}
            />
            <span className="text-[10px] text-muted-foreground">{benchmark.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-white border border-slate-600" />
          <span className="text-[10px] text-muted-foreground">You</span>
        </div>
      </div>
    </Card>
  );
}
