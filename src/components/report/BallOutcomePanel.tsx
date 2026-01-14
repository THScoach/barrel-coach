import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BallPanel } from '@/lib/report-types';
import { CircleDot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Props exclude 'present' - parent handles visibility check */
interface BallOutcomePanelProps {
  data: Omit<BallPanel, 'present'>;
}

export function BallOutcomePanel({ data }: BallOutcomePanelProps) {
  // Parent already checks isPresent() - only check for required data
  if (!data.outcomes || data.outcomes.length === 0) return null;

  // Nested present check for projected data (contract allows this pattern)
  const isProjected = data.projected?.present;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <CircleDot className="h-4 w-4 text-green-400" />
          Ball Outcomes
          {isProjected && (
            <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
              Projected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {data.outcomes.map((outcome, index) => (
            <div
              key={index}
              className="bg-slate-800/50 rounded-lg p-3 text-center"
            >
              <div className="text-2xl font-bold text-white">
                {outcome.value}
                {outcome.unit && (
                  <span className="text-sm text-slate-400 ml-0.5">{outcome.unit}</span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1">{outcome.name}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
