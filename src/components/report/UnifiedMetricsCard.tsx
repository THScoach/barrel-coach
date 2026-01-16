import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Video, Box } from "lucide-react";
import type { 
  BrainMetrics, 
  MetricValue, 
  GradeLabel 
} from "@/lib/unified-metrics-types";
import { getGradeLabel } from "@/lib/unified-metrics-types";
import { cn } from "@/lib/utils";

type DataSource = '2d_video' | '3d_reboot';

interface UnifiedMetricsCardProps {
  metrics: BrainMetrics;
  dataSource: DataSource;
  compositeScore?: number;
  swingCount?: number;
  className?: string;
}

const gradeColors: Record<GradeLabel, string> = {
  'Well Below': 'text-red-400',
  'Below Average': 'text-red-400',
  'Fringe': 'text-orange-400',
  'Average': 'text-yellow-400',
  'Above Average': 'text-emerald-400',
  'Plus': 'text-cyan-400',
  'Plus Plus': 'text-blue-400',
  'Elite': 'text-purple-400',
};

const gradeBgColors: Record<GradeLabel, string> = {
  'Well Below': 'bg-red-500/20',
  'Below Average': 'bg-red-500/20',
  'Fringe': 'bg-orange-500/20',
  'Average': 'bg-yellow-500/20',
  'Above Average': 'bg-emerald-500/20',
  'Plus': 'bg-cyan-500/20',
  'Plus Plus': 'bg-blue-500/20',
  'Elite': 'bg-purple-500/20',
};

const metricLabels: Record<string, string> = {
  load_sequence: 'Load Sequence',
  tempo: 'Tempo',
  separation: 'Separation',
  sync_score: 'Sync Score',
};

function MetricTile({ metric, label }: { metric: MetricValue; label: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 space-y-1">
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-bold tabular-nums", gradeColors[metric.grade_label])}>
          {metric.score_20_80}
        </span>
        <span className="text-sm text-slate-300">{metric.raw}</span>
      </div>
      <Badge 
        variant="outline" 
        className={cn(
          "text-[10px] px-1.5 py-0 border-0",
          gradeBgColors[metric.grade_label],
          gradeColors[metric.grade_label]
        )}
      >
        {metric.grade_label}
      </Badge>
    </div>
  );
}

function CompositeBar({ score }: { score: number }) {
  const gradeLabel = getGradeLabel(score);
  const progressValue = ((score - 20) / 60) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-4xl font-bold tabular-nums", gradeColors[gradeLabel])}>
            {score}
          </span>
          <span className="text-sm text-slate-400">/ 80</span>
        </div>
        <Badge 
          className={cn(
            "text-xs border-0",
            gradeBgColors[gradeLabel],
            gradeColors[gradeLabel]
          )}
        >
          {gradeLabel}
        </Badge>
      </div>
      <div className="relative">
        <Progress value={progressValue} className="h-2 bg-slate-700" />
        {/* Scale markers */}
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>20</span>
          <span>40</span>
          <span>60</span>
          <span>80</span>
        </div>
      </div>
    </div>
  );
}

export function UnifiedMetricsCard({ 
  metrics, 
  dataSource, 
  compositeScore, 
  swingCount = 3,
  className 
}: UnifiedMetricsCardProps) {
  const SourceIcon = dataSource === '3d_reboot' ? Box : Video;
  const sourceLabel = dataSource === '3d_reboot' ? '3D Reboot' : '2D Video';

  if (!metrics.present) {
    return (
      <Card className={cn("bg-slate-900 border-slate-800", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <Brain className="h-5 w-5 text-cyan-400" />
            Brain Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Brain metrics not available for this session.</p>
        </CardContent>
      </Card>
    );
  }

  const displayComposite = compositeScore ?? metrics.brain_score?.score_20_80 ?? metrics.sync_score.score_20_80;

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-200">
          <Brain className="h-5 w-5 text-cyan-400" />
          Brain Metrics
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Composite Score with Progress Bar */}
        <CompositeBar score={displayComposite} />

        {/* 4 Metric Tiles Grid */}
        <div className="grid grid-cols-2 gap-2">
          <MetricTile metric={metrics.load_sequence} label={metricLabels.load_sequence} />
          <MetricTile metric={metrics.tempo} label={metricLabels.tempo} />
          <MetricTile metric={metrics.separation} label={metricLabels.separation} />
          <MetricTile metric={metrics.sync_score} label={metricLabels.sync_score} />
        </div>

        {/* Confidence Note */}
        <p className="text-xs text-slate-500 text-center">
          Based on {swingCount}+ swings
        </p>

        {/* Data Source Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <SourceIcon className="h-3 w-3" />
          <span>{sourceLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default UnifiedMetricsCard;
