import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeaponPanel } from '@/lib/report-types';
import { Gauge } from 'lucide-react';

/** Props exclude 'present' - parent handles visibility check */
interface MetricsChipsPanelProps {
  data: Omit<WeaponPanel, 'present'>;
}

export function MetricsChipsPanel({ data }: MetricsChipsPanelProps) {
  // Parent already checks isPresent() - only check for required data
  if (!data.metrics || data.metrics.length === 0) return null;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          Swing Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {data.metrics.map((metric, index) => (
            <div
              key={index}
              className="bg-slate-800/50 rounded-lg p-3 text-center"
            >
              <div className="text-2xl font-bold text-white">{metric.value}</div>
              <div className="text-sm font-medium text-slate-300 mt-1">{metric.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{metric.meaning}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
