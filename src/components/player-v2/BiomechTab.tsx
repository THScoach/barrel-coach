/**
 * Biomech Tab — Lists hitting_4b_krs_sessions with expandable detail view
 * Includes Coach Barrels diagnostic trigger + question/answer loop
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { TagPill } from "@/components/player-v2/TagPill";
import { scoreColor } from "@/lib/player-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Zap, Target, Brain, Loader2, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface BiomechSession {
  id: string;
  session_date: string;
  krs_score: number | null;
  body_score: number | null;
  brain_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  weakest_b: string | null;
  main_constraint: string | null;
  secondary_constraint: string | null;
  has_sequence_issue: boolean;
  has_momentum_issue: boolean;
  has_plane_issue: boolean;
  has_range_usage_issue: boolean;
  has_balance_stability_issue: boolean;
  summary_player_text: string | null;
  summary_coach_text: string | null;
  focus_next_bp: string | null;
  recommended_cues: string[] | null;
  recommended_drills: any[] | null;
  coach_barrels_classification: any[] | null;
  coach_barrels_prescription: any | null;
  coach_barrels_voice_sample: string | null;
}

const FLAG_LABELS: Record<string, { label: string; icon: any }> = {
  has_sequence_issue: { label: "Sequence", icon: Activity },
  has_momentum_issue: { label: "Momentum", icon: Zap },
  has_plane_issue: { label: "Swing Plane", icon: Target },
  has_range_usage_issue: { label: "Range/Timing", icon: Brain },
  has_balance_stability_issue: { label: "Balance", icon: Activity },
};

export function BiomechTab({ playerId }: { playerId: string | null }) {
  const [sessions, setSessions] = useState<BiomechSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!playerId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("hitting_4b_krs_sessions")
      .select("id, session_date, krs_score, body_score, brain_score, bat_score, ball_score, weakest_b, main_constraint, secondary_constraint, has_sequence_issue, has_momentum_issue, has_plane_issue, has_range_usage_issue, has_balance_stability_issue, summary_player_text, summary_coach_text, focus_next_bp, recommended_cues, recommended_drills, coach_barrels_classification, coach_barrels_prescription, coach_barrels_voice_sample")
      .eq("player_id", playerId)
      .order("session_date", { ascending: false })
      .limit(50);
    if (data) setSessions(data as unknown as BiomechSession[]);
    setLoading(false);
  }, [playerId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" style={{ background: '#111827' }} />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-12 w-12" />}
        title="No biomech reports yet"
        description="Complete a Reboot session to get your first 4B/KRS biomech analysis."
        ctaLabel="Start Session"
        ctaTo="/player/session"
      />
    );
  }

  const selected = selectedId ? sessions.find(s => s.id === selectedId) : null;

  if (selected) {
    return (
      <BiomechDetail
        session={selected}
        onBack={() => setSelectedId(null)}
        onRefresh={fetchSessions}
      />
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s, i) => (
        <button
          key={s.id}
          onClick={() => setSelectedId(s.id)}
          className="w-full text-left rounded-xl p-4 transition-colors hover:opacity-90"
          style={{ background: '#111827', border: '1px solid #1E2535' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: '#fff' }}>
                Report {sessions.length - i} · {format(new Date(s.session_date), 'MMM d, yyyy')}
              </p>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {s.weakest_b && (
                  <TagPill label={`Weakest: ${s.weakest_b.toUpperCase()}`} color="#FF3B30" />
                )}
                {s.main_constraint && (
                  <TagPill label={s.main_constraint.replace(/_/g, ' ')} color="#FFA000" />
                )}
                {s.coach_barrels_voice_sample && (
                  <TagPill label="🛢️ Coach Barrels" color="#F59E0B" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: scoreColor(s.krs_score) }}>
                  {s.krs_score ?? '—'}
                </p>
                <p className="text-[10px] uppercase font-semibold" style={{ color: '#6B7A8F' }}>KRS</p>
              </div>
              <ChevronRight className="h-4 w-4" style={{ color: '#6B7A8F' }} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Detail View ─────────────────────────────────────────────────────────────

function BiomechDetail({
  session: s,
  onBack,
  onRefresh,
}: {
  session: BiomechSession;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [barrelsResult, setBarrelsResult] = useState<any>(null);
  const [questionState, setQuestionState] = useState<{
    flag_id: string;
    question_text: string;
    voice_sample: string;
  } | null>(null);
  const [answer, setAnswer] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  const pillars = [
    { label: 'BODY', score: s.body_score },
    { label: 'BRAIN', score: s.brain_score },
    { label: 'BAT', score: s.bat_score },
    { label: 'BALL', score: s.ball_score },
  ];

  const flagEntries = Object.entries(FLAG_LABELS).map(([key, meta]) => ({
    key,
    ...meta,
    active: (s as any)[key] === true,
  }));

  const activeFlags = flagEntries.filter(f => f.active);
  const cues: string[] = Array.isArray(s.recommended_cues) ? s.recommended_cues : [];
  const drills: any[] = Array.isArray(s.recommended_drills) ? s.recommended_drills : [];

  const hasCoachBarrels = !!s.coach_barrels_voice_sample;
  const hasActiveFlags = activeFlags.length > 0;

  // Build active_flags object for the API
  const activeFlagsObj: Record<string, boolean> = {};
  flagEntries.forEach(f => { activeFlagsObj[f.key] = f.active; });

  const runCoachBarrels = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('coach-barrels-diagnostic', {
        body: {
          player_id: (s as any).player_id || undefined,
          krs_session_id: s.id,
          active_flags: activeFlagsObj,
          player_scores: {
            body_score: s.body_score,
            brain_score: s.brain_score,
            bat_score: s.bat_score,
            ball_score: s.ball_score,
            krs_score: s.krs_score,
          },
        },
      });

      if (error) throw error;

      const result = data?.data;
      if (!result) throw new Error("No result returned");

      setBarrelsResult(result);

      if (result.response_type === "question" && result.question) {
        setQuestionState({
          flag_id: result.question.flag_id,
          question_text: result.question.text,
          voice_sample: result.voice_sample,
        });
      } else {
        // Classification or prescription — refresh the session data
        toast.success("Coach Barrels analysis complete");
        onRefresh();
      }
    } catch (err: any) {
      console.error("Coach Barrels error:", err);
      toast.error(err.message || "Coach Barrels analysis failed");
    } finally {
      setRunning(false);
    }
  };

  const submitAnswer = async () => {
    if (!questionState || !answer.trim()) return;
    setSubmittingAnswer(true);
    try {
      const { data, error } = await supabase.functions.invoke('coach-barrels-diagnostic', {
        body: {
          player_id: (s as any).player_id || undefined,
          krs_session_id: s.id,
          active_flags: activeFlagsObj,
          player_scores: {
            body_score: s.body_score,
            brain_score: s.brain_score,
            bat_score: s.bat_score,
            ball_score: s.ball_score,
            krs_score: s.krs_score,
          },
          player_response: {
            flag_id: questionState.flag_id,
            answer: answer.trim(),
          },
        },
      });

      if (error) throw error;

      setBarrelsResult(data?.data);
      setQuestionState(null);
      setAnswer("");
      toast.success("Coach Barrels prescription generated");
      onRefresh();
    } catch (err: any) {
      console.error("Coach Barrels answer error:", err);
      toast.error(err.message || "Failed to submit answer");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold" style={{ color: '#FF3B30' }}>
        <ChevronLeft className="h-4 w-4" /> All Reports
      </button>

      {/* Header */}
      <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1E2535' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: '#6B7A8F' }}>
              {format(new Date(s.session_date), 'MMM d, yyyy')}
            </p>
            <p className="text-sm font-bold mt-1" style={{ color: '#fff' }}>
              4B/KRS Biomech Report
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold" style={{ color: scoreColor(s.krs_score) }}>
              {s.krs_score ?? '—'}
            </p>
            <p className="text-[10px] uppercase font-semibold" style={{ color: '#6B7A8F' }}>KRS</p>
          </div>
        </div>
      </div>

      {/* Player Summary */}
      {s.summary_player_text && (
        <div className="rounded-xl p-4" style={{ background: '#0F1D2E', border: '1px solid #1A3550' }}>
          <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#00B4D8' }}>Your Report</p>
          <p className="text-sm leading-relaxed" style={{ color: '#E2E8F0' }}>{s.summary_player_text}</p>
        </div>
      )}

      {/* 4B Pillar Grid */}
      <div className="grid grid-cols-2 gap-3">
        {pillars.map(d => (
          <div
            key={d.label}
            className="rounded-xl p-4"
            style={{
              background: d.label.toLowerCase() === s.weakest_b ? '#1A1015' : '#111827',
              border: `1px solid ${d.label.toLowerCase() === s.weakest_b ? '#FF3B30' : '#1E2535'}`,
            }}
          >
            <p className="text-[11px] font-semibold uppercase" style={{ color: '#6B7A8F' }}>{d.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: scoreColor(d.score) }}>{d.score ?? '—'}</p>
            <div className="mt-2 h-1.5 rounded-full" style={{ background: '#1E2535' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${d.score ?? 0}%`, background: scoreColor(d.score) }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Biomech Flags */}
      <div>
        <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#6B7A8F' }}>Biomech Checkpoints</p>
        <div className="space-y-2">
          {flagEntries.map(f => {
            const Icon = f.active ? XCircle : CheckCircle2;
            return (
              <div
                key={f.key}
                className="flex items-center gap-3 rounded-lg p-3"
                style={{ background: '#111827', border: '1px solid #1E2535' }}
              >
                <Icon className="h-5 w-5 flex-shrink-0" style={{ color: f.active ? '#FF3B30' : '#22C55E' }} />
                <p className="text-sm font-semibold" style={{ color: f.active ? '#FF3B30' : '#22C55E' }}>{f.label}</p>
                <p className="text-xs ml-auto" style={{ color: '#6B7A8F' }}>{f.active ? 'Issue detected' : 'Looks good'}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Constraints */}
      {(s.main_constraint || s.secondary_constraint) && (
        <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1E2535' }}>
          <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#6B7A8F' }}>Constraints</p>
          {s.main_constraint && (
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: '#FF3B30' }} />
              <p className="text-sm font-semibold" style={{ color: '#fff' }}>{s.main_constraint.replace(/_/g, ' ')}</p>
              <TagPill label="Primary" color="#FF3B30" />
            </div>
          )}
          {s.secondary_constraint && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: '#FFA000' }} />
              <p className="text-sm" style={{ color: '#B0B8C8' }}>{s.secondary_constraint.replace(/_/g, ' ')}</p>
              <TagPill label="Secondary" color="#FFA000" />
            </div>
          )}
        </div>
      )}

      {/* ═══ Coach Barrels Section ═══ */}
      
      {/* Diagnostic Question Loop */}
      {questionState && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: '#1A1508', border: '1px solid #3D3510' }}>
          <div className="flex items-center gap-2">
            <span className="text-base">🛢️</span>
            <p className="text-xs font-semibold uppercase" style={{ color: '#F59E0B' }}>Coach Barrels has a question</p>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#E2E8F0' }}>{questionState.voice_sample}</p>
          <div className="rounded-lg p-3" style={{ background: '#111827', border: '1px solid #1E2535' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#F59E0B' }}>
              <MessageSquare className="h-3 w-3 inline mr-1" />
              Answer this:
            </p>
            <p className="text-sm mb-3 italic" style={{ color: '#B0B8C8' }}>"{questionState.question_text}"</p>
            <Textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="min-h-[80px] text-sm border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
            />
            <Button
              onClick={submitAnswer}
              disabled={submittingAnswer || !answer.trim()}
              className="mt-2 bg-amber-600 hover:bg-amber-700 text-white"
              size="sm"
            >
              {submittingAnswer ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Classifying...</>
              ) : (
                <><Send className="h-3 w-3 mr-1" /> Submit Answer</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Existing Coach Barrels Results */}
      {s.coach_barrels_voice_sample && (
        <div className="rounded-xl p-4" style={{ background: '#0D1520', border: '1px solid #1A3050' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🛢️</span>
            <p className="text-xs font-semibold uppercase" style={{ color: '#F59E0B' }}>Coach Barrels</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#1E2535', color: '#6B7A8F' }}>
              Coach Rick AI inside 4B
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#E2E8F0' }}>{s.coach_barrels_voice_sample}</p>
          {Array.isArray(s.coach_barrels_classification) && s.coach_barrels_classification.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {s.coach_barrels_classification.map((fc: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: fc.classification === 'capacity' ? '#FF3B30' : fc.classification === 'recruitment' ? '#22C55E' : '#FFA000' }}
                  />
                  <span style={{ color: '#B0B8C8' }}>
                    {(FLAG_LABELS[fc.flag_id]?.label || fc.flag_id)} — <strong style={{ color: fc.classification === 'capacity' ? '#FF3B30' : '#22C55E' }}>{fc.classification}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
          {s.coach_barrels_prescription && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1E2535' }}>
              <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: '#F59E0B' }}>Prescription</p>
              {s.coach_barrels_prescription.drills?.length > 0 && (
                <p className="text-xs" style={{ color: '#B0B8C8' }}>
                  Drills: {s.coach_barrels_prescription.drills.join(', ')}
                </p>
              )}
              {s.coach_barrels_prescription.tools?.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: '#B0B8C8' }}>
                  Tools: {s.coach_barrels_prescription.tools.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Run Coach Barrels button — show if active flags exist and no analysis yet */}
      {hasActiveFlags && !hasCoachBarrels && !questionState && (
        <Button
          onClick={runCoachBarrels}
          disabled={running}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold"
          size="lg"
        >
          {running ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Running Coach Barrels...</>
          ) : (
            <>🛢️ Run Coach Barrels Diagnostic</>
          )}
        </Button>
      )}

      {/* Re-run option if analysis already exists */}
      {hasActiveFlags && hasCoachBarrels && !questionState && (
        <Button
          onClick={runCoachBarrels}
          disabled={running}
          variant="outline"
          className="w-full border-amber-700 text-amber-400 hover:bg-amber-900/20"
          size="sm"
        >
          {running ? (
            <><Loader2 className="h-3 w-3 animate-spin mr-2" /> Re-analyzing...</>
          ) : (
            <>🛢️ Re-run Coach Barrels</>
          )}
        </Button>
      )}

      {/* Focus for Next BP */}
      {s.focus_next_bp && (
        <div className="rounded-xl p-4" style={{ background: '#14200D', border: '1px solid #2D4A1A' }}>
          <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#22C55E' }}>🎯 Focus for Next BP</p>
          <p className="text-sm font-semibold leading-relaxed" style={{ color: '#E2E8F0' }}>{s.focus_next_bp}</p>
        </div>
      )}

      {/* Cues */}
      {cues.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#6B7A8F' }}>Coaching Cues</p>
          <div className="flex flex-wrap gap-2">
            {cues.map((cue, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: '#1E2535', color: '#00B4D8' }}
              >
                {cue}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Drills */}
      {drills.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#6B7A8F' }}>Recommended Drills</p>
          <div className="space-y-2">
            {drills.map((d, i) => (
              <div
                key={i}
                className="rounded-lg p-3"
                style={{ background: '#111827', border: '1px solid #1E2535' }}
              >
                <p className="text-sm font-bold" style={{ color: '#fff' }}>{d.name || 'Drill'}</p>
                {d.reason && (
                  <p className="text-xs mt-0.5" style={{ color: '#6B7A8F' }}>{d.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
