/**
 * Barrel Score Gauge - GOATY-inspired circular score display
 */
import { cn } from "@/lib/utils";

interface BarrelScoreGaugeProps {
  score: number;
  previousScore?: number | null;
  grade?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BarrelScoreGauge({ 
  score, 
  previousScore, 
  grade,
  size = 'lg' 
}: BarrelScoreGaugeProps) {
  const delta = previousScore !== null && previousScore !== undefined 
    ? score - previousScore 
    : null;

  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-28 h-28',
    lg: 'w-36 h-36',
  };

  const textSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  // Calculate stroke dasharray for the progress ring
  const radius = size === 'lg' ? 60 : size === 'md' ? 48 : 36;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score / 100, 0), 1);
  const strokeDashoffset = circumference * (1 - progress);

  // Color based on score
  const getScoreColor = () => {
    if (score >= 60) return 'stroke-emerald-500';
    if (score >= 45) return 'stroke-primary';
    if (score >= 30) return 'stroke-amber-500';
    return 'stroke-red-500';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", sizeClasses[size])}>
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
            className="opacity-30"
          />
          {/* Progress arc */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            className={cn("transition-all duration-700 ease-out", getScoreColor())}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-black", textSizes[size])}>
            {score || '--'}
          </span>
          {grade && (
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {grade}
            </span>
          )}
        </div>
      </div>

      {/* Delta text */}
      {delta !== null && (
        <div className="text-sm text-center">
          <span className="text-muted-foreground">Last: {previousScore} • </span>
          <span className={cn(
            "font-semibold",
            delta > 0 ? "text-emerald-500" : delta < 0 ? "text-red-500" : "text-muted-foreground"
          )}>
            {delta > 0 ? '+' : ''}{delta} pts
          </span>
        </div>
      )}
    </div>
  );
}
