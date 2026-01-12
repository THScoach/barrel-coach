/**
 * Player Progression Dashboard
 * ============================
 * Shows score trends, leak timeline, and coaching events over time.
 * Enables coaches to see long-term development at a glance.
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Brain,
  Activity,
  Zap,
  Target,
  AlertTriangle,
  Calendar,
  Users,
  Award,
  Loader2,
  ChevronRight,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  Dot
} from "recharts";

interface ProgressionSession {
  id: string;
  date: Date;
  type: 'analyzer' | 'reboot' | 'hittrax';
  composite: number | null;
  brain: number | null;
  body: number | null;
  bat: number | null;
  ball: number | null;
  leakType: string | null;
  weakestCategory: string | null;
}

interface CoachingEvent {
  id: string;
  date: Date;
  type: 'assessment' | 'drill_block' | 'membership' | 'note' | 'milestone';
  title: string;
  description?: string;
}

interface PlayerProgressionDashboardProps {
  playerId: string; // player_profiles.id
  playersTableId: string; // players.id for data queries
  playerName: string;
  onViewSession: (sessionId: string, type: 'analyzer' | 'reboot' | 'hittrax') => void;
}

const LEAK_COLORS: Record<string, string> = {
  late_legs: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  early_arms: 'bg-red-500/20 text-red-400 border-red-500/30',
  torso_bypass: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  no_separation: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  casting: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  default: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const LEAK_LABELS: Record<string, string> = {
  late_legs: 'Late Legs',
  early_arms: 'Early Arms',
  torso_bypass: 'Torso Bypass',
  no_separation: 'No Separation',
  casting: 'Casting',
};

export function PlayerProgressionDashboard({
  playerId,
  playersTableId,
  playerName,
  onViewSession,
}: PlayerProgressionDashboardProps) {
  const [sessions, setSessions] = useState<ProgressionSession[]>([]);
  const [events, setEvents] = useState<CoachingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'90' | '180' | 'all'>('90');

  useEffect(() => {
    loadProgressionData();
  }, [playerId, playersTableId, timeRange]);

  const loadProgressionData = async () => {
    setLoading(true);

    // Calculate date filter
    const now = new Date();
    let dateFilter: string | null = null;
    if (timeRange === '90') {
      dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    } else if (timeRange === '180') {
      dateFilter = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Fetch sessions and activity in parallel
    const [sessionsRes, rebootRes, activityRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, created_at, composite_score, four_b_brain, four_b_body, four_b_bat, four_b_ball, leak_type, weakest_category')
        .eq('player_id', playerId)
        .order('created_at', { ascending: true })
        .gte('created_at', dateFilter || '1970-01-01'),
      supabase
        .from('reboot_uploads')
        .select('id, created_at, composite_score, brain_score, body_score, bat_score, weakest_link')
        .eq('player_id', playersTableId)
        .order('created_at', { ascending: true })
        .gte('created_at', dateFilter || '1970-01-01'),
      supabase
        .from('activity_log')
        .select('id, action, description, created_at, metadata')
        .eq('player_id', playersTableId)
        .order('created_at', { ascending: true })
        .gte('created_at', dateFilter || '1970-01-01'),
    ]);

    // Transform sessions
    const allSessions: ProgressionSession[] = [
      ...(sessionsRes.data || []).map(s => ({
        id: s.id,
        date: new Date(s.created_at || new Date()),
        type: 'analyzer' as const,
        composite: s.composite_score,
        brain: s.four_b_brain,
        body: s.four_b_body,
        bat: s.four_b_bat,
        ball: s.four_b_ball,
        leakType: s.leak_type,
        weakestCategory: s.weakest_category,
      })),
      ...(rebootRes.data || []).map(s => ({
        id: s.id,
        date: new Date(s.created_at || new Date()),
        type: 'reboot' as const,
        composite: s.composite_score,
        brain: s.brain_score,
        body: s.body_score,
        bat: s.bat_score,
        ball: null,
        leakType: null,
        weakestCategory: s.weakest_link,
      })),
    ];

    allSessions.sort((a, b) => a.date.getTime() - b.date.getTime());
    setSessions(allSessions);

    // Transform activity events
    const coachingEvents: CoachingEvent[] = (activityRes.data || [])
      .filter(a => ['beta_invite_sent', 'reboot_session_processed', 'membership_started', 'in_person_session'].includes(a.action))
      .map(a => ({
        id: a.id,
        date: new Date(a.created_at || new Date()),
        type: getEventType(a.action),
        title: getEventTitle(a.action),
        description: a.description || undefined,
      }));

    setEvents(coachingEvents);
    setLoading(false);
  };

  const getEventType = (action: string): CoachingEvent['type'] => {
    switch (action) {
      case 'in_person_session': return 'assessment';
      case 'membership_started': return 'membership';
      case 'beta_invite_sent': return 'membership';
      default: return 'note';
    }
  };

  const getEventTitle = (action: string): string => {
    switch (action) {
      case 'in_person_session': return 'In-Person Assessment';
      case 'reboot_session_processed': return 'Bio Session';
      case 'membership_started': return 'Membership Started';
      case 'beta_invite_sent': return 'Beta Invite';
      default: return action;
    }
  };

  // Chart data
  const chartData = useMemo(() => {
    return sessions.map(s => ({
      date: format(s.date, 'MMM d'),
      fullDate: format(s.date, 'MMM d, yyyy'),
      composite: s.composite,
      brain: s.brain,
      body: s.body,
      bat: s.bat,
      ball: s.ball,
      leakType: s.leakType,
      id: s.id,
      type: s.type,
    }));
  }, [sessions]);

  // Calculate trends (first to last)
  const trends = useMemo(() => {
    if (sessions.length < 2) return null;

    const first = sessions[0];
    const last = sessions[sessions.length - 1];

    const calcTrend = (curr: number | null, prev: number | null) => {
      if (curr === null || prev === null) return { direction: 'flat', delta: 0 };
      const delta = curr - prev;
      return {
        direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
        delta,
      };
    };

    return {
      composite: calcTrend(last.composite, first.composite),
      brain: calcTrend(last.brain, first.brain),
      body: calcTrend(last.body, first.body),
      bat: calcTrend(last.bat, first.bat),
      ball: calcTrend(last.ball, first.ball),
    };
  }, [sessions]);

  // Calculate session-over-session delta for the latest point
  const lastSessionDelta = useMemo(() => {
    if (sessions.length < 2) return null;
    const prev = sessions[sessions.length - 2];
    const last = sessions[sessions.length - 1];
    if (last.composite === null || prev.composite === null) return null;
    return last.composite - prev.composite;
  }, [sessions]);

  // Detect leak changes over time
  const leakChanges = useMemo(() => {
    const changes: { from: string; to: string; sessionIndex: number }[] = [];
    for (let i = 1; i < sessions.length; i++) {
      const prev = sessions[i - 1].leakType;
      const curr = sessions[i].leakType;
      if (prev && curr && prev !== curr) {
        changes.push({ from: prev, to: curr, sessionIndex: i });
      }
    }
    return changes;
  }, [sessions]);

  // Leak frequency
  const leakFrequency = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach(s => {
      if (s.leakType) {
        counts[s.leakType] = (counts[s.leakType] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [sessions]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-white mb-1">{data.fullDate}</p>
        {data.composite && (
          <p className="text-xs text-primary">Composite: {data.composite}</p>
        )}
        {data.leakType && (
          <p className="text-xs text-amber-400">Leak: {LEAK_LABELS[data.leakType] || data.leakType}</p>
        )}
        <p className="text-[10px] text-slate-500 mt-1">Click to view report</p>
      </div>
    );
  };

  // Clickable dot component
  const ClickableDot = (props: any) => {
    const { cx, cy, payload, dataKey } = props;
    if (payload[dataKey] === null || payload[dataKey] === undefined) return null;

    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill="currentColor"
        className="cursor-pointer hover:r-8 transition-all"
        onClick={() => onViewSession(payload.id, payload.type)}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="bg-slate-900/80 border-slate-700">
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No session history yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Upload multiple sessions to see progression trends
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Progression Timeline
        </h3>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <TabsList className="h-8 bg-slate-800">
            <TabsTrigger value="90" className="text-xs h-6 px-3">90 Days</TabsTrigger>
            <TabsTrigger value="180" className="text-xs h-6 px-3">6 Months</TabsTrigger>
            <TabsTrigger value="all" className="text-xs h-6 px-3">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* GOATY-Style Summary Deltas */}
      {trends && sessions.length >= 2 && (
        <Card className="bg-gradient-to-r from-primary/10 via-slate-900 to-slate-900 border-primary/30">
          <CardContent className="py-4 px-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="text-sm font-medium text-slate-300">
                Since first session:
              </div>
              <DeltaBadge label="KRS" delta={trends.composite.delta} />
              <DeltaBadge label="Brain" delta={trends.brain.delta} color="text-purple-400" />
              <DeltaBadge label="Body" delta={trends.body.delta} color="text-blue-400" />
              <DeltaBadge label="Bat" delta={trends.bat.delta} color="text-orange-400" />
              <DeltaBadge label="Ball" delta={trends.ball.delta} color="text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend Summary Cards */}
      {trends && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <TrendCard label="Composite" trend={trends.composite} color="text-primary" />
          <TrendCard label="Brain" trend={trends.brain} color="text-purple-400" />
          <TrendCard label="Body" trend={trends.body} color="text-blue-400" />
          <TrendCard label="Bat" trend={trends.bat} color="text-orange-400" />
          <TrendCard label="Ball" trend={trends.ball} color="text-emerald-400" />
        </div>
      )}

      {/* Main Composite Chart */}
      <Card className="bg-slate-900/80 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Catch Barrel Score Over Time
            </h4>
            <div className="flex items-center gap-2">
              {lastSessionDelta !== null && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    lastSessionDelta > 0 
                      ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                      : lastSessionDelta < 0 
                      ? "border-red-500/50 text-red-400 bg-red-500/10"
                      : "border-slate-600 text-slate-400"
                  )}
                >
                  Last: {lastSessionDelta > 0 ? '+' : ''}{lastSessionDelta}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                {sessions.length} sessions
              </Badge>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="compositeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11}
                  domain={[20, 80]}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Event markers */}
                {events.map(event => {
                  const eventDate = format(event.date, 'MMM d');
                  return (
                    <ReferenceLine 
                      key={event.id}
                      x={eventDate}
                      stroke="#f59e0b"
                      strokeDasharray="5 5"
                      strokeOpacity={0.5}
                    />
                  );
                })}

                <Area
                  type="monotone"
                  dataKey="composite"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#compositeGradient)"
                  dot={<ClickableDot dataKey="composite" />}
                  activeDot={{ r: 8, className: 'cursor-pointer' }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 4B Mini Charts */}
      <div className="grid md:grid-cols-4 gap-3">
        <MiniChart 
          data={chartData} 
          dataKey="brain" 
          label="Brain" 
          color="#a855f7"
          icon={Brain}
          onDotClick={onViewSession}
        />
        <MiniChart 
          data={chartData} 
          dataKey="body" 
          label="Body" 
          color="#3b82f6"
          icon={Activity}
          onDotClick={onViewSession}
        />
        <MiniChart 
          data={chartData} 
          dataKey="bat" 
          label="Bat" 
          color="#f97316"
          icon={Zap}
          onDotClick={onViewSession}
        />
        <MiniChart 
          data={chartData} 
          dataKey="ball" 
          label="Ball" 
          color="#10b981"
          icon={Target}
          onDotClick={onViewSession}
        />
      </div>

      {/* Leak Timeline */}
      <Card className="bg-slate-900/80 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Leak Timeline
            </h4>
            {leakFrequency.length > 0 && (
              <div className="flex gap-2">
                {leakFrequency.map(([leak, count]) => (
                  <Badge 
                    key={leak} 
                    variant="outline" 
                    className={cn("text-[10px]", LEAK_COLORS[leak] || LEAK_COLORS.default)}
                  >
                    {LEAK_LABELS[leak] || leak} ({count})
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-1 overflow-x-auto pb-2">
            {sessions.map((session, i) => {
              // Check if this session is a leak change point
              const isChangePoint = leakChanges.some(c => c.sessionIndex === i);
              return (
                <button
                  key={session.id}
                  className={cn(
                    "flex-shrink-0 px-2 py-1 rounded text-[10px] font-medium border transition-all",
                    "hover:scale-105 cursor-pointer",
                    session.leakType 
                      ? LEAK_COLORS[session.leakType] || LEAK_COLORS.default
                      : "bg-slate-800 text-slate-500 border-slate-700",
                    isChangePoint && "ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900"
                  )}
                  onClick={() => onViewSession(session.id, session.type)}
                  title={`${format(session.date, 'MMM d, yyyy')}${isChangePoint ? ' (Leak Changed!)' : ''}`}
                >
                  {session.leakType ? (LEAK_LABELS[session.leakType] || session.leakType) : '—'}
                </button>
              );
            })}
          </div>
          
          {/* Leak change indicator */}
          {leakChanges.length > 0 && (
            <div className="flex items-center gap-2 mt-2 text-xs text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              <span>
                {leakChanges.length} leak pattern change{leakChanges.length > 1 ? 's' : ''} detected
              </span>
            </div>
          )}

          <p className="text-[10px] text-slate-500 mt-2">
            ← Oldest to Newest → (Click to view session)
          </p>
        </CardContent>
      </Card>

      {/* Coaching Events */}
      {events.length > 0 && (
        <Card className="bg-slate-900/80 border-slate-700">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Coaching Events
            </h4>

            <div className="space-y-2">
              {events.map(event => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-2 rounded bg-slate-800/50"
                >
                  <div className="p-1.5 rounded bg-amber-500/20">
                    {event.type === 'assessment' && <Users className="h-3 w-3 text-amber-400" />}
                    {event.type === 'membership' && <Award className="h-3 w-3 text-amber-400" />}
                    {event.type === 'drill_block' && <Calendar className="h-3 w-3 text-amber-400" />}
                    {event.type === 'note' && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-300">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-slate-500 truncate">{event.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {format(event.date, 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Trend Card Component
function TrendCard({ 
  label, 
  trend, 
  color 
}: { 
  label: string; 
  trend: { direction: string; delta: number }; 
  color: string;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-3 text-center">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        <div className="flex items-center justify-center gap-1">
          {trend.direction === 'up' && <TrendingUp className={cn("h-4 w-4", color)} />}
          {trend.direction === 'down' && <TrendingDown className="h-4 w-4 text-red-400" />}
          {trend.direction === 'flat' && <Minus className="h-4 w-4 text-slate-500" />}
          <span className={cn(
            "text-lg font-bold",
            trend.direction === 'up' ? color : 
            trend.direction === 'down' ? 'text-red-400' : 'text-slate-500'
          )}>
            {trend.delta > 0 ? '+' : ''}{trend.delta}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Delta Badge Component for GOATY-style summaries
function DeltaBadge({ 
  label, 
  delta, 
  color = "text-primary" 
}: { 
  label: string; 
  delta: number; 
  color?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-slate-500">{label}:</span>
      <span className={cn(
        "font-bold",
        delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-slate-500"
      )}>
        {delta > 0 ? '+' : ''}{delta}
      </span>
    </span>
  );
}

// Mini Chart Component
function MiniChart({
  data,
  dataKey,
  label,
  color,
  icon: Icon,
  onDotClick,
}: {
  data: any[];
  dataKey: string;
  label: string;
  color: string;
  icon: any;
  onDotClick: (id: string, type: 'analyzer' | 'reboot' | 'hittrax') => void;
}) {
  const hasData = data.some(d => d[dataKey] !== null && d[dataKey] !== undefined);

  if (!hasData) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-4 w-4" style={{ color }} />
            <span className="text-xs font-semibold text-slate-400">{label}</span>
          </div>
          <div className="h-20 flex items-center justify-center">
            <p className="text-xs text-slate-600">No data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="text-xs font-semibold text-slate-400">{label}</span>
        </div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload[dataKey] === null || payload[dataKey] === undefined) return null;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={color}
                      className="cursor-pointer hover:r-6"
                      onClick={() => onDotClick(payload.id, payload.type)}
                    />
                  );
                }}
                connectNulls
              />
              <YAxis domain={[20, 80]} hide />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
