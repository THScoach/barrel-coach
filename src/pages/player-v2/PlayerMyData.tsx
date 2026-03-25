/**
 * My Data — 4 tabs: 4B Card, Trends, Sessions, Video
 * Polished with consistent 4B brand styling
 */
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { PillarScoreCard } from "@/components/player-v2/PillarScoreCard";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { TagPill } from "@/components/player-v2/TagPill";
import { scoreColor } from "@/lib/player-utils";
import { DataSkeleton } from "@/components/player-v2/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { SwingIllustration, TrendsIllustration, VideoIllustration } from "@/components/player-v2/EmptyStateIllustrations";
import { Upload, BarChart3, Play, Video, Share, ChevronRight } from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";
import { format } from "date-fns";

const TABS = [
  { key: '4b', label: '4B Card' },
  { key: 'trends', label: 'Trends' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'video', label: 'Video' },
];

interface SessionRow {
  id: string;
  session_date: string;
  overall_score: number | null;
  body_score: number | null;
  brain_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  leak_type: string | null;
  swing_count: number | null;
  source: '3d' | '2d';
}

interface FlagRow {
  id: string;
  flag_type: string;
  message: string;
  severity: string;
  pillar: string;
}

export default function PlayerMyData() {
  const { player, loading } = usePlayerData();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || '4b';
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!player?.id) return;
    const fetchData = async () => {
      setLoadingData(true);
      const [rebootRes, video2dRes] = await Promise.all([
        supabase
          .from("player_sessions")
          .select("id, session_date, overall_score, body_score, brain_score, bat_score, ball_score, leak_type, swing_count")
          .eq("player_id", player.id)
          .order("session_date", { ascending: false })
          .limit(50),
        supabase
          .from("video_2d_sessions")
          .select("id, session_date, composite_score, body_score, brain_score, bat_score, ball_score, leak_detected, swing_number")
          .eq("player_id", player.id)
          .eq("processing_status", "complete")
          .order("session_date", { ascending: false })
          .limit(50),
      ]);

      const items: SessionRow[] = [];
      if (rebootRes.data) {
        items.push(...rebootRes.data.map(s => ({ ...s, source: '3d' as const })));
      }
      if (video2dRes.data) {
        items.push(...video2dRes.data.map(s => ({
          id: s.id,
          session_date: s.session_date,
          overall_score: s.composite_score,
          body_score: s.body_score,
          brain_score: s.brain_score,
          bat_score: s.bat_score,
          ball_score: s.ball_score,
          leak_type: s.leak_detected,
          swing_count: s.swing_number,
          source: '2d' as const,
        })));
      }
      items.sort((a, b) => b.session_date.localeCompare(a.session_date));
      setSessions(items);

      const reboot3d = rebootRes.data || [];
      if (reboot3d.length > 0) {
        const { data: swings } = await supabase
          .from("swing_analysis")
          .select("id")
          .eq("session_id", reboot3d[0].id);

        if (swings && swings.length > 0) {
          const swingIds = swings.map(s => s.id);
          const { data: flagsData } = await supabase
            .from("swing_flags")
            .select("id, flag_type, message, severity, pillar")
            .in("swing_id", swingIds);

          if (flagsData) setFlags(flagsData as unknown as FlagRow[]);
        }
      }
      setLoadingData(false);
    };
    fetchData();
  }, [player?.id]);

  if (loading) {
    return <DataSkeleton />;
  }

  const latest = sessions[0] || null;
  const radarData = latest ? [
    { pillar: 'BODY', score: latest.body_score ?? 0 },
    { pillar: 'BRAIN', score: latest.brain_score ?? 0 },
    { pillar: 'BAT', score: latest.bat_score ?? 0 },
    { pillar: 'BALL', score: latest.ball_score ?? 0 },
  ] : [];

  const trendData = [...sessions].reverse().map(s => ({
    date: format(new Date(s.session_date), 'M/d'),
    krs: s.overall_score ?? 0,
  }));

  return (
    <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />

      {/* Tab Bar */}
      <div className="flex px-4 gap-0 overflow-x-auto" style={{ borderBottom: '1px solid #1a1a1a' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSearchParams({ tab: tab.key })}
            className="px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all"
            style={{
              color: activeTab === tab.key ? '#E63946' : '#444',
              borderBottom: activeTab === tab.key ? '2px solid #E63946' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="px-4 pb-24 pt-4">
        {activeTab === '4b' && (
          sessions.length === 0 ? (
            <EmptyState illustration={<SwingIllustration size={96} />} title="No 4B Card yet" description="Upload your first swing session to see your 4B Card" ctaLabel="Start Session" ctaTo="/player/session" />
          ) : (
            <div className="space-y-3">
              {/* Radar Chart */}
              <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)', border: '1px solid #1a1a1a' }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-center mb-2" style={{ color: '#555' }}>4B Performance Profile</p>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                    <PolarGrid stroke="#1a1a1a" />
                    <PolarAngleAxis dataKey="pillar" tick={{ fill: '#666', fontSize: 11, fontWeight: 700 }} />
                    <Radar name="Score" dataKey="score" stroke="#E63946" fill="rgba(230,57,70,0.12)" fillOpacity={1} strokeWidth={2.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Pillar Grid — reuse PillarScoreCard */}
              <div className="grid grid-cols-4 gap-2">
                {(['body', 'brain', 'bat', 'ball'] as const).map(pillar => (
                  <PillarScoreCard key={pillar} pillar={pillar} value={latest?.[`${pillar}_score`] ?? null} />
                ))}
              </div>

              {/* Active Flags */}
              {flags.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#555' }}>Active Flags</p>
                  <div className="space-y-2">
                    {flags.map(f => (
                      <div key={f.id} className="rounded-xl p-3 flex items-start justify-between" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                        <div className="flex-1">
                          <p className="text-sm font-black" style={{ color: '#fff' }}>{f.flag_type?.replace(/_/g, ' ')}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: '#555' }}>{f.message}</p>
                        </div>
                        <TagPill label={f.pillar || 'body'} color={scoreColor(60)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'trends' && (
          sessions.length === 0 ? (
            <EmptyState illustration={<TrendsIllustration size={96} />} title="No trends yet" description="Complete sessions to see your score progression over time" ctaLabel="Start Session" ctaTo="/player/session" />
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)', border: '1px solid #1a1a1a' }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: '#555' }}>KRS Over Time</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="date" tick={{ fill: '#444', fontSize: 10, fontWeight: 600 }} axisLine={{ stroke: '#1a1a1a' }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#444', fontSize: 10, fontWeight: 600 }} axisLine={{ stroke: '#1a1a1a' }} />
                    <Tooltip
                      contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 12, color: '#fff', fontSize: 12, fontWeight: 700 }}
                      labelStyle={{ color: '#555' }}
                    />
                    <Line type="monotone" dataKey="krs" stroke="#E63946" strokeWidth={2.5} dot={{ fill: '#E63946', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#E63946' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        )}

        {activeTab === 'sessions' && (
          sessions.length === 0 ? (
            <EmptyState icon={<Upload className="h-12 w-12" />} title="No sessions yet" description="Upload your first Reboot file to get started." ctaLabel="Start Session" ctaTo="/player/session" />
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => {
                const prev = sessions[i + 1];
                const diff = prev?.overall_score && s.overall_score ? s.overall_score - prev.overall_score : null;
                const badgeColor = s.source === '2d' ? '#3B82F6' : '#14B8A6';
                return (
                  <Link
                    key={s.id}
                    to={`/player/session/${s.id}`}
                    className="block rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.98]"
                    style={{ background: '#111', border: '1px solid #1a1a1a' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-black" style={{ color: '#fff' }}>
                          Session {sessions.length - i}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#444' }}>
                          {format(new Date(s.session_date), 'MMM d, yyyy')}
                        </p>
                        <div className="flex gap-1.5 mt-2">
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: `${badgeColor}15`, color: badgeColor }}
                          >
                            {s.source === '2d' ? 'Video' : '3D'}
                          </span>
                          {s.leak_type && <TagPill label={s.leak_type.replace(/_/g, ' ')} color="#ffa500" />}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="text-2xl font-black" style={{ color: scoreColor(s.overall_score) }}>{s.overall_score ?? '—'}</p>
                          {diff !== null && (
                            <p className="text-[11px] font-bold" style={{ color: diff >= 0 ? '#4ecdc4' : '#E63946' }}>
                              {diff >= 0 ? '+' : ''}{diff}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4" style={{ color: '#333' }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'video' && (
          <VideoTab playerId={player?.id ?? null} sessionIdParam={searchParams.get('session')} />
        )}
      </main>

      <PlayerBottomNav />
    </div>
  );
}

function VideoTab({ playerId, sessionIdParam }: { playerId: string | null; sessionIdParam: string | null }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (!playerId) { setLoading(false); return; }
    const fetchSession = async () => {
      setLoading(true);
      let query = supabase
        .from("player_sessions")
        .select("id, session_date, overall_score, body_score, brain_score, bat_score, ball_score, raw_metrics")
        .eq("player_id", playerId);

      if (sessionIdParam) {
        query = query.eq("id", sessionIdParam);
      } else {
        query = query.order("session_date", { ascending: false }).limit(1);
      }

      const { data } = await query.maybeSingle();
      if (data) setSession(data);
      setLoading(false);
    };
    fetchSession();
  }, [playerId, sessionIdParam]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-48 w-full rounded-2xl" style={{ background: '#111' }} />
        <Skeleton className="h-24 w-full rounded-2xl" style={{ background: '#111' }} />
      </div>
    );
  }

  if (!session) {
    return <EmptyState icon={<Video className="h-12 w-12" />} title="No video data" description="Complete a session to view video analysis" ctaLabel="Start Session" ctaTo="/player/session" />;
  }

  const metrics = session.raw_metrics || {};

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', aspectRatio: '16/9', border: '1px solid #1a1a1a' }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Play className="h-12 w-12 mx-auto mb-2" style={{ color: '#333' }} />
            <p className="text-[11px] font-semibold" style={{ color: '#333' }}>Session video</p>
          </div>
        </div>
      </div>

      {/* Slow motion controls */}
      <div className="flex gap-2">
        {[1, 0.5, 0.25].map(rate => (
          <button
            key={rate}
            onClick={() => setPlaybackRate(rate)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
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

      {/* 3-column metric grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Transfer Ratio', value: metrics.transfer_ratio ?? '—' },
          { label: 'Pelvis KE', value: metrics.pelvis_ke ? `${metrics.pelvis_ke}J` : '—' },
          { label: 'P→T Gap', value: metrics.peak_timing_gap_ms ? `${metrics.peak_timing_gap_ms}ms` : '—' },
        ].map(m => (
          <div key={m.label} className="rounded-xl p-3 text-center" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#444' }}>{m.label}</p>
            <p className="text-lg font-black mt-1" style={{ color: '#fff' }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Comparison toggle */}
      <div className="flex gap-2">
        {['This Session', 'Baseline', 'Best'].map(label => (
          <button
            key={label}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
            style={{ background: '#111', border: '1px solid #1a1a1a', color: '#444' }}
            onClick={() => toast.info("Coming soon")}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={() => toast.info("Coming soon")}
        className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-80"
        style={{ background: '#111', border: '1px solid #1a1a1a', color: '#444' }}
      >
        <Share className="h-4 w-4" /> Export Clip
      </button>
    </div>
  );
}
