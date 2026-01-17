/**
 * 4B Score Cards Component
 * ========================
 * Clean dark dashboard style with left border accent based on score.
 */

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, Brain, Zap, Target } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface FourBScoreCardsProps {
  body: number | null;
  brain: number | null;
  bat: number | null;
  ball: number | null;
  prevBody?: number | null;
  prevBrain?: number | null;
  prevBat?: number | null;
  prevBall?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const scoreConfig = {
  body: {
    label: "BODY",
    icon: Activity,
    description: "Ground-up energy",
  },
  brain: {
    label: "BRAIN",
    icon: Brain,
    description: "Decision & timing",
  },
  bat: {
    label: "BAT",
    icon: Zap,
    description: "Upper body delivery",
  },
  ball: {
    label: "BALL",
    icon: Target,
    description: "Output quality",
  },
};

// Get border color based on score (scouting scale)
function getScoreBorderColor(score: number | null): string {
  if (score === null) return "border-l-slate-600";
  if (score >= 70) return "border-l-teal-500";      // Plus-Plus (Elite)
  if (score >= 60) return "border-l-teal-400";      // Plus
  if (score >= 50) return "border-l-slate-500";     // Average
  if (score >= 40) return "border-l-orange-500";    // Below Avg
  return "border-l-red-500";                         // Fringe/Poor
}

function getTrend(current: number | null, prev: number | null) {
  if (current === null || prev === null) return 'flat';
  if (current > prev) return 'up';
  if (current < prev) return 'down';
  return 'flat';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-slate-500" />;
}

export function FourBScoreCards({ 
  body, brain, bat, ball, 
  prevBody, prevBrain, prevBat, prevBall,
  size = "md", 
  className 
}: FourBScoreCardsProps) {
  const scores = { body, brain, bat, ball };
  const prevScores = { body: prevBody, brain: prevBrain, bat: prevBat, ball: prevBall };

  const sizeClasses = {
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
  };

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4", sizeClasses[size], className)}>
      {(Object.keys(scoreConfig) as Array<keyof typeof scoreConfig>).map((key) => {
        const config = scoreConfig[key];
        const score = scores[key];
        const prevScore = prevScores[key];
        const Icon = config.icon;
        const borderColor = getScoreBorderColor(score);
        const trend = getTrend(score, prevScore);

        return (
          <Card 
            key={key} 
            className={cn(
              "bg-slate-800/50 border-slate-700 border-l-4",
              borderColor
            )}
          >
            <CardContent className="p-3 md:p-4">
              {/* Header row: Icon + Label + Trend */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {config.label}
                  </span>
                </div>
                <TrendIcon trend={trend} />
              </div>
              
              {/* Large score */}
              <div className="mb-1">
                <span className="text-3xl md:text-4xl font-black text-white">
                  {score ?? '—'}
                </span>
              </div>
              
              {/* Description */}
              {size !== "sm" && (
                <p className="text-xs text-slate-500">{config.description}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
