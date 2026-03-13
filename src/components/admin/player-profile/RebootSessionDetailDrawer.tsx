import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Calendar, MapPin, Video, ExternalLink, Activity,
  ChevronDown, Zap, Brain, Target, TrendingUp,
  ArrowRight, Dumbbell, Eye, Gauge
} from "lucide-react";
import { DrillSessionBanner } from "./DrillSessionBanner";
import { SessionTypeBadge } from "./SessionTypeBadge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import {
  buildCoachingReport,
  type CoachingReportData,
  type PillarQuestion,
  type PredictionTile,
  type ActualVsPredicted,
  type SessionScoreData,
} from "@/lib/coachingReport";

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

// ─── Prediction Tile ─────────────────────────────────────────────────────────

function PredictionTileCard({ tile }: { tile: PredictionTile }) {
  const isEstimation = tile.value.startsWith('~');
  return (
    <div className={`flex-1 min-w-0 border rounded-xl p-4 text-center space-y-1.5 ${
      isEstimation 
        ? 'bg-slate-800/30 border-slate-700/30' 
        : 'bg-slate-800/60 border-slate-700/40'
    }`}>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
        {tile.label}
      </p>
      <p className={`text-2xl font-black tracking-tight ${
        isEstimation ? 'text-slate-400' : tile.available ? 'text-white' : 'text-slate-500'
      }`}>
        {tile.value}
      </p>
      <p className="text-[10px] leading-snug text-slate-500">
        {tile.subLabel}
      </p>
    </div>
  );
}

// ─── Actual vs Predicted Row ─────────────────────────────────────────────────

