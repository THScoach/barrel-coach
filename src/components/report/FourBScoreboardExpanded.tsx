import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, TrendingDown, Minus, ChevronDown, 
  Brain, Activity, Zap, Target,
  Video, Box
} from 'lucide-react';
import type { 
  UnifiedMetrics, 
  LeadLegBraking, 
  FreemanComparison, 
  DataSource, 
  MetricValue 
} from '@/lib/unified-metrics-types';
import { FREEMAN_BENCHMARKS } from '@/lib/unified-metrics-types';

// ============================================================================
// INFO TOOLTIP CONTENT
// ============================================================================
const TOOLTIPS = {
  fourBAnalysis: "Your 4B Score measures four parts of your swing: Body (how you move), Brain (your timing), Bat (how you deliver), Ball (your results).",
  body: "Body score measures how well you create and transfer energy from the ground up. Higher = more efficient movement.",
  brain: "Brain score measures your timing and rhythm. It's about WHEN things happen, not how hard you swing.",
  bat: "Bat score measures how you deliver the barrel to the ball. Requires Diamond Kinetics sensor data.",
  ball: "Ball score measures what actually happens when you make contact. Requires batted ball data (Hittrax, Rapsodo, etc).",
  loadSequence: "Time between your hips moving forward and shoulders starting to rotate. Positive = good (hips lead).",
  separation: "The gap between hip and shoulder rotation at front foot strike. More separation = more stored energy.",
  leadLegBraking: "When your front leg firms up relative to hip peak. Negative = early (good). Positive = late (leak).",
  tempo: "Ratio of load time to launch time. Elite is 2:1 to 3:1. Too high = rushing.",
  syncScore: "How well your body segments fire in sequence. Higher = smoother energy transfer.",
};

// ============================================================================
// TYPES
// ============================================================================

interface FourBScoreboardProps {
  unifiedMetrics: UnifiedMetrics;
  leadLegBraking: LeadLegBraking;
  freemanComparison: FreemanComparison;
  dataSource: DataSource;
  batScore?: number;
  ballScore?: number;
  deltas?: {
    body?: number;
    brain?: number;
    bat?: number;
    ball?: number;
    composite?: number;
  };
  className?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate lead leg braking score from brace timing (ms relative to hip peak)
 * Negative = early brace (good), Positive = late brace (bad)
 */
function calculateLeadLegBrakingScore(timingMs: number): number {
  // Elite early brace: < -50ms → 80-100 (interpolate: -100ms = 100, -50ms = 80)
  if (timingMs < -50) {
    return Math.min(100, Math.max(80, 100 + (timingMs + 100) * 0.4));
  }
  // Good early brace: -50 to -30ms → 70-80 (interpolate: -50ms = 80, -30ms = 70)
  if (timingMs < -30) {
    return 80 - ((timingMs + 50) / 20) * 10;
  }
  // Borderline/on-time: -30 to +30ms → 50-70 (interpolate: -30ms = 70, +30ms = 50)
  if (timingMs <= 30) {
    return 70 - ((timingMs + 30) / 60) * 20;
  }
  // Late brace: > +30ms → 30-50 (interpolate: +30ms = 50, +80ms = 30)
  return Math.max(30, 50 - ((timingMs - 30) / 50) * 20);
}

function calculateBodyScore(metrics: UnifiedMetrics, braking: LeadLegBraking): number {
  const loadSeq = metrics.load_sequence?.score_20_80 ?? 50;
  const separation = metrics.separation?.score_20_80 ?? 50;
  
  const brakingScore = braking.present 
    ? calculateLeadLegBrakingScore(braking.brace_timing_ms)
    : 50; // Default when no braking data
  
  return Math.round((loadSeq * 0.30) + (separation * 0.30) + (brakingScore * 0.40));
}

function calculateBrainScore(metrics: UnifiedMetrics): number {
  const tempo = metrics.tempo?.score_20_80 ?? 50;
  const sync = metrics.sync_score?.score_20_80 ?? 50;
  return Math.round((tempo * 0.50) + (sync * 0.50));
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 55) return 'text-yellow-400';
  if (score >= 45) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 55) return 'bg-yellow-500';
  if (score >= 45) return 'bg-orange-500';
  return 'bg-red-500';
}

function getScoreGrade(score: number): string {
  if (score >= 80) return 'Elite';
  if (score >= 70) return 'Plus';
  if (score >= 60) return 'Above Avg';
  if (score >= 50) return 'Average';
  if (score >= 40) return 'Below Avg';
  return 'Developing';
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function DeltaBadge({ delta }: { delta?: number }) {
  if (delta === undefined) return null;
  
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isPositive && 'text-green-400',
        delta < 0 && 'text-red-400',
        isNeutral && 'text-slate-500'
      )}
    >
      {isPositive && <TrendingUp className="h-3 w-3" />}
      {delta < 0 && <TrendingDown className="h-3 w-3" />}
      {isNeutral && <Minus className="h-3 w-3" />}
      {isPositive ? '+' : ''}{delta}
    </span>
  );
}

