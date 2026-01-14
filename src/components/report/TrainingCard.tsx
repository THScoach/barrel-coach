import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Drill } from '@/lib/report-types';
import { DrillCard } from './DrillCard';
import { Dumbbell } from 'lucide-react';

interface TrainingCardProps {
  drills: Drill[];
}

export function TrainingCard({ drills }: TrainingCardProps) {
  if (drills.length === 0) return null;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-primary" />
          This Week's Work
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {drills.slice(0, 3).map((drill) => (
            <DrillCard key={drill.id} drill={drill} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
