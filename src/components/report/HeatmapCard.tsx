import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SquareUpWindow } from '@/lib/report-types';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeatmapCardProps {
  data: SquareUpWindow;
}

function getHeatColor(value: number): string {
  if (value >= 75) return 'bg-green-500';
  if (value >= 50) return 'bg-yellow-500';
  if (value >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

function getHeatOpacity(value: number): string {
  if (value >= 75) return 'opacity-90';
  if (value >= 50) return 'opacity-70';
  if (value >= 30) return 'opacity-50';
  return 'opacity-30';
}

export function HeatmapCard({ data }: HeatmapCardProps) {
  if (!data.present || !data.grid) return null;

  const { grid, bestZone, avoidZone, coachNote } = data;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Square-Up Window
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Heatmap grid */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Strike zone outline */}
            <div className="border-2 border-slate-600 rounded p-1 bg-slate-800/30">
              <div className="grid grid-cols-3 gap-1">
                {grid.map((row, rowIndex) =>
                  row.map((value, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={cn(
                        'w-12 h-12 rounded flex items-center justify-center text-xs font-bold text-white',
                        getHeatColor(value),
                        getHeatOpacity(value)
                      )}
                    >
                      {value}%
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Zone labels */}
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Inside</span>
            </div>
            <div className="absolute -right-8 top-1/2 -translate-y-1/2 -rotate-90">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Outside</span>
            </div>
            <div className="absolute top-[-18px] left-1/2 -translate-x-1/2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Up</span>
            </div>
            <div className="absolute bottom-[-18px] left-1/2 -translate-x-1/2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Down</span>
            </div>
          </div>
        </div>

        {/* Zone callouts */}
        <div className="flex justify-center gap-4 text-sm">
          {bestZone && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-sm" />
              <span className="text-slate-300">Best: {bestZone}</span>
            </div>
          )}
          {avoidZone && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-sm opacity-50" />
              <span className="text-slate-300">Avoid: {avoidZone}</span>
            </div>
          )}
        </div>

        {/* Coach note */}
        {coachNote && (
          <p className="text-sm text-slate-400 text-center italic">
            {coachNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
