import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Hash, MapPin, FileText, Video, ExternalLink, Activity, ChevronDown, Zap, Brain, Target } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScoreBadge, getScoreGrade } from "@/components/ui/ScoreBadge";

interface RebootSession {
  id: string;
  player_id: string | null;
  session_date: string | null;
  movement_type: string | null;
  status: string | null;
  session_number: number | null;
  reboot_session_id: string | null;
  reboot_player_id: string | null;
  location: string | null;
  notes: string | null;
  video_url: string | null;
  ik_file_path: string | null;
  me_file_path: string | null;
  error_message: string | null;
  completed_at: string | null;
  exported_at: string | null;
  processed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_polled_at: string | null;
}

interface RebootSessionDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: RebootSession | null;
}

function MetricRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between py-2 border-b border-slate-700/50">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-white font-medium text-sm">{value}</span>
    </div>
  );
}

const statusColor = (s: string | null) => {
  if (s === "scored") return "bg-teal-500/15 text-teal-400 border-teal-500/30";
  if (s === "completed") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s === "processing" || s === "exported") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (s === "uploaded" || s === "ready_for_processing") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
};

function ScoreCard({ label, score, icon: Icon }: { label: string; score: number; icon: any }) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 text-center space-y-1">
      <div className="flex items-center justify-center gap-1.5 text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <ScoreBadge score={score} size="md" />
      <p className="text-[10px] text-slate-500">{getScoreGrade(score)}</p>
    </div>
  );
}

export function RebootSessionDetailDrawer({ open, onOpenChange, session }: RebootSessionDetailDrawerProps) {
  const [rawOpen, setRawOpen] = useState(false);

  // Fetch linked player_session scores
  const { data: playerSession } = useQuery({
    queryKey: ["player-session-scores", session?.player_id, session?.reboot_session_id],
    queryFn: async () => {
      if (!session?.player_id) return null;

      // Try by reboot_session_id first
      if (session.reboot_session_id) {
        const { data } = await supabase
          .from("player_sessions")
          .select("*")
          .eq("player_id", session.player_id)
          .eq("reboot_session_id", session.reboot_session_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }

      // Fallback: match by player_id + closest date
      if (session.session_date) {
        const { data } = await supabase
          .from("player_sessions")
          .select("*")
          .eq("player_id", session.player_id)
          .gte("session_date", session.session_date + "T00:00:00")
          .lte("session_date", session.session_date + "T23:59:59")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data;
      }
      return null;
    },
    enabled: open && !!session?.player_id,
  });

  if (!session) return null;

  const rebootUrl = session.reboot_session_id
    ? `https://app.rebootmotion.com/sessions/${session.reboot_session_id}`
    : null;

  const hasScores = playerSession?.overall_score != null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-slate-900 border-slate-700 w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            Reboot Session
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Header info */}
          <div className="flex flex-wrap items-center gap-2">
            {session.session_date && (
              <Badge variant="outline" className="border-slate-700 text-slate-300 gap-1.5">
                <Calendar className="h-3 w-3" />
                {format(new Date(session.session_date), "MMM d, yyyy")}
              </Badge>
            )}
            <Badge variant="outline" className={statusColor(session.status)}>
              {session.status || "unknown"}
            </Badge>
            {session.movement_type && (
              <Badge variant="outline" className="border-slate-700 text-slate-400">
                {session.movement_type}
              </Badge>
            )}
          </div>

          {/* 4BKRS Score Card */}
          {hasScores && (
            <>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">4BKRS Score</h3>
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={playerSession.overall_score} size="lg" showGrade />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <ScoreCard label="Body" score={playerSession.body_score} icon={Activity} />
                  <ScoreCard label="Brain" score={playerSession.brain_score} icon={Brain} />
                  <ScoreCard label="Bat" score={playerSession.bat_score} icon={Zap} />
                  <ScoreCard label="Ball" score={playerSession.ball_score} icon={Target} />
                </div>
                {playerSession.leak_type && playerSession.leak_type !== 'unknown' && playerSession.leak_type !== 'clean_transfer' && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1">Energy Leak</p>
                    <p className="text-sm text-orange-300">{playerSession.leak_caption || playerSession.leak_type.replace(/_/g, ' ')}</p>
                    {playerSession.leak_training && (
                      <p className="text-xs text-orange-400/70 mt-1">{playerSession.leak_training}</p>
                    )}
                  </div>
                )}
                {playerSession.swing_count && (
                  <p className="text-xs text-slate-500 text-right">{playerSession.swing_count} swings analyzed</p>
                )}
              </div>
            </>
          )}

          <Separator className="bg-slate-700" />

          {/* Key details */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Session Details</h3>
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-0">
              <MetricRow label="Session Number" value={session.session_number} />
              <MetricRow label="Movement Type" value={session.movement_type} />
              <MetricRow label="Location" value={session.location} />
              <MetricRow
                label="Completed At"
                value={session.completed_at ? format(new Date(session.completed_at), "MMM d, yyyy h:mm a") : null}
              />
              <MetricRow
                label="Exported At"
                value={session.exported_at ? format(new Date(session.exported_at), "MMM d, yyyy h:mm a") : null}
              />
              <MetricRow
                label="Processed At"
                value={session.processed_at ? format(new Date(session.processed_at), "MMM d, yyyy h:mm a") : null}
              />
            </div>
          </div>

          {/* Files */}
          {(session.ik_file_path || session.me_file_path || session.video_url) && (
            <>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Files</h3>
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-0">
                  <MetricRow label="IK File" value={session.ik_file_path} />
                  <MetricRow label="ME File" value={session.me_file_path} />
                  {session.video_url && (
                    <div className="flex justify-between py-2 border-b border-slate-700/50 items-center">
                      <span className="text-slate-400 text-sm flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5" /> Video
                      </span>
                      <a
                        href={session.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {session.notes && (
            <>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Notes</h3>
                <p className="text-slate-300 text-sm bg-slate-800/50 rounded-lg p-4">{session.notes}</p>
              </div>
            </>
          )}

          {/* Error */}
          {session.error_message && (
            <>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">Error</h3>
                <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  {session.error_message}
                </p>
              </div>
            </>
          )}

          {/* View in Reboot */}
          {rebootUrl && (
            <>
              <Separator className="bg-slate-700" />
              <Button
                asChild
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600"
              >
                <a href={rebootUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in Reboot Motion
                </a>
              </Button>
            </>
          )}

          {/* Raw Data */}
          <Separator className="bg-slate-700" />
          <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold text-slate-400 uppercase tracking-wider py-1 hover:text-slate-300 transition-colors">
              Raw Data
              <ChevronDown className={`h-4 w-4 transition-transform ${rawOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-4 mt-2 overflow-auto max-h-80 whitespace-pre-wrap break-all">
                {JSON.stringify(session, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>

          {/* Metadata */}
          <div className="text-xs text-slate-500 space-y-1 pt-2">
            <div>ID: {session.id}</div>
            {session.reboot_session_id && <div>Reboot Session: {session.reboot_session_id}</div>}
            {session.reboot_player_id && <div>Reboot Player: {session.reboot_player_id}</div>}
            {session.created_at && <div>Created: {format(new Date(session.created_at), "MMM d, yyyy h:mm a")}</div>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
