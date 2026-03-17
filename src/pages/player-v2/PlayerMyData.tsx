/**
 * My Data - 5 tabs: 4B Card, Trends, Sessions, Video, Biomech
 */
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { TagPill } from "@/components/player-v2/TagPill";
import { scoreColor, scoreLabel } from "@/lib/player-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, BarChart3, Play, Video } from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";
import { format } from "date-fns";
import { BiomechTab } from "@/components/player-v2/BiomechTab";

const TABS = [
  { key: '4b', label: '4B Card' },
  { key: 'trends', label: 'Trends' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'video', label: 'Video' },
  { key: 'biomech', label: 'Biomech' },
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
      <div style={{ background: '#0A0D1A', minHeight: '100vh' }}>
        <Skeleton className="h-14 w-full" style={{ background: '#111827' }} />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-full" style={{ background: '#111827' }} />
          <Skeleton className="h-64 w-full rounded-xl" style={{ background: '#111827' }} />
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
    <div style={{ background: '#0A0D1A', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />

      {/* Tab Bar */}
      <div className="flex px-4 gap-0 overflow-x-auto" style={{ borderBottom: '1px solid #1E2535' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSearchParams({ tab: tab.key })}
            className="px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors"
            style={{
              color: activeTab === tab.key ? '#FF3B30' : '#6B7A8F',
              borderBottom: activeTab === tab.key ? '2px solid #FF3B30' : '2px solid transparent',
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
              <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1E2535' }}>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="#1E2535" />
                    <PolarAngleAxis dataKey="pillar" tick={{ fill: '#B0B8C8', fontSize: 12, fontWeight: 600 }} />
                    <Radar name="Score" dataKey="score" stroke="#FF3B30" fill="rgba(255,59,48,0.12)" fillOpacity={1} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Pillar Grid */}
              <div className="grid grid-cols-2 gap-3">
                {radarData.map(d => (
                  <div key={d.pillar} className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1E2535' }}>
                    <p className="text-[11px] font-semibold uppercase" style={{ color: '#6B7A8F' }}>{d.pillar}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: scoreColor(d.score) }}>{d.score}</p>
                    <div className="mt-2 h-1.5 rounded-full" style={{ background: '#1E2535' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${d.score}%`, background: scoreColor(d.score) }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Active Flags */}
              {flags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#6B7A8F' }}>Active Flags — Priority Order</p>
                  <div className="space-y-2">
                    {flags.map(f => (
                      <div key={f.id} className="rounded-lg p-3 flex items-start justify-between" style={{ background: '#111827', border: '1px solid #1E2535' }}>
                        <div className="flex-1">
                          <p className="text-sm font-bold" style={{ color: '#fff' }}>{f.flag_type?.replace(/_/g, ' ')}</p>
                          <p className="text-[12px] mt-0.5" style={{ color: '#6B7A8F' }}>{f.message}</p>
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
              <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1E2535' }}>
                <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#6B7A8F' }}>KRS Over Time</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2535" />
                    <XAxis dataKey="date" tick={{ fill: '#6B7A8F', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#6B7A8F', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1E2535', borderRadius: 8, color: '#fff' }} />
                    <Line type="monotone" dataKey="krs" stroke="#FF3B30" strokeWidth={2} dot={{ fill: '#FF3B30', r: 4 }} />
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
                    to={`/player/data?tab=video&session=${s.id}`}
                    className="block rounded-xl p-4 transition-colors hover:opacity-90"
                    style={{ background: '#111827', border: '1px solid #1E2535' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#fff' }}>
                          Session {sessions.length - i} · {format(new Date(s.session_date), 'MMM d, yyyy')}
                        </p>
                        <div className="flex gap-2 mt-1.5">
                          {s.leak_type && <TagPill label={s.leak_type.replace(/_/g, ' ')} color="#FFA000" />}
                          {s.swing_count && <TagPill label={`${s.swing_count} swings`} color="#00B4D8" />}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold" style={{ color: scoreColor(s.overall_score) }}>{s.overall_score ?? '—'}</p>
                        {diff !== null && (
                          <p className="text-xs font-semibold" style={{ color: diff >= 0 ? '#22C55E' : '#FF3B30' }}>
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

        {activeTab === 'biomech' && (
          <BiomechTab playerId={player?.id ?? null} />
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
    const fetch = async () => {
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

      const { data } = await query.single();
      setSession(data);
      setLoading(false);
    };
    fetch();
  }, [playerId, sessionIdParam]);

  if (loading) {
    return <div className="space-y-3">
      <Skeleton className="h-48 w-full rounded-xl" style={{ background: '#111827' }} />
      <Skeleton className="h-24 w-full rounded-xl" style={{ background: '#111827' }} />
    </div>;
  }

  if (!session) {
    return <EmptyState icon={<Video className="h-12 w-12" />} title="No video data" description="Complete a session to view video analysis" ctaLabel="Start Session" ctaTo="/player/session" />;
  }

  const metrics = session.raw_metrics || {};

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={{ background: '#0A0D1A', aspectRatio: '16/9', border: '1px solid #1E2535' }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Play className="h-12 w-12 mx-auto mb-2" style={{ color: '#6B7A8F' }} />
            <p className="text-xs" style={{ color: '#6B7A8F' }}>Session video</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {[1, 0.5, 0.25].map(rate => (
          <button
            key={rate}
            onClick={() => setPlaybackRate(rate)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: playbackRate === rate ? '#FF3B30' : '#111827',
              color: playbackRate === rate ? '#fff' : '#6B7A8F',
              border: `1px solid ${playbackRate === rate ? '#FF3B30' : '#1E2535'}`,
            }}
          >
            {rate}x
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Transfer Ratio', value: metrics.transfer_ratio ?? '—' },
          { label: 'Pelvis KE', value: metrics.pelvis_ke ? `${metrics.pelvis_ke}J` : '—' },
          { label: 'P→T Gap', value: metrics.peak_timing_gap_ms ? `${metrics.peak_timing_gap_ms}ms` : '—' },
        ].map(m => (
          <div key={m.label} className="rounded-lg p-3 text-center" style={{ background: '#111827', border: '1px solid #1E2535' }}>
            <p className="text-[10px] uppercase" style={{ color: '#6B7A8F' }}>{m.label}</p>
            <p className="text-lg font-bold mt-1" style={{ color: '#fff' }}>{m.value}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => { }}
        className="w-full py-3 rounded-lg text-sm font-semibold"
        style={{ background: '#111827', border: '1px solid #1E2535', color: '#6B7A8F' }}
      >
        Export Clip — Coming Soon
      </button>
    </div>
  );
}
