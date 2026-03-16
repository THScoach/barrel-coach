/**
 * My Progress - KRS history, flag resolution, projections
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { TagPill } from "@/components/player-v2/TagPill";
import { scoreColor } from "@/lib/player-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ArrowRight, Flag } from "lucide-react";

interface SessionScore {
  id: string;
  session_date: string;
  overall_score: number | null;
  projections: any;
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
  const [sessions, setSessions] = useState<SessionScore[]>([]);
  const [allFlags, setAllFlags] = useState<FlagHistory[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!player?.id) return;
    const fetchData = async () => {
      setLoadingData(true);
      const { data: sessData } = await supabase
        .from("player_sessions")
        .select("id, session_date, overall_score, projections")
        .eq("player_id", player.id)
        .order("session_date", { ascending: true });

      if (sessData) setSessions(sessData);

      // Get all flags across all sessions
      if (sessData && sessData.length > 0) {
        const sessionIds = sessData.map(s => s.id);
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
  }, [player?.id]);

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
        <EmptyState icon={<TrendingUp className="h-12 w-12" />} title="No progress data" description="Complete sessions to track your improvement over time" ctaLabel="Start Session" ctaTo="/player/session" />
        <PlayerBottomNav />
      </div>
    );
  }

  const baseline = sessions[0]?.overall_score ?? 0;
  const current = sessions[sessions.length - 1]?.overall_score ?? 0;
  const latestProjections = sessions[sessions.length - 1]?.projections;
  const projected = latestProjections?.projected_krs ?? current;
  const gain = current - baseline;

  return (
    <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />

      <main className="px-4 pb-24 pt-4 space-y-4">
        {/* KRS Summary */}
        <div className="rounded-xl p-5" style={{ background: '#111', border: '1px solid #222' }}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[11px] uppercase" style={{ color: '#555' }}>Baseline</p>
              <p className="text-2xl font-bold" style={{ color: '#fff' }}>{baseline}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase" style={{ color: '#555' }}>Current</p>
              <p className="text-2xl font-bold" style={{ color: scoreColor(current) }}>{current}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase" style={{ color: '#555' }}>Projected</p>
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

        {/* Flag Resolution Tracker */}
        {allFlags.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: '#111', border: '1px solid #222' }}>
            <p className="text-xs font-semibold uppercase mb-4" style={{ color: '#777' }}>Flag Resolution Tracker</p>
            <div className="space-y-3">
              {/* Deduplicate flags by type */}
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
                <p className="text-[11px] uppercase" style={{ color: '#555' }}>Bat Speed</p>
                <p className="text-xl font-bold mt-1" style={{ color: '#fff' }}>{latestProjections.current_bat_speed || '—'}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <ArrowRight className="h-3 w-3" style={{ color: '#4ecdc4' }} />
                  <span className="text-sm font-bold" style={{ color: '#4ecdc4' }}>{latestProjections.projected_bat_speed}</span>
                </div>
              </div>
            )}
            {latestProjections.projected_exit_velo && (
              <div className="rounded-xl p-4 text-center" style={{ background: '#111', border: '1px solid #222' }}>
                <p className="text-[11px] uppercase" style={{ color: '#555' }}>Exit Velo</p>
                <p className="text-xl font-bold mt-1" style={{ color: '#fff' }}>{latestProjections.current_exit_velo || '—'}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <ArrowRight className="h-3 w-3" style={{ color: '#4ecdc4' }} />
                  <span className="text-sm font-bold" style={{ color: '#4ecdc4' }}>{latestProjections.projected_exit_velo}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[11px]" style={{ color: '#555' }}>Projections update after each Reboot upload</p>
      </main>

      <PlayerBottomNav />
    </div>
  );
}
