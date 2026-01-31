/**
 * Entry Angle Card - Bat Path Analysis
 * Shows how the barrel enters the hitting zone
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { EntryAngleAnalysis, EntryAngleStatus } from '@/lib/lab-report-types';

interface EntryAngleCardProps {
  entryAngle: EntryAngleAnalysis;
}

function getStatusColor(status: EntryAngleStatus): string {
  switch (status) {
    case 'optimal_uppercut': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    case 'flat': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'steep': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'chop': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'too_steep': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

function getStatusLabel(status: EntryAngleStatus): string {
  switch (status) {
    case 'optimal_uppercut': return 'OPTIMAL';
    case 'flat': return 'FLAT';
    case 'steep': return 'STEEP';
    case 'chop': return 'CHOP';
    case 'too_steep': return 'TOO STEEP';
  }
}

function getAngleColor(status: EntryAngleStatus): string {
  switch (status) {
    case 'optimal_uppercut': return 'text-teal-400';
    case 'flat': return 'text-orange-400';
    case 'steep': return 'text-yellow-400';
    case 'chop': return 'text-red-400';
    case 'too_steep': return 'text-red-400';
    default: return 'text-white';
  }
}

export function EntryAngleCard({ entryAngle }: EntryAngleCardProps) {
  if (!entryAngle.present) return null;

  const status = entryAngle.entry_angle_status || 'flat';
  const angle = entryAngle.entry_angle_deg || 0;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            Entry Angle
          </CardTitle>
          <Badge variant="outline" className={getStatusColor(status)}>
            {getStatusLabel(status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Angle Display */}
        <div className="bg-slate-800/50 rounded-lg p-4 text-center">
          <div className={`text-4xl font-bold ${getAngleColor(status)}`}>
            {angle > 0 ? '+' : ''}{angle.toFixed(0)}°
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {angle > 0 ? 'Below Horizontal (Uppercut)' : angle < 0 ? 'Above Horizontal (Chop)' : 'Flat'}
          </div>
        </div>

        {/* Visual Representation */}
        <div className="relative bg-slate-800/30 rounded-lg p-4 h-20">
          <div className="absolute inset-x-4 top-1/2 h-0.5 bg-slate-600" /> {/* Horizontal reference */}
          
          {/* Angle indicator */}
          <div 
            className={`absolute left-1/2 top-1/2 w-16 h-0.5 origin-left ${status === 'optimal_uppercut' ? 'bg-teal-500' : status === 'flat' ? 'bg-orange-500' : 'bg-red-500'}`}
            style={{ 
              transform: `translateY(-50%) rotate(${-angle}deg)`,
            }}
          />
          
          {/* Labels */}
          <div className="absolute bottom-1 left-4 text-xs text-slate-500">Ground balls</div>
          <div className="absolute bottom-1 right-4 text-xs text-teal-400">Line drives</div>
        </div>

        {/* Zone Reference */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className={`rounded p-2 ${status === 'chop' ? 'bg-red-500/20 border border-red-500/30' : 'bg-slate-800/30'}`}>
            <div className="text-slate-400">&lt;0°</div>
            <div className="text-slate-500">Chop</div>
          </div>
          <div className={`rounded p-2 ${status === 'optimal_uppercut' ? 'bg-teal-500/20 border border-teal-500/30' : 'bg-slate-800/30'}`}>
            <div className="text-teal-400">8-15°</div>
            <div className="text-slate-500">Optimal</div>
          </div>
          <div className={`rounded p-2 ${status === 'too_steep' ? 'bg-red-500/20 border border-red-500/30' : 'bg-slate-800/30'}`}>
            <div className="text-slate-400">&gt;22°</div>
            <div className="text-slate-500">Too Steep</div>
          </div>
        </div>

        {/* Player-Facing Summary */}
        {entryAngle.summary && (
          <div className="bg-slate-800/30 rounded-lg p-3 border-l-2 border-orange-500">
            <p className="text-sm text-slate-200 leading-relaxed">
              {entryAngle.summary}
            </p>
          </div>
        )}

        {/* Fix Explanation */}
        {entryAngle.fix_explanation && (
          <div className="text-sm text-slate-400">
            <span className="font-medium text-slate-300">Elite model: </span>
            {entryAngle.fix_explanation}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
