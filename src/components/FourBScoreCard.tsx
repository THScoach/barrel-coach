import { Brain, Activity, Zap, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

const categoryConfig = {
  brain: { 
    label: 'BRAIN', 
    subtitle: 'Timing, Sync, Pattern Recognition',
    icon: Brain, 
    color: 'text-blue-500', 
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-500/10'
  },
  body: { 
    label: 'BODY', 
    subtitle: 'Ground-Up Sequencing, Force Creation',
    icon: Activity, 
    color: 'text-green-500', 
    bg: 'bg-green-500',
    bgLight: 'bg-green-500/10'
  },
  bat: { 
    label: 'BAT', 
    subtitle: 'Barrel Control, Transfer Efficiency',
    icon: Zap, 
    color: 'text-accent', 
    bg: 'bg-accent',
    bgLight: 'bg-accent/10'
  },
  ball: { 
    label: 'BALL', 
    subtitle: 'Contact Quality, Exit Velocity',
    icon: Target, 
    color: 'text-orange-500', 
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-500/10'
  }
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

  return (
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
          const isWeakest = weakestCategory === category;

          return (
            <div 
              key={category} 
              className={`p-6 text-center ${isWeakest ? 'bg-amber-500/5 ring-2 ring-inset ring-amber-500' : 'bg-card'}`}
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
              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {config.subtitle}
              </div>
              {isWeakest && (
                <Badge className="mt-2 bg-amber-500/20 text-amber-600 border-amber-500/30">
                  ⚠️ Weakest Link
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall Score */}
      <div className="p-6 bg-surface border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Overall Score</div>
            {grade && (
              <Badge variant="outline" className="mt-1">
                {grade}
              </Badge>
            )}
          </div>
          <div className="text-right">
            <span className={`text-5xl font-bold ${getScoreColor(compositeScore)}`}>
              {formatScore(compositeScore)}
            </span>
            <span className="text-muted-foreground text-lg">/100</span>
          </div>
        </div>
      </div>

      {/* Priority Issue */}
      {weakestCategory && primaryProblem && (
        <div className="p-6 bg-amber-500/10 border-t border-amber-500/20">
          <div className="flex items-start gap-3">
            <div className="bg-amber-500/20 rounded-full p-2 flex-shrink-0">
              <Target className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="font-bold text-amber-700 dark:text-amber-500">
                Priority Fix: {weakestCategory.toUpperCase()}
              </div>
              <div className="text-sm text-amber-600/80 dark:text-amber-400/80">
                {primaryProblem.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
