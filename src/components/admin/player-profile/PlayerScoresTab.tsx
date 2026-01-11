import { useState, useEffect, useMemo } from "react";
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
  Brain, 
  Activity, 
  Zap, 
  Target,
  Trophy,
  ChevronRight,
  BarChart3,
  Loader2
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { cn } from "@/lib/utils";

interface PlayerScoresTabProps {
  playerId: string;
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

type TimeRange = '7d' | '30d' | '90d' | 'all';

const SCORE_COLORS = {
  overall: "#f97316",
  brain: "#8b5cf6",
  body: "#3b82f6",
  bat: "#10b981",
  ball: "#f59e0b",
};

export function PlayerScoresTab({ playerId }: PlayerScoresTabProps) {
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
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

  // Filter scores by time range
  const filteredScores = useMemo(() => {
    if (timeRange === 'all') return scores;
    
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = subDays(new Date(), days);
    
    return scores.filter(s => isAfter(new Date(s.created_at), cutoff));
  }, [scores, timeRange]);

  // Get current (most recent) and previous scores
  const currentScore = filteredScores[0];
  const previousScore = filteredScores[1];

  // Calculate deltas
  const getDelta = (current: number | null | undefined, previous: number | null | undefined) => {
    if (current == null || previous == null) return null;
    return current - previous;
  };

  const overallDelta = getDelta(currentScore?.composite_score, previousScore?.composite_score);
  const brainDelta = getDelta(currentScore?.brain_score, previousScore?.brain_score);
  const bodyDelta = getDelta(currentScore?.body_score, previousScore?.body_score);
  const batDelta = getDelta(currentScore?.bat_score, previousScore?.bat_score);
  const ballDelta = getDelta(currentScore?.ball_score, previousScore?.ball_score);

  // Prepare chart data (reverse for chronological order)
  const chartData = useMemo(() => {
    return [...filteredScores]
      .reverse()
      .slice(-20) // Last 20 sessions max
      .map(s => ({
        date: format(new Date(s.created_at), 'MMM d'),
        fullDate: format(new Date(s.created_at), 'MMM d, yyyy'),
        overall: s.composite_score,
        brain: s.brain_score,
        body: s.body_score,
        bat: s.bat_score,
        ball: s.ball_score,
      }));
  }, [filteredScores]);

  // Sparkline data (last 10 sessions)
  const sparklineData = useMemo(() => {
    return [...scores].reverse().slice(-10).map(s => s.composite_score ?? 0);
  }, [scores]);

  // Highlights calculations
  const highlights = useMemo(() => {
    if (scores.length === 0) return null;

    const validScores = scores.filter(s => s.composite_score != null);
    if (validScores.length === 0) return null;

    // Best overall score
    const best = validScores.reduce((max, s) => 
      (s.composite_score ?? 0) > (max.composite_score ?? 0) ? s : max
    );

    // Biggest jump
    let biggestJump = { delta: 0, date: '' };
    for (let i = 1; i < validScores.length; i++) {
      const curr = validScores[i - 1].composite_score ?? 0;
      const prev = validScores[i].composite_score ?? 0;
      const delta = curr - prev;
      if (delta > biggestJump.delta) {
        biggestJump = { delta, date: validScores[i - 1].created_at };
      }
    }

    // Average of last 5
    const last5 = validScores.slice(0, 5);
    const avg = last5.reduce((sum, s) => sum + (s.composite_score ?? 0), 0) / last5.length;

    return {
      bestScore: best.composite_score,
      bestDate: best.created_at,
      biggestJump: biggestJump.delta,
      biggestJumpDate: biggestJump.date,
      consistency: Math.round(avg),
      totalSessions: scores.length,
    };
  }, [scores]);

  // Delta indicator component
  const DeltaIndicator = ({ delta }: { delta: number | null }) => {
    if (delta == null) return <span className="text-slate-500 text-xs">—</span>;
    if (delta > 0) return (
      <span className="flex items-center text-emerald-400 text-xs font-medium">
        <TrendingUp className="h-3 w-3 mr-0.5" />+{delta}
      </span>
    );
    if (delta < 0) return (
      <span className="flex items-center text-red-400 text-xs font-medium">
        <TrendingDown className="h-3 w-3 mr-0.5" />{delta}
      </span>
    );
    return (
      <span className="flex items-center text-slate-400 text-xs">
        <Minus className="h-3 w-3 mr-0.5" />0
      </span>
    );
  };

  // Score card component
  const ScoreCard = ({ 
    label, 
    value, 
    delta, 
    icon: Icon, 
    color 
  }: { 
    label: string; 
    value: number | null; 
    delta: number | null; 
    icon: typeof Brain; 
    color: string;
  }) => (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-sm flex items-center gap-1.5">
            <Icon className="h-4 w-4" style={{ color }} />
            {label}
          </span>
          <DeltaIndicator delta={delta} />
        </div>
        <div className="text-2xl font-bold text-white">
          {value ?? '—'}
        </div>
      </CardContent>
    </Card>
  );

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-slate-300 text-sm font-medium mb-2">{payload[0]?.payload?.fullDate}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400 capitalize">{entry.dataKey}:</span>
            <span className="text-white font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <Card className="bg-slate-900/80 border-slate-800">
        <CardContent className="py-16 text-center">
          <BarChart3 className="h-16 w-16 mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No scores yet</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Run your first session to start tracking progress. Scores will appear here after each assessment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score Cards Row */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-orange-300 text-sm font-medium">Overall Score</span>
              <DeltaIndicator delta={overallDelta} />
            </div>
            <div className="text-4xl font-bold text-white">
              {currentScore?.composite_score ?? '—'}
            </div>
            {currentScore?.grade && (
              <Badge className="mt-2 bg-orange-500/20 text-orange-300 border-orange-500/50">
                {currentScore.grade}
              </Badge>
            )}
          </CardContent>
        </Card>
        
        <ScoreCard 
          label="Brain" 
          value={currentScore?.brain_score ?? null} 
          delta={brainDelta} 
          icon={Brain} 
          color={SCORE_COLORS.brain} 
        />
        <ScoreCard 
          label="Body" 
          value={currentScore?.body_score ?? null} 
          delta={bodyDelta} 
          icon={Activity} 
          color={SCORE_COLORS.body} 
        />
        <ScoreCard 
          label="Bat" 
          value={currentScore?.bat_score ?? null} 
          delta={batDelta} 
          icon={Zap} 
          color={SCORE_COLORS.bat} 
        />
        <ScoreCard 
          label="Ball" 
          value={currentScore?.ball_score ?? null} 
          delta={ballDelta} 
          icon={Target} 
          color={SCORE_COLORS.ball} 
        />
      </div>

      {/* Main Chart + Highlights Row */}
      <div className="grid grid-cols-4 gap-6">
        {/* Chart Area */}
        <Card className="col-span-3 bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base">Score Trend</CardTitle>
              <div className="flex items-center gap-2">
                {/* Toggle buttons for sub-scores */}
                <div className="flex gap-1 mr-4">
                  <Button
                    variant={showBrain ? "default" : "outline"}
                    size="sm"
                    className={cn("h-7 px-2 text-xs", showBrain && "bg-purple-600 hover:bg-purple-700")}
                    onClick={() => setShowBrain(!showBrain)}
                  >
                    Brain
                  </Button>
                  <Button
                    variant={showBody ? "default" : "outline"}
                    size="sm"
                    className={cn("h-7 px-2 text-xs", showBody && "bg-blue-600 hover:bg-blue-700")}
                    onClick={() => setShowBody(!showBody)}
                  >
                    Body
                  </Button>
                  <Button
                    variant={showBat ? "default" : "outline"}
                    size="sm"
                    className={cn("h-7 px-2 text-xs", showBat && "bg-emerald-600 hover:bg-emerald-700")}
                    onClick={() => setShowBat(!showBat)}
                  >
                    Bat
                  </Button>
                  <Button
                    variant={showBall ? "default" : "outline"}
                    size="sm"
                    className={cn("h-7 px-2 text-xs", showBall && "bg-amber-600 hover:bg-amber-700")}
                    onClick={() => setShowBall(!showBall)}
                  >
                    Ball
                  </Button>
                </div>
                
                {/* Time range filter */}
                <div className="flex rounded-lg bg-slate-800 p-0.5">
                  {(['7d', '30d', '90d', 'all'] as TimeRange[]).map(range => (
                    <Button
                      key={range}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 px-3 text-xs rounded-md",
                        timeRange === range 
                          ? "bg-slate-700 text-white" 
                          : "text-slate-400 hover:text-white"
                      )}
                      onClick={() => setTimeRange(range)}
                    >
                      {range.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={12}
                    domain={[20, 80]}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  {/* Always show overall */}
                  <Line 
                    type="monotone" 
                    dataKey="overall" 
                    stroke={SCORE_COLORS.overall}
                    strokeWidth={3}
                    dot={{ fill: SCORE_COLORS.overall, strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name="Overall"
                  />
                  
                  {showBrain && (
                    <Line 
                      type="monotone" 
                      dataKey="brain" 
                      stroke={SCORE_COLORS.brain}
                      strokeWidth={2}
                      dot={{ fill: SCORE_COLORS.brain, strokeWidth: 0, r: 3 }}
                      name="Brain"
                    />
                  )}
                  {showBody && (
                    <Line 
                      type="monotone" 
                      dataKey="body" 
                      stroke={SCORE_COLORS.body}
                      strokeWidth={2}
                      dot={{ fill: SCORE_COLORS.body, strokeWidth: 0, r: 3 }}
                      name="Body"
                    />
                  )}
                  {showBat && (
                    <Line 
                      type="monotone" 
                      dataKey="bat" 
                      stroke={SCORE_COLORS.bat}
                      strokeWidth={2}
                      dot={{ fill: SCORE_COLORS.bat, strokeWidth: 0, r: 3 }}
                      name="Bat"
                    />
                  )}
                  {showBall && (
                    <Line 
                      type="monotone" 
                      dataKey="ball" 
                      stroke={SCORE_COLORS.ball}
                      strokeWidth={2}
                      dot={{ fill: SCORE_COLORS.ball, strokeWidth: 0, r: 3 }}
                      name="Ball"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-500">
                No data in selected time range
              </div>
            )}
          </CardContent>
        </Card>

        {/* Highlights Panel */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {highlights ? (
              <>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-slate-400 text-xs mb-1">Best Overall Score</p>
                  <p className="text-2xl font-bold text-white">{highlights.bestScore}</p>
                  <p className="text-slate-500 text-xs">
                    {format(new Date(highlights.bestDate), 'MMM d, yyyy')}
                  </p>
                </div>
                
                {highlights.biggestJump > 0 && (
                  <div className="p-3 rounded-lg bg-slate-800/50">
                    <p className="text-slate-400 text-xs mb-1">Biggest Jump</p>
                    <p className="text-xl font-bold text-emerald-400">+{highlights.biggestJump}</p>
                    <p className="text-slate-500 text-xs">
                      {format(new Date(highlights.biggestJumpDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
                
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-slate-400 text-xs mb-1">Consistency (Last 5)</p>
                  <p className="text-xl font-bold text-white">{highlights.consistency}</p>
                  <p className="text-slate-500 text-xs">avg score</p>
                </div>
                
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-slate-400 text-xs mb-1">Total Sessions</p>
                  <p className="text-xl font-bold text-white">{highlights.totalSessions}</p>
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm">No highlights yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions Table */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Date</TableHead>
                <TableHead className="text-slate-400">Overall</TableHead>
                <TableHead className="text-slate-400">Δ</TableHead>
                <TableHead className="text-slate-400">Brain</TableHead>
                <TableHead className="text-slate-400">Body</TableHead>
                <TableHead className="text-slate-400">Bat</TableHead>
                <TableHead className="text-slate-400">Ball</TableHead>
                <TableHead className="text-slate-400">Weakest</TableHead>
                <TableHead className="text-slate-400"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScores.slice(0, 10).map((score, index) => {
                const prevScore = filteredScores[index + 1];
                const delta = getDelta(score.composite_score, prevScore?.composite_score);
                
                return (
                  <TableRow key={score.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="text-slate-300">
                      {format(new Date(score.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <span className="text-white font-semibold text-lg">
                        {score.composite_score ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DeltaIndicator delta={delta} />
                    </TableCell>
                    <TableCell className="text-slate-300">{score.brain_score ?? '—'}</TableCell>
                    <TableCell className="text-slate-300">{score.body_score ?? '—'}</TableCell>
                    <TableCell className="text-slate-300">{score.bat_score ?? '—'}</TableCell>
                    <TableCell className="text-slate-300">{score.ball_score ?? '—'}</TableCell>
                    <TableCell>
                      {score.weakest_link && (
                        <Badge variant="outline" className="border-slate-700 text-slate-400 capitalize">
                          {score.weakest_link}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                        View <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
