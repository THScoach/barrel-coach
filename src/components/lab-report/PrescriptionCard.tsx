/**
 * Coaching Prescription Card - What to Do and What NOT to Do
 * Shows prioritized drills and contraindications
 * 
 * Integrated with Drill Library v1.0
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Play, XCircle, AlertTriangle } from 'lucide-react';
import { CoachingPrescription } from '@/lib/lab-report-types';
import { Link } from 'react-router-dom';

interface PrescriptionCardProps {
  prescription: CoachingPrescription;
}

function getLocationLabel(location: string): string {
  switch (location) {
    case 'BAT': return 'Bat (Delivery)';
    case 'ARMS': return 'Arms (Transfer)';
    case 'TORSO': return 'Torso (Engine)';
    case 'PELVIS': return 'Pelvis (Ground)';
    default: return location;
  }
}

export function PrescriptionCard({ prescription }: PrescriptionCardProps) {
  if (!prescription.present) return null;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-slate-400" />
          Your Prescription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Issue */}
        {prescription.primary_issue && (
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Primary Issue</div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-white">{prescription.primary_issue}</span>
              {prescription.primary_issue_location && (
                <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                  {getLocationLabel(prescription.primary_issue_location)}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Drill Priority */}
        {prescription.drills && prescription.drills.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Drill Priority</div>
            {prescription.drills.map((drill, idx) => (
              <div 
                key={drill.id || idx}
                className="bg-slate-800/30 rounded-lg p-3 border-l-2 border-teal-500"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-sm font-bold">
                      {idx + 1}
                    </div>
                    <Link 
                      to={`/drills/${drill.id}`}
                      className="font-medium text-white hover:text-teal-400 transition-colors"
                    >
                      {drill.name}
                    </Link>
                  </div>
                  {drill.video_url && (
                    <Link 
                      to={`/drills/${drill.id}`}
                      className="text-teal-400 hover:text-teal-300"
                    >
                      <Play className="h-4 w-4" />
                    </Link>
                  )}
                </div>
                
                <p className="text-sm text-slate-400 mt-2">{drill.why_it_works}</p>
                
                {drill.coaching_cue && (
                  <div className="mt-2 text-sm">
                    <span className="text-slate-500">Cue: </span>
                    <span className="text-slate-200 italic">"{drill.coaching_cue}"</span>
                  </div>
                )}
                
                {drill.reps && (
                  <div className="mt-1 text-xs text-slate-500">
                    {drill.reps}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* What NOT To Do */}
        {prescription.what_not_to_do && prescription.what_not_to_do.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-red-400 uppercase tracking-wide">
              <XCircle className="h-3 w-3" />
              What NOT To Do
            </div>
            <div className="bg-red-500/5 rounded-lg p-3 border border-red-500/20">
              {prescription.what_not_to_do.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 py-1">
                  <span className="text-red-400">❌</span>
                  <div>
                    <span className="text-sm text-red-300 font-medium">{item.drill_type}</span>
                    <span className="text-sm text-slate-400"> — {item.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adaptation Note */}
        {prescription.adaptation_note && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300">
                <span className="font-medium text-yellow-400">The Truth: </span>
                {prescription.adaptation_note}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
