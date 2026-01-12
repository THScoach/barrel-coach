/**
 * B Tab Content - Mini-dashboard for each B category
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
  History
} from "lucide-react";
import { format } from "date-fns";
import type { FourBCategory } from "./FourBNavStrip";

interface SessionDataPoint {
  id: string;
  date: Date;
  score: number;
}

interface MetricItem {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  description?: string;
}

interface BTabContentProps {
  category: FourBCategory;
  score: number | null;
  previousScore: number | null;
  grade?: string;
  subtitle: string;
  sessions: SessionDataPoint[];
  metrics: MetricItem[];
  onViewSession?: (sessionId: string) => void;
  onViewAllSessions?: () => void;
}

const CATEGORY_CONFIG: Record<FourBCategory, { 
  color: string; 
  bgGradient: string;
  label: string;
}> = {
  brain: { 
    color: 'text-purple-400', 
    bgGradient: 'from-purple-500/10 to-transparent',
    label: 'Brain'
  },
  body: { 
    color: 'text-blue-400', 
    bgGradient: 'from-blue-500/10 to-transparent',
    label: 'Body'
  },
  bat: { 
    color: 'text-orange-400', 
    bgGradient: 'from-orange-500/10 to-transparent',
    label: 'Bat'
  },
  ball: { 
    color: 'text-emerald-400', 
    bgGradient: 'from-emerald-500/10 to-transparent',
    label: 'Ball'
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

function MetricGrid({ metrics }: { metrics: MetricItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((metric, i) => (
        <div 
          key={i}
          className="p-3 rounded-lg bg-muted/30 border border-border/50"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold">
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
          </div>
          <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
          {metric.description && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{metric.description}</p>
          )}
        </div>
      ))}
    </div>
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
  onViewSession,
  onViewAllSessions,
}: BTabContentProps) {
  const config = CATEGORY_CONFIG[category];
  const delta = score !== null && previousScore !== null ? score - previousScore : null;

  return (
    <div className="space-y-4">
      {/* Header with score */}
      <Card className={cn("border-border/50 bg-gradient-to-br", config.bgGradient)}>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
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
            {grade && (
              <Badge variant="outline" className={cn("text-xs", config.color)}>
                {grade}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* Key Metrics */}
      {metrics.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Key Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricGrid metrics={metrics} />
          </CardContent>
        </Card>
      )}

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
