/**
 * My Data — 4 tabs: 4B Card, Trends, Sessions, Video
 */
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { TagPill } from "@/components/player-v2/TagPill";
import { scoreColor } from "@/lib/player-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Upload, BarChart3, Play, Video, Share } from "lucide-react";
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
      const { data: sessionsData } = await supabase
        .from("player_sessions")
        .select("id, session_date, overall_score, body_score, brain_score, bat_score, ball_score, leak_type, swing_count")
        .eq("player_id", player.id)
        .order("session_date", { ascending: false })
        .limit(50);

      if (sessionsData) setSessions(sessionsData);

      if (sessionsData && sessionsData.length > 0) {
        const { data: swings } = await supabase
          .from("swing_analysis")
          .select("id")
          .eq("session_id", sessionsData[0].id);

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
    return (
      <div style={{ background: '#000', minHeight: '100vh' }}>
        <Skeleton className="h-14 w-full" style={{ background: '#111' }} />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-full" style={{ background: '#111' }} />
          <Skeleton className="h-64 w-full rounded-xl" style={{ background: '#111' }} />
        </div>
      </div>
    );
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
      <div className="flex px-4 gap-0 overflow-x-auto" style={{ borderBottom: '1px solid #222' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSearchParams({ tab: tab.key })}
            className="px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors"
            style={{
              color: activeTab === tab.key ? '#E63946' : '#555',
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
            <EmptyState icon={<Upload className="h-12 w-12" />} title="No 4B Card yet" description="Upload your first swing session to see your 4B Card" ctaLabel="Start Session" ctaTo="/player/session" />
          ) : (
            <div className="space-y-4">
              {/* Radar Chart */}
              <div className="rounded-xl p-4" style={{ background: '#111', border: '1px solid #222' }}>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis dataKey="pillar" tick={{ fill: '#a0a0a0', fontSize: 12, fontWeight: 600 }} />
                    <Radar name="Score" dataKey="score" stroke="#E63946" fill="rgba(230,57,70,0.15)" fillOpacity={1} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Pillar Grid */}
              <div className="grid grid-cols-2 gap-3">
                {radarData.map(d => (
                  <div key={d.pillar} className="rounded-xl p-4" style={{ background: '#111', border: '1px solid #222' }}>
                    <p className="text-[11px] font-semibold uppercase" style={{ color: '#555' }}>{d.pillar}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: scoreColor(d.score) }}>{d.score}</p>
                    <div className="mt-2 h-1.5 rounded-full" style={{ background: '#222' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${d.score}%`, background: scoreColor(d.score) }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Active Flags */}
              {flags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#555' }}>Active Flags — Priority Order</p>
                  <div className="space-y-2">
                    {flags.map(f => (
                      <div key={f.id} className="rounded-lg p-3 flex items-start justify-between" style={{ background: '#111', border: '1px solid #222' }}>
                        <div className="flex-1">
                          <p className="text-sm font-bold" style={{ color: '#fff' }}>{f.flag_type?.replace(/_/g, ' ')}</p>
                          <p className="text-[12px] mt-0.5" style={{ color: '#555' }}>{f.message}</p>
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
            <EmptyState icon={<BarChart3 className="h-12 w-12" />} title="No trends yet" description="Complete sessions to see your score progression over time" ctaLabel="Start Session" ctaTo="/player/session" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ background: '#111', border: '1px solid #222' }}>
                <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#555' }}>KRS Over Time</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#555', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, color: '#fff' }} />
                    <Line type="monotone" dataKey="krs" stroke="#E63946" strokeWidth={2} dot={{ fill: '#E63946', r: 4 }} />
                    {/* Teal dashed projection line could go here when projection data is available */}
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
            <div className="space-y-3">
              {sessions.map((s, i) => {
                const prev = sessions[i + 1];
                const diff = prev?.overall_score && s.overall_score ? s.overall_score - prev.overall_score : null;
                return (
                  <Link
                    key={s.id}
                    to={`/player/session/${s.id}`}
                    className="block rounded-xl p-4 transition-colors hover:opacity-90"
                    style={{ background: '#111', border: '1px solid #222' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#fff' }}>
                          Session {sessions.length - i} · {format(new Date(s.session_date), 'MMM d, yyyy')}
                        </p>
                        <div className="flex gap-2 mt-1.5">
                          {s.leak_type && <TagPill label={s.leak_type.replace(/_/g, ' ')} color="#ffa500" />}
                          {s.swing_count && <TagPill label={`${s.swing_count} swings`} color="#4ecdc4" />}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold" style={{ color: scoreColor(s.overall_score) }}>{s.overall_score ?? '—'}</p>
                        {diff !== null && (
                          <p className="text-xs font-semibold" style={{ color: diff >= 0 ? '#4ecdc4' : '#E63946' }}>
                            {diff >= 0 ? '+' : ''}{diff}
                          </p>
                        )}
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

      const { data, error } = await query.maybeSingle();
      if (data) setSession(data);
      setLoading(false);
    };
    fetchSession();
  }, [playerId, sessionIdParam]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-48 w-full rounded-xl" style={{ background: '#111' }} />
        <Skeleton className="h-24 w-full rounded-xl" style={{ background: '#111' }} />
      </div>
    );
  }

  if (!session) {
    return <EmptyState icon={<Video className="h-12 w-12" />} title="No video data" description="Complete a session to view video analysis" ctaLabel="Start Session" ctaTo="/player/session" />;
  }

  const metrics = session.raw_metrics || {};

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={{ background: '#0a0a0a', aspectRatio: '16/9', border: '1px solid #222' }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Play className="h-12 w-12 mx-auto mb-2" style={{ color: '#555' }} />
            <p className="text-xs" style={{ color: '#555' }}>Session video</p>
          </div>
        </div>
      </div>

      {/* Slow motion controls */}
      <div className="flex gap-2">
        {[1, 0.5, 0.25].map(rate => (
          <button
            key={rate}
            onClick={() => setPlaybackRate(rate)}
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

      {/* 3-column metric grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Transfer Ratio', value: metrics.transfer_ratio ?? '—' },
          { label: 'Pelvis KE', value: metrics.pelvis_ke ? `${metrics.pelvis_ke}J` : '—' },
          { label: 'P→T Gap', value: metrics.peak_timing_gap_ms ? `${metrics.peak_timing_gap_ms}ms` : '—' },
        ].map(m => (
          <div key={m.label} className="rounded-lg p-3 text-center" style={{ background: '#111', border: '1px solid #222' }}>
            <p className="text-[10px] uppercase" style={{ color: '#555' }}>{m.label}</p>
            <p className="text-lg font-bold mt-1" style={{ color: '#fff' }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Comparison toggle */}
      <div className="flex gap-2">
        {['This Session', 'Baseline', 'Best'].map(label => (
          <button
            key={label}
            className="flex-1 py-2 rounded-lg text-xs font-semibold"
            style={{ background: '#111', border: '1px solid #222', color: '#555' }}
            onClick={() => toast.info("Coming soon")}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={() => toast.info("Coming soon")}
        className="w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
        style={{ background: '#111', border: '1px solid #222', color: '#555' }}
      >
        <Share className="h-4 w-4" /> Export Clip
      </button>
    </div>
  );
}
