import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarrelSlingPanel } from '@/lib/report-types';
import { Target, CheckCircle, AlertCircle } from 'lucide-react';

interface BarrelSlingCardProps {
  data: BarrelSlingPanel;
}

const scoreCategories = [
  { key: 'sling_load_score', label: 'Load', color: 'from-blue-500 to-blue-400' },
  { key: 'sling_start_score', label: 'Start', color: 'from-purple-500 to-purple-400' },
  { key: 'sling_deliver_score', label: 'Deliver', color: 'from-green-500 to-green-400' },
] as const;

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Elite';
  if (score >= 70) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Average';
  return 'Needs Work';
}

export function BarrelSlingCard({ data }: BarrelSlingCardProps) {
  const {
    barrel_sling_score = 0,
    sling_load_score = 0,
    sling_start_score = 0,
    sling_deliver_score = 0,
    notes,
    confidence = 'estimate',
  } = data;

  const scores = {
    sling_load_score,
    sling_start_score,
    sling_deliver_score,
  };

  const isEstimate = confidence === 'estimate';

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Barrel Sling Index
          </CardTitle>
          {isEstimate && (
            <span className="text-xs text-yellow-400/80 bg-yellow-500/10 px-2 py-0.5 rounded">
              Estimate
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Load it. Start it. Deliver it.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall BSI Score */}
        <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
          <div>
            <div className="text-2xl font-bold text-white">{Math.round(barrel_sling_score)}</div>
            <div className="text-xs text-slate-400">{getScoreLabel(barrel_sling_score)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Overall BSI</div>
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${barrel_sling_score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Individual Score Bars */}
        <div className="space-y-3">
          {scoreCategories.map(({ key, label, color }) => {
            const score = scores[key];
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 font-medium">{label}</span>
                  <span className="text-white font-semibold">{Math.round(score)}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Coaching Notes */}
        {notes && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            {notes.good && (
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-300">{notes.good}</p>
              </div>
            )}
            {notes.leak && (
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-400">{notes.leak}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
