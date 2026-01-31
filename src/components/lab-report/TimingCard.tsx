/**
 * Timing Analysis Card - Kinematic Sequence
 * Shows segment firing order, timing gaps, and deceleration status
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { TimingAnalysis } from '@/lib/lab-report-types';

interface TimingCardProps {
  timing: TimingAnalysis;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'elite': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    case 'good': return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
    case 'simultaneous': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'over_separated': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'out_of_order': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'elite': return 'ELITE SEQUENCE';
    case 'good': return 'GOOD SEQUENCE';
    case 'simultaneous': return '⚠️ SIMULTANEOUS FIRING';
    case 'over_separated': return '⚠️ OVER-SEPARATED';
    case 'out_of_order': return '❌ OUT OF ORDER';
    default: return status.toUpperCase();
  }
}

export function TimingCard({ timing }: TimingCardProps) {
  if (!timing.present) return null;

  const hasGoodBraking = timing.all_braking_elite;
  const mainGap = timing.pelvis_torso_gap_pct;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            Timing Analysis
          </CardTitle>
          {timing.sequence_status && (
            <Badge 
              variant="outline" 
              className={getStatusColor(timing.sequence_status)}
            >
              {getStatusLabel(timing.sequence_status)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sequence Timeline */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Ideal Sequence</span>
            <span className="text-xs text-slate-500">Pelvis → Torso → Arms → Bat</span>
          </div>
          
          {/* Timing Gap Display */}
          {mainGap !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Pelvis-Torso Gap</span>
                <span className={`text-lg font-bold ${mainGap >= 14 && mainGap <= 18 ? 'text-teal-400' : mainGap < 5 ? 'text-orange-400' : 'text-yellow-400'}`}>
                  {mainGap.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${mainGap >= 14 && mainGap <= 18 ? 'bg-teal-500' : mainGap < 5 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                  style={{ width: `${Math.min(100, (mainGap / 25) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Too Fast ({"<"}5%)</span>
                <span className="text-teal-400">Elite (14-18%)</span>
                <span>Over ({">"}22%)</span>
              </div>
            </div>
          )}
        </div>

        {/* Deceleration Status */}
        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-lg p-2 text-center ${timing.pelvis_decelerates ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            {timing.pelvis_decelerates ? (
              <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-teal-400" />
            ) : (
              <XCircle className="h-4 w-4 mx-auto mb-1 text-red-400" />
            )}
            <div className="text-xs text-slate-300">Pelvis Brake</div>
          </div>
          <div className={`rounded-lg p-2 text-center ${timing.torso_decelerates ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            {timing.torso_decelerates ? (
              <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-teal-400" />
            ) : (
              <XCircle className="h-4 w-4 mx-auto mb-1 text-red-400" />
            )}
            <div className="text-xs text-slate-300">Torso Brake</div>
          </div>
          <div className={`rounded-lg p-2 text-center ${timing.arms_decelerates ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            {timing.arms_decelerates ? (
              <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-teal-400" />
            ) : (
              <XCircle className="h-4 w-4 mx-auto mb-1 text-red-400" />
            )}
            <div className="text-xs text-slate-300">Arms Brake</div>
          </div>
        </div>

        {/* Player-Facing Summary */}
        {timing.summary && (
          <div className="bg-slate-800/30 rounded-lg p-3 border-l-2 border-orange-500">
            <p className="text-sm text-slate-200 leading-relaxed">
              {timing.summary}
            </p>
          </div>
        )}

        {/* Fix Explanation */}
        {timing.fix_explanation && (
          <div className="text-sm text-slate-400">
            <span className="font-medium text-slate-300">The fix: </span>
            {timing.fix_explanation}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
