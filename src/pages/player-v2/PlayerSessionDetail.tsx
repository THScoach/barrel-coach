/**
 * Player Session Detail — Shows 2D or 3D analysis for a specific session
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { Video2DAnalysisCard } from "@/components/admin/Video2DAnalysisCard";
import { Skeleton } from "@/components/ui/skeleton";
import { scoreColor } from "@/lib/player-utils";
import { ArrowLeft, Play, Cpu } from "lucide-react";
import { format } from "date-fns";

type SessionSource = '2d' | '3d' | null;

interface Session2D {
  id: string;
  session_date: string;
  composite_score: number | null;
  grade: string | null;
  body_score: number | null;
  brain_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  leak_detected: string | null;
  leak_evidence: string | null;
  motor_profile: string | null;
  coach_rick_take: string | null;
  priority_drill: string | null;
  analysis_confidence: number | null;
  video_url: string;
  video_filename: string | null;
  is_paid_user: boolean | null;
  pending_3d_analysis: boolean | null;
  analysis_json: any;
}

interface Session3D {
  id: string;
  session_date: string;
  overall_score: number | null;
  body_score: number | null;
  brain_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  leak_type: string | null;
  raw_metrics: any;
  swing_duration_ms: number | null;
  swing_classification: string | null;
  scoreable: boolean | null;
}

interface ComparisonScores {
  composite: number | null;
  body: number | null;
  brain: number | null;
  bat: number | null;
  ball: number | null;
}

export default function PlayerSessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { source: sourceParam } = Object.fromEntries(new URLSearchParams(window.location.search));
  const navigate = useNavigate();
  const { player, loading: playerLoading } = usePlayerData();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [session2D, setSession2D] = useState<Session2D | null>(null);
  const [session3D, setSession3D] = useState<Session3D | null>(null);
  const [source, setSource] = useState<SessionSource>(null);
  const [loading, setLoading] = useState(true);
  const [comparisonMode, setComparisonMode] = useState<'current' | 'baseline' | 'best'>('current');
  const [comparisonData, setComparisonData] = useState<ComparisonScores | null>(null);

  // Fetch session data
  useEffect(() => {
    if (!sessionId) return;
    const fetchData = async () => {
      setLoading(true);

      // Try both tables in parallel
      const [res2d, res3d] = await Promise.all([
        supabase
          .from("video_2d_sessions")
          .select("id, session_date, composite_score, grade, body_score, brain_score, bat_score, ball_score, leak_detected, leak_evidence, motor_profile, coach_rick_take, priority_drill, analysis_confidence, video_url, video_filename, is_paid_user, pending_3d_analysis, analysis_json")
          .eq("id", sessionId)
          .maybeSingle(),
        supabase
          .from("player_sessions")
          .select("id, session_date, overall_score, body_score, brain_score, bat_score, ball_score, leak_type, raw_metrics, swing_duration_ms, swing_classification, scoreable")
          .eq("id", sessionId)
          .maybeSingle(),
      ]);

      if (res2d.data) {
        setSession2D(res2d.data);
        setSource('2d');
      } else if (res3d.data) {
        setSession3D(res3d.data);
        setSource('3d');
      } else {
        setSource(null);
      }
      setLoading(false);
    };
    fetchData();
  }, [sessionId]);

  // Poll for 3D analysis completion when pending
  useEffect(() => {
    if (source !== '2d' || !session2D?.pending_3d_analysis || !player?.id) return;

    const interval = setInterval(async () => {
      // Check if a player_session appeared for the same date
      const { data: ps } = await supabase
        .from("player_sessions")
        .select("id, session_date, overall_score, body_score, brain_score, bat_score, ball_score, leak_type, raw_metrics")
        .eq("player_id", player.id)
        .eq("session_date", session2D.session_date)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ps) {
        setSession3D(ps);
        // Clear the pending flag
        await supabase
          .from("video_2d_sessions")
          .update({ pending_3d_analysis: false })
          .eq("id", session2D.id);
        setSession2D((prev) => prev ? { ...prev, pending_3d_analysis: false } : prev);
        clearInterval(interval);
      }
    }, 30_000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [source, session2D?.pending_3d_analysis, session2D?.session_date, session2D?.id, player?.id]);

  // Fetch comparison data
  useEffect(() => {
    if (!player?.id || comparisonMode === 'current') {
      setComparisonData(null);
      return;
    }

    const fetchComparison = async () => {
      if (source === '2d') {
        let query = supabase
          .from("video_2d_sessions")
          .select("composite_score, body_score, brain_score, bat_score, ball_score")
          .eq("player_id", player.id)
          .eq("processing_status", "complete");

        if (comparisonMode === 'baseline') {
          query = query.order("session_date", { ascending: true }).limit(1);
        } else {
          query = query.order("composite_score", { ascending: false }).limit(1);
        }

        const { data } = await query.maybeSingle();
        if (data) {
          setComparisonData({
            composite: data.composite_score,
            body: data.body_score,
            brain: data.brain_score,
            bat: data.bat_score,
            ball: data.ball_score,
          });
        }
      } else {
        let query = supabase
          .from("player_sessions")
          .select("overall_score, body_score, brain_score, bat_score, ball_score")
          .eq("player_id", player.id);

        if (comparisonMode === 'baseline') {
          query = query.order("session_date", { ascending: true }).limit(1);
        } else {
          query = query.order("overall_score", { ascending: false }).limit(1);
        }

        const { data } = await query.maybeSingle();
        if (data) {
          setComparisonData({
            composite: data.overall_score,
            body: data.body_score,
            brain: data.brain_score,
            bat: data.bat_score,
            ball: data.ball_score,
          });
        }
      }
    };
    fetchComparison();
  }, [player?.id, comparisonMode, source]);

  const handlePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  if (playerLoading || loading) {
    return (
      <div style={{ background: '#000', minHeight: '100vh' }}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-32" style={{ background: '#111' }} />
          <Skeleton className="h-48 w-full rounded-xl" style={{ background: '#111' }} />
          <Skeleton className="h-24 w-full rounded-xl" style={{ background: '#111' }} />
          <Skeleton className="h-64 w-full rounded-xl" style={{ background: '#111' }} />
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div style={{ background: '#000', minHeight: '100vh' }}>
        <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />
        <div className="flex flex-col items-center justify-center text-center px-6" style={{ paddingTop: '20vh' }}>
          <p className="text-lg font-semibold" style={{ color: '#fff' }}>Session not found</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 rounded-lg text-sm font-bold" style={{ background: '#E63946', color: '#fff' }}>
            Go Back
          </button>
        </div>
        <PlayerBottomNav />
      </div>
    );
  }

  // Compute current display scores
  const displayScores: ComparisonScores = comparisonMode === 'current' || !comparisonData
    ? source === '2d'
      ? { composite: session2D!.composite_score, body: session2D!.body_score, brain: session2D!.brain_score, bat: session2D!.bat_score, ball: session2D!.ball_score }
      : { composite: session3D!.overall_score, body: session3D!.body_score, brain: session3D!.brain_score, bat: session3D!.bat_score, ball: session3D!.ball_score }
    : comparisonData;

  const sessionDate = source === '2d' ? session2D!.session_date : session3D!.session_date;
  const videoUrl = source === '2d' ? session2D!.video_url : null;

  // Build adaptive metrics
  const metrics3D = source === '3d' && session3D?.raw_metrics ? [
    { label: 'Transfer Ratio', value: session3D.raw_metrics.transfer_ratio ?? '—' },
    { label: 'Pelvis KE', value: session3D.raw_metrics.pelvis_ke ? `${session3D.raw_metrics.pelvis_ke}J` : '—' },
    { label: 'P→T Gap', value: session3D.raw_metrics.peak_timing_gap_ms ? `${session3D.raw_metrics.peak_timing_gap_ms}ms` : '—' },
  ] : null;

  const metrics2D = source === '2d' && session2D ? [
    { label: 'Primary Leak', value: session2D.leak_detected?.replace(/_/g, ' ') || 'Clean' },
    { label: 'Composite', value: session2D.composite_score != null ? `${session2D.composite_score}` : '—' },
    { label: 'Motor Profile', value: session2D.motor_profile || '—' },
  ] : null;

  const displayMetrics = metrics3D || metrics2D || [
    { label: 'Transfer Ratio', value: '—' },
    { label: 'Pelvis KE', value: '—' },
    { label: 'P→T Gap', value: '—' },
  ];

  // Build Video2DAnalysisCard props
  const analysis2DProps = session2D ? {
    composite: session2D.composite_score ?? 0,
    body: session2D.body_score ?? 0,
    brain: session2D.brain_score ?? 0,
    bat: session2D.bat_score ?? 0,
    ball: session2D.ball_score ?? 0,
    grade: session2D.grade ?? 'Not graded',
    leak_detected: session2D.leak_detected ?? 'CLEAN_TRANSFER',
    leak_evidence: session2D.leak_evidence ?? '',
    motor_profile: session2D.motor_profile ?? '',
    coach_rick_take: session2D.coach_rick_take ?? '',
    priority_drill: session2D.priority_drill ?? '',
    limitations: ['2D video estimation — Brain & Ball scores capped'],
    confidence: session2D.analysis_confidence ?? 0.6,
    upgrade_cta: '',
    analysis_json: session2D.analysis_json as any,
  } : null;

  const badgeColor = source === '2d' ? '#3B82F6' : '#14B8A6';
  const badgeLabel = source === '2d' ? 'Video Analysis' : '3D Analysis';

  return (
    <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />

      <main className="px-4 pb-24 pt-4 space-y-4">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg" style={{ background: '#111' }}>
            <ArrowLeft className="h-5 w-5" style={{ color: '#a0a0a0' }} />
          </button>
          <div className="flex-1">
            <p className="text-base font-bold" style={{ color: '#fff' }}>
              {format(new Date(sessionDate), 'MMMM d, yyyy')}
            </p>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5"
              style={{ background: `${badgeColor}20`, color: badgeColor }}
            >
              {badgeLabel}
            </span>
          </div>
        </div>

        {/* Video Player */}
        {videoUrl ? (
          <div className="rounded-xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #222' }}>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              className="w-full"
              style={{ aspectRatio: '16/9', objectFit: 'contain', background: '#000' }}
              onLoadedMetadata={() => {
                if (videoRef.current) videoRef.current.playbackRate = playbackRate;
              }}
            />
            <div className="flex gap-2 p-2" style={{ background: '#0a0a0a' }}>
              {[1, 0.5, 0.25].map(rate => (
                <button
                  key={rate}
                  onClick={() => handlePlaybackRate(rate)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: playbackRate === rate ? '#E63946' : '#111',
                    color: playbackRate === rate ? '#fff' : '#555',
                    border: `1px solid ${playbackRate === rate ? '#E63946' : '#222'}`,
                  }}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl flex items-center justify-center" style={{ background: '#0a0a0a', aspectRatio: '16/9', border: '1px solid #222' }}>
            <div className="text-center">
              <Play className="h-12 w-12 mx-auto mb-2" style={{ color: '#555' }} />
              <p className="text-xs" style={{ color: '#555' }}>No video available</p>
            </div>
          </div>
        )}

        {/* Adaptive Metrics */}
        <div className="grid grid-cols-3 gap-3">
          {displayMetrics.map(m => (
            <div key={m.label} className="rounded-lg p-3 text-center" style={{ background: '#111', border: '1px solid #222' }}>
              <p className="text-[10px] uppercase" style={{ color: '#555' }}>{m.label}</p>
              <p className="text-sm font-bold mt-1 truncate" style={{ color: '#fff' }}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Comparison Toggle */}
        <div className="flex gap-2">
          {(['current', 'baseline', 'best'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setComparisonMode(mode)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize"
              style={{
                background: comparisonMode === mode ? '#E63946' : '#111',
                color: comparisonMode === mode ? '#fff' : '#555',
                border: `1px solid ${comparisonMode === mode ? '#E63946' : '#222'}`,
              }}
            >
              {mode === 'current' ? 'This Session' : mode}
            </button>
          ))}
        </div>

        {/* 4B Score Grid (always shown) */}
        <div className="grid grid-cols-4 gap-2">
          {(['body', 'brain', 'bat', 'ball'] as const).map(pillar => {
            const val = displayScores[pillar];
            return (
              <div key={pillar} className="rounded-lg p-3 text-center" style={{ background: '#111', border: '1px solid #222' }}>
                <p className="text-[10px] uppercase font-semibold" style={{ color: '#555' }}>{pillar}</p>
                <p className="text-xl font-bold mt-1" style={{ color: scoreColor(val) }}>{val ?? '—'}</p>
              </div>
            );
          })}
        </div>

        {/* 3D Processing Status */}
        {source === '2d' && session2D?.pending_3d_analysis && (
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)' }}>
            <Cpu className="h-5 w-5 animate-pulse" style={{ color: '#14B8A6' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#14B8A6' }}>3D Analysis Processing...</p>
              <p className="text-xs" style={{ color: '#777' }}>
                Full biomechanical data will appear here automatically when ready (~30-60 min).
              </p>
            </div>
          </div>
        )}

        {/* 3D Scores arrived alongside 2D */}
        {source === '2d' && session3D && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: '#111', border: '1px solid rgba(20,184,166,0.2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(20,184,166,0.15)', color: '#14B8A6' }}>
                3D Analysis
              </span>
              <p className="text-xs font-semibold uppercase" style={{ color: '#555' }}>Biomechanics</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['body', 'brain', 'bat', 'ball'] as const).map(pillar => {
                const val3d = pillar === 'body' ? session3D.body_score
                  : pillar === 'brain' ? session3D.brain_score
                  : pillar === 'bat' ? session3D.bat_score
                  : session3D.ball_score;
                return (
                  <div key={`3d-${pillar}`} className="rounded-lg p-2 text-center" style={{ background: '#0a0a0a', border: '1px solid #222' }}>
                    <p className="text-[9px] uppercase font-semibold" style={{ color: '#14B8A6' }}>{pillar}</p>
                    <p className="text-lg font-bold mt-0.5" style={{ color: scoreColor(val3d) }}>{val3d ?? '—'}</p>
                  </div>
                );
              })}
            </div>
            {session3D.raw_metrics && (
              <div className="mt-2 space-y-1">
                {[
                  { label: 'Transfer Ratio', value: session3D.raw_metrics.transfer_ratio },
                  { label: 'Pelvis KE', value: session3D.raw_metrics.pelvis_ke, unit: 'J' },
                  { label: 'P→T Gap', value: session3D.raw_metrics.peak_timing_gap_ms, unit: 'ms' },
                ].map(m => (
                  <div key={m.label} className="flex justify-between py-1" style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <span className="text-xs" style={{ color: '#777' }}>{m.label}</span>
                    <span className="text-xs font-bold" style={{ color: '#fff' }}>
                      {m.value != null ? `${m.value}${m.unit ? ` ${m.unit}` : ''}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2D Analysis Card */}
        {source === '2d' && analysis2DProps && (
          <Video2DAnalysisCard
            analysis={analysis2DProps}
            isPaidUser={session2D?.is_paid_user ?? false}
            pendingReboot={session2D?.pending_3d_analysis ?? false}
          />
        )}

        {/* 3D Raw Metrics */}
        {source === '3d' && session3D?.raw_metrics && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: '#111', border: '1px solid #222' }}>
            <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#555' }}>Biomechanics Data</p>
            {[
              { label: 'Pelvis Peak Velocity', value: session3D.raw_metrics.pelvis_velocity, unit: 'deg/s' },
              { label: 'Torso Peak Velocity', value: session3D.raw_metrics.torso_velocity, unit: 'deg/s' },
              { label: 'X-Factor', value: session3D.raw_metrics.x_factor, unit: 'deg' },
              { label: 'Transfer Efficiency', value: session3D.raw_metrics.transfer_efficiency, unit: '%' },
            ].map(m => (
              <div key={m.label} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid #222' }}>
                <span className="text-xs" style={{ color: '#777' }}>{m.label}</span>
                <span className="text-xs font-bold" style={{ color: '#fff' }}>
                  {m.value != null ? `${m.value} ${m.unit}` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      <PlayerBottomNav />
    </div>
  );
}
