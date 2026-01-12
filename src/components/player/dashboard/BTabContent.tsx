/**
 * B Tab Content - Mini-dashboard for each B category
 * Includes coaching notes, complete metric cards, and HitTrax integration
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ChevronRight,
  FileText,
  History,
  Lightbulb,
  AlertCircle,
  Target,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import type { FourBCategory } from "./FourBNavStrip";
import { generateCoachingNote } from "@/lib/coaching-notes";

interface SessionDataPoint {
  id: string;
  date: Date;
  score: number;
}

export interface MetricItem {
  label: string;
  value: string | number | null;
  unit?: string;
  delta?: number;
  description?: string;
  isMeasured?: boolean;
  highlight?: boolean; // For kinetic vs actual comparison
}

export interface SessionMetricsData {
  // Brain metrics
  consistencyCV?: number | null;
  timingScore?: number | null;
  
  // Body metrics
  legsKEPeak?: number | null;
  torsoKEPeak?: number | null;
  transferPct?: number | null;
  groundFlowScore?: number | null;
  coreFlowScore?: number | null;
  
  // Bat metrics
  armsKEPeak?: number | null;
  batKE?: number | null;
  upperFlowScore?: number | null;
  transferEfficiency?: number | null;
  kineticPotentialEV?: number | null;
  
  // Ball metrics (HitTrax)
  avgExitVelo?: number | null;
  maxExitVelo?: number | null;
  hardHitPct?: number | null;
  barrelPct?: number | null;
  sweetSpotPct?: number | null;
  
  // General
  primaryLeak?: string | null;
}

interface BTabContentProps {
  category: FourBCategory;
  score: number | null;
  previousScore: number | null;
  grade?: string;
  subtitle: string;
  sessions: SessionDataPoint[];
  metrics: MetricItem[];
  sessionMetrics?: SessionMetricsData; // Raw metrics for coaching note generation
  onViewSession?: (sessionId: string) => void;
  onViewAllSessions?: () => void;
}

const CATEGORY_CONFIG: Record<FourBCategory, { 
  color: string; 
  bgGradient: string;
  label: string;
  icon: typeof Target;
}> = {
  brain: { 
    color: 'text-purple-400', 
    bgGradient: 'from-purple-500/10 to-transparent',
    label: 'Brain',
    icon: Lightbulb,
  },
  body: { 
    color: 'text-blue-400', 
    bgGradient: 'from-blue-500/10 to-transparent',
    label: 'Body',
    icon: Target,
  },
  bat: { 
    color: 'text-orange-400', 
    bgGradient: 'from-orange-500/10 to-transparent',
    label: 'Bat',
    icon: Zap,
  },
  ball: { 
    color: 'text-emerald-400', 
    bgGradient: 'from-emerald-500/10 to-transparent',
    label: 'Ball',
    icon: Target,
  },
};

function TrendChart({ 
  data, 
  color,
  onPointClick 
}: { 
  data: SessionDataPoint[]; 
  color: string;
  onPointClick?: (id: string) => void;
}) {
  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
        No session data yet
      </div>
    );
  }

  const scores = data.map(d => d.score);
  const min = Math.min(...scores, 20);
  const max = Math.max(...scores, 80);
  const range = max - min || 1;

  return (
    <div className="h-32 flex items-end gap-1">
      {data.slice(-10).map((session, i, arr) => {
        const height = ((session.score - min) / range) * 100;
        const isLast = i === arr.length - 1;
        const prevScore = i > 0 ? arr[i - 1].score : null;
        const delta = prevScore !== null ? session.score - prevScore : null;

        return (
          <button
            key={session.id}
            onClick={() => onPointClick?.(session.id)}
            className="flex-1 flex flex-col items-center gap-1 group min-w-0"
          >
            <div className="relative w-full">
              {isLast && delta !== null && (
                <div className={cn(
                  "absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap",
                  delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground"
                )}>
                  {delta > 0 ? '+' : ''}{delta}
                </div>
              )}
              <div 
                className={cn(
                  "w-full rounded-t transition-all",
                  isLast ? color : "bg-muted/50",
                  "group-hover:opacity-80"
                )}
                style={{ height: `${Math.max(height, 8)}%`, minHeight: '8px' }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground truncate w-full text-center">
              {format(session.date, 'M/d')}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricItem }) {
  const isMeasured = metric.isMeasured !== false && metric.value !== null && metric.value !== 'Not measured';
  
  return (
    <div 
      className={cn(
        "p-3 rounded-lg border",
        isMeasured 
          ? "bg-muted/30 border-border/50" 
          : "bg-muted/10 border-dashed border-muted-foreground/30"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        {isMeasured ? (
          <>
            <span className={cn(
              "text-lg font-bold",
              metric.highlight ? "text-emerald-400" : ""
            )}>
              {metric.value}
              {metric.unit && <span className="text-xs text-muted-foreground ml-0.5">{metric.unit}</span>}
            </span>
            {metric.delta !== undefined && (
              <span className={cn(
                "text-xs font-medium",
                metric.delta > 0 ? "text-emerald-500" : metric.delta < 0 ? "text-red-500" : "text-muted-foreground"
              )}>
                {metric.delta > 0 ? '+' : ''}{metric.delta}
              </span>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-sm">Not measured</span>
          </div>
        )}
      </div>
      <p className={cn(
        "text-xs mt-1",
        isMeasured ? "text-muted-foreground" : "text-muted-foreground/70"
      )}>
        {metric.label}
      </p>
      {metric.description && isMeasured && (
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{metric.description}</p>
      )}
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: MetricItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((metric, i) => (
        <MetricCard key={i} metric={metric} />
      ))}
    </div>
  );
}

function CoachingNoteCard({ 
  category, 
  score, 
  previousScore,
  sessionMetrics 
}: { 
  category: FourBCategory;
  score: number | null;
  previousScore: number | null;
  sessionMetrics?: SessionMetricsData;
}) {
  const config = CATEGORY_CONFIG[category];
  
  // Generate coaching note
  const note = generateCoachingNote(category, {
    ...sessionMetrics,
    score: score ?? undefined,
    previousScore: previousScore ?? undefined,
  });
  
  return (
    <Card className={cn(
      "border-l-4",
      category === 'brain' && "border-l-purple-500",
      category === 'body' && "border-l-blue-500",
      category === 'bat' && "border-l-orange-500",
      category === 'ball' && "border-l-emerald-500",
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Coaching Note
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground leading-relaxed">
          {note.summary}
        </p>
        <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
          <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Focus:</span> {note.focus}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function BTabContent({
  category,
  score,
  previousScore,
  grade,
  subtitle,
  sessions,
  metrics,
  sessionMetrics,
  onViewSession,
  onViewAllSessions,
}: BTabContentProps) {
  const config = CATEGORY_CONFIG[category];
  const delta = score !== null && previousScore !== null ? score - previousScore : null;
  const IconComponent = config.icon;

  return (
    <div className="space-y-4">
      {/* Header with score */}
      <Card className={cn("border-border/50 bg-gradient-to-br", config.bgGradient)}>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg bg-muted/50",
                config.color
              )}>
                <IconComponent className="h-5 w-5" />
              </div>
              <div>
                <h3 className={cn("text-lg font-bold", config.color)}>
                  {config.label}: {score ?? '--'}
                </h3>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
                {delta !== null && (
                  <div className="flex items-center gap-1 mt-1">
                    {delta > 0 && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                    {delta < 0 && <TrendingDown className="h-3 w-3 text-red-500" />}
                    {delta === 0 && <Minus className="h-3 w-3 text-muted-foreground" />}
                    <span className={cn(
                      "text-sm font-medium",
                      delta > 0 ? "text-emerald-500" : delta < 0 ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {delta > 0 ? '+' : ''}{delta} since last session
                    </span>
                  </div>
                )}
              </div>
            </div>
            {grade && (
              <Badge variant="outline" className={cn("text-xs", config.color)}>
                {grade}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Coaching Note - The key GOATY-style addition */}
      <CoachingNoteCard 
        category={category}
        score={score}
        previousScore={previousScore}
        sessionMetrics={sessionMetrics}
      />

      {/* Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Score Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart 
            data={sessions} 
            color={config.color.replace('text-', 'bg-')}
            onPointClick={onViewSession}
          />
        </CardContent>
      </Card>

      {/* Key Metrics - Now with complete cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Key Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length > 0 ? (
            <MetricGrid metrics={metrics} />
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No metrics recorded this session</p>
              <p className="text-xs mt-1">Upload session data to see detailed metrics</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {sessions.length > 0 && (
          <Button 
            variant="outline" 
            className="w-full justify-between"
            onClick={() => onViewSession?.(sessions[sessions.length - 1]?.id)}
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              View Latest KRS Report
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <Button 
          variant="ghost" 
          className="w-full justify-between text-muted-foreground"
          onClick={onViewAllSessions}
        >
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" />
            See All {config.label} Sessions
          </span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
