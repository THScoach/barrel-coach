/**
 * Lab Report Header v2.0 - Kinetic Fingerprint Report Header
 * Matches the template specification
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Fingerprint, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { LabReportSession, MotorProfileType, getMotorProfileColor } from '@/lib/lab-report-types';
import type { KineticFingerprintResult } from '@/lib/kinetic-fingerprint-score';

interface ReportHeaderProps {
  session: LabReportSession;
  kfScore?: KineticFingerprintResult;
  motorProfile?: MotorProfileType;
  mlbMatch?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-teal-400';
  if (score >= 60) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBorderColor(score: number): string {
  if (score >= 80) return 'border-teal-500';
  if (score >= 60) return 'border-orange-500';
  return 'border-red-500';
}

function getProfileEmoji(profile?: MotorProfileType): string {
  switch (profile) {
    case 'SPINNER': return '🌀';
    case 'WHIPPER': return '🏏';
    case 'SLINGSHOTTER': return '🚀';
    case 'TITAN': return '⚡';
    default: return '⚾';
  }
}

function getProfileColor(profile?: MotorProfileType): string {
  switch (profile) {
    case 'SPINNER': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    case 'WHIPPER': return 'text-green-400 bg-green-500/10 border-green-500/30';
    case 'SLINGSHOTTER': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'TITAN': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
}

export function ReportHeader({ session, kfScore, motorProfile, mlbMatch }: ReportHeaderProps) {
  const formattedDate = session.date 
    ? format(new Date(session.date), 'MMM d, yyyy')
    : 'Date unavailable';

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-slate-700 overflow-hidden">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-orange-500" />
      
      <CardContent className="p-5">
        {/* Title Section */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Fingerprint className="h-5 w-5 text-red-500" />
          <h1 className="text-sm font-semibold text-slate-300 tracking-widest uppercase">
            Kinetic Fingerprint Report
          </h1>
        </div>
        
        {/* Player Info */}
        <div className="text-center mb-5">
          <h2 className="text-2xl font-bold text-white mb-1">
            {session.player.name}
          </h2>
          <div className="flex items-center justify-center gap-3 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
            {session.id && (
              <span className="text-slate-600">#{session.id.slice(0, 8)}</span>
            )}
          </div>
        </div>
        
        {/* KF Score Box */}
        {kfScore && (
          <div className={cn(
            "mx-auto max-w-[200px] p-4 rounded-lg border-2 bg-slate-800/50 text-center mb-5",
            getScoreBorderColor(kfScore.total)
          )}>
            <div className="text-sm text-slate-400 mb-1">KF SCORE</div>
            <div className={cn("text-4xl font-bold", getScoreColor(kfScore.total))}>
              {kfScore.total}
            </div>
            <div className={cn("text-sm font-medium mt-1", getScoreColor(kfScore.total))}>
              {kfScore.rating}
            </div>
            
            {/* Progress bar */}
            <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  kfScore.total >= 80 ? 'bg-teal-500' : kfScore.total >= 60 ? 'bg-orange-500' : 'bg-red-500'
                )}
                style={{ width: `${kfScore.total}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Motor Profile & MLB Match Row */}
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {motorProfile && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Motor Profile:</span>
              <Badge 
                variant="outline" 
                className={cn("border px-2 py-0.5", getProfileColor(motorProfile))}
              >
                <span className="mr-1">{getProfileEmoji(motorProfile)}</span>
                {motorProfile}
              </Badge>
            </div>
          )}
          
          {mlbMatch && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">MLB Match:</span>
              <span className="text-sm font-medium text-white">{mlbMatch}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
