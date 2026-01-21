/**
 * Ghost Lab 4B Scorecard - 20-80 scout scale display
 * Shows Brain, Body, Bat, Ball scores with visual gauges
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Activity, Zap, Target, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GhostLab4BScorecardProps {
  brainScore: number | null;
  bodyScore: number | null;
  batScore: number | null;
  ballScore: number | null;
  compositeScore: number | null;
  weakestLink: string | null;
  leaks?: {
    type: string;
    severity: 'mild' | 'moderate' | 'severe';
  }[];
}

const CATEGORY_CONFIG = {
  brain: {
    label: 'BRAIN',
    subtitle: 'How repeatable is your timing?',
    icon: Brain,
    color: 'text-purple-400',
    bgGlow: 'from-purple-500/20',
    borderColor: 'border-purple-500/40',
  },
  body: {
    label: 'BODY',
    subtitle: 'Are you using the ground?',
    icon: Activity,
    color: 'text-blue-400',
    bgGlow: 'from-blue-500/20',
    borderColor: 'border-blue-500/40',
  },
  bat: {
    label: 'BAT',
    subtitle: 'Is energy reaching the barrel?',
    icon: Zap,
    color: 'text-orange-400',
    bgGlow: 'from-orange-500/20',
    borderColor: 'border-orange-500/40',
  },
  ball: {
    label: 'BALL',
    subtitle: 'How clean is your contact?',
    icon: Target,
    color: 'text-emerald-400',
    bgGlow: 'from-emerald-500/20',
    borderColor: 'border-emerald-500/40',
  },
};

function getScoreGrade(score: number): string {
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 50) return "Average";
  if (score >= 45) return "Below Avg";
  if (score >= 40) return "Fringe";
  return "Developing";
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 60) return 'text-teal-400';
  if (score >= 55) return 'text-blue-400';
  if (score >= 50) return 'text-slate-300';
  if (score >= 45) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

interface ScoreGaugeProps {
  score: number | null;
  category: keyof typeof CATEGORY_CONFIG;
  isWeakest?: boolean;
}

function ScoreGauge({ score, category, isWeakest }: ScoreGaugeProps) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;
  const displayScore = score ?? 0;
  const percentage = Math.max(0, Math.min(100, ((displayScore - 20) / 60) * 100));
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "relative flex flex-col items-center p-4 rounded-xl border transition-all cursor-help",
              "bg-gradient-to-br to-transparent",
              config.bgGlow,
              config.borderColor,
              isWeakest && "ring-2 ring-primary ring-offset-2 ring-offset-slate-900"
            )}
          >
            {/* Circular Gauge */}
            <div className="relative w-24 h-24">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-800"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={score !== null ? (score >= 50 ? '#14b8a6' : score >= 40 ? '#f97316' : '#DC2626') : '#64748b'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={score !== null ? offset : circumference}
                  className="transition-all duration-700"
                />
              </svg>
              
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-2xl font-black", score !== null ? getScoreColor(score) : 'text-slate-500')}>
                  {score !== null ? Math.round(score) : '—'}
                </span>
              </div>
            </div>

            {/* Label */}
            <div className="flex items-center gap-1.5 mt-3">
              <Icon className={cn("h-4 w-4", config.color)} />
              <span className="text-xs font-bold uppercase tracking-wide text-white">
                {config.label}
              </span>
            </div>

            {/* Grade badge */}
            {score !== null && (
              <Badge variant="outline" className="mt-1 text-[10px] border-slate-600 text-slate-400">
                {getScoreGrade(score)}
              </Badge>
            )}

            {/* Weakest link indicator */}
            {isWeakest && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <AlertTriangle className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-medium">{config.subtitle}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function GhostLab4BScorecard({
  brainScore,
  bodyScore,
  batScore,
  ballScore,
  compositeScore,
  weakestLink,
  leaks,
}: GhostLab4BScorecardProps) {
  const grade = compositeScore !== null ? getScoreGrade(compositeScore) : null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-slate-900 to-slate-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">
            4B Scout Card
          </CardTitle>
          <Badge className="bg-primary text-white text-[10px]">
            20-80 SCALE
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Composite Score Hero */}
        <div className="text-center py-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
            Overall Swing Grade
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className={cn(
              "text-6xl font-black",
              compositeScore !== null ? getScoreColor(compositeScore) : 'text-slate-500'
            )}>
              {compositeScore !== null ? Math.round(compositeScore) : '—'}
            </span>
          </div>
          {grade && (
            <Badge className="mt-2 bg-slate-700 text-white">
              {grade}
            </Badge>
          )}
        </div>

        {/* 4B Grid */}
        <div className="grid grid-cols-2 gap-3">
          <ScoreGauge 
            score={brainScore} 
            category="brain" 
            isWeakest={weakestLink?.toLowerCase() === 'brain'}
          />
          <ScoreGauge 
            score={bodyScore} 
            category="body" 
            isWeakest={weakestLink?.toLowerCase() === 'body'}
          />
          <ScoreGauge 
            score={batScore} 
            category="bat" 
            isWeakest={weakestLink?.toLowerCase() === 'bat'}
          />
          <ScoreGauge 
            score={ballScore} 
            category="ball" 
            isWeakest={weakestLink?.toLowerCase() === 'ball'}
          />
        </div>

        {/* Leak Alert */}
        {weakestLink && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-white">
                Focus Area: <span className="text-primary uppercase">{weakestLink}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {weakestLink.toLowerCase() === 'brain' && "Work on swing consistency - your timing varies too much"}
              {weakestLink.toLowerCase() === 'body' && "Use your legs more - power starts from the ground"}
              {weakestLink.toLowerCase() === 'bat' && "Energy is leaking before it reaches the barrel"}
              {weakestLink.toLowerCase() === 'ball' && "Focus on squaring the ball up more consistently"}
            </p>
          </div>
        )}

        {/* Detected Leaks */}
        {leaks && leaks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Detected Leaks</p>
            <div className="flex flex-wrap gap-2">
              {leaks.map((leak, i) => (
                <Badge 
                  key={i}
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    leak.severity === 'severe' && "border-red-500 text-red-400",
                    leak.severity === 'moderate' && "border-orange-500 text-orange-400",
                    leak.severity === 'mild' && "border-yellow-500 text-yellow-400"
                  )}
                >
                  {leak.type}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