function MetricDetail({ label, metric, tooltip }: { label: string; metric?: MetricValue; tooltip?: string }) {
  if (!metric) {
    return (
      <div className="flex items-center justify-between py-1.5 px-2 bg-slate-800/40 rounded">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{label}</span>
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>
        <span className="text-sm text-slate-600">--</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 px-2 bg-slate-800/40 rounded">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">{metric.raw}</span>
        <Badge 
          variant="outline" 
          className={cn(
            "text-[9px] px-1.5 py-0 border-0",
            getScoreColor(metric.score_20_80),
            metric.score_20_80 >= 70 ? 'bg-emerald-500/20' : 
            metric.score_20_80 >= 55 ? 'bg-yellow-500/20' : 
            metric.score_20_80 >= 45 ? 'bg-orange-500/20' : 'bg-red-500/20'
          )}
        >
          {metric.score_20_80}
        </Badge>
      </div>
    </div>
  );
}

function LeadLegDetail({ braking }: { braking: LeadLegBraking }) {
  if (!braking.present) {
    return (
      <div className="flex items-center justify-between py-1.5 px-2 bg-slate-800/40 rounded">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Lead Leg Braking</span>
          <InfoTooltip content={TOOLTIPS.leadLegBraking} />
        </div>
        <span className="text-sm text-slate-600">--</span>
      </div>
    );
  }

  const timing = braking.brace_timing_ms;
  const isGood = timing < -30;
  const isBorderline = timing >= -30 && timing <= 30;
  
  return (
    <div className="flex items-center justify-between py-1.5 px-2 bg-slate-800/40 rounded">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400">Lead Leg Braking</span>
        <InfoTooltip content={TOOLTIPS.leadLegBraking} />
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-xs",
          isGood ? 'text-emerald-400' : isBorderline ? 'text-yellow-400' : 'text-red-400'
        )}>
          {timing > 0 ? '+' : ''}{timing}ms
        </span>
        <Badge 
          variant="outline" 
          className={cn(
            "text-[9px] px-1.5 py-0 border-0",
            isGood ? 'bg-emerald-500/20 text-emerald-400' : 
            isBorderline ? 'bg-yellow-500/20 text-yellow-400' : 
            'bg-red-500/20 text-red-400'
          )}
        >
          {isGood ? 'Elite' : isBorderline ? 'OK' : 'Late'}
        </Badge>
      </div>
    </div>
  );
}

