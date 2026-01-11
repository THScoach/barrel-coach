import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Loader2,
  Activity,
  Target,
  Zap,
  BarChart3
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  ResponsiveContainer,
  Tooltip,
  XAxis
} from "recharts";
import { cn } from "@/lib/utils";

interface PlayerScoresSectionProps {
  playerId: string;
}

interface LaunchSession {
  id: string;
  session_date: string;
  avg_exit_velo: number | null;
  max_exit_velo: number | null;
  avg_launch_angle: number | null;
  barrel_pct: number | null;
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

export function PlayerScoresSection({ playerId }: PlayerScoresSectionProps) {
  const [launchSessions, setLaunchSessions] = useState<LaunchSession[]>([]);
  const [fourbScores, setFourbScores] = useState<FourBScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [playerId]);

  const loadData = async () => {
    setLoading(true);
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];

    const [launchRes, scoresRes] = await Promise.all([
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
    ]);

    setLaunchSessions(launchRes.data || []);
    setFourbScores(scoresRes.data || []);
    setLoading(false);
  };

  // Aggregate metrics from last 30 days
  const aggregates = useMemo(() => {
    if (launchSessions.length === 0 && fourbScores.length === 0) return null;

    // 4B Composite from scores
    const composites = fourbScores.filter(s => s.composite_score != null).map(s => s.composite_score!);
    const avgComposite = composites.length > 0 
      ? Math.round(composites.reduce((a, b) => a + b, 0) / composites.length) 
      : null;

    // Launch monitor aggregates
    const barrelPcts = launchSessions.filter(s => s.barrel_pct != null).map(s => s.barrel_pct!);
    const avgBarrel = barrelPcts.length > 0 
      ? (barrelPcts.reduce((a, b) => a + b, 0) / barrelPcts.length).toFixed(1)
      : null;

    const evs = launchSessions.filter(s => s.avg_exit_velo != null).map(s => s.avg_exit_velo!);
    const avgEV = evs.length > 0 
      ? (evs.reduce((a, b) => a + b, 0) / evs.length).toFixed(1)
      : null;

    const sweetSpots = launchSessions.filter(s => s.quality_hit_pct != null).map(s => s.quality_hit_pct!);
    const avgSweetSpot = sweetSpots.length > 0 
      ? (sweetSpots.reduce((a, b) => a + b, 0) / sweetSpots.length).toFixed(1)
      : null;

    return {
      composite: avgComposite,
      barrelPct: avgBarrel,
      avgEV,
      sweetSpotPct: avgSweetSpot,
    };
  }, [launchSessions, fourbScores]);

  // Last session box score
  const lastSession = useMemo(() => {
    if (launchSessions.length === 0) return null;
    const s = launchSessions[0];
    
    const lineDriveCount = (s.balls_in_play || 0) - (s.ground_ball_count || 0) - (s.fly_ball_count || 0);
    const hardHitPct = s.velo_90_plus && s.balls_in_play && s.balls_in_play > 0
      ? ((s.velo_90_plus / s.balls_in_play) * 100).toFixed(1)
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
      ldCount: lineDriveCount > 0 ? lineDriveCount : 0,
      fbCount: s.fly_ball_count || 0,
    };
  }, [launchSessions]);

  // Sparkline data
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!aggregates && launchSessions.length === 0 && fourbScores.length === 0) {
    return (
      <Card className="bg-muted/30 border-border">
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No session data yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Complete a training session to see your scores</p>
        </CardContent>
      </Card>
    );
  }

  const SparklineChart = ({ data, color }: { data: { value: number | null }[], color: string }) => {
    if (data.length < 2) return <span className="text-muted-foreground text-xs">—</span>;
    
    return (
      <ResponsiveContainer width={80} height={24}>
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

  return (
    <div className="space-y-6">
      {/* Big 4 Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-medium text-accent uppercase tracking-wide mb-1">Composite</p>
            <p className="text-3xl font-bold text-foreground">
              {aggregates?.composite ?? '—'}
            </p>
            <div className="mt-2">
              <SparklineChart data={sparklineData.compositeData} color="hsl(var(--accent))" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-medium text-emerald-500 uppercase tracking-wide mb-1">Barrel%</p>
            <p className="text-3xl font-bold text-foreground">
              {aggregates?.barrelPct ? `${aggregates.barrelPct}%` : '—'}
            </p>
            <div className="mt-2">
              <SparklineChart data={sparklineData.barrelData} color="#10b981" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-medium text-blue-500 uppercase tracking-wide mb-1">Avg EV</p>
            <p className="text-3xl font-bold text-foreground">
              {aggregates?.avgEV ? `${aggregates.avgEV}` : '—'}
            </p>
            <div className="mt-2">
              <SparklineChart data={sparklineData.evData} color="#3b82f6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-medium text-amber-500 uppercase tracking-wide mb-1">Sweet Spot%</p>
            <p className="text-3xl font-bold text-foreground">
              {aggregates?.sweetSpotPct ? `${aggregates.sweetSpotPct}%` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Last Session Box Score */}
      {lastSession && (
        <Card className="border-border bg-muted/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Last Session Box Score
              </h3>
              <Badge variant="outline" className="text-xs">
                {format(new Date(lastSession.date), 'MMM d, yyyy')}
              </Badge>
            </div>
            
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2 text-center">
              <div className="p-2 bg-background rounded">
                <p className="text-lg font-bold">{lastSession.swings}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Swings</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-lg font-bold">{lastSession.maxEV?.toFixed(1) || '—'}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Max EV</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-lg font-bold">{lastSession.avgEV?.toFixed(1) || '—'}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Avg EV</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-lg font-bold">{lastSession.avgLA?.toFixed(1) || '—'}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Avg LA</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-lg font-bold">{lastSession.hardHitPct || '—'}%</p>
                <p className="text-[10px] text-muted-foreground uppercase">HardHit%</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-lg font-bold">{lastSession.barrelPct?.toFixed(1) || '—'}%</p>
                <p className="text-[10px] text-muted-foreground uppercase">Barrel%</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-lg font-bold">{lastSession.gbCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase">GB</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-lg font-bold">{lastSession.ldCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase">LD</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-lg font-bold">{lastSession.fbCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase">FB</p>
              </div>
              <div className="p-2 bg-background rounded flex items-center justify-center">
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}