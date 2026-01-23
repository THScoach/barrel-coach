/**
 * Weapon Panel - Advanced Diamond Kinetics metrics visualization
 * Displays WIP Index, Plane Integrity, Square-Up Consistency, and Impact Momentum
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  WeaponMetrics, 
  getWeaponMetricDisplays, 
  getWeaponGrade 
} from '@/lib/weapon-metrics';
import { 
  Zap, 
  Target, 
  ArrowRightLeft, 
  Gauge,
  Info,
  Bluetooth
} from 'lucide-react';

interface WeaponPanelProps {
  metrics: WeaponMetrics;
  isConnected?: boolean;
  className?: string;
}

const metricIcons = {
  'WIP Index': Zap,
  'Plane Integrity': ArrowRightLeft,
  'Square-Up': Target,
  'Impact Momentum': Gauge,
};

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 65) return 'text-teal-400';
  if (score >= 55) return 'text-blue-400';
  if (score >= 50) return 'text-slate-400';
  if (score >= 45) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBorderColor(score: number | null): string {
  if (score === null) return 'border-muted';
  if (score >= 65) return 'border-teal-500/50';
  if (score >= 55) return 'border-blue-500/50';
  if (score >= 50) return 'border-slate-500/50';
  if (score >= 45) return 'border-orange-500/50';
  return 'border-red-500/50';
}

function getProgressColor(score: number | null): string {
  if (score === null) return 'bg-muted';
  if (score >= 65) return 'bg-teal-500';
  if (score >= 55) return 'bg-blue-500';
  if (score >= 50) return 'bg-slate-500';
  if (score >= 45) return 'bg-orange-500';
  return 'bg-red-500';
}

interface MetricCardProps {
  name: string;
  shortName: string;
  value: number | null;
  description: string;
  interpretation: string;
  isGood: boolean;
}

function MetricCard({ name, value, description, interpretation }: MetricCardProps) {
  const Icon = metricIcons[name as keyof typeof metricIcons] || Gauge;
  const scoreColor = getScoreColor(value);
  const borderColor = getScoreBorderColor(value);
  const progressColor = getProgressColor(value);
  
  // Convert 20-80 to percentage
  const percentage = value !== null 
    ? Math.max(0, Math.min(100, ((value - 20) / 60) * 100)) 
    : 0;
  
  return (
    <Card className={cn(
      "relative bg-slate-900/50 border-l-4 p-4 transition-all hover:bg-slate-800/50",
      borderColor
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            value !== null && value >= 55 ? "bg-teal-500/20" : "bg-slate-700/50"
          )}>
            <Icon className={cn("h-4 w-4", scoreColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">{name}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs">{description}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground">{interpretation}</p>
          </div>
        </div>
        
        <div className="text-right flex-shrink-0">
          <span className={cn("text-2xl font-black", scoreColor)}>
            {value !== null ? value : '—'}
          </span>
          {value !== null && (
            <p className="text-[10px] text-muted-foreground">
              {getWeaponGrade(value)}
            </p>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", progressColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </Card>
  );
}

export function WeaponPanel({ metrics, isConnected = true, className }: WeaponPanelProps) {
  const displays = getWeaponMetricDisplays(metrics);
  const hasAnyData = Object.values(metrics).some(v => v !== null);
  
  if (!isConnected) {
    return (
      <Card className={cn("bg-slate-900/50 border-slate-800 p-6", className)}>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bluetooth className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Connect Diamond Kinetics</h3>
          <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
            Link your DK sensor to unlock advanced weapon metrics
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
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">Weapon Panel</h3>
            <p className="text-xs text-muted-foreground">Diamond Kinetics Metrics</p>
          </div>
        </div>
        {hasAnyData && (
          <Badge variant="outline" className="text-teal-400 border-teal-500/50">
            DK Connected
          </Badge>
        )}
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {displays.map((metric) => (
          <MetricCard key={metric.name} {...metric} />
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-teal-500" />
          <span className="text-[10px] text-muted-foreground">65+ Plus</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[10px] text-muted-foreground">55-64 Above Avg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-500" />
          <span className="text-[10px] text-muted-foreground">50-54 Average</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-[10px] text-muted-foreground">45-49 Below</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[10px] text-muted-foreground">&lt;45 Needs Work</span>
        </div>
      </div>
    </Card>
  );
}

// Compact variant for embedding in other views
export function WeaponPanelCompact({ metrics, className }: { metrics: WeaponMetrics; className?: string }) {
  const displays = getWeaponMetricDisplays(metrics);
  
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {displays.map((metric) => {
        const Icon = metricIcons[metric.name as keyof typeof metricIcons] || Gauge;
        const scoreColor = getScoreColor(metric.value);
        
        return (
          <div 
            key={metric.name}
            className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3"
          >
            <Icon className={cn("h-4 w-4 flex-shrink-0", scoreColor)} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{metric.shortName}</p>
              <p className={cn("text-lg font-bold", scoreColor)}>
                {metric.value !== null ? metric.value : '—'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
