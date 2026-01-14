import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KineticPotential } from '@/lib/report-types';
import { Zap } from 'lucide-react';

interface PotentialVsExpressionCardProps {
  potential: KineticPotential;
}

export function PotentialVsExpressionCard({ potential }: PotentialVsExpressionCardProps) {
  const { ceiling, current } = potential;
  const gap = ceiling - current;
  const expressionPct = (current / ceiling) * 100;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          Kinetic Potential
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ceiling Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Your Ceiling</span>
            <span className="text-white font-semibold">{ceiling}</span>
          </div>
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-yellow-500/50 to-yellow-400/80 rounded-full"
              style={{ width: `${ceiling}%` }}
            />
          </div>
        </div>

        {/* Current Expression Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Current Expression</span>
            <span className="text-white font-semibold">{current}</span>
          </div>
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full"
              style={{ width: `${current}%` }}
            />
          </div>
        </div>

        {/* Gap indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
            <span className="text-yellow-400 text-sm font-medium">
              +{gap} points to unlock
            </span>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-sm text-slate-400 text-center">
          Your body is capable of more than it's showing right now. We unlock it by fixing leaks.
        </p>
      </CardContent>
    </Card>
  );
}
