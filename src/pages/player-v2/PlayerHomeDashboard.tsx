/**
 * Player Home Dashboard — 4B brand rebuild
 * Refactored with extracted sub-components for maintainability
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { KRSRingChart } from "@/components/player-v2/KRSRingChart";
import { PillarScoreCard } from "@/components/player-v2/PillarScoreCard";
import { ScoreHistoryBar } from "@/components/player-v2/ScoreHistoryBar";
import { TagPill } from "@/components/player-v2/TagPill";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { motorProfileColor } from "@/lib/player-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, ChevronRight, Zap, Target, ArrowRight } from "lucide-react";
import { format } from "date-fns";

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
  source?: string;
}

export default function PlayerHomeDashboard() {
  const { player, loading } = usePlayerData();
  const [primaryFlag, setPrimaryFlag] = useState<FlagData | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [projections, setProjections] = useState<any>(null);
  const [drillCount, setDrillCount] = useState(0);
  const [scores2D, setScores2D] = useState<{
    composite: number | null;
    body: number | null;
    brain: number | null;
    bat: number | null;
    ball: number | null;
  } | null>(null);

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
      const [rebootRes, video2dRes] = await Promise.all([
        supabase
          .from("player_sessions")
          .select("id, overall_score, session_date")
          .eq("player_id", player.id)
          .order("session_date", { ascending: false })
          .limit(5),
        supabase
          .from("video_2d_sessions")
          .select("id, composite_score, session_date")
          .eq("player_id", player.id)
          .eq("processing_status", "complete")
          .order("session_date", { ascending: false })
          .limit(5),
      ]);

      const items: SessionHistoryItem[] = [];
      if (rebootRes.data) {
        items.push(...rebootRes.data.map((s) => ({ id: s.id, overall_score: s.overall_score, session_date: s.session_date, source: '3d' })));
      }
      if (video2dRes.data) {
        items.push(...video2dRes.data.map((s) => ({ id: s.id, overall_score: s.composite_score, session_date: s.session_date, source: '2d' })));
      }

      items.sort((a, b) => b.session_date.localeCompare(a.session_date));
      setSessionHistory(items.slice(0, 5).reverse());
    };

    const fetchDrillCount = async () => {
      const { count } = await supabase
        .from("player_drill_assignments")
        .select("id", { count: 'exact', head: true })
        .eq("player_id", player.id)
        .eq("status", "assigned");
      setDrillCount(count ?? 0);
    };

    const fetch2DScores = async () => {
      const { data } = await supabase
        .from("video_2d_sessions")
        .select("composite_score, body_score, brain_score, bat_score, ball_score")
        .eq("player_id", player.id)
        .eq("processing_status", "complete")
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setScores2D({
          composite: data.composite_score,
          body: data.body_score,
          brain: data.brain_score,
          bat: data.bat_score,
          ball: data.ball_score,
        });
      }
    };

    fetchFlag();
    fetchHistory();
    fetchDrillCount();
    fetch2DScores();
  }, [player?.id]);

  if (loading) {
    return (
      <div style={{ background: '#000', minHeight: '100vh' }}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" style={{ background: '#111' }} />
          <Skeleton className="h-52 w-full rounded-xl" style={{ background: '#111' }} />
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" style={{ background: '#111' }} />)}
          </div>
          <Skeleton className="h-24 w-full rounded-xl" style={{ background: '#111' }} />
        </div>
      </div>
    );
  }

  const has3DScores = player?.latest_composite_score != null;
  const krs = has3DScores
    ? Math.round(Number(player.latest_composite_score))
    : scores2D?.composite != null
      ? Math.round(scores2D.composite)
      : null;

  const scores = {
    body: has3DScores ? player?.latest_body_score : scores2D?.body ?? null,
    brain: has3DScores ? player?.latest_brain_score : scores2D?.brain ?? null,
    bat: has3DScores ? player?.latest_bat_score : scores2D?.bat ?? null,
    ball: has3DScores ? player?.latest_ball_score : scores2D?.ball ?? null,
  };

  const scoreSource = has3DScores ? '3D Analysis' : scores2D ? '2D Video' : null;
  const sessionNum = sessionHistory.length + 1;

  return (
    <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <PlayerTopBar
        playerName={player?.name ?? null}
        motorProfile={player?.motor_profile_sensor ?? null}
        statusBadge={player?.account_status === 'queued' ? 'Queued' : null}
      />

      <main className="px-4 pb-24 space-y-3 pt-4">
        {/* KRS + 4B Pillars Card */}
        <div className="rounded-2xl p-5 pb-4" style={{ background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)', border: '1px solid #1a1a1a' }}>
          <KRSRingChart score={krs} />
          <div className="grid grid-cols-4 gap-2 mt-4">
            {(['body', 'brain', 'bat', 'ball'] as const).map(pillar => (
              <PillarScoreCard key={pillar} pillar={pillar} value={scores[pillar]} />
            ))}
          </div>
          {scoreSource && (
            <p className="text-center text-[10px] mt-3 tracking-wide" style={{ color: '#444' }}>
              via {scoreSource} · Tap pillar for details
            </p>
          )}
        </div>

        {/* Motor Profile Card */}
        {player?.motor_profile_sensor && (
          <Link to="/player/profile" className="block rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99]" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${motorProfileColor(player.motor_profile_sensor)}15` }}
              >
                <Zap className="h-5 w-5" style={{ color: motorProfileColor(player.motor_profile_sensor) }} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#555' }}>Motor Profile</p>
                <p className="font-black text-base" style={{ color: '#fff' }}>{player.motor_profile_sensor}</p>
              </div>
              <ChevronRight className="h-4 w-4" style={{ color: '#333' }} />
            </div>
          </Link>
        )}

        {/* Primary Flag Card */}
        {primaryFlag && (
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, rgba(230,57,70,0.08), rgba(230,57,70,0.03))', border: '1px solid rgba(230,57,70,0.2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#E63946' }} />
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#E63946' }}>Primary Fix</span>
            </div>
            <p className="text-base font-black mb-1" style={{ color: '#fff' }}>{primaryFlag.flag_type?.replace(/_/g, ' ')}</p>
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#888' }}>{primaryFlag.message}</p>
            <div className="flex flex-wrap gap-1.5">
              <TagPill label={primaryFlag.severity || 'warning'} color="#E63946" />
              <TagPill label={primaryFlag.pillar || 'body'} color="#ffa500" />
              {primaryFlag.segment && <TagPill label={primaryFlag.segment} color="#4ecdc4" />}
            </div>
          </div>
        )}

        {/* Projected Gain Card */}
        {projections && (
          <div className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#555' }}>Projected Gains</p>
            <div className="grid grid-cols-2 gap-4">
              {projections.projected_bat_speed && (
                <div>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: '#444' }}>Bat Speed</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black" style={{ color: '#fff' }}>{projections.current_bat_speed || '—'}</span>
                    <ArrowRight className="h-3 w-3" style={{ color: '#4ecdc4' }} />
                    <span className="text-lg font-black" style={{ color: '#4ecdc4' }}>{projections.projected_bat_speed}</span>
                  </div>
                </div>
              )}
              {projections.projected_exit_velo && (
                <div>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: '#444' }}>Exit Velo</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black" style={{ color: '#fff' }}>{projections.current_exit_velo || '—'}</span>
                    <ArrowRight className="h-3 w-3" style={{ color: '#4ecdc4' }} />
                    <span className="text-lg font-black" style={{ color: '#4ecdc4' }}>{projections.projected_exit_velo}</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] mt-2" style={{ color: '#333' }}>When primary flag resolves</p>
          </div>
        )}

        {/* Today's Session CTA */}
        <div className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4" style={{ color: '#E63946' }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#555' }}>Today's Session</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <TagPill label={`Session ${sessionNum}`} color="#666" />
            <TagPill label={format(new Date(), 'MMM d')} color="#666" />
            {drillCount > 0 && <TagPill label={`${drillCount} drills`} color="#4ecdc4" />}
          </div>
          <Link
            to="/player/session"
            className="block w-full text-center py-3 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #E63946, #c62b38)' }}
          >
            Start Today's Session
          </Link>
        </div>

        {/* Score History */}
        <ScoreHistoryBar sessions={sessionHistory} />

        {/* No Data State */}
        {!krs && (
          <EmptyState
            icon={<BarChart3 className="h-12 w-12" />}
            title="No scores yet"
            description="Upload your first swing session to see your 4B scores."
            ctaLabel="Start Session"
            ctaTo="/player/session/new"
          />
        )}
      </main>

      <PlayerBottomNav />
    </div>
  );
}
