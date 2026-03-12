/**
 * Player Progression Dashboard
 * DK-style player-facing view showing score trends, metric progression,
 * coaching, and session history.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  TrendingUp, TrendingDown, Minus, Loader2, ArrowRight,
  ChevronDown, ChevronUp, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  getWeakestLinkInfo, getTrendLanguage, getScoreColor, getScoreLabel,
  getWeakestPillar, PILLAR_COLORS
} from "@/lib/coachingLanguage";

interface ScoredSession {
  id: string;
  date: Date;
  body: number | null;
  brain: number | null;
  bat: number | null;
  ball: number | null;
  composite: number | null;
  leakType: string | null;
  weakestLink: string | null;
  transferRatio: number | null;
  timingGapPct: number | null;
  xFactorMax: number | null;
  creationScore: number | null;
  transferScore: number | null;
  groundFlow: number | null;
  coreFlow: number | null;
  upperFlow: number | null;
  source: string | null;
}

// Compare mode types
interface CompareState {
  active: boolean;
  sessionA: ScoredSession | null;
  sessionB: ScoredSession | null;
}

export default function PlayerProgression() {
  const [sessions, setSessions] = useState<ScoredSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [visibleLines, setVisibleLines] = useState({ body: true, brain: true, bat: true, ball: true, composite: true });
  const [compare, setCompare] = useState<CompareState>({ active: false, sessionA: null, sessionB: null });
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: player } = await supabase
      .from('players')
      .select('id, name')
      .eq('email', user.email)
      .maybeSingle();

    if (!player) { setLoading(false); return; }
    setPlayerName(player.name || 'Player');

    const { data } = await supabase
      .from('player_sessions')
      .select('id, session_date, body_score, brain_score, bat_score, ball_score, overall_score, leak_type, weakest_link, transfer_ratio, timing_gap_pct, x_factor_max, creation_score, transfer_score, ground_flow, core_flow, upper_flow, session_source')
      .eq('player_id', player.id)
      .not('body_score', 'is', null)
      .order('session_date', { ascending: true });

    if (data) {
      setSessions(data.map(s => ({
        id: s.id,
        date: new Date(s.session_date),
        body: s.body_score,
        brain: s.brain_score,
        bat: s.bat_score,
        ball: s.ball_score,
        composite: s.overall_score,
        leakType: s.leak_type,
        weakestLink: s.weakest_link,
        transferRatio: s.transfer_ratio ? Number(s.transfer_ratio) : null,
        timingGapPct: s.timing_gap_pct ? Number(s.timing_gap_pct) : null,
        xFactorMax: s.x_factor_max ? Number(s.x_factor_max) : null,
        creationScore: s.creation_score ? Number(s.creation_score) : null,
        transferScore: s.transfer_score ? Number(s.transfer_score) : null,
        groundFlow: s.ground_flow,
        coreFlow: s.core_flow,
        upperFlow: s.upper_flow,
        source: s.session_source,
      })));
    }
    setLoading(false);
  };

  const latest = sessions[sessions.length - 1] || null;
  const previous = sessions.length > 1 ? sessions[sessions.length - 2] : null;

  const chartData = useMemo(() =>
    sessions.map(s => ({
      date: format(s.date, 'MMM d'),
      fullDate: format(s.date, 'MMM d, yyyy'),
      body: s.body,
      brain: s.brain,
      bat: s.bat,
      ball: s.ball,
      composite: s.composite,
      id: s.id,
    })),
    [sessions]
  );

  const weakest = useMemo(() =>
    latest ? getWeakestPillar(latest.body, latest.brain, latest.bat, latest.ball) : null,
    [latest]
  );

  const leakInfo = useMemo(() =>
    getWeakestLinkInfo(latest?.leakType || latest?.weakestLink || null),
    [latest]
  );

  const DeltaArrow = ({ current, prev }: { current: number | null; prev: number | null }) => {
    if (current === null || prev === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
    const delta = current - prev;
    if (delta > 2) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    if (delta < -2) return <TrendingDown className="h-3 w-3 text-red-400" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const toggleLine = (key: keyof typeof visibleLines) => {
    setVisibleLines(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCompareSelect = (session: ScoredSession) => {
    if (!compare.active) return;
    if (!compare.sessionA) {
      setCompare(prev => ({ ...prev, sessionA: session }));
    } else if (!compare.sessionB) {
      setCompare(prev => ({ ...prev, sessionB: session }));
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 md:ml-56 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className="container mx-auto px-4 py-8 md:ml-56">
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-lg font-medium">No scored sessions yet</p>
            <p className="text-sm text-muted-foreground mt-2">Complete a session to see your progression</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:ml-56 pb-24 md:pb-8 space-y-5 max-w-3xl">
      {/* Section 1: Current Snapshot */}
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-5">
          <div className="text-center mb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {latest ? format(latest.date, 'MMMM d, yyyy') : ''}
            </div>
            <div
              className="text-6xl font-black tabular-nums"
              style={{ color: getScoreColor(latest?.composite || 0) }}
            >
              {latest?.composite ?? '—'}
            </div>
            <div className="text-sm font-semibold mt-1" style={{ color: getScoreColor(latest?.composite || 0) }}>
              {getScoreLabel(latest?.composite || 0)}
            </div>
            {latest?.leakType && latest.leakType !== 'clean_transfer' && latest.leakType !== 'unknown' && (
              <Badge variant="outline" className="mt-2 text-xs border-amber-500/30 text-amber-400 bg-amber-500/10">
                {leakInfo?.title || latest.leakType}
              </Badge>
            )}
          </div>

          {/* 4B Pillar Row */}
          <div className="grid grid-cols-4 gap-2">
            {(['BODY', 'BRAIN', 'BAT', 'BALL'] as const).map(pillar => {
              const key = pillar.toLowerCase() as 'body' | 'brain' | 'bat' | 'ball';
              const score = latest?.[key] ?? null;
              const prevScore = previous?.[key] ?? null;
              const color = PILLAR_COLORS[pillar];
              return (
                <div key={pillar} className="text-center p-2 rounded-lg bg-background/50">
                  <div className="text-[10px] font-bold tracking-wider" style={{ color }}>{pillar}</div>
                  <div className="text-2xl font-bold tabular-nums" style={{ color }}>{score ?? '—'}</div>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <DeltaArrow current={score} prev={prevScore} />
                    <span className="text-[10px] text-muted-foreground">{getScoreLabel(score || 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Trend Lines */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Score Progression</h3>
            <Badge variant="outline" className="text-xs">{sessions.length} sessions</Badge>
          </div>

          {/* Toggle Buttons */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {([
              { key: 'composite', label: 'KRS', color: PILLAR_COLORS.COMPOSITE },
              { key: 'body', label: 'Body', color: PILLAR_COLORS.BODY },
              { key: 'brain', label: 'Brain', color: PILLAR_COLORS.BRAIN },
              { key: 'bat', label: 'Bat', color: PILLAR_COLORS.BAT },
              { key: 'ball', label: 'Ball', color: PILLAR_COLORS.BALL },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => toggleLine(key)}
                className={cn(
                  "text-[10px] font-bold px-2 py-1 rounded-full border transition-all",
                  visibleLines[key]
                    ? "border-current opacity-100"
                    : "border-border opacity-40"
                )}
                style={{ color, borderColor: visibleLines[key] ? color : undefined }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[20, 100]} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                {visibleLines.composite && (
                  <Line type="monotone" dataKey="composite" stroke={PILLAR_COLORS.COMPOSITE} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                )}
                {visibleLines.body && (
                  <Line type="monotone" dataKey="body" stroke={PILLAR_COLORS.BODY} strokeWidth={1.5} dot={{ r: 3 }} connectNulls />
                )}
                {visibleLines.brain && (
                  <Line type="monotone" dataKey="brain" stroke={PILLAR_COLORS.BRAIN} strokeWidth={1.5} dot={{ r: 3 }} connectNulls />
                )}
                {visibleLines.bat && (
                  <Line type="monotone" dataKey="bat" stroke={PILLAR_COLORS.BAT} strokeWidth={1.5} dot={{ r: 3 }} connectNulls />
                )}
                {visibleLines.ball && (
                  <Line type="monotone" dataKey="ball" stroke={PILLAR_COLORS.BALL} strokeWidth={1.5} dot={{ r: 3 }} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Key Metrics Sparklines */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard label="Transfer Ratio" value={latest?.transferRatio} target={[1.5, 1.8]} sessions={sessions.map(s => s.transferRatio)} />
        <MetricCard label="Timing Gap" value={latest?.timingGapPct} unit="ms" target={[14, 18]} sessions={sessions.map(s => s.timingGapPct)} />
        <MetricCard label="X-Factor Max" value={latest?.xFactorMax} unit="°" target={[45, 60]} sessions={sessions.map(s => s.xFactorMax)} />
        <MetricCard label="Ground Flow" value={latest?.groundFlow} sessions={sessions.map(s => s.groundFlow)} />
        <MetricCard label="Core Flow" value={latest?.coreFlow} sessions={sessions.map(s => s.coreFlow)} />
        <MetricCard label="Upper Flow" value={latest?.upperFlow} sessions={sessions.map(s => s.upperFlow)} />
      </div>

      {/* Section 4: Coaching Card */}
      {leakInfo && leakInfo.drills.length > 0 && (
        <Card className="bg-card border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-primary/20 text-primary border-primary/30">YOUR PRIORITY</Badge>
              {weakest && (
                <span className="text-xs font-bold" style={{ color: PILLAR_COLORS[weakest.pillar as keyof typeof PILLAR_COLORS] || '#fff' }}>
                  {weakest.pillar} ({weakest.score})
                </span>
              )}
            </div>
            <h3 className="font-bold text-lg text-foreground mb-2">{leakInfo.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{leakInfo.explanation}</p>

            <div className="mb-3">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">WHAT TO WORK ON</div>
              <div className="flex flex-wrap gap-2">
                {leakInfo.drills.map(drill => (
                  <Badge key={drill} variant="outline" className="text-xs">{drill}</Badge>
                ))}
              </div>
            </div>

            {sessions.length >= 3 && (
              <p className="text-xs text-muted-foreground italic">
                {getTrendLanguage(
                  weakest?.pillar || 'score',
                  latest?.composite || 0,
                  sessions[0]?.composite || 0,
                  sessions.length
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 5: Compare Button */}
      <div className="flex gap-2">
        <Button
          variant={compare.active ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (compare.active) {
              setCompare({ active: false, sessionA: null, sessionB: null });
            } else {
              setCompare({ active: true, sessionA: null, sessionB: null });
            }
          }}
        >
          {compare.active ? 'Cancel Compare' : 'Compare Sessions'}
        </Button>
        {compare.active && (
          <p className="text-xs text-muted-foreground self-center">
            {!compare.sessionA ? 'Select first session below' : !compare.sessionB ? 'Select second session' : 'Comparing'}
          </p>
        )}
      </div>

      {/* Compare View */}
      {compare.sessionA && compare.sessionB && (
        <CompareView a={compare.sessionA} b={compare.sessionB} onClose={() => setCompare({ active: false, sessionA: null, sessionB: null })} />
      )}

      {/* Section 6: Session History */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Session History</h3>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {[...sessions].reverse().map(session => {
              const isExpanded = expandedSession === session.id;
              const isCompareTarget = compare.active && (!compare.sessionA || !compare.sessionB);
              return (
                <div key={session.id}>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left",
                      "hover:bg-accent/50",
                      isCompareTarget && "cursor-pointer ring-1 ring-primary/20",
                      (compare.sessionA?.id === session.id || compare.sessionB?.id === session.id) && "ring-2 ring-primary"
                    )}
                    onClick={() => {
                      if (compare.active) {
                        handleCompareSelect(session);
                      } else {
                        setExpandedSession(isExpanded ? null : session.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getScoreColor(session.composite || 0) }}
                      />
                      <div>
                        <div className="text-sm font-medium">{format(session.date, 'MMM d, yyyy')}</div>
                        <div className="text-[10px] text-muted-foreground">{session.source || 'Reboot'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold tabular-nums" style={{ color: getScoreColor(session.composite || 0) }}>
                        {session.composite ?? '—'}
                      </span>
                      {!compare.active && (isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 grid grid-cols-4 gap-2">
                      {(['body', 'brain', 'bat', 'ball'] as const).map(key => (
                        <div key={key} className="text-center p-2 rounded bg-background/50">
                          <div className="text-[10px] font-bold uppercase" style={{ color: PILLAR_COLORS[key.toUpperCase() as keyof typeof PILLAR_COLORS] }}>
                            {key}
                          </div>
                          <div className="text-lg font-bold tabular-nums">{session[key] ?? '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mini metric card with sparkline-like progress
function MetricCard({
  label,
  value,
  unit,
  target,
  sessions,
}: {
  label: string;
  value: number | null;
  unit?: string;
  target?: [number, number];
  sessions: (number | null)[];
}) {
  const recent = sessions.filter((v): v is number => v !== null).slice(-5);
  const prev = recent.length >= 2 ? recent[recent.length - 2] : null;
  const delta = value !== null && prev !== null ? value - prev : null;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold tabular-nums text-foreground">
            {value !== null ? (Number.isInteger(value) ? value : value.toFixed(1)) : '—'}
          </span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {delta !== null && (
          <div className={cn("text-[10px] font-medium", delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground")}>
            {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {Math.abs(delta).toFixed(1)}
          </div>
        )}
        {target && (
          <div className="mt-1.5">
            <div className="text-[9px] text-muted-foreground">Target: {target[0]}–{target[1]}{unit || ''}</div>
            {value !== null && (
              <Progress
                value={Math.min(100, Math.max(0, ((value - target[0]) / (target[1] - target[0])) * 100))}
                className="h-1 mt-0.5"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compare View Component
function CompareView({
  a,
  b,
  onClose,
}: {
  a: ScoredSession;
  b: ScoredSession;
  onClose: () => void;
}) {
  const metrics = [
    { label: 'Composite', keyA: a.composite, keyB: b.composite },
    { label: 'Body', keyA: a.body, keyB: b.body },
    { label: 'Brain', keyA: a.brain, keyB: b.brain },
    { label: 'Bat', keyA: a.bat, keyB: b.bat },
    { label: 'Ball', keyA: a.ball, keyB: b.ball },
    { label: 'Transfer Ratio', keyA: a.transferRatio, keyB: b.transferRatio },
    { label: 'Timing Gap', keyA: a.timingGapPct, keyB: b.timingGapPct },
    { label: 'X-Factor', keyA: a.xFactorMax, keyB: b.xFactorMax },
    { label: 'Ground Flow', keyA: a.groundFlow, keyB: b.groundFlow },
    { label: 'Core Flow', keyA: a.coreFlow, keyB: b.coreFlow },
    { label: 'Upper Flow', keyA: a.upperFlow, keyB: b.upperFlow },
  ];

  // Auto-generated coaching summary
  const improvements = metrics.filter(m => m.keyA !== null && m.keyB !== null && (m.keyB! - m.keyA!) > 2);
  const declines = metrics.filter(m => m.keyA !== null && m.keyB !== null && (m.keyB! - m.keyA!) < -2);

  return (
    <Card className="bg-card border-primary/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Session Comparison</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-1 text-sm mb-4">
          <div className="text-center text-xs font-medium text-muted-foreground pb-2 border-b border-border">
            {format(a.date, 'MMM d')}
          </div>
          <div className="text-center text-xs text-muted-foreground pb-2 border-b border-border">vs</div>
          <div className="text-center text-xs font-medium text-muted-foreground pb-2 border-b border-border">
            {format(b.date, 'MMM d')}
          </div>

          {metrics.map(({ label, keyA, keyB }) => {
            const delta = keyA !== null && keyB !== null ? keyB - keyA : null;
            const improved = delta !== null && delta > 2;
            const declined = delta !== null && delta < -2;
            return (
              <>
                <div key={`a-${label}`} className={cn("text-right py-1 tabular-nums font-medium", declined && "text-red-400", improved && "text-emerald-400")}>
                  {keyA !== null ? (Number.isInteger(keyA) ? keyA : Number(keyA).toFixed(1)) : '—'}
                </div>
                <div key={`l-${label}`} className="text-center py-1 text-xs text-muted-foreground">{label}</div>
                <div key={`b-${label}`} className={cn("text-left py-1 tabular-nums font-medium", improved && "text-emerald-400", declined && "text-red-400")}>
                  {keyB !== null ? (Number.isInteger(keyB) ? keyB : Number(keyB).toFixed(1)) : '—'}
                  {delta !== null && Math.abs(delta) > 2 && (
                    <span className={cn("text-[10px] ml-1", delta > 0 ? "text-emerald-400" : "text-red-400")}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                    </span>
                  )}
                </div>
              </>
            );
          })}
        </div>

        {/* What Changed Summary */}
        {(improvements.length > 0 || declines.length > 0) && (
          <div className="border-t border-border pt-3">
            <div className="text-xs font-bold text-muted-foreground uppercase mb-2">What Changed</div>
            {improvements.map(m => (
              <p key={m.label} className="text-xs text-emerald-400 mb-1">
                ↑ {m.label} improved from {m.keyA?.toFixed?.(1) ?? m.keyA} to {m.keyB?.toFixed?.(1) ?? m.keyB}
              </p>
            ))}
            {declines.map(m => (
              <p key={m.label} className="text-xs text-red-400 mb-1">
                ↓ {m.label} declined from {m.keyA?.toFixed?.(1) ?? m.keyA} to {m.keyB?.toFixed?.(1) ?? m.keyB}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
