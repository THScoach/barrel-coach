import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { 
  Loader2,
  Upload,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface PlayerScoresSectionProps {
  playerId: string;
  playerName?: string;
  onAskRick?: (context: string) => void;
}

interface LaunchSession {
  id: string;
  session_date: string;
  source: string;
  avg_exit_velo: number | null;
  max_exit_velo: number | null;
  avg_launch_angle: number | null;
  barrel_pct: number | null;
  contact_rate: number | null;
  total_swings: number;
  balls_in_play: number | null;
  ground_ball_count: number | null;
  fly_ball_count: number | null;
  velo_90_plus: number | null;
  velo_95_plus: number | null;
  quality_hit_pct: number | null;
}

interface FourBScore {
  id: string;
  created_at: string;
  composite_score: number | null;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  weakest_link: string | null;
}

interface PlayerData {
  latest_composite_score: number | null;
  latest_ball_score: number | null;
  latest_bat_score: number | null;
  latest_body_score: number | null;
  latest_brain_score: number | null;
  is_in_season: boolean | null;
}

type TrendRange = '30' | '60' | '90';

export function PlayerScoresSection({ playerId, playerName, onAskRick }: PlayerScoresSectionProps) {
  const [launchSessions, setLaunchSessions] = useState<LaunchSession[]>([]);
  const [fourbScores, setFourbScores] = useState<FourBScore[]>([]);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [trendRange, setTrendRange] = useState<TrendRange>('30');

  useEffect(() => {
    loadData();
  }, [playerId]);

  const loadData = async () => {
    setLoading(true);
    const ninetyDaysAgo = subDays(new Date(), 90).toISOString().split('T')[0];

    const [launchRes, scoresRes, playerRes] = await Promise.all([
      supabase
        .from('launch_monitor_sessions')
        .select('*')
        .eq('player_id', playerId)
        .gte('session_date', ninetyDaysAgo)
        .order('session_date', { ascending: false }),
      supabase
        .from('swing_4b_scores')
        .select('id, created_at, composite_score, brain_score, body_score, bat_score, ball_score, weakest_link')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(90),
      supabase
        .from('players')
        .select('latest_composite_score, latest_ball_score, latest_bat_score, latest_body_score, latest_brain_score, is_in_season')
        .eq('id', playerId)
        .single(),
    ]);

    setLaunchSessions(launchRes.data || []);
    setFourbScores((scoresRes.data || []) as FourBScore[]);
    setPlayerData(playerRes.data);
    setLoading(false);
  };

  // Filter sessions by trend range
  const filteredSessions = useMemo(() => {
    const days = parseInt(trendRange);
    const cutoff = subDays(new Date(), days).toISOString().split('T')[0];
    return launchSessions.filter(s => s.session_date >= cutoff);
  }, [launchSessions, trendRange]);

  const filteredScores = useMemo(() => {
    const days = parseInt(trendRange);
    const cutoff = subDays(new Date(), days).toISOString();
    return fourbScores.filter(s => s.created_at >= cutoff);
  }, [fourbScores, trendRange]);

  // Summary strip metrics
  const summaryStrip = useMemo(() => {
    const latest = fourbScores[0];
    const previous = fourbScores[1];
    
    return {
      composite: playerData?.latest_composite_score ?? latest?.composite_score ?? null,
      brain: playerData?.latest_brain_score ?? latest?.brain_score ?? null,
      body: playerData?.latest_body_score ?? latest?.body_score ?? null,
      bat: playerData?.latest_bat_score ?? latest?.bat_score ?? null,
      ball: playerData?.latest_ball_score ?? latest?.ball_score ?? null,
      weakestLink: latest?.weakest_link ?? null,
      prevComposite: previous?.composite_score ?? null,
      prevBrain: previous?.brain_score ?? null,
      prevBody: previous?.body_score ?? null,
      prevBat: previous?.bat_score ?? null,
      prevBall: previous?.ball_score ?? null,
      isInSeason: playerData?.is_in_season ?? false,
    };
  }, [fourbScores, playerData]);

  // Calculate trend arrow
  const getTrendArrow = (current: number | null, previous: number | null) => {
    if (current === null || previous === null) return 'flat';
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'flat';
  };

  // Trend chart data
  const trendChartData = useMemo(() => {
    const evData = [...filteredSessions]
      .filter(s => s.avg_exit_velo != null)
      .reverse()
      .map(s => ({ 
        date: format(new Date(s.session_date), 'M/d'),
        value: s.avg_exit_velo 
      }));

    const barrelData = [...filteredSessions]
      .filter(s => s.barrel_pct != null)
      .reverse()
      .map(s => ({ 
        date: format(new Date(s.session_date), 'M/d'),
        value: s.barrel_pct 
      }));

    const compositeData = [...filteredScores]
      .filter(s => s.composite_score != null)
      .reverse()
      .map(s => ({ 
        date: format(new Date(s.created_at), 'M/d'),
        value: s.composite_score 
      }));

    // Calculate averages
    const avgEV = evData.length > 0 
      ? (evData.reduce((a, b) => a + (b.value || 0), 0) / evData.length).toFixed(1)
      : null;
    const avgBarrel = barrelData.length > 0
      ? (barrelData.reduce((a, b) => a + (b.value || 0), 0) / barrelData.length).toFixed(1)
      : null;
    const avgComposite = compositeData.length > 0
      ? Math.round(compositeData.reduce((a, b) => a + (b.value || 0), 0) / compositeData.length)
      : null;

    return { evData, barrelData, compositeData, avgEV, avgBarrel, avgComposite };
  }, [filteredSessions, filteredScores]);

  // Build context for Ask Rick
  const buildRickContext = () => {
    const parts: string[] = [];
    if (playerName) parts.push(`Player: ${playerName}`);
    if (summaryStrip.composite) parts.push(`Composite Score: ${summaryStrip.composite}`);
    if (summaryStrip.brain) parts.push(`Brain: ${summaryStrip.brain}`);
    if (summaryStrip.body) parts.push(`Body: ${summaryStrip.body}`);
    if (summaryStrip.bat) parts.push(`Bat: ${summaryStrip.bat}`);
    if (summaryStrip.ball) parts.push(`Ball: ${summaryStrip.ball}`);
    if (summaryStrip.weakestLink) parts.push(`Weakest Link: ${summaryStrip.weakestLink}`);
    if (trendChartData.avgEV) parts.push(`${trendRange}-Day Avg EV: ${trendChartData.avgEV} mph`);
    if (trendChartData.avgBarrel) parts.push(`${trendRange}-Day Avg Barrel%: ${trendChartData.avgBarrel}%`);
    if (summaryStrip.isInSeason) parts.push(`Currently In-Season`);
    
    return parts.join('\n');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  const hasData = launchSessions.length > 0 || fourbScores.length > 0 || playerData?.latest_composite_score;
  
  if (!hasData) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Get Your 4B Score
          </h3>
          <p className="text-slate-400 max-w-sm mx-auto mb-6">
            Upload your first session to see your Composite Score, Exit Velo, Barrel Rate, and more.
          </p>
          <Button asChild size="lg" className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600">
            <Link to="/player/new-session">
              <Upload className="h-4 w-4 mr-2" /> Upload Your First Session
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-slate-500" />;
  };

  const ScoreChip = ({ label, value, prevValue, color }: { label: string; value: number | null; prevValue: number | null; color: string }) => (
    <div className={`p-3 rounded-lg ${color} text-center`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <div className="flex items-center justify-center gap-1">
        <span className="text-2xl font-black text-foreground">{value ?? '—'}</span>
        <TrendIcon trend={getTrendArrow(value, prevValue)} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Strip - Scoreboard Header */}
      <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                4B SCOREBOARD
              </h3>
              {summaryStrip.isInSeason && (
                <Badge className="bg-emerald-600 text-white text-xs">
                  <Activity className="w-3 h-3 mr-1" />
                  IN SEASON
                </Badge>
              )}
            </div>
            {summaryStrip.weakestLink && (
              <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                <Zap className="w-3 h-3 mr-1" />
                Focus: {summaryStrip.weakestLink.toUpperCase()}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">Composite</p>
              <div className="flex items-center justify-center gap-1">
                <span className="text-3xl font-black text-foreground">{summaryStrip.composite ?? '—'}</span>
                <TrendIcon trend={getTrendArrow(summaryStrip.composite, summaryStrip.prevComposite)} />
              </div>
            </div>
            <ScoreChip label="Brain" value={summaryStrip.brain} prevValue={summaryStrip.prevBrain} color="bg-purple-500/10 border border-purple-500/30" />
            <ScoreChip label="Body" value={summaryStrip.body} prevValue={summaryStrip.prevBody} color="bg-blue-500/10 border border-blue-500/30" />
            <ScoreChip label="Bat" value={summaryStrip.bat} prevValue={summaryStrip.prevBat} color="bg-orange-500/10 border border-orange-500/30" />
            <ScoreChip label="Ball" value={summaryStrip.ball} prevValue={summaryStrip.prevBall} color="bg-emerald-500/10 border border-emerald-500/30" />
          </div>
        </CardContent>
      </Card>

      {/* Trend Cards with Range Selector */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              TRENDS
            </h3>
            <Tabs value={trendRange} onValueChange={(v) => setTrendRange(v as TrendRange)}>
              <TabsList className="h-8 bg-slate-800">
                <TabsTrigger value="30" className="text-xs h-6 px-3">30 Days</TabsTrigger>
                <TabsTrigger value="60" className="text-xs h-6 px-3">60 Days</TabsTrigger>
                <TabsTrigger value="90" className="text-xs h-6 px-3">90 Days</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Composite Trend */}
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Composite Score</span>
                <span className="text-sm font-bold text-primary">{trendChartData.avgComposite ?? '—'} avg</span>
              </div>
              {trendChartData.compositeData.length > 1 ? (
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={trendChartData.compositeData}>
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[60px] flex items-center justify-center text-xs text-slate-500">Not enough data</div>
              )}
            </div>

            {/* EV Trend */}
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Avg Exit Velo</span>
                <span className="text-sm font-bold text-blue-400">{trendChartData.avgEV ?? '—'} mph</span>
              </div>
              {trendChartData.evData.length > 1 ? (
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={trendChartData.evData}>
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[60px] flex items-center justify-center text-xs text-slate-500">Not enough data</div>
              )}
            </div>

            {/* Barrel Trend */}
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Barrel %</span>
                <span className="text-sm font-bold text-emerald-400">{trendChartData.avgBarrel ?? '—'}%</span>
              </div>
              {trendChartData.barrelData.length > 1 ? (
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={trendChartData.barrelData}>
                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[60px] flex items-center justify-center text-xs text-slate-500">Not enough data</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Game Log Table */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-4">
            GAME LOG (Last 10 Sessions)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-2 text-xs font-bold text-slate-400 uppercase">Date</th>
                  <th className="text-left py-2 px-2 text-xs font-bold text-slate-400 uppercase">Source</th>
                  <th className="text-center py-2 px-2 text-xs font-bold text-slate-400 uppercase">Swings</th>
                  <th className="text-center py-2 px-2 text-xs font-bold text-slate-400 uppercase">Avg EV</th>
                  <th className="text-center py-2 px-2 text-xs font-bold text-slate-400 uppercase">Max EV</th>
                  <th className="text-center py-2 px-2 text-xs font-bold text-slate-400 uppercase">Avg LA</th>
                  <th className="text-center py-2 px-2 text-xs font-bold text-slate-400 uppercase">HH%</th>
                  <th className="text-center py-2 px-2 text-xs font-bold text-slate-400 uppercase">Barrel%</th>
                  <th className="text-center py-2 px-2 text-xs font-bold text-slate-400 uppercase">Sweet%</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {launchSessions.slice(0, 10).map((session) => {
                  const hardHitPct = session.velo_95_plus && session.balls_in_play && session.balls_in_play > 0
                    ? ((session.velo_95_plus / session.balls_in_play) * 100).toFixed(1)
                    : '—';
                  const isExpanded = expandedSessionId === session.id;
                  
                  return (
                    <tr key={session.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-2 text-white font-medium">
                        {format(new Date(session.session_date), 'MMM d')}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs border-slate-600">
                          {session.source || 'HitTrax'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-center text-white">{session.total_swings}</td>
                      <td className="py-3 px-2 text-center text-blue-400 font-bold">{session.avg_exit_velo?.toFixed(1) ?? '—'}</td>
                      <td className="py-3 px-2 text-center text-emerald-400 font-bold">{session.max_exit_velo?.toFixed(1) ?? '—'}</td>
                      <td className="py-3 px-2 text-center text-white">{session.avg_launch_angle?.toFixed(1) ?? '—'}°</td>
                      <td className="py-3 px-2 text-center text-white">{hardHitPct}%</td>
                      <td className="py-3 px-2 text-center text-yellow-400 font-bold">{session.barrel_pct?.toFixed(1) ?? '—'}%</td>
                      <td className="py-3 px-2 text-center text-white">{session.quality_hit_pct?.toFixed(1) ?? '—'}%</td>
                      <td className="py-3 px-2">
                        <button 
                          onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                          className="p-1 text-slate-400 hover:text-white transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {launchSessions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No sessions recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Expanded Session Detail */}
          {expandedSessionId && (() => {
            const session = launchSessions.find(s => s.id === expandedSessionId);
            if (!session) return null;
            
            const lineDriveCount = Math.max(0, (session.balls_in_play || 0) - (session.ground_ball_count || 0) - (session.fly_ball_count || 0));
            
            return (
              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white">
                    Session Detail — {format(new Date(session.session_date), 'MMM d, yyyy')}
                  </h4>
                  <Badge className="bg-blue-600 text-white text-xs">{session.source || 'HitTrax'}</Badge>
                </div>
                
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2 text-center">
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <p className="text-lg font-bold text-white">{session.total_swings}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Swings</p>
                  </div>
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <p className="text-lg font-bold text-white">{session.balls_in_play || 0}</p>
                    <p className="text-[10px] text-slate-400 uppercase">BIP</p>
                  </div>
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <p className="text-lg font-bold text-blue-400">{session.avg_exit_velo?.toFixed(1) || '—'}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Avg EV</p>
                  </div>
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <p className="text-lg font-bold text-emerald-400">{session.max_exit_velo?.toFixed(1) || '—'}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Max EV</p>
                  </div>
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <p className="text-lg font-bold text-white">{session.avg_launch_angle?.toFixed(1) || '—'}°</p>
                    <p className="text-[10px] text-slate-400 uppercase">Avg LA</p>
                  </div>
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <p className="text-lg font-bold text-yellow-400">{session.barrel_pct?.toFixed(1) || '—'}%</p>
                    <p className="text-[10px] text-slate-400 uppercase">Barrel%</p>
                  </div>
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <p className="text-lg font-bold text-white">{session.contact_rate?.toFixed(1) || '—'}%</p>
                    <p className="text-[10px] text-slate-400 uppercase">Contact%</p>
                  </div>
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <p className="text-lg font-bold text-white">{session.ground_ball_count || 0}</p>
                    <p className="text-[10px] text-slate-400 uppercase">GB</p>
                  </div>
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <p className="text-lg font-bold text-white">{lineDriveCount}</p>
                    <p className="text-[10px] text-slate-400 uppercase">LD</p>
                  </div>
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <p className="text-lg font-bold text-white">{session.fly_ball_count || 0}</p>
                    <p className="text-[10px] text-slate-400 uppercase">FB</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Ask Rick Button */}
      {onAskRick && (
        <Button
          onClick={() => onAskRick(buildRickContext())}
          className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
          size="lg"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Ask Rick About My Numbers
        </Button>
      )}
    </div>
  );
}