/**
 * Player Session Detail — Shows 2D or 3D analysis for a specific session
 * Polished with consistent 4B brand styling
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useAuth } from "@/contexts/AuthContext";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { PillarScoreCard } from "@/components/player-v2/PillarScoreCard";
import { Video2DAnalysisCard } from "@/components/admin/Video2DAnalysisCard";
import { EnergyDeliveryReport } from "@/components/player-v2/session-report/EnergyDeliveryReport";
import { SessionDetailSkeleton } from "@/components/player-v2/PageSkeleton";
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
  const navigate = useNavigate();
  const { player, loading: playerLoading } = usePlayerData();
  const { isAdmin } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [session2D, setSession2D] = useState<Session2D | null>(null);
  const [session3D, setSession3D] = useState<Session3D | null>(null);
  const [source, setSource] = useState<SessionSource>(null);
  const [loading, setLoading] = useState(true);
  const [comparisonMode, setComparisonMode] = useState<'current' | 'baseline' | 'best'>('current');
  const [comparisonData, setComparisonData] = useState<ComparisonScores | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const fetchData = async () => {
      setLoading(true);
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
      const { data: ps } = await supabase
        .from("player_sessions")
        .select("id, session_date, overall_score, body_score, brain_score, bat_score, ball_score, leak_type, raw_metrics, swing_duration_ms, swing_classification, scoreable")
        .eq("player_id", player.id)
        .eq("session_date", session2D.session_date)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ps) {
        setSession3D(ps);
        await supabase
          .from("video_2d_sessions")
          .update({ pending_3d_analysis: false })
          .eq("id", session2D.id);
        setSession2D((prev) => prev ? { ...prev, pending_3d_analysis: false } : prev);
        clearInterval(interval);
      }
    }, 30_000);
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
          setComparisonData({ composite: data.composite_score, body: data.body_score, brain: data.brain_score, bat: data.bat_score, ball: data.ball_score });
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
          setComparisonData({ composite: data.overall_score, body: data.body_score, brain: data.brain_score, bat: data.bat_score, ball: data.ball_score });
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
    return <SessionDetailSkeleton />;
  }

  if (!source) {
    return (
      <div style={{ background: '#000', minHeight: '100vh' }}>
        <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />
        <div className="flex flex-col items-center justify-center text-center px-6" style={{ paddingTop: '20vh' }}>
          <p className="text-lg font-black" style={{ color: '#fff' }}>Session not found</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-black transition-all hover:opacity-90" style={{ background: '#E63946', color: '#fff' }}>
            Go Back
          </button>
        </div>
        <PlayerBottomNav />
      </div>
    );
  }

  const displayScores: ComparisonScores = comparisonMode === 'current' || !comparisonData
    ? source === '2d'
      ? { composite: session2D!.composite_score, body: session2D!.body_score, brain: session2D!.brain_score, bat: session2D!.bat_score, ball: session2D!.ball_score }
      : { composite: session3D!.overall_score, body: session3D!.body_score, brain: session3D!.brain_score, bat: session3D!.bat_score, ball: session3D!.ball_score }
    : comparisonData;

  const sessionDate = source === '2d' ? session2D!.session_date : session3D!.session_date;
  const videoUrl = source === '2d' ? session2D!.video_url : null;

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

  const classificationConfig: Record<string, { color: string; label: string }> = {
    competitive: { color: '#14B8A6', label: 'Competitive' },
    load_overweight: { color: '#A855F7', label: 'Load / Overweight' },
    walkthrough: { color: '#6B7280', label: 'Walkthrough' },
    partial_capture: { color: '#EAB308', label: 'Partial Capture' },
  };
  const swingClass = source === '3d' && session3D?.swing_classification
    ? classificationConfig[session3D.swing_classification] ?? null
    : null;
  const isExcluded = source === '3d' && session3D?.scoreable === false;

  return (
    <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />

      <main className="px-4 pb-24 pt-4 space-y-3">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <ArrowLeft className="h-5 w-5" style={{ color: '#666' }} />
          </button>
          <div className="flex-1">
            <p className="text-base font-black" style={{ color: '#fff' }}>
              {format(new Date(sessionDate), 'MMMM d, yyyy')}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: `${badgeColor}15`, color: badgeColor }}
              >
                {badgeLabel}
              </span>
              {swingClass && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: `${swingClass.color}15`, color: swingClass.color }}
                >
                  {swingClass.label}
                  {session3D?.swing_duration_ms ? ` · ${Math.round(session3D.swing_duration_ms)}ms` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Excluded swing notice */}
        {isExcluded && (
          <div className="rounded-xl p-3" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)' }}>
            <p className="text-[11px] leading-relaxed" style={{ color: '#888' }}>
              ⚠️ This swing was classified as <strong style={{ color: swingClass?.color }}>{swingClass?.label?.toLowerCase()}</strong> ({Math.round(session3D?.swing_duration_ms ?? 0)}ms) and excluded from your 4B scores.
            </p>
          </div>
        )}

        {/* Video Player */}
        {videoUrl ? (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
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
            <div className="flex gap-2 p-2.5" style={{ background: '#0a0a0a' }}>
              {[1, 0.5, 0.25].map(rate => (
                <button
                  key={rate}
                  onClick={() => handlePlaybackRate(rate)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: playbackRate === rate ? 'linear-gradient(135deg, #E63946, #c62b38)' : '#111',
                    color: playbackRate === rate ? '#fff' : '#444',
                    border: `1px solid ${playbackRate === rate ? '#E63946' : '#1a1a1a'}`,
                  }}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl flex items-center justify-center" style={{ background: '#0a0a0a', aspectRatio: '16/9', border: '1px solid #1a1a1a' }}>
            <div className="text-center">
              <Play className="h-12 w-12 mx-auto mb-2" style={{ color: '#333' }} />
              <p className="text-[11px] font-semibold" style={{ color: '#333' }}>No video available</p>
            </div>
          </div>
        )}

        {/* Adaptive Metrics */}
        <div className="grid grid-cols-3 gap-2">
          {displayMetrics.map(m => (
            <div key={m.label} className="rounded-xl p-3 text-center" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#444' }}>{m.label}</p>
              <p className="text-sm font-black mt-1 truncate" style={{ color: '#fff' }}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Comparison Toggle */}
        <div className="flex gap-2">
          {(['current', 'baseline', 'best'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setComparisonMode(mode)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all"
              style={{
                background: comparisonMode === mode ? 'linear-gradient(135deg, #E63946, #c62b38)' : '#111',
                color: comparisonMode === mode ? '#fff' : '#444',
                border: `1px solid ${comparisonMode === mode ? '#E63946' : '#1a1a1a'}`,
              }}
            >
              {mode === 'current' ? 'This Session' : mode}
            </button>
          ))}
        </div>

        {/* 4B Score Grid — use PillarScoreCard */}
        <div className="grid grid-cols-4 gap-2">
          {(['body', 'brain', 'bat', 'ball'] as const).map(pillar => (
            <PillarScoreCard key={pillar} pillar={pillar} value={displayScores[pillar]} />
          ))}
        </div>

        {/* 3D Processing Status */}
        {source === '2d' && session2D?.pending_3d_analysis && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.15)' }}>
            <Cpu className="h-5 w-5 animate-pulse" style={{ color: '#14B8A6' }} />
            <div>
              <p className="text-sm font-black" style={{ color: '#14B8A6' }}>3D Analysis Processing...</p>
              <p className="text-[11px]" style={{ color: '#555' }}>
                Full biomechanical data will appear automatically when ready (~30-60 min).
              </p>
            </div>
          </div>
        )}

        {/* 3D Scores arrived alongside 2D */}
        {source === '2d' && session3D && (
          <div className="rounded-2xl p-4 space-y-2" style={{ background: '#111', border: '1px solid rgba(20,184,166,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(20,184,166,0.1)', color: '#14B8A6' }}>
                3D Analysis
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#444' }}>Biomechanics</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['body', 'brain', 'bat', 'ball'] as const).map(pillar => {
                const val3d = pillar === 'body' ? session3D.body_score
                  : pillar === 'brain' ? session3D.brain_score
                  : pillar === 'bat' ? session3D.bat_score
                  : session3D.ball_score;
                return (
                  <div key={`3d-${pillar}`} className="rounded-xl p-2 text-center" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                    <p className="text-[9px] uppercase font-bold" style={{ color: '#14B8A6' }}>{pillar}</p>
                    <p className="text-lg font-black mt-0.5" style={{ color: scoreColor(val3d) }}>{val3d ?? '—'}</p>
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
                  <div key={m.label} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <span className="text-[11px]" style={{ color: '#555' }}>{m.label}</span>
                    <span className="text-[11px] font-black" style={{ color: '#fff' }}>
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

        {/* 3D Energy Delivery Report */}
        {source === '3d' && session3D?.raw_metrics && (
          <EnergyDeliveryReport
            sessionId={session3D.id}
            playerId={player?.id ?? ''}
            rawMetrics={session3D.raw_metrics}
            isAdmin={isAdmin}
            existingMetricsContent={
              <div className="rounded-2xl p-4 space-y-2" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#555' }}>Biomechanics Data</p>
                {[
                  { label: 'Pelvis Peak Velocity', value: session3D.raw_metrics.pelvis_velocity ?? session3D.raw_metrics.avgPelvisVelocity, unit: 'deg/s' },
                  { label: 'Torso Peak Velocity', value: session3D.raw_metrics.torso_velocity ?? session3D.raw_metrics.avgTorsoVelocity, unit: 'deg/s' },
                  { label: 'X-Factor', value: session3D.raw_metrics.x_factor_deg ?? session3D.raw_metrics.avgXFactor, unit: 'deg' },
                  { label: 'Transfer Efficiency', value: session3D.raw_metrics.transfer_efficiency, unit: '%' },
                  { label: 'Transfer Ratio', value: session3D.raw_metrics.transfer_ratio },
                  { label: 'P→T Gap', value: session3D.raw_metrics.pelvis_torso_gap_ms, unit: 'ms' },
                  { label: 'Brake Efficiency', value: session3D.raw_metrics.brake_efficiency != null ? `${Math.round(session3D.raw_metrics.brake_efficiency * 100)}%` : null },
                  { label: 'Bat Speed', value: session3D.raw_metrics.bat_speed_mph, unit: 'mph' },
                  { label: 'Exit Velocity', value: session3D.raw_metrics.exit_velocity_mph, unit: 'mph' },
                  { label: 'Pelvis→Torso Gain', value: session3D.raw_metrics.pelvis_torso_gain },
                  { label: 'Torso→Arms Gain', value: session3D.raw_metrics.torso_arm_gain },
                  { label: 'Arms→Bat Gain', value: session3D.raw_metrics.arm_bat_gain },
                  { label: 'Beat', value: session3D.raw_metrics.beat },
                ].map(m => (
                  <div key={m.label} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <span className="text-[11px]" style={{ color: '#555' }}>{m.label}</span>
                    <span className="text-[11px] font-black" style={{ color: '#fff' }}>
                      {m.value != null ? `${m.value}${m.unit ? ` ${m.unit}` : ''}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            }
          />
        )}
      </main>

      <PlayerBottomNav />
    </div>
  );
}
