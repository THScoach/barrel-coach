import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Activity, Timer, Gauge, Target, Video, Box } from "lucide-react";
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
  className?: string;
}

const gradeColors: Record<GradeLabel, string> = {
  'Well Below': 'text-red-400',
  'Below Avg': 'text-orange-400',
  'Average': 'text-yellow-400',
  'Above Avg': 'text-emerald-400',
  'Plus': 'text-cyan-400',
  'Elite': 'text-purple-400',
};

const gradeBgColors: Record<GradeLabel, string> = {
  'Well Below': 'bg-red-500/20 border-red-500/30',
  'Below Avg': 'bg-orange-500/20 border-orange-500/30',
  'Average': 'bg-yellow-500/20 border-yellow-500/30',
  'Above Avg': 'bg-emerald-500/20 border-emerald-500/30',
  'Plus': 'bg-cyan-500/20 border-cyan-500/30',
  'Elite': 'bg-purple-500/20 border-purple-500/30',
};

const metricConfig = [
  { key: 'load_sequence', label: 'Load Sequence', icon: Timer, description: 'Hip-hand timing offset' },
  { key: 'tempo', label: 'Tempo', icon: Activity, description: 'Load-to-swing ratio' },
  { key: 'separation', label: 'Separation', icon: Target, description: 'Hip-shoulder X-factor' },
  { key: 'sync_score', label: 'Sync Score', icon: Gauge, description: 'Overall timing sync' },
] as const;

function MetricRow({ metric, label, icon: Icon, description }: { 
  metric: MetricValue; 
  label: string; 
  icon: React.ElementType;
  description: string;
}) {
  const progressValue = ((metric.score_20_80 - 20) / 60) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-lg font-bold tabular-nums", gradeColors[metric.grade_label])}>
            {metric.raw}
          </span>
          <Badge 
            variant="outline" 
            className={cn("text-xs border", gradeBgColors[metric.grade_label], gradeColors[metric.grade_label])}
          >
            {metric.grade}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Progress 
          value={progressValue} 
          className="h-1.5 flex-1 bg-slate-800" 
        />
        <span className="text-xs text-slate-500 w-20 text-right">{metric.grade_label}</span>
      </div>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}

function CompositeScoreDisplay({ score }: { score: number }) {
  const gradeLabel = getGradeLabel(score);
  const progressValue = ((score - 20) / 60) * 100;
  
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
      <div className="flex-shrink-0">
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center border-2",
          gradeBgColors[gradeLabel],
          "border-current"
        )}>
          <span className={cn("text-2xl font-bold tabular-nums", gradeColors[gradeLabel])}>
            {score}
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">Composite Brain Score</span>
          <Badge 
            variant="outline" 
            className={cn("border", gradeBgColors[gradeLabel], gradeColors[gradeLabel])}
          >
            {gradeLabel}
          </Badge>
        </div>
        <Progress 
          value={progressValue} 
          className="h-2 bg-slate-700" 
        />
        <p className="text-xs text-slate-500">20-80 scouting scale</p>
      </div>
    </div>
  );
}

export function UnifiedMetricsCard({ metrics, dataSource, compositeScore, className }: UnifiedMetricsCardProps) {
  const SourceIcon = dataSource === '3d_reboot' ? Box : Video;
  const sourceLabel = dataSource === '3d_reboot' ? '3D Reboot' : '2D Video';

  if (!metrics.present) {
    return (
      <Card className={cn("bg-slate-900 border-slate-800", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <Brain className="h-5 w-5 text-cyan-400" />
            Brain Metrics
            <Badge variant="outline" className="ml-auto text-xs border-slate-700 text-slate-400">
              <SourceIcon className="h-3 w-3 mr-1" />
              {sourceLabel}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Brain metrics not available for this session.</p>
        </CardContent>
      </Card>
    );
  }

  const displayComposite = compositeScore ?? metrics.brain_score ?? metrics.sync_score.score_20_80;

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-200">
          <Brain className="h-5 w-5 text-cyan-400" />
          Brain Metrics
          <Badge variant="outline" className="ml-auto text-xs border-slate-700 text-slate-400">
            <SourceIcon className="h-3 w-3 mr-1" />
            {sourceLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Composite Score */}
        <CompositeScoreDisplay score={displayComposite} />

        {/* Individual Metrics */}
        <div className="space-y-4 pt-2">
          {metricConfig.map(({ key, label, icon, description }) => (
            <MetricRow 
              key={key}
              metric={metrics[key]}
              label={label}
              icon={icon}
              description={description}
            />
          ))}
        </div>

        {/* Brain Score if different from composite */}
        {metrics.brain_score !== undefined && metrics.brain_score !== displayComposite && (
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Brain Score (Raw)</span>
              <span className={cn("font-bold", gradeColors[getGradeLabel(metrics.brain_score)])}>
                {metrics.brain_score}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UnifiedMetricsCard;