function FreemanComparisonDetail({ comparison }: { comparison: FreemanComparison }) {
  if (!comparison.present) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-800">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">vs Freddie Freeman</div>
      <div className="space-y-1.5">
        {(['load_sequence', 'tempo', 'separation'] as const).map((key) => {
          const data = comparison[key];
          const benchmark = FREEMAN_BENCHMARKS[key];
          const isGood = data.status === 'similar' || data.status === 'above';
          
          return (
            <div key={key} className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 capitalize">{key.replace('_', ' ')}</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{data.player_raw}</span>
                <span className={isGood ? 'text-emerald-400' : 'text-orange-400'}>
                  {isGood ? '≈' : '→'} {benchmark.raw}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ScoreRowProps {
  label: string;
  score: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  delta?: number;
  isExpanded: boolean;
  onToggle: () => void;
  tooltip?: string;
  children?: React.ReactNode;
}

function ScoreRow({ 
  label, score, icon, color, bgColor, delta, 
  isExpanded, onToggle, tooltip, children 
}: ScoreRowProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="w-full text-left">
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800/80 transition-colors">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-lg", bgColor)}>
                {icon}
              </div>
              <span className="text-sm font-medium text-slate-200">{label}</span>
              {tooltip && <InfoTooltip content={tooltip} />}
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xl font-bold tabular-nums", getScoreColor(score))}>
                {score}
              </span>
              <DeltaBadge delta={delta} />
              <ChevronDown className={cn(
                "h-4 w-4 text-slate-500 transition-transform",
                isExpanded && "rotate-180"
              )} />
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      {children && (
        <CollapsibleContent>
          <div className="mt-2 ml-9 space-y-1">
            {children}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FourBScoreboardExpanded({
  unifiedMetrics,
  leadLegBraking,
  freemanComparison,
  dataSource,
  batScore = 50,
  ballScore = 50,
  deltas,
  className
}: FourBScoreboardProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Calculate scores from unified metrics
  const bodyScore = calculateBodyScore(unifiedMetrics, leadLegBraking);
  const brainScore = calculateBrainScore(unifiedMetrics);
  const compositeScore = Math.round(
    (bodyScore * 0.25) + (brainScore * 0.25) + (batScore * 0.25) + (ballScore * 0.25)
  );
  
  const grade = getScoreGrade(compositeScore);
  const SourceIcon = dataSource === '3d_reboot' ? Box : Video;
  const sourceLabel = dataSource === '3d_reboot' ? '3D' : '2D';

  const toggleExpand = (key: string) => {
    setExpanded(expanded === key ? null : key);
  };

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              4B Analysis
            </CardTitle>
            <InfoTooltip content={TOOLTIPS.fourBAnalysis} />
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] gap-1",
              dataSource === '3d_reboot' 
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
            )}
          >
            <SourceIcon className="h-3 w-3" />
            {sourceLabel}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Hero Composite Score */}
        <div className="text-center pb-4 border-b border-slate-800">
          <div className="relative inline-flex items-center justify-center">
            <div className={cn(
              "w-28 h-28 rounded-full border-4 flex items-center justify-center",
              compositeScore >= 70 ? 'border-emerald-500 bg-emerald-500/10' :
              compositeScore >= 55 ? 'border-yellow-500 bg-yellow-500/10' :
              compositeScore >= 45 ? 'border-orange-500 bg-orange-500/10' :
              'border-red-500 bg-red-500/10'
            )}>
              <div className="text-center">
                <span className={cn("text-4xl font-bold tabular-nums", getScoreColor(compositeScore))}>
                  {compositeScore}
                </span>
                {deltas?.composite !== undefined && (
                  <div className="mt-0.5">
                    <DeltaBadge delta={deltas.composite} />
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-2 font-medium">{grade}</p>
          <p className="text-[10px] text-slate-600 mt-1">Tap each score to see details</p>
        </div>

        {/* 4B Scores - Expandable */}
        <div className="space-y-2">
          {/* BODY */}
          <ScoreRow
            label="BODY"
            score={bodyScore}
            icon={<Activity className="h-4 w-4 text-blue-400" />}
            color="text-blue-400"
            bgColor="bg-blue-500/20"
            delta={deltas?.body}
            isExpanded={expanded === 'body'}
            onToggle={() => toggleExpand('body')}
            tooltip={TOOLTIPS.body}
          >
            <MetricDetail label="Load Sequence" metric={unifiedMetrics.load_sequence} tooltip={TOOLTIPS.loadSequence} />
            <MetricDetail label="Separation" metric={unifiedMetrics.separation} tooltip={TOOLTIPS.separation} />
            <LeadLegDetail braking={leadLegBraking} />
            <FreemanComparisonDetail comparison={freemanComparison} />
          </ScoreRow>

          {/* BRAIN */}
          <ScoreRow
            label="BRAIN"
            score={brainScore}
            icon={<Brain className="h-4 w-4 text-purple-400" />}
            color="text-purple-400"
            bgColor="bg-purple-500/20"
            delta={deltas?.brain}
            isExpanded={expanded === 'brain'}
            onToggle={() => toggleExpand('brain')}
            tooltip={TOOLTIPS.brain}
          >
            <MetricDetail label="Tempo" metric={unifiedMetrics.tempo} tooltip={TOOLTIPS.tempo} />
            <MetricDetail label="Sync Score" metric={unifiedMetrics.sync_score} tooltip={TOOLTIPS.syncScore} />
          </ScoreRow>

          {/* BAT */}
          <ScoreRow
            label="BAT"
            score={batScore}
            icon={<Zap className="h-4 w-4 text-orange-400" />}
            color="text-orange-400"
            bgColor="bg-orange-500/20"
            delta={deltas?.bat}
            isExpanded={expanded === 'bat'}
            onToggle={() => toggleExpand('bat')}
            tooltip={TOOLTIPS.bat}
          >
            <div className="py-1.5 px-2 bg-slate-800/40 rounded">
              <span className="text-xs text-slate-500">Bat speed, hand speed, energy transfer metrics</span>
            </div>
          </ScoreRow>

          {/* BALL */}
          <ScoreRow
            label="BALL"
            score={ballScore}
            icon={<Target className="h-4 w-4 text-green-400" />}
            color="text-green-400"
            bgColor="bg-green-500/20"
            delta={deltas?.ball}
            isExpanded={expanded === 'ball'}
            onToggle={() => toggleExpand('ball')}
            tooltip={TOOLTIPS.ball}
          >
            <div className="py-1.5 px-2 bg-slate-800/40 rounded">
              <span className="text-xs text-slate-500">Exit velo, launch angle, distance metrics</span>
            </div>
          </ScoreRow>
        </div>

        {/* Caption */}
        <p className="text-[10px] text-slate-600 text-center italic pt-2">
          Scores improve by fixing leaks — not by swinging harder.
        </p>
      </CardContent>
    </Card>
  );
}

export default FourBScoreboardExpanded;
