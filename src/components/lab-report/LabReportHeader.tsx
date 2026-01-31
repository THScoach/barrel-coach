/**
 * Lab Report Header - Player info, date, and branding
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { LabReportSession } from '@/lib/lab-report-types';

interface LabReportHeaderProps {
  session: LabReportSession;
}

function getHandednessLabel(handedness: 'R' | 'L' | 'S' | null | undefined): string {
  switch (handedness) {
    case 'R': return 'Right-Handed';
    case 'L': return 'Left-Handed';
    case 'S': return 'Switch Hitter';
    default: return '';
  }
}

export function LabReportHeader({ session }: LabReportHeaderProps) {
  const formattedDate = session.date 
    ? format(new Date(session.date), 'MMMM d, yyyy')
    : 'Date unavailable';

  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      {/* Brand accent bar */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-orange-500" />
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <User className="h-5 w-5 text-slate-400" />
              {session.player.name}
            </h1>
            
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formattedDate}
              </div>
              
              {session.player.age && (
                <span>Age {session.player.age}</span>
              )}
              
              {session.player.level && (
                <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">
                  {session.player.level}
                </Badge>
              )}
            </div>
            
            {session.player.handedness && (
              <div className="text-xs text-slate-500 mt-1">
                {getHandednessLabel(session.player.handedness)}
              </div>
            )}
          </div>

          {/* Catching Barrels Branding */}
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Lab Report</div>
            <div className="text-sm font-semibold text-red-500">v2.0</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
