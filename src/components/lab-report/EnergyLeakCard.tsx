/**
 * Energy Leak Card - Where Power Is Going Instead of Into the Ball
 * Shows leak direction, magnitude, and what it causes
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, ArrowUp, ArrowDown, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import { EnergyLeakReport, LeakDirection } from '@/lib/lab-report-types';

interface EnergyLeakCardProps {
  energyLeak: EnergyLeakReport;
}

function getLeakIcon(direction: LeakDirection) {
  switch (direction) {
    case 'UP': return <ArrowUp className="h-5 w-5" />;
    case 'DOWN': return <ArrowDown className="h-5 w-5" />;
    case 'OUT': return <ArrowRight className="h-5 w-5" />;
    case 'IN': return <ArrowLeft className="h-5 w-5" />;
  }
}

function getLeakColor(direction: LeakDirection): string {
  switch (direction) {
    case 'UP': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    case 'DOWN': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
    case 'OUT': return 'text-red-400 bg-red-500/20 border-red-500/30';
    case 'IN': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
  }
}

function getLeakMeaning(direction: LeakDirection): string {
  switch (direction) {
    case 'UP': return 'Energy going vertical — popping up, early extension';
    case 'DOWN': return 'Energy going into ground — collapsing, no brace';
    case 'OUT': return 'Energy going away from body — casting, arm bar';
    case 'IN': return 'Energy staying in body — no release, muscling';
  }
}

export function EnergyLeakCard({ energyLeak }: EnergyLeakCardProps) {
  if (!energyLeak.present || !energyLeak.primary_leak) return null;

  const primaryLeak = energyLeak.primary_leak;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Zap className="h-4 w-4 text-slate-400" />
            Energy Leak Report
          </CardTitle>
          <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            LEAK DETECTED
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Leak Display */}
        <div className={`rounded-lg p-4 border ${getLeakColor(primaryLeak.direction)}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-full ${getLeakColor(primaryLeak.direction)}`}>
              {getLeakIcon(primaryLeak.direction)}
            </div>
            <div>
              <div className="text-lg font-bold text-white">
                Energy Leaking {primaryLeak.direction}
              </div>
              <div className="text-sm text-slate-400">
                Source: {primaryLeak.source}
              </div>
            </div>
          </div>
          
          <div className="text-xs text-slate-500 mb-2">
            {getLeakMeaning(primaryLeak.direction)}
          </div>
        </div>

        {/* Loss Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {primaryLeak.lost_bat_speed_mph !== undefined && (
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">
                ~{primaryLeak.lost_bat_speed_mph} mph
              </div>
              <div className="text-xs text-slate-500">Bat Speed Lost</div>
            </div>
          )}
          {primaryLeak.lost_exit_velo_mph !== undefined && (
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">
                ~{primaryLeak.lost_exit_velo_mph} mph
              </div>
              <div className="text-xs text-slate-500">Exit Velo Impact</div>
            </div>
          )}
        </div>

        {/* What it causes */}
        {primaryLeak.cause && (
          <div className="space-y-2">
            <div className="text-sm text-slate-400">
              <span className="font-medium text-slate-300">WHAT IT CAUSES: </span>
              {primaryLeak.cause}
            </div>
          </div>
        )}

        {/* The Feel */}
        {primaryLeak.feel_description && (
          <div className="bg-slate-800/30 rounded-lg p-3 border-l-2 border-orange-500">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">THE FEEL</div>
            <p className="text-sm text-slate-200 italic">
              "{primaryLeak.feel_description}"
            </p>
          </div>
        )}

        {/* Potential Unlocked */}
        {energyLeak.potential_unlocked_mph !== undefined && (
          <div className="bg-teal-500/10 rounded-lg p-3 border border-teal-500/20 text-center">
            <div className="text-xs text-teal-400 uppercase tracking-wide mb-1">Potential to Unlock</div>
            <div className="text-2xl font-bold text-teal-400">
              +{energyLeak.potential_unlocked_mph} mph
            </div>
            <div className="text-xs text-slate-500">Available bat speed if leak is fixed</div>
          </div>
        )}

        {/* Player-Facing Summary */}
        {energyLeak.summary && (
          <p className="text-sm text-slate-300 leading-relaxed">
            {energyLeak.summary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
