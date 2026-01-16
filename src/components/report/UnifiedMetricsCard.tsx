import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Video, Box } from "lucide-react";
import type { UnifiedMetrics, MetricValue, DataSource } from "@/lib/unified-metrics-types";
import { cn } from "@/lib/utils";

interface UnifiedMetricsCardProps {
  metrics: UnifiedMetrics;
  dataSource: DataSource;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 55) return 'text-yellow-400';
  if (score >= 45) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500/20';
  if (score >= 55) return 'bg-yellow-500/20';
  if (score >= 45) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}

function MetricCard({ 
  label, 
  metric 
}: { 
  label: string; 
  metric?: MetricValue;
}) {
  if (!metric) {
    return (
      <div className="bg-slate-800/60 rounded-lg p-3 space-y-1">
        <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">{label}</div>
        <div className="text-2xl font-bold text-slate-600 tabular-nums">--</div>
        <div className="text-[10px] text-slate-600">Need 3+ swings</div>
      </div>
    );
  }

  const scoreColor = getScoreColor(metric.score_20_80);
  const bgColor = getScoreBgColor(metric.score_20_80);

  return (
    <div className="bg-slate-800/60 rounded-lg p-3 space-y-1">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums", scoreColor)}>
        {metric.score_20_80}
      </div>
      <div className="text-xs text-slate-300">{metric.raw}</div>
      <Badge 
        variant="outline" 
        className={cn(
          "text-[9px] px-1.5 py-0 border-0 font-medium",
          bgColor,
          scoreColor
        )}
      >
        {metric.grade_label}
      </Badge>
    </div>
  );
}

function CompositeBar({ score }: { score: number }) {
  const progressValue = ((score - 20) / 60) * 100;
  const scoreColor = getScoreColor(score);
  const bgColor = getScoreBgColor(score);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-5xl font-bold tabular-nums tracking-tight", scoreColor)}>
            {score}
          </span>
          <span className="text-sm text-slate-500 font-medium">/ 80</span>
        </div>
        <Badge className={cn("text-xs border-0 font-semibold", bgColor, scoreColor)}>
          Composite
        </Badge>
      </div>
      <div className="relative">
        <Progress value={progressValue} className="h-3 bg-slate-700" />
        <div className="flex justify-between text-[10px] text-slate-600 mt-1.5 px-0.5">
          <span>20</span>
          <span>35</span>
          <span>50</span>
          <span>65</span>
          <span>80</span>
        </div>
      </div>
    </div>
  );
}

export function UnifiedMetricsCard({ 
  metrics, 
  dataSource,
  className 
}: UnifiedMetricsCardProps) {
  const SourceIcon = dataSource === '3d_reboot' ? Box : Video;
  const sourceLabel = dataSource === '3d_reboot' ? '3D ANALYSIS' : '2D ANALYSIS';
  const sourceBadgeColor = dataSource === '3d_reboot' 
    ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
    : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';

  if (!metrics.present) {
    return (
      <Card className={cn("bg-slate-900 border-slate-800", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-slate-200">
              <Brain className="h-5 w-5 text-cyan-400" />
              Unified Metrics
            </CardTitle>
            <Badge variant="outline" className={cn("text-[10px] gap-1", sourceBadgeColor)}>
              <SourceIcon className="h-3 w-3" />
              {sourceLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Metrics not available for this session.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <Brain className="h-5 w-5 text-cyan-400" />
            Unified Metrics
          </CardTitle>
          <Badge variant="outline" className={cn("text-[10px] gap-1", sourceBadgeColor)}>
            <SourceIcon className="h-3 w-3" />
            {sourceLabel}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Composite Score */}
        <CompositeBar score={metrics.composite.score_20_80} />

        {/* 5 Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <MetricCard label="Load Sequence" metric={metrics.load_sequence} />
          <MetricCard label="Tempo" metric={metrics.tempo} />
          <MetricCard label="Separation" metric={metrics.separation} />
          <MetricCard label="Sync Score" metric={metrics.sync_score} />
          <MetricCard label="Brain Score" metric={metrics.brain_score} />
        </div>

        {/* Data Source Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-center text-[10px] text-slate-600">
          Powered by {dataSource === '3d_reboot' ? 'Reboot Motion' : '2D Video Analysis'}
        </div>
      </CardContent>
    </Card>
  );
}

export default UnifiedMetricsCard;
