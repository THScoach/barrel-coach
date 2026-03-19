/**
 * My Progress — KRS history, flag resolution, projections (4B brand)
 * Now includes video_2d_sessions alongside Reboot sessions with badges
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { TagPill } from "@/components/player-v2/TagPill";
import { scoreColor } from "@/lib/player-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, ArrowRight } from "lucide-react";

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

      // Fetch both 3D and 2D sessions in parallel
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

      // Sort by date ascending
      merged.sort((a, b) => a.session_date.localeCompare(b.session_date));
      setSessions(merged);

      // Fetch flags from Reboot sessions only
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
    return (
      <div style={{ background: '#000', minHeight: '100vh' }}>
        <Skeleton className="h-14 w-full" style={{ background: '#111' }} />
        <div className="p-4 space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" style={{ background: '#111' }} />
          <Skeleton className="h-48 w-full rounded-xl" style={{ background: '#111' }} />
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
        <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />
        <div className="flex flex-col items-center justify-center text-center px-6" style={{ paddingTop: '20vh' }}>
          <BarChart3 className="mb-4" style={{ color: '#E63946' }} size={48} strokeWidth={2} />
          <h2 className="text-[22px] font-semibold mb-2" style={{ color: '#ffffff' }}>No Progress Data Yet</h2>
          <p className="text-base mb-6 max-w-xs" style={{ color: '#a0a0a0' }}>Complete your first session to start tracking your score over time.</p>
          <button
            onClick={() => navigate('/player/session/new')}
            className="px-6 py-3 rounded-lg text-sm font-bold text-white"
            style={{ background: '#E63946' }}
          >
            Upload Swings
          </button>
        </div>
        <PlayerBottomNav />
      </div>
    );
  }

  // Only use scoreable sessions for baseline/current/projected calculations
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

      <main className="px-4 pb-24 pt-4 space-y-4">
        {/* Score Summary */}
        <div className="rounded-xl p-5" style={{ background: '#111', border: '1px solid #222' }}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[11px] uppercase font-medium" style={{ color: '#555' }}>Baseline</p>
              <p className="text-2xl font-bold" style={{ color: '#fff' }}>{baseline}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase font-medium" style={{ color: '#555' }}>Current</p>
              <p className="text-2xl font-bold" style={{ color: scoreColor(current) }}>{current}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase font-medium" style={{ color: '#555' }}>Projected</p>
              <p className="text-2xl font-bold" style={{ color: '#4ecdc4' }}>{projected}</p>
            </div>
          </div>
          {gain !== 0 && (
            <div className="mt-3 text-center rounded-lg py-2" style={{ background: 'rgba(78,205,196,0.08)' }}>
              <span className="text-sm font-semibold" style={{ color: '#4ecdc4' }}>
                +{gain} points over {sessions.length} sessions
              </span>
            </div>
          )}
        </div>

        {/* Score Timeline with source badges */}
        <div className="rounded-xl p-5" style={{ background: '#111', border: '1px solid #222' }}>
          <p className="text-xs font-semibold uppercase mb-4" style={{ color: '#555' }}>Score Timeline</p>
          <div className="space-y-2">
            {[...sessions].reverse().slice(0, 10).map((s) => {
              const score = s.overall_score ?? 0;
              const badgeColor = s.source === '2d' ? '#3B82F6' : '#14B8A6';
              const badgeLabel = s.source === '2d' ? 'Video Analysis' : '3D Analysis';
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/player/session/${s.id}`)}
                  className="flex items-center gap-3 rounded-lg p-3 w-full text-left hover:opacity-80 transition-opacity"
                  style={{ background: '#0a0a0a', border: '1px solid #222' }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: scoreColor(score) }}>{score}</span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${badgeColor}20`, color: badgeColor }}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                    <span className="text-[11px]" style={{ color: '#555' }}>{s.session_date}</span>
                  </div>
                  <div
                    className="h-6 rounded-sm"
                    style={{ width: `${Math.max(score, 5)}%`, maxWidth: '120px', background: badgeColor, opacity: 0.6 }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Flag Resolution Tracker */}
        {allFlags.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: '#111', border: '1px solid #222' }}>
            <p className="text-xs font-semibold uppercase mb-4" style={{ color: '#555' }}>Flag Resolution Tracker</p>
            <div className="space-y-3">
              {[...new Map(allFlags.map(f => [f.flag_type, f])).values()].map(f => {
                const statusColor = f.severity === 'resolved' ? '#4ecdc4' : f.severity === 'improving' ? '#ffa500' : '#E63946';
                const statusLabel = f.severity === 'resolved' ? 'RESOLVED' : f.severity === 'improving' ? 'IMPROVING' : 'ACTIVE';
                return (
                  <div key={f.id} className="rounded-lg p-3" style={{ background: '#0a0a0a', border: '1px solid #222' }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold" style={{ color: '#fff' }}>{f.flag_type?.replace(/_/g, ' ')}</p>
                      <TagPill label={statusLabel} color={statusColor} />
                    </div>
                    <p className="text-[12px]" style={{ color: '#777' }}>{f.message}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Projected vs Actual */}
        {latestProjections && (
          <div className="grid grid-cols-2 gap-3">
            {latestProjections.projected_bat_speed && (
              <div className="rounded-xl p-4 text-center" style={{ background: '#111', border: '1px solid #222' }}>
                <p className="text-[11px] uppercase font-medium" style={{ color: '#555' }}>Bat Speed</p>
                <p className="text-xl font-bold mt-1" style={{ color: '#fff' }}>{latestProjections.current_bat_speed || '—'}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <ArrowRight className="h-3 w-3" style={{ color: '#4ecdc4' }} />
                  <span className="text-sm font-bold" style={{ color: '#4ecdc4' }}>{latestProjections.projected_bat_speed}</span>
                </div>
              </div>
            )}
            {latestProjections.projected_exit_velo && (
              <div className="rounded-xl p-4 text-center" style={{ background: '#111', border: '1px solid #222' }}>
                <p className="text-[11px] uppercase font-medium" style={{ color: '#555' }}>Exit Velo</p>
                <p className="text-xl font-bold mt-1" style={{ color: '#fff' }}>{latestProjections.current_exit_velo || '—'}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <ArrowRight className="h-3 w-3" style={{ color: '#4ecdc4' }} />
                  <span className="text-sm font-bold" style={{ color: '#4ecdc4' }}>{latestProjections.projected_exit_velo}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-[11px]" style={{ color: '#555' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#3B82F6' }} />
            <span>Video Analysis</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#14B8A6' }} />
            <span>3D Analysis</span>
          </div>
        </div>
      </main>

      <PlayerBottomNav />
    </div>
  );
}
