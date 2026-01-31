/**
 * 4B Scoreboard v2.0 - Lab Report Style
 * Dark mode with score-specific left-border colors
 */

import { Card, CardContent } from '@/components/ui/card';
import { Brain, Activity, Zap, Target } from 'lucide-react';
import { FourBScores, getScoreRating, ScoreRating } from '@/lib/lab-report-types';

interface FourBScoreboardV2Props {
  scores: FourBScores;
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#4ecdc4'; // teal
  if (score >= 50) return '#ffa500'; // orange
  return '#ff6b6b'; // coral red
}

function getBorderClass(score: number): string {
  if (score >= 70) return 'border-l-teal-500';
  if (score >= 50) return 'border-l-orange-500';
  return 'border-l-red-500';
}

function getGradeLabel(score: number): string {
  if (score >= 80) return 'Elite';
  if (score >= 70) return 'Plus-Plus';
  if (score >= 65) return 'Plus';
  if (score >= 60) return 'Above Avg';
  if (score >= 55) return 'Average';
  if (score >= 50) return 'Fringe';
  if (score >= 45) return 'Below Avg';
  return 'Needs Work';
}

function ScoreTile({ 
  label, 
  score, 
  delta,
  icon: Icon 
}: { 
  label: string; 
  score: number; 
  delta?: number;
  icon: React.ElementType;
}) {
  const borderClass = getBorderClass(score);
  const scoreColor = getScoreColor(score);

  return (
    <div className={`bg-slate-800 rounded-lg p-3 border-l-4 ${borderClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
        </div>
        {delta !== undefined && delta !== 0 && (
          <span className={`text-xs font-medium ${delta > 0 ? 'text-teal-400' : 'text-red-400'}`}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span 
          className="text-2xl font-bold"
          style={{ color: scoreColor }}
        >
          {Math.round(score)}
        </span>
        <span className="text-xs text-slate-500">{getGradeLabel(score)}</span>
      </div>
    </div>
  );
}

export function FourBScoreboardV2({ scores }: FourBScoreboardV2Props) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4 space-y-4">
        {/* Composite Score - Hero Display */}
        <div className="text-center py-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Composite Score</div>
          <div 
            className="text-5xl font-bold"
            style={{ color: getScoreColor(scores.composite) }}
          >
            {Math.round(scores.composite)}
          </div>
          <div className="text-sm text-slate-400 mt-1">{getGradeLabel(scores.composite)}</div>
          {scores.deltas?.composite !== undefined && scores.deltas.composite !== 0 && (
            <div className={`text-sm font-medium mt-2 ${scores.deltas.composite > 0 ? 'text-teal-400' : 'text-red-400'}`}>
              {scores.deltas.composite > 0 ? '↑' : '↓'} {Math.abs(scores.deltas.composite).toFixed(1)} from last session
            </div>
          )}
        </div>

        {/* 4B Grid */}
        <div className="grid grid-cols-2 gap-3">
          <ScoreTile 
            label="Brain" 
            score={scores.brain} 
            delta={scores.deltas?.brain}
            icon={Brain} 
          />
          <ScoreTile 
            label="Body" 
            score={scores.body} 
            delta={scores.deltas?.body}
            icon={Activity} 
          />
          <ScoreTile 
            label="Bat" 
            score={scores.bat} 
            delta={scores.deltas?.bat}
            icon={Zap} 
          />
          <ScoreTile 
            label="Ball" 
            score={scores.ball} 
            delta={scores.deltas?.ball}
            icon={Target} 
          />
        </div>

        {/* Scout Scale Reference */}
        <div className="flex justify-center gap-4 text-xs text-slate-500 pt-2">
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span> &lt;50</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1"></span> 50-69</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-teal-500 mr-1"></span> 70+</span>
        </div>
      </CardContent>
    </Card>
  );
}
