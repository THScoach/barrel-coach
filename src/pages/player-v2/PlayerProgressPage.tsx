/**
 * My Progress — KRS history, flag resolution, projections (4B brand)
 * Polished with consistent styling
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { TagPill } from "@/components/player-v2/TagPill";
import { scoreColor } from "@/lib/player-utils";
import { ProgressSkeleton } from "@/components/player-v2/PageSkeleton";
import { BarChart3, ArrowRight, ChevronRight } from "lucide-react";

interface SessionScore {
  id: string;
  session_date: string;
  overall_score: number | null;
  projections: any;
  source: '3d' | '2d';
  scoreable?: boolean;
  swing_classification?: string;
}

interface FlagHistory {
  id: string;
  flag_type: string;
  severity: string;
  pillar: string;
  message: string;
  created_at: string;
}

export default function PlayerProgress() {
  const { player, loading } = usePlayerData();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionScore[]>([]);
  const [allFlags, setAllFlags] = useState<FlagHistory[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!player?.id) {
      if (!loading) setLoadingData(false);
      return;
    }
    const fetchData = async () => {
      setLoadingData(true);

      const [rebootRes, video2dRes] = await Promise.all([
        supabase
          .from("player_sessions")
          .select("id, session_date, overall_score, projections, scoreable, swing_classification")
          .eq("player_id", player.id)
          .order("session_date", { ascending: true }),
        supabase
          .from("video_2d_sessions")
          .select("id, session_date, composite_score")
          .eq("player_id", player.id)
          .eq("processing_status", "complete")
          .order("session_date", { ascending: true }),
      ]);

      const merged: SessionScore[] = [];

      if (rebootRes.data) {
        merged.push(...rebootRes.data.map((s) => ({
          id: s.id,
          session_date: s.session_date,
          overall_score: s.overall_score,
          projections: s.projections,
          source: '3d' as const,
          scoreable: (s as any).scoreable ?? true,
          swing_classification: (s as any).swing_classification ?? 'unknown',
        })));
      }

      if (video2dRes.data) {
        merged.push(...video2dRes.data.map((s) => ({
          id: s.id,
          session_date: s.session_date,
          overall_score: s.composite_score,
          projections: null,
          source: '2d' as const,
        })));
      }

      merged.sort((a, b) => a.session_date.localeCompare(b.session_date));
      setSessions(merged);

      const rebootSessions = rebootRes.data || [];
      if (rebootSessions.length > 0) {
        const sessionIds = rebootSessions.map(s => s.id);
        const { data: swings } = await supabase
          .from("swing_analysis")
          .select("id, session_id")
          .in("session_id", sessionIds);

        if (swings && swings.length > 0) {
          const swingIds = swings.map(s => s.id);
          const { data: flagsData } = await supabase
            .from("swing_flags")
            .select("id, flag_type, severity, pillar, message, created_at")
            .in("swing_id", swingIds)
            .order("created_at", { ascending: true });

          if (flagsData) setAllFlags(flagsData as unknown as FlagHistory[]);
        }
      }
      setLoadingData(false);
    };
    fetchData();
  }, [player?.id, loading]);

  if (loading || loadingData) {
    return <ProgressSkeleton />;
  }

  if (sessions.length === 0) {
    return (
      <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
        <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />
        <div className="flex flex-col items-center justify-center text-center px-6" style={{ paddingTop: '20vh' }}>
          <BarChart3 className="mb-4" style={{ color: '#E63946' }} size={48} strokeWidth={2} />
          <h2 className="text-xl font-black mb-2" style={{ color: '#ffffff' }}>No Progress Data Yet</h2>
          <p className="text-sm mb-6 max-w-xs" style={{ color: '#666' }}>Complete your first session to start tracking your score over time.</p>
          <button
            onClick={() => navigate('/player/session/new')}
            className="px-6 py-3 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #E63946, #c62b38)' }}
          >
            Upload Swings
          </button>
        </div>
        <PlayerBottomNav />
      </div>
    );
  }

  const scoreableSessions = sessions.filter(s => s.scoreable !== false && s.overall_score != null);
  const baseline = scoreableSessions[0]?.overall_score ?? 0;
  const current = scoreableSessions[scoreableSessions.length - 1]?.overall_score ?? 0;
  const latestReboot = [...scoreableSessions].reverse().find(s => s.source === '3d');
  const latestProjections = latestReboot?.projections;
  const projected = latestProjections?.projected_krs ?? current;
  const gain = current - baseline;

  return (
    <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />

      <main className="px-4 pb-24 pt-4 space-y-3">
        {/* Score Summary */}
        <div className="rounded-2xl p-5 animate-fade-up" style={{ background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)', border: '1px solid #1a1a1a' }}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#444' }}>Baseline</p>
              <p className="text-2xl font-black mt-1" style={{ color: '#666' }}>{baseline}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#444' }}>Current</p>
              <p className="text-2xl font-black mt-1" style={{ color: scoreColor(current) }}>{current}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#444' }}>Projected</p>
              <p className="text-2xl font-black mt-1" style={{ color: '#4ecdc4' }}>{projected}</p>
            </div>
          </div>
          {gain !== 0 && (
            <div className="mt-3 text-center rounded-xl py-2" style={{ background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.15)' }}>
              <span className="text-sm font-black" style={{ color: '#4ecdc4' }}>
                +{gain} points over {scoreableSessions.length} sessions
              </span>
            </div>
          )}
        </div>

        {/* Score Timeline */}
        <div className="rounded-2xl p-5 animate-fade-up-d1" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: '#555' }}>Score Timeline</p>
          <div className="space-y-2">
            {[...sessions].reverse().slice(0, 10).map((s) => {
              const score = s.overall_score ?? 0;
              const isNonScoreable = s.scoreable === false;
              const classificationBadge: Record<string, { color: string; label: string }> = {
                load_overweight: { color: '#A855F7', label: 'Load' },
                walkthrough: { color: '#6B7280', label: 'Walkthrough' },
                partial_capture: { color: '#EAB308', label: 'Partial' },
                competitive: { color: '#14B8A6', label: 'Competitive' },
              };
              const classBadge = s.swing_classification ? classificationBadge[s.swing_classification] : null;
              const badgeColor = s.source === '2d' ? '#3B82F6' : '#14B8A6';
              const badgeLabel = s.source === '2d' ? 'Video' : '3D';
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/player/session/${s.id}`)}
                  className="flex items-center gap-3 rounded-xl p-3 w-full text-left transition-all hover:scale-[1.01] active:scale-[0.98]"
                  style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', opacity: isNonScoreable ? 0.5 : 1 }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black" style={{ color: isNonScoreable ? '#444' : scoreColor(score) }}>
                        {isNonScoreable ? '—' : score}
                      </span>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: `${badgeColor}15`, color: badgeColor }}
                      >
                        {badgeLabel}
                      </span>
                      {classBadge && s.swing_classification !== 'competitive' && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: `${classBadge.color}15`, color: classBadge.color }}
                        >
                          {classBadge.label}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px]" style={{ color: '#444' }}>{s.session_date}</span>
                  </div>
                  {!isNonScoreable && (
                    <div
                      className="h-5 rounded-md"
                      style={{ width: `${Math.max(score, 5)}%`, maxWidth: '100px', background: `linear-gradient(90deg, ${badgeColor}, ${badgeColor}88)`, opacity: 0.6 }}
                    />
                  )}
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: '#333' }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Flag Resolution Tracker */}
        {allFlags.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: '#555' }}>Flag Resolution</p>
            <div className="space-y-2">
              {[...new Map(allFlags.map(f => [f.flag_type, f])).values()].map(f => {
                const statusColor = f.severity === 'resolved' ? '#4ecdc4' : f.severity === 'improving' ? '#ffa500' : '#E63946';
                const statusLabel = f.severity === 'resolved' ? 'RESOLVED' : f.severity === 'improving' ? 'IMPROVING' : 'ACTIVE';
                return (
                  <div key={f.id} className="rounded-xl p-3" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-black" style={{ color: '#fff' }}>{f.flag_type?.replace(/_/g, ' ')}</p>
                      <TagPill label={statusLabel} color={statusColor} />
                    </div>
                    <p className="text-[11px]" style={{ color: '#555' }}>{f.message}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Projected vs Actual */}
        {latestProjections && (
          <div className="grid grid-cols-2 gap-2">
            {latestProjections.projected_bat_speed && (
              <div className="rounded-2xl p-4 text-center" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#444' }}>Bat Speed</p>
                <p className="text-xl font-black mt-1" style={{ color: '#fff' }}>{latestProjections.current_bat_speed || '—'}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <ArrowRight className="h-3 w-3" style={{ color: '#4ecdc4' }} />
                  <span className="text-sm font-black" style={{ color: '#4ecdc4' }}>{latestProjections.projected_bat_speed}</span>
                </div>
              </div>
            )}
            {latestProjections.projected_exit_velo && (
              <div className="rounded-2xl p-4 text-center" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#444' }}>Exit Velo</p>
                <p className="text-xl font-black mt-1" style={{ color: '#fff' }}>{latestProjections.current_exit_velo || '—'}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <ArrowRight className="h-3 w-3" style={{ color: '#4ecdc4' }} />
                  <span className="text-sm font-black" style={{ color: '#4ecdc4' }}>{latestProjections.projected_exit_velo}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-[10px] font-semibold" style={{ color: '#444' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm" style={{ background: '#3B82F6' }} />
            <span>Video</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm" style={{ background: '#14B8A6' }} />
            <span>3D Analysis</span>
          </div>
        </div>
      </main>

      <PlayerBottomNav />
    </div>
  );
}
