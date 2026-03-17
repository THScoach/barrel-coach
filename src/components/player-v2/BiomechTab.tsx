/**
 * Biomech Tab — Lists hitting_4b_krs_sessions with expandable detail view
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { TagPill } from "@/components/player-v2/TagPill";
import { scoreColor } from "@/lib/player-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Zap, Target, Brain } from "lucide-react";
import { format } from "date-fns";

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

  useEffect(() => {
    if (!playerId) { setLoading(false); return; }
    const fetchSessions = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("hitting_4b_krs_sessions")
        .select("id, session_date, krs_score, body_score, brain_score, bat_score, ball_score, weakest_b, main_constraint, secondary_constraint, has_sequence_issue, has_momentum_issue, has_plane_issue, has_range_usage_issue, has_balance_stability_issue, summary_player_text, summary_coach_text, focus_next_bp, recommended_cues, recommended_drills")
        .eq("player_id", playerId)
        .order("session_date", { ascending: false })
        .limit(50);
      if (data) setSessions(data as unknown as BiomechSession[]);
      setLoading(false);
    };
    fetchSessions();
  }, [playerId]);

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
    return <BiomechDetail session={selected} onBack={() => setSelectedId(null)} />;
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
                  <TagPill
                    label={`Weakest: ${s.weakest_b.toUpperCase()}`}
                    color="#FF3B30"
                  />
                )}
                {s.main_constraint && (
                  <TagPill
                    label={s.main_constraint.replace(/_/g, ' ')}
                    color="#FFA000"
                  />
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

function BiomechDetail({ session: s, onBack }: { session: BiomechSession; onBack: () => void }) {
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

  const cues: string[] = Array.isArray(s.recommended_cues) ? s.recommended_cues : [];
  const drills: any[] = Array.isArray(s.recommended_drills) ? s.recommended_drills : [];

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-semibold"
        style={{ color: '#FF3B30' }}
      >
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

      {/* Player Summary — prominent */}
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
                <Icon
                  className="h-5 w-5 flex-shrink-0"
                  style={{ color: f.active ? '#FF3B30' : '#22C55E' }}
                />
                <p className="text-sm font-semibold" style={{ color: f.active ? '#FF3B30' : '#22C55E' }}>
                  {f.label}
                </p>
                <p className="text-xs ml-auto" style={{ color: '#6B7A8F' }}>
                  {f.active ? 'Issue detected' : 'Looks good'}
                </p>
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
              <p className="text-sm font-semibold" style={{ color: '#fff' }}>
                {s.main_constraint.replace(/_/g, ' ')}
              </p>
              <TagPill label="Primary" color="#FF3B30" />
            </div>
          )}
          {s.secondary_constraint && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: '#FFA000' }} />
              <p className="text-sm" style={{ color: '#B0B8C8' }}>
                {s.secondary_constraint.replace(/_/g, ' ')}
              </p>
              <TagPill label="Secondary" color="#FFA000" />
            </div>
          )}
        </div>
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
