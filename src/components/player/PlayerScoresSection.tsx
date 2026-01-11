import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { 
  Loader2,
  Upload,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  ResponsiveContainer,
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
}

interface PlayerData {
  latest_composite_score: number | null;
  latest_ball_score: number | null;
  latest_bat_score: number | null;
  latest_body_score: number | null;
  latest_brain_score: number | null;
}

export function PlayerScoresSection({ playerId, playerName, onAskRick }: PlayerScoresSectionProps) {
  const [launchSessions, setLaunchSessions] = useState<LaunchSession[]>([]);
  const [fourbScores, setFourbScores] = useState<FourBScore[]>([]);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [playerId]);

  const loadData = async () => {
    setLoading(true);
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];

    const [launchRes, scoresRes, playerRes] = await Promise.all([
      supabase
        .from('launch_monitor_sessions')
        .select('*')
        .eq('player_id', playerId)
        .gte('session_date', thirtyDaysAgo)
        .order('session_date', { ascending: false }),
      supabase
        .from('fourb_scores')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('players')
        .select('latest_composite_score, latest_ball_score, latest_bat_score, latest_body_score, latest_brain_score')
        .eq('id', playerId)
        .single(),
    ]);

    setLaunchSessions(launchRes.data || []);
    setFourbScores(scoresRes.data || []);
    setPlayerData(playerRes.data);
    setLoading(false);
  };

  // Use cached player data for top tiles when available
  const topTiles = useMemo(() => {
    // Try to use cached latest scores from players table first
    const composite = playerData?.latest_composite_score ?? 
      (fourbScores[0]?.composite_score ?? null);
    
    // Launch monitor aggregates
    const barrelPcts = launchSessions.filter(s => s.barrel_pct != null).map(s => s.barrel_pct!);
    const avgBarrel = barrelPcts.length > 0 
      ? (barrelPcts.reduce((a, b) => a + b, 0) / barrelPcts.length)
      : null;

    const evs = launchSessions.filter(s => s.avg_exit_velo != null).map(s => s.avg_exit_velo!);
    const avgEV = evs.length > 0 
      ? (evs.reduce((a, b) => a + b, 0) / evs.length)
      : null;

    const contactRates = launchSessions.filter(s => s.contact_rate != null).map(s => s.contact_rate!);
    const avgContact = contactRates.length > 0 
      ? (contactRates.reduce((a, b) => a + b, 0) / contactRates.length)
      : null;

    return {
      composite,
      barrelPct: avgBarrel,
      avgEV,
      contactRate: avgContact,
    };
  }, [launchSessions, fourbScores, playerData]);

  // Last session box score
  const lastSession = useMemo(() => {
    if (launchSessions.length === 0) return null;
    const s = launchSessions[0];
    
    const lineDriveCount = Math.max(0, (s.balls_in_play || 0) - (s.ground_ball_count || 0) - (s.fly_ball_count || 0));
    const hardHitPct = s.velo_90_plus && s.balls_in_play && s.balls_in_play > 0
      ? ((s.velo_90_plus / s.balls_in_play) * 100)
      : null;

    return {
      date: s.session_date,
      swings: s.total_swings,
      maxEV: s.max_exit_velo,
      avgEV: s.avg_exit_velo,
      avgLA: s.avg_launch_angle,
      hardHitPct,
      barrelPct: s.barrel_pct,
      gbCount: s.ground_ball_count || 0,
      ldCount: lineDriveCount,
      fbCount: s.fly_ball_count || 0,
    };
  }, [launchSessions]);

  // Sparkline data for trends
  const sparklineData = useMemo(() => {
    const compositeData = [...fourbScores]
      .filter(s => s.composite_score != null)
      .reverse()
      .map(s => ({ value: s.composite_score }));

    const evData = [...launchSessions]
      .filter(s => s.avg_exit_velo != null)
      .reverse()
      .map(s => ({ value: s.avg_exit_velo }));

    const barrelData = [...launchSessions]
      .filter(s => s.barrel_pct != null)
      .reverse()
      .map(s => ({ value: s.barrel_pct }));

    return { compositeData, evData, barrelData };
  }, [launchSessions, fourbScores]);

  // Calculate trend direction
  const getTrend = (data: { value: number | null }[]) => {
    if (data.length < 2) return 'flat';
    const last = data[data.length - 1]?.value ?? 0;
    const prev = data[data.length - 2]?.value ?? 0;
    if (last > prev) return 'up';
    if (last < prev) return 'down';
    return 'flat';
  };

  // Build context for Ask Rick
  const buildRickContext = () => {
    const parts: string[] = [];
    if (playerName) parts.push(`Player: ${playerName}`);
    if (topTiles.composite) parts.push(`Composite Score: ${topTiles.composite}`);
    if (topTiles.avgEV) parts.push(`Avg Exit Velo: ${topTiles.avgEV.toFixed(1)} mph`);
    if (topTiles.barrelPct) parts.push(`Barrel%: ${topTiles.barrelPct.toFixed(1)}%`);
    if (topTiles.contactRate) parts.push(`Contact Rate: ${topTiles.contactRate.toFixed(1)}%`);
    
    const compositeTrend = getTrend(sparklineData.compositeData);
    const evTrend = getTrend(sparklineData.evData);
    parts.push(`Composite Trend: ${compositeTrend}`);
    parts.push(`EV Trend: ${evTrend}`);
    
    return parts.join('\n');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state - no data yet
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

  const SparklineChart = ({ data, color }: { data: { value: number | null }[], color: string }) => {
    if (data.length < 2) return null;
    
    return (
      <ResponsiveContainer width={60} height={20}>
        <LineChart data={data}>
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={1.5} 
            dot={false} 
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-slate-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Top 4 Tiles - Hero metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Composite Score - Primary */}
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Composite</p>
            <p className="text-4xl font-black text-foreground">
              {topTiles.composite ?? '—'}
            </p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <SparklineChart data={sparklineData.compositeData} color="hsl(var(--primary))" />
              <TrendIcon trend={getTrend(sparklineData.compositeData)} />
            </div>
          </CardContent>
        </Card>

        {/* Avg EV */}
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">Avg EV</p>
            <p className="text-4xl font-black text-foreground">
              {topTiles.avgEV ? topTiles.avgEV.toFixed(1) : '—'}
            </p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <SparklineChart data={sparklineData.evData} color="#3b82f6" />
              <TrendIcon trend={getTrend(sparklineData.evData)} />
            </div>
          </CardContent>
        </Card>

        {/* Barrel% */}
        <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">Barrel%</p>
            <p className="text-4xl font-black text-foreground">
              {topTiles.barrelPct ? `${topTiles.barrelPct.toFixed(1)}` : '—'}
            </p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <SparklineChart data={sparklineData.barrelData} color="#10b981" />
              <TrendIcon trend={getTrend(sparklineData.barrelData)} />
            </div>
          </CardContent>
        </Card>

        {/* Contact Rate */}
        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">Contact%</p>
            <p className="text-4xl font-black text-foreground">
              {topTiles.contactRate ? `${topTiles.contactRate.toFixed(1)}` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Last Session Box Score */}
      {lastSession && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                Last Session Box Score
              </h3>
              <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                {format(new Date(lastSession.date), 'MMM d, yyyy')}
              </Badge>
            </div>
            
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2 text-center">
              <div className="p-2 bg-slate-800 rounded-lg">
                <p className="text-xl font-bold text-white">{lastSession.swings}</p>
                <p className="text-[10px] text-slate-400 uppercase">Swings</p>
              </div>
              <div className="p-2 bg-slate-800 rounded-lg">
                <p className="text-xl font-bold text-white">{lastSession.avgEV?.toFixed(1) || '—'}</p>
                <p className="text-[10px] text-slate-400 uppercase">Avg EV</p>
              </div>
              <div className="p-2 bg-slate-800 rounded-lg">
                <p className="text-xl font-bold text-emerald-400">{lastSession.maxEV?.toFixed(1) || '—'}</p>
                <p className="text-[10px] text-slate-400 uppercase">Max EV</p>
              </div>
              <div className="p-2 bg-slate-800 rounded-lg">
                <p className="text-xl font-bold text-white">{lastSession.avgLA?.toFixed(1) || '—'}°</p>
                <p className="text-[10px] text-slate-400 uppercase">Avg LA</p>
              </div>
              <div className="p-2 bg-slate-800 rounded-lg">
                <p className="text-xl font-bold text-white">{lastSession.hardHitPct?.toFixed(1) || '—'}%</p>
                <p className="text-[10px] text-slate-400 uppercase">HardHit%</p>
              </div>
              <div className="p-2 bg-slate-800 rounded-lg">
                <p className="text-xl font-bold text-white">{lastSession.barrelPct?.toFixed(1) || '—'}%</p>
                <p className="text-[10px] text-slate-400 uppercase">Barrel%</p>
              </div>
              <div className="p-2 bg-slate-800 rounded-lg">
                <p className="text-xl font-bold text-white">{lastSession.gbCount}</p>
                <p className="text-[10px] text-slate-400 uppercase">GB</p>
              </div>
              <div className="p-2 bg-slate-800 rounded-lg">
                <p className="text-xl font-bold text-white">{lastSession.ldCount}</p>
                <p className="text-[10px] text-slate-400 uppercase">LD</p>
              </div>
              <div className="p-2 bg-slate-800 rounded-lg">
                <p className="text-xl font-bold text-white">{lastSession.fbCount}</p>
                <p className="text-[10px] text-slate-400 uppercase">FB</p>
              </div>
              <div className="p-2 bg-slate-800 rounded-lg hidden md:flex items-center justify-center">
                <Badge className="bg-blue-600 text-white text-[10px]">Latest</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trends Section */}
      {(sparklineData.compositeData.length > 1 || sparklineData.evData.length > 1 || sparklineData.barrelData.length > 1) && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-4">
              Trends (Last 30 Days)
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {sparklineData.compositeData.length > 1 && (
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-2">Composite</p>
                  <div className="flex justify-center">
                    <ResponsiveContainer width={100} height={40}>
                      <LineChart data={sparklineData.compositeData}>
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {sparklineData.evData.length > 1 && (
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-2">Avg EV</p>
                  <div className="flex justify-center">
                    <ResponsiveContainer width={100} height={40}>
                      <LineChart data={sparklineData.evData}>
                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {sparklineData.barrelData.length > 1 && (
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-2">Barrel%</p>
                  <div className="flex justify-center">
                    <ResponsiveContainer width={100} height={40}>
                      <LineChart data={sparklineData.barrelData}>
                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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