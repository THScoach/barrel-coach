import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FourBScoreData } from '@/lib/report-types';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScoreboardCardProps {
  scores: FourBScoreData;
}

const scoreCategories = [
  { key: 'body', label: 'BODY', color: 'bg-blue-500' },
  { key: 'brain', label: 'BRAIN', color: 'bg-purple-500' },
  { key: 'bat', label: 'BAT', color: 'bg-orange-500' },
  { key: 'ball', label: 'BALL', color: 'bg-green-500' },
] as const;

function DeltaBadge({ delta }: { delta?: number }) {
  if (delta === undefined) return null;
  
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium ml-2',
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

function getScoreGrade(score: number): string {
  if (score >= 80) return 'Elite';
  if (score >= 70) return 'Plus';
  if (score >= 60) return 'Above Avg';
  if (score >= 50) return 'Average';
  if (score >= 40) return 'Below Avg';
  return 'Developing';
}

export function ScoreboardCard({ scores }: ScoreboardCardProps) {
  const { composite, deltas } = scores;
  const grade = getScoreGrade(composite);

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide">
          Your Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hero Composite Score */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary flex items-center justify-center">
              <div>
                <span className="text-4xl font-bold text-white">{composite}</span>
                <DeltaBadge delta={deltas?.composite} />
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-2">{grade}</p>
        </div>

        {/* Sub-scores */}
        <div className="space-y-3">
          {scoreCategories.map(({ key, label, color }) => {
            const score = scores[key];
            const delta = deltas?.[key];
            
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 font-medium">{label}</span>
                  <div className="flex items-center">
                    <span className="text-white font-semibold">{score}</span>
                    <DeltaBadge delta={delta} />
                  </div>
                </div>
                <Progress 
                  value={score} 
                  className="h-2 bg-slate-800"
                  // @ts-ignore - custom indicator color
                  indicatorClassName={color}
                />
              </div>
            );
          })}
        </div>

        {/* Caption */}
        <p className="text-xs text-slate-500 text-center italic">
          Scores go up by fixing leaks — not by swinging harder.
        </p>
      </CardContent>
    </Card>
  );
}
