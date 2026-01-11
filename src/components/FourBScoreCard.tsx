import { Brain, Activity, Zap, Target, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FourBScoreCardProps {
  brainScore: number | null;
  bodyScore: number | null;
  batScore: number | null;
  ballScore: number | null;
  compositeScore: number | null;
  grade: string | null;
  weakestCategory: string | null;
  primaryProblem?: string | null;
}

// Coach Rick language for 4B categories
const categoryConfig = {
  brain: { 
    label: 'BRAIN', 
    subtitle: 'How repeatable your swing is.',
    tooltip: 'Same move, swing after swing.',
    icon: Brain, 
    color: 'text-blue-500', 
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-500/10'
  },
  body: { 
    label: 'BODY', 
    subtitle: 'How well you use the ground and sequence up.',
    tooltip: 'This is where power starts.',
    icon: Activity, 
    color: 'text-green-500', 
    bg: 'bg-green-500',
    bgLight: 'bg-green-500/10'
  },
  bat: { 
    label: 'BAT', 
    subtitle: 'How much energy makes it to the barrel.',
    tooltip: 'Good swings send it. Weak ones leak it.',
    icon: Zap, 
    color: 'text-accent', 
    bg: 'bg-accent',
    bgLight: 'bg-accent/10'
  },
  ball: { 
    label: 'BALL', 
    subtitle: 'How clean your contact is.',
    tooltip: 'Miss-hits live here.',
    icon: Target, 
    color: 'text-orange-500', 
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-500/10'
  }
};

// Coach Rick grade labels (no "poor", "bad", or "failing")
const getGradeLabel = (score: number | null): string => {
  if (score === null) return '';
  if (score >= 70) return 'HIGH-LEVEL';
  if (score >= 60) return 'STRONG';
  if (score >= 55) return 'ABOVE AVERAGE';
  if (score >= 45) return 'SOLID';
  if (score >= 40) return 'BELOW AVERAGE';
  if (score >= 30) return 'FRAGILE';
  return 'BROKEN';
};

// Weakest link display mapping (Coach Rick language)
const weakestLinkDisplay: Record<string, { label: string; explanation: string }> = {
  brain: {
    label: 'CONSISTENCY',
    explanation: 'Your swing changes too much from rep to rep.',
  },
  body: {
    label: 'GROUND & LEGS',
    explanation: "Your lower half isn't helping you enough.",
  },
  bat: {
    label: 'BARREL DELIVERY',
    explanation: "Energy isn't getting to the bat.",
  },
  ball: {
    label: 'CONTACT QUALITY',
    explanation: "You're not squaring it up enough.",
  },
};

const formatScore = (score: number | null) => {
  if (score === null) return '—';
  return Math.round(score);
};

const getScoreColor = (score: number | null) => {
  if (score === null) return 'text-muted-foreground';
  if (score >= 70) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-accent';
};

export function FourBScoreCard({
  brainScore,
  bodyScore,
  batScore,
  ballScore,
  compositeScore,
  grade,
  weakestCategory,
  primaryProblem,
}: FourBScoreCardProps) {
  const scores = {
    brain: brainScore,
    body: bodyScore,
    bat: batScore,
    ball: ballScore,
  };

  const gradeLabel = getGradeLabel(compositeScore);
  const weakestInfo = weakestCategory ? weakestLinkDisplay[weakestCategory.toLowerCase()] : null;

  return (
    <TooltipProvider>
      <div className="bg-card rounded-2xl shadow-card overflow-hidden border border-border">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-6 text-center">
          <h2 className="text-2xl font-bold mb-1">YOUR 4B SCORE CARD</h2>
          <p className="text-primary-foreground/70 text-sm">The 4B Hitting System™</p>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-2 gap-px bg-border">
          {(['brain', 'body', 'bat', 'ball'] as const).map(category => {
            const config = categoryConfig[category];
            const score = scores[category];
            const isWeakest = weakestCategory?.toLowerCase() === category;

            return (
              <Tooltip key={category}>
                <TooltipTrigger asChild>
                  <div 
                    className={`p-6 text-center cursor-help ${isWeakest ? 'bg-amber-500/5 ring-2 ring-inset ring-amber-500' : 'bg-card'}`}
                  >
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 ${config.bgLight}`}>
                      <config.icon className={`h-7 w-7 ${config.color}`} />
                    </div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      {config.label}
                    </div>
                    <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
                      {formatScore(score)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {config.subtitle}
                    </div>
                    {isWeakest && (
                      <Badge className="mt-2 bg-amber-500/20 text-amber-600 border-amber-500/30">
                        ⚠️ Focus Here
                      </Badge>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-sm">{config.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Overall Swing Grade */}
        <div className="p-6 bg-surface border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Overall Swing Grade</div>
              <div className="text-xs text-muted-foreground/70 mt-0.5">
                How well your swing turns effort into results.
              </div>
              {gradeLabel && (
                <Badge variant="outline" className="mt-2">
                  {gradeLabel}
                </Badge>
              )}
            </div>
            <div className="text-right">
              <span className={`text-5xl font-bold ${getScoreColor(compositeScore)}`}>
                {formatScore(compositeScore)}
              </span>
              <span className="text-muted-foreground text-lg">/80</span>
            </div>
          </div>
        </div>

        {/* What's Holding You Back */}
        {weakestInfo && (
          <div className="p-6 bg-amber-500/10 border-t border-amber-500/20">
            <div className="flex items-start gap-3">
              <div className="bg-amber-500/20 rounded-full p-2 flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="font-bold text-amber-700 dark:text-amber-500 mb-1">
                  What's Holding You Back
                </div>
                <Badge className="bg-amber-600 text-white border-0 mb-2">
                  {weakestInfo.label}
                </Badge>
                <div className="text-sm text-amber-600/90 dark:text-amber-400/90 mb-2">
                  {weakestInfo.explanation}
                </div>
                <div className="text-xs text-amber-700/70 dark:text-amber-300/70 font-medium italic">
                  Fix this first. Everything else improves faster.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
