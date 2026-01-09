import { cn } from '@/lib/utils';

interface ScoreCircleProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  grade?: string;
  variant?: 'default' | 'accent';
}

function getGrade(score: number): string {
  if (score >= 80) return 'Elite';
  if (score >= 70) return 'Excellent';
  if (score >= 60) return 'Above Avg';
  if (score >= 50) return 'Average';
  if (score >= 40) return 'Below Avg';
  return 'Needs Work';
}

const sizeClasses = {
  sm: 'w-20 h-20',
  md: 'w-32 h-32',
  lg: 'w-44 h-44',
};

const scoreSizeClasses = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-6xl',
};

const gradeSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function ScoreCircle({ 
  score, 
  size = 'lg', 
  grade,
  variant = 'default' 
}: ScoreCircleProps) {
  const displayGrade = grade || getGrade(score);

  return (
    <div 
      className={cn(
        'score-circle flex-col gap-1',
        sizeClasses[size],
        variant === 'accent' && 'score-circle-accent'
      )}
    >
      <span className={cn(
        'font-bold text-white',
        scoreSizeClasses[size]
      )}>
        {Math.round(score)}
      </span>
      <span className={cn(
        'text-white/80 font-medium',
        gradeSizeClasses[size]
      )}>
        {displayGrade}
      </span>
    </div>
  );
}
