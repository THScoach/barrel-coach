import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FixOrderItem } from '@/lib/report-types';
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FixOrderChecklistProps {
  items: FixOrderItem[];
  doNotChase: string[];
}

export function FixOrderChecklist({ items, doNotChase }: FixOrderChecklistProps) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide">
          Fix Order (Do These In Order)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Checklist items */}
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg transition-colors',
                item.completed ? 'bg-green-500/10' : 'bg-slate-800/50'
              )}
            >
              <div className="mt-0.5">
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-500" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">#{index + 1}</span>
                  <h4 className={cn(
                    'font-semibold',
                    item.completed ? 'text-green-400' : 'text-white'
                  )}>
                    {item.label}
                  </h4>
                </div>
                <p className="text-sm text-slate-400 italic">
                  "{item.feel_cue}"
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Do NOT chase box */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-yellow-400 font-medium">Do NOT chase:</p>
              <p className="text-sm text-slate-400">
                {doNotChase.join(', ')}. Fix the foundation first.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
