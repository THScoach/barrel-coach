/**
 * Kinetic Fingerprint Score Card - Section 2
 * 6-component breakdown with gaps to elite
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { KineticFingerprintResult, ComponentScore } from '@/lib/kinetic-fingerprint-score';
import { Fingerprint, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { COMPONENT_WEIGHTS } from '@/lib/kinetic-fingerprint-score';

interface KineticFingerprintScoreCardProps {
  kfScore: KineticFingerprintResult;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-teal-400';
  if (score >= 60) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-teal-500';
  if (score >= 60) return 'bg-orange-500';
  return 'bg-red-500';
}

function getProgressColor(score: number): string {
  if (score >= 80) return 'bg-teal-500';
  if (score >= 60) return 'bg-orange-500';
  return 'bg-red-500';
}

function GapIndicator({ score }: { score: number }) {
  const gap = 100 - score;
  if (gap <= 0) {
    return (
      <span className="text-xs text-teal-400 flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />
        Elite
      </span>
    );
  }
  if (gap <= 15) {
    return (
      <span className="text-xs text-slate-400 flex items-center gap-1">
        <Minus className="h-3 w-3" />
        -{gap}
      </span>
    );
  }
  return (
    <span className="text-xs text-orange-400 flex items-center gap-1">
      <TrendingDown className="h-3 w-3" />
      -{gap}
    </span>
  );
}

function ComponentRow({ 
  label, 
  component, 
  eliteTarget,
  weight 
}: { 
  label: string; 
  component: ComponentScore; 
  eliteTarget: string;
  weight: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-300">{label}</span>
          <span className="text-xs text-slate-500">({Math.round(weight * 100)}%)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            You: <span className="text-slate-300">{component.value}</span>
          </span>
          <span className={cn('font-semibold tabular-nums', getScoreColor(component.score))}>
            {component.score}
          </span>
          <GapIndicator score={component.score} />
        </div>
      </div>
      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={cn('h-full rounded-full transition-all duration-500', getProgressColor(component.score))}
          style={{ width: `${component.score}%` }}
        />
        {/* Elite marker at 90% */}
        <div className="absolute right-[10%] top-0 h-full w-0.5 bg-slate-600" />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{component.rating}</span>
        <span>Elite: {eliteTarget}</span>
      </div>
    </div>
  );
}

export function KineticFingerprintScoreCard({ kfScore }: KineticFingerprintScoreCardProps) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
          <Fingerprint className="h-4 w-4" />
          KINETIC FINGERPRINT SCORE
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Total Score Display */}
        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div>
            <div className="text-3xl font-bold text-white">
              {kfScore.total}
              <span className="text-lg text-slate-500 font-normal"> / 100</span>
            </div>
            <div className={cn('text-sm font-medium', getScoreColor(kfScore.total))}>
              {kfScore.rating}
            </div>
          </div>
          
          {/* Visual gauge */}
          <div className="relative w-24 h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                className="text-slate-700"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                className={getScoreColor(kfScore.total).replace('text-', 'text-')}
                strokeWidth="3"
                strokeDasharray={`${kfScore.total}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-white">{kfScore.total}</span>
            </div>
          </div>
        </div>
        
        {/* Component Breakdown */}
        <div className="space-y-4">
          <ComponentRow 
            label="Transfer Ratio"
            component={kfScore.components.transfer_ratio}
            eliteTarget={COMPONENT_WEIGHTS.transfer_ratio.elite}
            weight={COMPONENT_WEIGHTS.transfer_ratio.weight}
          />
          
          <ComponentRow 
            label="Timing Gap"
            component={kfScore.components.timing_gap}
            eliteTarget={COMPONENT_WEIGHTS.timing_gap.elite}
            weight={COMPONENT_WEIGHTS.timing_gap.weight}
          />
          
          <ComponentRow 
            label="Deceleration"
            component={kfScore.components.deceleration}
            eliteTarget={COMPONENT_WEIGHTS.deceleration.elite}
            weight={COMPONENT_WEIGHTS.deceleration.weight}
          />
          
          <ComponentRow 
            label="Sequence Order"
            component={kfScore.components.sequence_order}
            eliteTarget={COMPONENT_WEIGHTS.sequence_order.elite}
            weight={COMPONENT_WEIGHTS.sequence_order.weight}
          />
          
          <ComponentRow 
            label="Energy Delivery"
            component={kfScore.components.energy_delivery}
            eliteTarget={COMPONENT_WEIGHTS.energy_delivery.elite}
            weight={COMPONENT_WEIGHTS.energy_delivery.weight}
          />
          
          <ComponentRow 
            label="X-Factor"
            component={kfScore.components.x_factor}
            eliteTarget={COMPONENT_WEIGHTS.x_factor.elite}
            weight={COMPONENT_WEIGHTS.x_factor.weight}
          />
        </div>
        
        {/* Generated Flags */}
        {kfScore.flags.length > 0 && (
          <div className="pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-2">Detected Issues:</p>
            <div className="flex flex-wrap gap-2">
              {kfScore.flags.map(flag => (
                <span 
                  key={flag}
                  className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded border border-red-500/20"
                >
                  {flag.replace('flag_', '').replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
