import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, isAfter } from "date-fns";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ChevronRight,
  BarChart3,
  Loader2,
  Flame,
  Target as TargetIcon,
  Plus
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { cn } from "@/lib/utils";

interface PlayerScoresTabProps {
  playerId: string;
  playerName?: string;
}

interface ScoreRecord {
  id: string;
  created_at: string;
  composite_score: number | null;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  grade: string | null;
  weakest_link: string | null;
  reboot_session_id: string | null;
}

type SessionRange = 5 | 10 | 30 | 'all';

const SCORE_COLORS = {
  overall: "#f97316",
  brain: "#8b5cf6",
  body: "#3b82f6",
  bat: "#10b981",
  ball: "#f59e0b",
};

export function PlayerScoresTab({ playerId, playerName }: PlayerScoresTabProps) {
  const navigate = useNavigate();
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionRange, setSessionRange] = useState<SessionRange>(10);
  const [showBrain, setShowBrain] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const [showBat, setShowBat] = useState(false);
  const [showBall, setShowBall] = useState(false);

  useEffect(() => {
    loadScores();
  }, [playerId]);

  const loadScores = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fourb_scores')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScores(data || []);
    } catch (err) {
      console.error('Error loading scores:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter scores by session count
  const filteredScores = useMemo(() => {
    if (sessionRange === 'all') return scores;
    return scores.slice(0, sessionRange);
  }, [scores, sessionRange]);

  // Stats calculations
  const stats = useMemo(() => {
    if (scores.length === 0) return null;

    const validScores = scores.filter(s => s.composite_score != null);
    if (validScores.length === 0) return null;

    const current = validScores[0];
    const previous = validScores[1];

    // Season averages
    const avgOverall = Math.round(validScores.reduce((sum, s) => sum + (s.composite_score ?? 0), 0) / validScores.length);
    const avgBrain = Math.round(validScores.filter(s => s.brain_score != null).reduce((sum, s) => sum + (s.brain_score ?? 0), 0) / validScores.filter(s => s.brain_score != null).length) || null;
    const avgBody = Math.round(validScores.filter(s => s.body_score != null).reduce((sum, s) => sum + (s.body_score ?? 0), 0) / validScores.filter(s => s.body_score != null).length) || null;
    const avgBat = Math.round(validScores.filter(s => s.bat_score != null).reduce((sum, s) => sum + (s.bat_score ?? 0), 0) / validScores.filter(s => s.bat_score != null).length) || null;
    const avgBall = Math.round(validScores.filter(s => s.ball_score != null).reduce((sum, s) => sum + (s.ball_score ?? 0), 0) / validScores.filter(s => s.ball_score != null).length) || null;

    // Best scores
    const bestOverall = Math.max(...validScores.map(s => s.composite_score ?? 0));
    const bestBrain = Math.max(...validScores.filter(s => s.brain_score != null).map(s => s.brain_score ?? 0));
    const bestBody = Math.max(...validScores.filter(s => s.body_score != null).map(s => s.body_score ?? 0));
    const bestBat = Math.max(...validScores.filter(s => s.bat_score != null).map(s => s.bat_score ?? 0));
    const bestBall = Math.max(...validScores.filter(s => s.ball_score != null).map(s => s.ball_score ?? 0));

    // Deltas vs previous
    const deltaOverall = current && previous ? (current.composite_score ?? 0) - (previous.composite_score ?? 0) : null;
    const deltaBrain = current?.brain_score != null && previous?.brain_score != null ? current.brain_score - previous.brain_score : null;
    const deltaBody = current?.body_score != null && previous?.body_score != null ? current.body_score - previous.body_score : null;
    const deltaBat = current?.bat_score != null && previous?.bat_score != null ? current.bat_score - previous.bat_score : null;
    const deltaBall = current?.ball_score != null && previous?.ball_score != null ? current.ball_score - previous.ball_score : null;

    // Last 5 average
    const last5 = validScores.slice(0, 5);
    const last5Avg = Math.round(last5.reduce((sum, s) => sum + (s.composite_score ?? 0), 0) / last5.length);

    // Best 3-session stretch
    let best3Avg = 0;
    for (let i = 0; i <= validScores.length - 3; i++) {
      const avg = (
        (validScores[i].composite_score ?? 0) +
        (validScores[i + 1].composite_score ?? 0) +
        (validScores[i + 2].composite_score ?? 0)
      ) / 3;
      if (avg > best3Avg) best3Avg = avg;
    }
    best3Avg = Math.round(best3Avg);

    // Consistency (std dev)
    const mean = avgOverall;
    const variance = validScores.reduce((sum, s) => sum + Math.pow((s.composite_score ?? 0) - mean, 2), 0) / validScores.length;
    const stdDev = Math.sqrt(variance);
    const consistencyLabel = stdDev < 3 ? 'Steady' : stdDev < 6 ? 'Normal' : 'Volatile';

    // Trend (last 5 vs season)
    const trendDiff = last5Avg - avgOverall;
    const trendLabel = trendDiff >= 3 ? 'Trending Up' : trendDiff <= -3 ? 'Trending Down' : 'Stable';

    return {
      current: {
        overall: current?.composite_score ?? null,
        brain: current?.brain_score ?? null,
        body: current?.body_score ?? null,
        bat: current?.bat_score ?? null,
        ball: current?.ball_score ?? null,
        grade: current?.grade ?? null,
      },
      avg: { overall: avgOverall, brain: avgBrain, body: avgBody, bat: avgBat, ball: avgBall },
      best: { overall: bestOverall, brain: bestBrain || null, body: bestBody || null, bat: bestBat || null, ball: bestBall || null },
      delta: { overall: deltaOverall, brain: deltaBrain, body: deltaBody, bat: deltaBat, ball: deltaBall },
      form: {
        last5Avg,
        best3Avg,
        consistencyLabel,
        trendLabel,
        trendDiff,
        totalSessions: scores.length,
      },
    };
  }, [scores]);

  // Chart data
  const chartData = useMemo(() => {
    return [...filteredScores]
      .reverse()
      .map(s => ({
        date: format(new Date(s.created_at), 'M/d'),
        fullDate: format(new Date(s.created_at), 'MMM d, yyyy'),
        overall: s.composite_score,
        brain: s.brain_score,
        body: s.body_score,
        bat: s.bat_score,
        ball: s.ball_score,
      }));
  }, [filteredScores]);

  // Delta component
  const Delta = ({ value, size = 'sm' }: { value: number | null; size?: 'sm' | 'lg' }) => {
    if (value == null) return <span className="text-slate-600">—</span>;
    
    const isLarge = size === 'lg';
    const iconSize = isLarge ? 'h-4 w-4' : 'h-3 w-3';
    const textSize = isLarge ? 'text-sm font-semibold' : 'text-xs';
    
    if (value > 0) return (
      <span className={cn("flex items-center text-emerald-400", textSize)}>
        <TrendingUp className={cn(iconSize, "mr-0.5")} />+{value}
      </span>
    );
    if (value < 0) return (
      <span className={cn("flex items-center text-red-400", textSize)}>
        <TrendingDown className={cn(iconSize, "mr-0.5")} />{value}
      </span>
    );
    return (
      <span className={cn("flex items-center text-slate-500", textSize)}>
        <Minus className={cn(iconSize, "mr-0.5")} />0
      </span>
    );
  };

  // Stat box component - ESPN style
  const StatBox = ({ 
    label, 
    current, 
    avg, 
    best, 
    delta,
    color,
    isPrimary = false
  }: { 
    label: string;
    current: number | null;
    avg: number | null;
    best: number | null;
    delta: number | null;
    color: string;
    isPrimary?: boolean;
  }) => (
    <div className={cn(
      "border border-slate-800 rounded-lg p-3",
      isPrimary ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80" : "bg-slate-900/60"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          "text-xs font-medium uppercase tracking-wide",
          isPrimary ? "text-orange-400" : "text-slate-500"
        )} style={{ color: isPrimary ? undefined : color }}>
          {label}
        </span>
        <Delta value={delta} size={isPrimary ? 'lg' : 'sm'} />
      </div>
      
      <div className={cn(
        "font-bold text-white mb-2",
        isPrimary ? "text-4xl" : "text-2xl"
      )}>
        {current ?? '—'}
      </div>
      
      <div className="flex items-center gap-3 text-xs">
        <div>
          <span className="text-slate-500">AVG </span>
          <span className="text-slate-300 font-medium">{avg ?? '—'}</span>
        </div>
        <div className="text-slate-700">|</div>
        <div>
          <span className="text-slate-500">BEST </span>
          <span className="text-slate-300 font-medium">{best ?? '—'}</span>
        </div>
      </div>
    </div>
  );

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 shadow-lg">
        <p className="text-slate-300 text-xs font-medium mb-1.5">{payload[0]?.payload?.fullDate}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-400">{entry.name}:</span>
              <span className="text-white font-semibold">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Score cell with color coding
  const ScoreCell = ({ value, prevValue }: { value: number | null; prevValue?: number | null }) => {
    if (value == null) return <span className="text-slate-600">—</span>;
    
    const isUp = prevValue != null && value > prevValue;
    const isDown = prevValue != null && value < prevValue;
    
    return (
      <span className={cn(
        "font-medium",
        isUp && "text-emerald-400",
        isDown && "text-red-400",
        !isUp && !isDown && "text-slate-200"
      )}>
        {value}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="border border-slate-800 rounded-lg bg-slate-900/60 py-16 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-slate-700 mb-3" />
        <h3 className="text-lg font-semibold text-white mb-1">No sessions yet</h3>
        <p className="text-slate-500 text-sm mb-4">
          Run your first swing analysis to start your season.
        </p>
        <Button 
          onClick={() => navigate('/admin/new-session', { state: { playerId, playerName } })}
          className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Session
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Season Snapshot - Box Score Style */}
      <div className="grid grid-cols-5 gap-3">
        <StatBox
          label="Overall 4B"
          current={stats?.current.overall ?? null}
          avg={stats?.avg.overall ?? null}
          best={stats?.best.overall ?? null}
          delta={stats?.delta.overall ?? null}
          color={SCORE_COLORS.overall}
          isPrimary
        />
        <StatBox
          label="Brain"
          current={stats?.current.brain ?? null}
          avg={stats?.avg.brain ?? null}
          best={stats?.best.brain ?? null}
          delta={stats?.delta.brain ?? null}
          color={SCORE_COLORS.brain}
        />
        <StatBox
          label="Body"
          current={stats?.current.body ?? null}
          avg={stats?.avg.body ?? null}
          best={stats?.best.body ?? null}
          delta={stats?.delta.body ?? null}
          color={SCORE_COLORS.body}
        />
        <StatBox
          label="Bat"
          current={stats?.current.bat ?? null}
          avg={stats?.avg.bat ?? null}
          best={stats?.best.bat ?? null}
          delta={stats?.delta.bat ?? null}
          color={SCORE_COLORS.bat}
        />
        <StatBox
          label="Ball"
          current={stats?.current.ball ?? null}
          avg={stats?.avg.ball ?? null}
          best={stats?.best.ball ?? null}
          delta={stats?.delta.ball ?? null}
          color={SCORE_COLORS.ball}
        />
      </div>

      {/* Chart + Form Section */}
      <div className="grid grid-cols-4 gap-4">
        {/* Trend Chart */}
        <div className="col-span-3 border border-slate-800 rounded-lg bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide">Score Trend</h3>
            
            <div className="flex items-center gap-3">
              {/* Sub-score toggles */}
              <div className="flex gap-1">
                {[
                  { key: 'brain', label: 'Brain', color: SCORE_COLORS.brain, active: showBrain, toggle: setShowBrain },
                  { key: 'body', label: 'Body', color: SCORE_COLORS.body, active: showBody, toggle: setShowBody },
                  { key: 'bat', label: 'Bat', color: SCORE_COLORS.bat, active: showBat, toggle: setShowBat },
                  { key: 'ball', label: 'Ball', color: SCORE_COLORS.ball, active: showBall, toggle: setShowBall },
                ].map(({ key, label, color, active, toggle }) => (
                  <button
                    key={key}
                    onClick={() => toggle(!active)}
                    className={cn(
                      "px-2 py-1 text-xs font-medium rounded transition-colors",
                      active 
                        ? "text-white" 
                        : "text-slate-500 hover:text-slate-300"
                    )}
                    style={{ backgroundColor: active ? color : 'transparent' }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Session range */}
              <div className="flex bg-slate-800 rounded p-0.5">
                {([5, 10, 30, 'all'] as SessionRange[]).map(range => (
                  <button
                    key={range}
                    onClick={() => setSessionRange(range)}
                    className={cn(
                      "px-2 py-1 text-xs font-medium rounded transition-colors",
                      sessionRange === range 
                        ? "bg-slate-700 text-white" 
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {range === 'all' ? 'ALL' : range}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis 
                  dataKey="date" 
                  stroke="#475569" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={11}
                  domain={[20, 80]}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip content={<CustomTooltip />} />
                
                <Line 
                  type="monotone" 
                  dataKey="overall" 
                  stroke={SCORE_COLORS.overall}
                  strokeWidth={2.5}
                  dot={{ fill: SCORE_COLORS.overall, strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  name="Overall"
                />
                
                {showBrain && (
                  <Line 
                    type="monotone" 
                    dataKey="brain" 
                    stroke={SCORE_COLORS.brain}
                    strokeWidth={1.5}
                    dot={false}
                    name="Brain"
                  />
                )}
                {showBody && (
                  <Line 
                    type="monotone" 
                    dataKey="body" 
                    stroke={SCORE_COLORS.body}
                    strokeWidth={1.5}
                    dot={false}
                    name="Body"
                  />
                )}
                {showBat && (
                  <Line 
                    type="monotone" 
                    dataKey="bat" 
                    stroke={SCORE_COLORS.bat}
                    strokeWidth={1.5}
                    dot={false}
                    name="Bat"
                  />
                )}
                {showBall && (
                  <Line 
                    type="monotone" 
                    dataKey="ball" 
                    stroke={SCORE_COLORS.ball}
                    strokeWidth={1.5}
                    dot={false}
                    name="Ball"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-slate-600 text-sm">
              Need more sessions to show trend
            </div>
          )}
        </div>

        {/* Form & Consistency Panel */}
        <div className="border border-slate-800 rounded-lg bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">Form</h3>
          
          <div className="space-y-3">
            {/* Trend indicator */}
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
              <span className="text-slate-400 text-xs">Status</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs font-medium border-0",
                  stats?.form.trendLabel === 'Trending Up' && "bg-emerald-500/20 text-emerald-400",
                  stats?.form.trendLabel === 'Trending Down' && "bg-red-500/20 text-red-400",
                  stats?.form.trendLabel === 'Stable' && "bg-slate-500/20 text-slate-400"
                )}
              >
                {stats?.form.trendLabel === 'Trending Up' && <TrendingUp className="h-3 w-3 mr-1" />}
                {stats?.form.trendLabel === 'Trending Down' && <TrendingDown className="h-3 w-3 mr-1" />}
                {stats?.form.trendLabel}
              </Badge>
            </div>

            {/* Last 5 Avg */}
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400 text-xs">Last 5 Avg</span>
              <span className="text-white font-semibold">{stats?.form.last5Avg ?? '—'}</span>
            </div>

            {/* Best Stretch */}
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-500" />
                Best 3-Game Avg
              </span>
              <span className="text-white font-semibold">{stats?.form.best3Avg ?? '—'}</span>
            </div>

            {/* Consistency */}
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <TargetIcon className="h-3 w-3 text-blue-500" />
                Consistency
              </span>
              <span className={cn(
                "text-xs font-medium",
                stats?.form.consistencyLabel === 'Steady' && "text-emerald-400",
                stats?.form.consistencyLabel === 'Normal' && "text-slate-300",
                stats?.form.consistencyLabel === 'Volatile' && "text-amber-400"
              )}>
                {stats?.form.consistencyLabel ?? '—'}
              </span>
            </div>

            {/* Total Sessions */}
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400 text-xs">Total Sessions</span>
              <span className="text-white font-semibold">{stats?.form.totalSessions ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Game Log Table */}
      <div className="border border-slate-800 rounded-lg bg-slate-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wide">Game Log</h3>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-500 text-xs uppercase">Date</TableHead>
              <TableHead className="text-slate-500 text-xs uppercase">Session</TableHead>
              <TableHead className="text-slate-500 text-xs uppercase text-center">Overall</TableHead>
              <TableHead className="text-slate-500 text-xs uppercase text-center">Brain</TableHead>
              <TableHead className="text-slate-500 text-xs uppercase text-center">Body</TableHead>
              <TableHead className="text-slate-500 text-xs uppercase text-center">Bat</TableHead>
              <TableHead className="text-slate-500 text-xs uppercase text-center">Ball</TableHead>
              <TableHead className="text-slate-500 text-xs uppercase text-center">Δ</TableHead>
              <TableHead className="text-slate-500 text-xs uppercase w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredScores.slice(0, 15).map((score, index) => {
              const prevScore = filteredScores[index + 1];
              const delta = score.composite_score != null && prevScore?.composite_score != null 
                ? score.composite_score - prevScore.composite_score 
                : null;
              
              return (
                <TableRow 
                  key={score.id} 
                  className="border-slate-800/50 hover:bg-slate-800/30"
                >
                  <TableCell className="text-slate-400 text-sm py-2">
                    {format(new Date(score.created_at), 'M/d/yy')}
                  </TableCell>
                  <TableCell className="text-slate-300 text-sm py-2">
                    Session {scores.length - scores.indexOf(score)}
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <span className="text-white font-bold text-base">
                      {score.composite_score ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <ScoreCell value={score.brain_score} prevValue={prevScore?.brain_score} />
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <ScoreCell value={score.body_score} prevValue={prevScore?.body_score} />
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <ScoreCell value={score.bat_score} prevValue={prevScore?.bat_score} />
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <ScoreCell value={score.ball_score} prevValue={prevScore?.ball_score} />
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <Delta value={delta} />
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-slate-500 hover:text-white hover:bg-slate-800"
                    >
                      View <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
