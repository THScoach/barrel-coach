/**
 * Direction Analysis Card - Plane Chain
 * Shows plane angles, arm unity, and direction gaps
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Compass, AlertTriangle } from 'lucide-react';
import { DirectionAnalysis, getArmUnityStatus } from '@/lib/lab-report-types';

interface DirectionCardProps {
  direction: DirectionAnalysis;
}

function getArmUnityColor(status: 'elite' | 'good' | 'priority'): string {
  switch (status) {
    case 'elite': return 'text-teal-400';
    case 'good': return 'text-yellow-400';
    case 'priority': return 'text-red-400';
  }
}

function getArmUnityBadgeColor(status: 'elite' | 'good' | 'priority'): string {
  switch (status) {
    case 'elite': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    case 'good': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'priority': return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}

export function DirectionCard({ direction }: DirectionCardProps) {
  if (!direction.present) return null;

  const armUnityStatus = direction.arm_unity_status || 
    (direction.arm_unity !== undefined ? getArmUnityStatus(direction.arm_unity) : undefined);

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          <Compass className="h-4 w-4 text-slate-400" />
          Direction Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plane Angles */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">Plane Angles (vs Lead Arm)</div>
          <div className="grid grid-cols-3 gap-3">
            {direction.pelvis_plane_angle !== undefined && (
              <div className="text-center">
                <div className="text-lg font-bold text-white">{direction.pelvis_plane_angle.toFixed(0)}°</div>
                <div className="text-xs text-slate-500">Pelvis</div>
              </div>
            )}
            {direction.torso_plane_angle !== undefined && (
              <div className="text-center">
                <div className="text-lg font-bold text-white">{direction.torso_plane_angle.toFixed(0)}°</div>
                <div className="text-xs text-slate-500">Torso</div>
              </div>
            )}
            {direction.arms_plane_angle !== undefined && (
              <div className="text-center">
                <div className="text-lg font-bold text-white">{direction.arms_plane_angle.toFixed(0)}°</div>
                <div className="text-xs text-slate-500">Arms</div>
              </div>
            )}
          </div>
        </div>

        {/* Arm Unity - Key Metric */}
        {direction.arm_unity !== undefined && (
          <div className={`rounded-lg p-4 border ${armUnityStatus === 'priority' ? 'bg-red-500/10 border-red-500/30' : armUnityStatus === 'elite' ? 'bg-teal-500/10 border-teal-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">Arm Unity</span>
                {armUnityStatus === 'priority' && (
                  <Badge variant="outline" className={getArmUnityBadgeColor('priority')}>
                    ⚠️ PRIORITY
                  </Badge>
                )}
              </div>
              <span className={`text-2xl font-bold ${armUnityStatus ? getArmUnityColor(armUnityStatus) : 'text-white'}`}>
                {direction.arm_unity.toFixed(0)}°
              </span>
            </div>
            
            {/* Reference */}
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Cowser: 11° (Elite)</span>
              <span>MLB Avg: ~25°</span>
              <span>E. Williams: 108° (Bad)</span>
            </div>
          </div>
        )}

        {/* Plane Deviation */}
        {direction.plane_deviation_score !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">Total Plane Deviation</span>
            <span className={`font-bold ${direction.plane_deviation_score <= 73.6 ? 'text-teal-400' : 'text-orange-400'}`}>
              {direction.plane_deviation_score.toFixed(1)}° 
              <span className="text-xs text-slate-500 ml-1">(MLB avg: 73.6°)</span>
            </span>
          </div>
        )}

        {/* Player-Facing Summary */}
        {direction.summary && (
          <div className="bg-slate-800/30 rounded-lg p-3 border-l-2 border-orange-500">
            <p className="text-sm text-slate-200 leading-relaxed">
              {direction.summary}
            </p>
          </div>
        )}

        {/* Fix Explanation */}
        {direction.fix_explanation && (
          <div className="text-sm text-slate-400">
            <span className="font-medium text-slate-300">The fix: </span>
            {direction.fix_explanation}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