function ActualRow({ item }: { item: ActualVsPredicted }) {
  const gapColor = item.gap > 0 ? 'text-orange-400' : item.gap < 0 ? 'text-teal-400' : 'text-slate-400';
  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-slate-800/40 rounded-lg">
      <div className="flex items-center gap-2">
        <Gauge className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-sm text-slate-300 font-medium">{item.metric}</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-white font-bold">{item.actual} {item.unit}</span>
        <span className="text-slate-500 text-xs">(Body says ~{Math.round(item.predicted)})</span>
        {item.gap !== 0 && (
          <span className={`text-xs font-semibold ${gapColor}`}>
            {item.gap > 0 ? `+${item.gap} left` : `${item.gap} over`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Pillar Question Card ────────────────────────────────────────────────────

const PILLAR_ICONS: Record<string, any> = {
  BRAIN: Brain,
  BODY: Activity,
  BAT: Zap,
  BALL: Target,
};

function PillarQuestionCard({ data }: { data: PillarQuestion }) {
  const Icon = PILLAR_ICONS[data.pillar] ?? Activity;
  return (
    <div
      className="bg-slate-800/50 rounded-xl p-3 space-y-1.5"
      style={{ borderLeft: `3px solid ${data.color}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" style={{ color: data.color }} />
          <span className="text-xs font-semibold text-slate-300">{data.question}</span>
        </div>
        {data.score != null && (
          <ScoreBadge score={data.score} size="sm" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="text-[10px] py-0 px-1.5"
          style={{ borderColor: data.color, color: data.color }}
        >
          {data.label}
        </Badge>
      </div>
      <p className="text-[11px] leading-snug text-slate-400">{data.explanation}</p>
    </div>
  );
}

// ─── Main Drawer ─────────────────────────────────────────────────────────────

export function RebootSessionDetailDrawer({ open, onOpenChange, session }: RebootSessionDetailDrawerProps) {
  const [rawOpen, setRawOpen] = useState(false);

  const { data: playerSession } = useQuery({
    queryKey: ["player-session-scores", session?.player_id, session?.reboot_session_id],
    queryFn: async () => {
      if (!session?.player_id) return null;

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

      if (session.session_date) {
        const dateStr = session.session_date.split("T")[0];
        const { data } = await supabase
          .from("player_sessions")
          .select("*")
          .eq("player_id", session.player_id)
          .gte("session_date", dateStr + "T00:00:00")
          .lte("session_date", dateStr + "T23:59:59")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }

      const { data } = await supabase
        .from("player_sessions")
        .select("*")
        .eq("player_id", session.player_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: open && !!session?.player_id,
  });

  if (!session) return null;

  const rebootUrl = session.reboot_session_id
    ? `https://app.rebootmotion.com/sessions/${session.reboot_session_id}`
    : null;

  const hasScores = playerSession?.overall_score != null || playerSession?.score_4bkrs != null;

  // Build the coaching report from session data
  const report: CoachingReportData | null = hasScores && playerSession
    ? buildCoachingReport(playerSession as unknown as SessionScoreData)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-slate-900 border-slate-700 w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-3">
          <SheetTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            Session Report
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* ── Header badges ── */}
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
            <SessionTypeBadge sessionType={(session as any).session_type} drillName={(session as any).drill_name} />
          </div>

          <DrillSessionBanner sessionType={(session as any).session_type} drillName={(session as any).drill_name} />

          {/* ── Overall Score Header ── */}
          {report && (
            <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Score</p>
                <p className="text-lg font-bold text-white">{report.overallRating}</p>
              </div>
              <ScoreBadge score={report.overallScore} size="lg" showGrade />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/*  SECTION 1: "What your body can do" — Predictions              */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {report && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-200">What your body can do</h3>
              </div>
              <div className="flex gap-2">
                {report.predictions.map((tile, i) => (
                  <PredictionTileCard key={i} tile={tile} />
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/*  SECTION 2: "What actually happened" — Actuals + gap           */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {report && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-200">What actually happened today</h3>
              </div>
              {report.hasActuals ? (
                <div className="space-y-2">
                  {report.actuals.map((item, i) => (
                    <ActualRow key={i} item={item} />
                  ))}
                  {report.gapSummary && (
                    <p className="text-xs text-slate-400 italic px-1">{report.gapSummary}</p>
                  )}
                </div>
              ) : (
                <div className="bg-slate-800/30 border border-dashed border-slate-700/50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {report.noActualsMessage}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/*  SECTION 3: 4 Pillars as simple questions                     */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {report && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-200">The 4 B's</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {report.pillarQuestions.map((pq) => (
                  <PillarQuestionCard key={pq.pillar} data={pq} />
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/*  SECTION 4: "What to train next" — Coaching                   */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {report && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-orange-400" />
                <h3 className="text-sm font-bold text-slate-200">What to train next</h3>
              </div>
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-orange-300">{report.coaching.title}</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {report.coaching.explanation}
                </p>
                {report.coaching.drills.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {report.coaching.drills.map((drill, i) => (
                      <div
                        key={i}
                        className="bg-slate-800/80 border border-orange-500/20 rounded-lg px-3 py-2 text-xs"
                      >
                        <span className="text-orange-300 font-semibold">{drill.name}</span>
                        <span className="text-slate-500 ml-1.5">– {drill.prescription}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/*  FOOTER: "If this improves…" Projection                       */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {report && report.projection.evGain > 0 && (
            <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-purple-300 uppercase tracking-wider">If this improves…</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{report.projection.text}</p>
                </div>
              </div>
            </div>
          )}

          <Separator className="bg-slate-700" />

          {/* ── Session Details (collapsed) ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold text-slate-400 uppercase tracking-wider py-1 hover:text-slate-300 transition-colors">
              Session Details
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-0 mt-2">
                <MetricRow label="Session Number" value={session.session_number} />
                <MetricRow label="Movement Type" value={session.movement_type} />
                <MetricRow label="Location" value={session.location} />
                <MetricRow
                  label="Completed At"
                  value={session.completed_at ? format(new Date(session.completed_at), "MMM d, yyyy h:mm a") : null}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Files ── */}
          {(session.ik_file_path || session.me_file_path || session.video_url) && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold text-slate-400 uppercase tracking-wider py-1 hover:text-slate-300 transition-colors">
                Files
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-0 mt-2">
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
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Notes */}
          {session.notes && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-slate-300 text-sm bg-slate-800/50 rounded-lg p-4">{session.notes}</p>
            </div>
          )}

          {/* Error */}
          {session.error_message && (
            <div>
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">Error</h3>
              <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                {session.error_message}
              </p>
            </div>
          )}

          {/* View in Reboot */}
          {rebootUrl && (
            <Button
              asChild
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600"
            >
              <a href={rebootUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View in Reboot Motion
              </a>
            </Button>
          )}

          {/* Raw Data */}
          <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold text-slate-400 uppercase tracking-wider py-1 hover:text-slate-300 transition-colors">
              Raw Data
              <ChevronDown className={`h-4 w-4 transition-transform ${rawOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-4 mt-2 overflow-auto max-h-80 whitespace-pre-wrap break-all">
                {JSON.stringify({ session, scores: playerSession }, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>

          {/* Metadata */}
          <div className="text-xs text-slate-500 space-y-1 pt-2">
            <div>ID: {session.id}</div>
            {session.reboot_session_id && <div>Reboot Session: {session.reboot_session_id}</div>}
            {session.created_at && <div>Created: {format(new Date(session.created_at), "MMM d, yyyy h:mm a")}</div>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
