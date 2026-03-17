/**
 * Player Home Dashboard - Complete rebuild
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { KRSRingChart } from "@/components/player-v2/KRSRingChart";
import { TagPill } from "@/components/player-v2/TagPill";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { scoreColor, motorProfileColor } from "@/lib/player-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, ChevronRight, Zap, Target, ArrowRight } from "lucide-react";

interface FlagData {
  id: string;
  flag_type: string;
  message: string;
  severity: string;
  pillar: string;
  segment: string;
}

interface SessionHistoryItem {
  id: string;
  overall_score: number | null;
  session_date: string;
}

export default function PlayerHomeDashboard() {
  const { player, loading } = usePlayerData();
  const [primaryFlag, setPrimaryFlag] = useState<FlagData | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [projections, setProjections] = useState<any>(null);

  useEffect(() => {
    if (!player?.id) return;

    const fetchFlag = async () => {
      const { data: latestSession } = await supabase
        .from("player_sessions")
        .select("id")
        .eq("player_id", player.id)
        .order("session_date", { ascending: false })
        .limit(1)
        .single();

      if (latestSession) {
        const { data: swings } = await supabase
          .from("swing_analysis")
          .select("id")
          .eq("session_id", latestSession.id)
          .limit(1);

        if (swings && swings.length > 0) {
          const { data: flags } = await supabase
            .from("swing_flags")
            .select("*")
            .eq("swing_id", swings[0].id)
            .order("severity", { ascending: true })
            .limit(1);

          if (flags && flags.length > 0) {
            setPrimaryFlag(flags[0] as unknown as FlagData);
          }
        }

        const { data: sessionData } = await supabase
          .from("player_sessions")
          .select("projections")
          .eq("id", latestSession.id)
          .single();

        if (sessionData?.projections) {
          setProjections(sessionData.projections);
        }
      }
    };

    const fetchHistory = async () => {
      const { data } = await supabase
        .from("player_sessions")
        .select("id, overall_score, session_date")
        .eq("player_id", player.id)
        .order("session_date", { ascending: false })
        .limit(5);

      if (data) setSessionHistory(data.reverse());
    };

    fetchFlag();
    fetchHistory();
  }, [player?.id]);

  if (loading) {
    return (
      <div style={{ background: '#0A0D1A', minHeight: '100vh' }}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" style={{ background: '#1E2535' }} />
          <Skeleton className="h-48 w-full rounded-xl" style={{ background: '#111827' }} />
          <Skeleton className="h-32 w-full rounded-xl" style={{ background: '#111827' }} />
        </div>
      </div>
    );
  }

  const krs = player?.latest_composite_score ? Math.round(Number(player.latest_composite_score)) : null;
  const scores = {
    body: player?.latest_body_score,
    brain: player?.latest_brain_score,
    bat: player?.latest_bat_score,
    ball: player?.latest_ball_score,
  };

  return (
    <div style={{ background: '#0A0D1A', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />

      <main className="px-4 pb-24 space-y-4 pt-4">
        {/* KRS Score Card */}
        <div className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1E2535' }}>
          <KRSRingChart score={krs} />
          <div className="grid grid-cols-4 gap-2 mt-4">
            {(['body', 'brain', 'bat', 'ball'] as const).map(pillar => {
              const val = scores[pillar];
              return (
                <Link
                  key={pillar}
                  to={`/player/data?tab=4b`}
                  className="flex flex-col items-center p-2 rounded-lg transition-colors hover:opacity-80"
                  style={{ background: '#0A0D1A' }}
                >
                  <span className="text-[10px] font-semibold uppercase" style={{ color: '#6B7A8F' }}>{pillar}</span>
                  <span className="text-lg font-bold" style={{ color: scoreColor(val) }}>{val ?? '—'}</span>
                </Link>
              );
            })}
          </div>
          <p className="text-center text-[11px] mt-3" style={{ color: '#6B7A8F' }}>Tap any pillar to see breakdown</p>
        </div>

        {/* Motor Profile Card */}
        {player?.motor_profile_sensor && (
          <Link to="/player/profile" className="block rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1E2535' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${motorProfileColor(player.motor_profile_sensor)}1f` }}>
                <Zap className="h-5 w-5" style={{ color: motorProfileColor(player.motor_profile_sensor) }} />
              </div>
              <div className="flex-1">
                <p className="text-xs" style={{ color: '#6B7A8F' }}>Motor Profile</p>
                <p className="font-bold" style={{ color: '#fff' }}>{player.motor_profile_sensor}</p>
              </div>
              <ChevronRight className="h-4 w-4" style={{ color: '#6B7A8F' }} />
            </div>
          </Link>
        )}

        {/* Primary Flag Card */}
        {primaryFlag && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#FF3B30' }} />
              <span className="text-[11px] font-bold uppercase" style={{ color: '#FF3B30' }}>Primary Fix</span>
            </div>
            <p className="text-base font-bold mb-1" style={{ color: '#fff' }}>{primaryFlag.flag_type?.replace(/_/g, ' ')}</p>
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#B0B8C8' }}>{primaryFlag.message}</p>
            <div className="flex flex-wrap gap-1.5">
              <TagPill label={primaryFlag.severity || 'warning'} color="#FF3B30" />
              <TagPill label={primaryFlag.pillar || 'body'} color="#FFA000" />
              {primaryFlag.segment && <TagPill label={primaryFlag.segment} color="#00B4D8" />}
            </div>
          </div>
        )}

        {/* Projected Gain Card */}
        {projections && (
          <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1E2535' }}>
            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#6B7A8F' }}>Projected Gains</p>
            <div className="grid grid-cols-2 gap-4">
              {projections.projected_bat_speed && (
                <div>
                  <p className="text-[11px]" style={{ color: '#6B7A8F' }}>Bat Speed</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold" style={{ color: '#fff' }}>{projections.current_bat_speed || '—'}</span>
                    <ArrowRight className="h-3 w-3" style={{ color: '#22C55E' }} />
                    <span className="text-lg font-bold" style={{ color: '#22C55E' }}>{projections.projected_bat_speed}</span>
                  </div>
                </div>
              )}
              {projections.projected_exit_velo && (
                <div>
                  <p className="text-[11px]" style={{ color: '#6B7A8F' }}>Exit Velo</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold" style={{ color: '#fff' }}>{projections.current_exit_velo || '—'}</span>
                    <ArrowRight className="h-3 w-3" style={{ color: '#22C55E' }} />
                    <span className="text-lg font-bold" style={{ color: '#22C55E' }}>{projections.projected_exit_velo}</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[11px] mt-2" style={{ color: '#6B7A8F' }}>When primary flag resolves</p>
          </div>
        )}

        {/* Today's Session CTA */}
        <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1E2535' }}>
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4" style={{ color: '#FF3B30' }} />
            <span className="text-xs font-semibold uppercase" style={{ color: '#6B7A8F' }}>Today's Session</span>
          </div>
          <p className="text-sm mb-4" style={{ color: '#B0B8C8' }}>Your personalized drill plan is ready</p>
          <Link
            to="/player/session"
            className="block w-full text-center py-3 rounded-lg text-sm font-bold text-white"
            style={{ background: '#FF3B30' }}
          >
            Start Today's Session
          </Link>
        </div>

        {/* Progress Snapshot */}
        {sessionHistory.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1E2535' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase" style={{ color: '#6B7A8F' }}>KRS History</span>
              <Link to="/player/progress" className="text-xs font-semibold flex items-center gap-1" style={{ color: '#FF3B30' }}>
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex items-end gap-2 h-16">
              {sessionHistory.map((s, i) => {
                const val = s.overall_score ?? 0;
                const maxH = 56;
                const h = (val / 100) * maxH;
                return (
                  <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold" style={{ color: scoreColor(val) }}>{val}</span>
                    <div
                      className="w-full rounded-sm"
                      style={{ height: `${Math.max(h, 4)}px`, background: scoreColor(val), opacity: 0.7 + (i / sessionHistory.length) * 0.3 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No Data State */}
        {!krs && (
          <EmptyState
            icon={<BarChart3 className="h-12 w-12" />}
            title="No scores yet"
            description="Upload your first Reboot session to see your KRS and 4B scores."
            ctaLabel="Start Session"
            ctaTo="/player/session"
          />
        )}
      </main>

      <PlayerBottomNav />
    </div>
  );
}
