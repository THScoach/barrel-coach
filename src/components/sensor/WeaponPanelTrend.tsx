/**
 * WeaponPanelTrend - Shows weapon metrics trends over time with sparklines
 */

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  WeaponMetrics, 
  getWeaponGrade,
  calculateWeaponMetrics 
} from '@/lib/weapon-metrics';
import { 
  Zap, 
  Target, 
  ArrowRightLeft, 
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
  Info
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface SessionMetrics {
  date: string;
  sessionId: string;
  metrics: WeaponMetrics;
}

interface WeaponPanelTrendProps {
  sessions: SessionMetrics[];
  className?: string;
}

const metricConfig = {
  wipIndex: {
    name: 'WIP Index',
    shortName: 'WIP',
    icon: Zap,
    color: '#f97316', // orange-500
    description: 'Wrist-to-Impact Power efficiency',
  },
  planeIntegrity: {
    name: 'Plane Integrity',
    shortName: 'Plane',
    icon: ArrowRightLeft,
    color: '#3b82f6', // blue-500
    description: 'Swing plane consistency',
  },
  squareUpConsistency: {
    name: 'Square-Up',
    shortName: 'SQ-Up',
    icon: Target,
    color: '#10b981', // emerald-500
    description: 'Contact point repeatability',
  },
  impactMomentum: {
    name: 'Impact Momentum',
    shortName: 'Impact',
    icon: Gauge,
    color: '#8b5cf6', // violet-500
    description: 'Power at contact',
  },
};

type MetricKey = keyof typeof metricConfig;

function getTrend(current: number | null, previous: number | null): 'up' | 'down' | 'stable' | null {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (diff >= 3) return 'up';
  if (diff <= -3) return 'down';
  return 'stable';
}

function TrendBadge({ trend, delta }: { trend: 'up' | 'down' | 'stable' | null; delta: number | null }) {
  if (trend === null || delta === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const config = {
    up: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    down: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/20' },
    stable: { icon: Minus, color: 'text-slate-400', bg: 'bg-slate-500/20' },
  };

  const { icon: Icon, color, bg } = config[trend];

  return (
    <Badge variant="outline" className={cn("text-xs border-0 gap-1", bg, color)}>
      <Icon className="h-3 w-3" />
      {delta > 0 ? '+' : ''}{delta}
    </Badge>
  );
}

interface SparklineProps {
  data: (number | null)[];
  color: string;
  height?: number;
}

function Sparkline({ data, color, height = 40 }: SparklineProps) {
  const chartData = data.map((value, index) => ({ index, value }));
  const validValues = data.filter(v => v !== null) as number[];
  const avg = validValues.length > 0 
    ? validValues.reduce((a, b) => a + b, 0) / validValues.length 
    : 50;

  if (validValues.length < 2) {
    return (
      <div 
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ height }}
      >
        Need more data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <ReferenceLine y={avg} stroke="#475569" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: color }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface MetricTrendCardProps {
  metricKey: MetricKey;
  sessions: SessionMetrics[];
}

function MetricTrendCard({ metricKey, sessions }: MetricTrendCardProps) {
  const config = metricConfig[metricKey];
  const Icon = config.icon;

  const { current, previous, trend, delta, history, avg, best } = useMemo(() => {
    const values = sessions.map(s => s.metrics[metricKey]);
    const validValues = values.filter(v => v !== null) as number[];
    
    const current = values[0] ?? null;
    const previous = values[1] ?? null;
    const trend = getTrend(current, previous);
    const delta = current !== null && previous !== null ? current - previous : null;
    
    const avg = validValues.length > 0
      ? Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length)
      : null;
    
    const best = validValues.length > 0 ? Math.max(...validValues) : null;

    return { current, previous, trend, delta, history: values, avg, best };
  }, [sessions, metricKey]);

  const scoreColor = current !== null && current >= 55 ? 'text-teal-400' : 'text-slate-300';

  return (
    <Card className="bg-slate-900/60 border-slate-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Icon className="h-4 w-4" style={{ color: config.color }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
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
            <p className="text-[10px] text-muted-foreground">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <TrendBadge trend={trend} delta={delta} />
      </div>

      {/* Sparkline */}
      <div className="mb-3">
        <Sparkline data={history} color={config.color} />
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Current</p>
          <p className={cn("text-lg font-bold", scoreColor)}>
            {current ?? '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Avg</p>
          <p className="text-sm font-medium text-slate-300">{avg ?? '—'}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Best</p>
          <p className="text-sm font-medium text-slate-300">{best ?? '—'}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Grade</p>
          <p className="text-xs font-medium text-slate-400">
            {current !== null ? getWeaponGrade(current) : '—'}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function WeaponPanelTrend({ sessions, className }: WeaponPanelTrendProps) {
  if (sessions.length === 0) {
    return (
      <Card className={cn("bg-slate-900/50 border-slate-800 p-6", className)}>
        <div className="text-center py-8">
          <Zap className="h-12 w-12 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Trend Data</h3>
          <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
            Complete multiple sessions to see how your weapon metrics change over time.
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
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">Weapon Trends</h3>
            <p className="text-xs text-muted-foreground">
              Last {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.keys(metricConfig) as MetricKey[]).map((key) => (
          <MetricTrendCard key={key} metricKey={key} sessions={sessions} />
        ))}
      </div>
    </Card>
  );
}

export type { SessionMetrics };
