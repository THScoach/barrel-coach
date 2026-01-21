import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Brain, Activity, Zap, Target, TrendingUp, Gauge, AlertTriangle, MessageSquare } from "lucide-react";

interface SessionDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    id: string;
    video_filename: string | null;
    session_date: string;
    processing_status: string | null;
    upload_source: string | null;
    composite_score: number | null;
    grade: string | null;
    brain_score: number | null;
    body_score: number | null;
    bat_score: number | null;
    ground_flow_score: number | null;
    core_flow_score: number | null;
    upper_flow_score: number | null;
    pelvis_velocity: number | null;
    torso_velocity: number | null;
    x_factor: number | null;
    bat_ke: number | null;
    transfer_efficiency: number | null;
    consistency_cv: number | null;
    consistency_grade: string | null;
    weakest_link: string | null;
    reboot_session_id: string | null;
    // AI coaching notes
    leak_detected?: string | null;
    leak_evidence?: string | null;
    motor_profile?: string | null;
    motor_profile_evidence?: string | null;
    priority_drill?: string | null;
    analysis_confidence?: number | null;
  } | null;
}

function ScoreCard({ 
  label, 
  score, 
  icon: Icon, 
  color,
  subScores 
}: { 
  label: string; 
  score: number | null; 
  icon: typeof Brain;
  color: string;
  subScores?: { label: string; value: number | string | null }[];
}) {
  return (
    <div className={`p-4 rounded-lg border ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-5 w-5" />
        <span className="font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold mb-2">{score ?? '-'}</div>
      {subScores && subScores.length > 0 && (
        <div className="space-y-1 mt-3 pt-3 border-t border-current/20">
          {subScores.map((sub, i) => (
            <div key={i} className="flex justify-between text-sm opacity-80">
              <span>{sub.label}</span>
              <span className="font-medium">{sub.value ?? '-'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value, unit }: { label: string; value: number | string | null; unit?: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-700/50">
      <span className="text-slate-400">{label}</span>
      <span className="text-white font-medium">
        {value !== null ? `${value}${unit ? ` ${unit}` : ''}` : '-'}
      </span>
    </div>
  );
}

export function SessionDetailModal({ open, onOpenChange, session }: SessionDetailModalProps) {
  if (!session) return null;

  const getWeakestLinkDisplay = (link: string | null) => {
    const labels: Record<string, { label: string; color: string }> = {
      brain: { label: 'Brain', color: 'bg-purple-500/20 text-purple-400' },
      body: { label: 'Body', color: 'bg-blue-500/20 text-blue-400' },
      bat: { label: 'Bat', color: 'bg-orange-500/20 text-orange-400' },
      ball: { label: 'Ball', color: 'bg-emerald-500/20 text-emerald-400' },
    };
    return labels[link || ''] || { label: link || 'Unknown', color: 'bg-slate-500/20 text-slate-400' };
  };

  const weakest = getWeakestLinkDisplay(session.weakest_link);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-between">
            <span>{session.video_filename || `Session ${session.id.slice(0, 8)}`}</span>
            <div className="flex items-center gap-2">
              {session.upload_source && (
                <Badge variant="outline" className="text-xs">
                  {session.upload_source === 'reboot_api' ? 'Reboot Import' : session.upload_source}
                </Badge>
              )}
              {session.composite_score && (
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  {session.composite_score} {session.grade}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Composite Score */}
          <div className="text-center p-6 bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Composite Score</div>
            <div className="text-5xl font-bold text-white mb-2">{session.composite_score ?? '-'}</div>
            <div className="text-lg text-slate-300">{session.grade || 'Not graded'}</div>
            {session.weakest_link && (
              <div className="mt-3">
                <span className="text-sm text-slate-400">Weakest Link: </span>
                <Badge className={weakest.color}>{weakest.label}</Badge>
              </div>
            )}
          </div>

          {/* 4B Score Breakdown */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              4B Score Breakdown
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <ScoreCard
                label="Brain"
                score={session.brain_score}
                icon={Brain}
                color="bg-purple-500/10 border-purple-500/30 text-purple-400"
                subScores={[
                  { label: 'Consistency CV', value: session.consistency_cv ? `${session.consistency_cv}%` : null },
                  { label: 'Grade', value: session.consistency_grade },
                ]}
              />
              <ScoreCard
                label="Body"
                score={session.body_score}
                icon={Activity}
                color="bg-blue-500/10 border-blue-500/30 text-blue-400"
                subScores={[
                  { label: 'Ground Flow', value: session.ground_flow_score },
                  { label: 'Core Flow', value: session.core_flow_score },
                ]}
              />
              <ScoreCard
                label="Bat"
                score={session.bat_score}
                icon={Zap}
                color="bg-orange-500/10 border-orange-500/30 text-orange-400"
                subScores={[
                  { label: 'Upper Flow', value: session.upper_flow_score },
                  { label: 'Transfer %', value: session.transfer_efficiency ? `${session.transfer_efficiency}%` : null },
                ]}
              />
              <ScoreCard
                label="Ball"
                score={null}
                icon={Target}
                color="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                subScores={[
                  { label: 'Based on', value: 'Transfer Efficiency' },
                ]}
              />
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* AI Coaching Notes */}
          {(session.leak_detected || session.priority_drill || session.motor_profile || session.leak_evidence) && (
            <>
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  AI Coaching Notes
                </h3>
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
                  {/* Leak & Motor Profile Badges */}
                  <div className="flex flex-wrap gap-3">
                    {session.leak_detected && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <div>
                          <span className="text-red-300 font-semibold text-sm">
                            {session.leak_detected.replace(/_/g, ' ')}
                          </span>
                          <span className="text-red-400/60 text-xs ml-2">Leak Detected</span>
                        </div>
                      </div>
                    )}
                    {session.motor_profile && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Target className="h-4 w-4 text-blue-400" />
                        <div>
                          <span className="text-blue-300 font-semibold text-sm">{session.motor_profile}</span>
                          <span className="text-blue-400/60 text-xs ml-2">Motor Profile</span>
                        </div>
                      </div>
                    )}
                    {session.analysis_confidence && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
                        <span className="text-slate-300 text-sm">
                          {Math.round(session.analysis_confidence * 100)}% Confidence
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Leak Evidence */}
                  {session.leak_evidence && (
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Leak Evidence</span>
                      <p className="text-slate-300 text-sm leading-relaxed">{session.leak_evidence}</p>
                    </div>
                  )}

                  {/* Motor Profile Evidence */}
                  {session.motor_profile_evidence && (
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Motor Profile Evidence</span>
                      <p className="text-slate-300 text-sm leading-relaxed">{session.motor_profile_evidence}</p>
                    </div>
                  )}

                  {/* Priority Drill */}
                  {session.priority_drill && (
                    <div className="space-y-1 pt-2 border-t border-slate-700/50">
                      <span className="text-xs text-emerald-500 uppercase tracking-wide">Priority Drill</span>
                      <p className="text-emerald-300 font-medium">{session.priority_drill}</p>
                    </div>
                  )}
                </div>
              </div>
              <Separator className="bg-slate-700" />
            </>
          )}

          <Separator className="bg-slate-700" />

          {/* Raw Biomechanics Data */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Raw Biomechanics Data
            </h3>
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-1">
              <MetricRow label="Pelvis Peak Velocity" value={session.pelvis_velocity} unit="deg/s" />
              <MetricRow label="Torso Peak Velocity" value={session.torso_velocity} unit="deg/s" />
              <MetricRow label="X-Factor (Separation)" value={session.x_factor} unit="deg" />
              <MetricRow label="Bat Kinetic Energy" value={session.bat_ke} unit="J" />
              <MetricRow label="Transfer Efficiency" value={session.transfer_efficiency} unit="%" />
              <MetricRow label="Consistency CV" value={session.consistency_cv} unit="%" />
            </div>
          </div>

          {/* Session Metadata */}
          <div className="text-xs text-slate-500 space-y-1">
            <div>Session ID: {session.id}</div>
            {session.reboot_session_id && (
              <div>Reboot Session: {session.reboot_session_id}</div>
            )}
            <div>Date: {new Date(session.session_date).toLocaleDateString()}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}