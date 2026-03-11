/**
 * Drill Intelligence Tab
 * Compares drill sessions vs free-swing baseline,
 * tracks CNS transfer over time.
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, Beaker, ArrowUp, ArrowDown, Minus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrillIntelTabProps {
  playersTableId: string;
  playerName: string;
}

interface SessionWithMetrics {
  id: string;
  sessionDate: Date;
  sessionType: string;
  drillName: string | null;
  metrics: {
    pelvis_torso_gap_ms: number | null;
    p_to_t_gain: number | null;
    torso_ke: number | null;
    brake_efficiency: number | null;
    beat: string | null;
    trunk_variability_cv: number | null;
  };
}

const METRIC_KEYS = [
  'pelvis_torso_gap_ms',
  'p_to_t_gain',
  'torso_ke',
  'brake_efficiency',
  'trunk_variability_cv',
] as const;

type MetricKey = typeof METRIC_KEYS[number];

const METRIC_CONFIG: Record<MetricKey, { label: string; unit: string; higherIsBetter: boolean; format: (v: number) => string }> = {
  pelvis_torso_gap_ms: { label: 'P→T Gap', unit: 'ms', higherIsBetter: true, format: (v) => `${v.toFixed(1)}ms` },
  p_to_t_gain: { label: 'P→T Gain', unit: '', higherIsBetter: true, format: (v) => v.toFixed(2) },
  torso_ke: { label: 'Torso KE', unit: 'J', higherIsBetter: true, format: (v) => `${v.toFixed(1)}J` },
  brake_efficiency: { label: 'Brake Eff', unit: '%', higherIsBetter: true, format: (v) => `${(v * 100).toFixed(0)}%` },
  trunk_variability_cv: { label: 'Trunk Var CV', unit: '', higherIsBetter: false, format: (v) => v.toFixed(3) },
};

function extractMetrics(rawMetrics: any): SessionWithMetrics['metrics'] {
  if (!rawMetrics || typeof rawMetrics !== 'object') {
    return { pelvis_torso_gap_ms: null, p_to_t_gain: null, torso_ke: null, brake_efficiency: null, beat: null, trunk_variability_cv: null };
  }
  const m = rawMetrics as Record<string, any>;
  return {
    pelvis_torso_gap_ms: m.pelvis_torso_gap_ms ?? m.pelvisTorsoGapMs ?? null,
    p_to_t_gain: m.p_to_t_gain ?? m.pelvis_torso_gain ?? m.pToTGain ?? null,
    torso_ke: m.avgTorsoKE ?? m.torso_ke ?? null,
    brake_efficiency: m.brake_efficiency ?? m.brakeEfficiency ?? null,
    beat: m.beat ?? null,
    trunk_variability_cv: m.trunk_variability_cv ?? m.trunkVariabilityCv ?? null,
  };
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function mostCommon(values: (string | null)[]): string | null {
  const valid = values.filter((v): v is string => v !== null);
  if (valid.length === 0) return null;
  const counts: Record<string, number> = {};
  valid.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function DrillIntelTab({ playersTableId, playerName }: DrillIntelTabProps) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionWithMetrics[]>([]);

  useEffect(() => {
    loadData();
  }, [playersTableId]);

  const loadData = async () => {
    setLoading(true);
    // Get player_sessions joined with reboot_sessions
    const { data: playerSessions } = await supabase
      .from('player_sessions')
      .select('id, session_date, raw_metrics, reboot_session_id')
      .eq('player_id', playersTableId)
      .not('reboot_session_id', 'is', null)
      .order('session_date', { ascending: true });

    if (!playerSessions || playerSessions.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const rebootIds = playerSessions.map(ps => ps.reboot_session_id).filter(Boolean) as string[];

    const { data: rebootSessions } = await supabase
      .from('reboot_sessions')
      .select('id, reboot_session_id, session_type, drill_name, session_date')
      .in('reboot_session_id', rebootIds);

    const rebootMap = new Map((rebootSessions || []).map(rs => [rs.reboot_session_id, rs]));

    const merged: SessionWithMetrics[] = playerSessions.map(ps => {
      const rs = rebootMap.get(ps.reboot_session_id!);
      return {
        id: ps.id,
        sessionDate: new Date(rs?.session_date || ps.session_date),
        sessionType: rs?.session_type || 'bp',
        drillName: rs?.drill_name || null,
        metrics: extractMetrics(ps.raw_metrics),
      };
    });

    merged.sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());
    setSessions(merged);
    setLoading(false);
  };

  const analysis = useMemo(() => {
    const bpSessions = sessions.filter(s => s.sessionType === 'bp');
    const drillSessions = sessions.filter(s => s.sessionType === 'drill');

    if (drillSessions.length === 0) return null;

    // Baseline: last 5 BP sessions before or including all time
    const baselineSessions = bpSessions.slice(-5);
    const baselineAvgs: Record<MetricKey, number | null> = {} as any;
    const baselineBeat = mostCommon(baselineSessions.map(s => s.metrics.beat));
    METRIC_KEYS.forEach(key => {
      baselineAvgs[key] = avg(baselineSessions.map(s => s.metrics[key] as number | null));
    });

    // Latest drill session
    const latestDrill = drillSessions[drillSessions.length - 1];
    const drillAvgs: Record<MetricKey, number | null> = {} as any;
    METRIC_KEYS.forEach(key => {
      drillAvgs[key] = latestDrill.metrics[key] as number | null;
    });
    const drillBeat = latestDrill.metrics.beat;

    // Count improvements
    let improvements = 0;
    METRIC_KEYS.forEach(key => {
      const b = baselineAvgs[key];
      const d = drillAvgs[key];
      if (b === null || d === null) return;
      const config = METRIC_CONFIG[key];
      if (config.higherIsBetter ? d > b : d < b) improvements++;
    });

    const constraintStatus = improvements >= 3 ? 'working' : improvements >= 1 ? 'partial' : 'not_firing';

    // Transfer: post-drill BP sessions
    const latestDrillDate = latestDrill.sessionDate.getTime();
    const postDrillBP = bpSessions.filter(s => s.sessionDate.getTime() > latestDrillDate);
    const preDrillBP = bpSessions.filter(s => s.sessionDate.getTime() <= latestDrillDate);

    let transferStatus: 'transferring' | 'partial' | 'not_transferring' | 'not_enough_data' = 'not_enough_data';
    let postDrillAvgGap: number | null = null;
    let preDrillAvgGap: number | null = null;
    let transferSentence = '';

    if (postDrillBP.length >= 2) {
      postDrillAvgGap = avg(postDrillBP.map(s => s.metrics.pelvis_torso_gap_ms));
      preDrillAvgGap = avg(preDrillBP.slice(-5).map(s => s.metrics.pelvis_torso_gap_ms));

      // Count transferring metrics
      let transferCount = 0;
      METRIC_KEYS.forEach(key => {
        const pre = avg(preDrillBP.slice(-5).map(s => s.metrics[key] as number | null));
        const post = avg(postDrillBP.map(s => s.metrics[key] as number | null));
        if (pre === null || post === null) return;
        const config = METRIC_CONFIG[key];
        if (config.higherIsBetter ? post > pre : post < pre) transferCount++;
      });

      transferStatus = transferCount >= 3 ? 'transferring' : transferCount >= 1 ? 'partial' : 'not_transferring';

      const drillLabel = latestDrill.drillName || 'drill';
      const drillCount = drillSessions.length;

      if (preDrillAvgGap !== null && postDrillAvgGap !== null) {
        const delta = postDrillAvgGap - preDrillAvgGap;
        if (delta > 5) {
          transferSentence = `After ${drillCount} ${drillLabel} session${drillCount > 1 ? 's' : ''}, his P→T gap in free swings moved from ${preDrillAvgGap.toFixed(0)}ms → ${postDrillAvgGap.toFixed(0)}ms. Pattern is transferring to the CNS.`;
        } else if (delta >= 0) {
          transferSentence = `${drillCount} ${drillLabel} session${drillCount > 1 ? 's' : ''} completed. Free-swing baseline unchanged. Constraint is teaching the pattern but CNS hasn't retained it yet.`;
        } else {
          transferSentence = `${drillCount} ${drillLabel} session${drillCount > 1 ? 's' : ''} completed. Free-swing P→T gap regressed (${preDrillAvgGap.toFixed(0)}ms → ${postDrillAvgGap.toFixed(0)}ms). Pattern reverting — increase drill volume.`;
        }
      }
    } else {
      transferSentence = 'Run a free-swing BP session after the next drill to measure CNS transfer.';
    }

    // Timeline: last 6 sessions of any type
    const timelineSessions = sessions.slice(-6);

    return {
      constraintStatus,
      improvements,
      baselineAvgs,
      baselineBeat,
      drillAvgs,
      drillBeat,
      transferStatus,
      transferSentence,
      postDrillAvgGap,
      preDrillAvgGap,
      preDrillBP: preDrillBP.slice(-5),
      postDrillBP,
      timelineSessions,
      drillSessions,
      latestDrill,
    };
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state: no drill sessions
  const drillSessions = sessions.filter(s => s.sessionType === 'drill');
  if (drillSessions.length === 0) {
    return (
      <Card className="bg-slate-900/80 border-slate-800">
        <CardContent className="py-12 text-center">
          <Beaker className="h-12 w-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No drill sessions tagged yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Upload a session and tag it as DRILL to start tracking constraint training effectiveness.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const statusConfig = {
    working: { label: 'WORKING', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    partial: { label: 'PARTIAL', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    not_firing: { label: 'NOT FIRING', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  };

  const transferConfig = {
    transferring: { label: 'TRANSFERRING', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    partial: { label: 'PARTIAL TRANSFER', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    not_transferring: { label: 'NOT TRANSFERRING YET', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
    not_enough_data: { label: 'NOT ENOUGH DATA', className: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  };

  return (
    <div className="space-y-6">
      {/* SECTION A: Is the Constraint Working? */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white">Is the Constraint Working?</CardTitle>
            <Badge variant="outline" className={cn("text-xs font-semibold", statusConfig[analysis.constraintStatus].className)}>
              {statusConfig[analysis.constraintStatus].label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-slate-500 pb-2 pr-4 font-medium">Metric</th>
                  <th className="text-center text-slate-500 pb-2 px-4 font-medium">Baseline</th>
                  <th className="text-center text-slate-500 pb-2 px-4 font-medium">Drill</th>
                  <th className="text-center text-slate-500 pb-2 pl-4 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {METRIC_KEYS.map(key => {
                  const config = METRIC_CONFIG[key];
                  const b = analysis.baselineAvgs[key];
                  const d = analysis.drillAvgs[key];
                  let status: 'up' | 'down' | 'flat' = 'flat';
                  if (b !== null && d !== null) {
                    const improved = config.higherIsBetter ? d > b : d < b;
                    const regressed = config.higherIsBetter ? d < b : d > b;
                    status = improved ? 'up' : regressed ? 'down' : 'flat';
                  }
                  return (
                    <tr key={key} className="border-b border-slate-800/50">
                      <td className="py-2 pr-4 text-slate-300 font-medium">{config.label}</td>
                      <td className="py-2 px-4 text-center text-slate-400">
                        {b !== null ? config.format(b) : '—'}
                      </td>
                      <td className={cn("py-2 px-4 text-center font-medium", 
                        status === 'up' ? 'text-teal-400' : status === 'down' ? 'text-red-400' : 'text-slate-400'
                      )}>
                        {d !== null ? config.format(d) : '—'}
                      </td>
                      <td className="py-2 pl-4 text-center">
                        {status === 'up' && <ArrowUp className="h-4 w-4 text-teal-400 inline" />}
                        {status === 'down' && <ArrowDown className="h-4 w-4 text-red-400 inline" />}
                        {status === 'flat' && <Minus className="h-4 w-4 text-slate-600 inline" />}
                      </td>
                    </tr>
                  );
                })}
                {/* Beat row */}
                <tr>
                  <td className="py-2 pr-4 text-slate-300 font-medium">Beat Pattern</td>
                  <td className="py-2 px-4 text-center text-slate-400 font-mono text-xs">
                    {analysis.baselineBeat || '—'}
                  </td>
                  <td className={cn("py-2 px-4 text-center font-mono text-xs font-medium",
                    analysis.drillBeat && analysis.drillBeat !== analysis.baselineBeat ? 'text-teal-400' : 'text-slate-400'
                  )}>
                    {analysis.drillBeat || '—'}
                  </td>
                  <td className="py-2 pl-4 text-center">
                    {analysis.drillBeat && analysis.drillBeat !== analysis.baselineBeat 
                      ? <ArrowUp className="h-4 w-4 text-teal-400 inline" /> 
                      : <Minus className="h-4 w-4 text-slate-600 inline" />}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION B: CNS Transfer */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white">CNS Transfer</CardTitle>
            <Badge variant="outline" className={cn("text-xs font-semibold", transferConfig[analysis.transferStatus].className)}>
              {transferConfig[analysis.transferStatus].label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timeline */}
          <div className="flex items-center justify-between px-2">
            {analysis.timelineSessions.map((s, i) => {
              const isBP = s.sessionType === 'bp';
              const isDrill = s.sessionType === 'drill';
              const gap = s.metrics.pelvis_torso_gap_ms;

              // Determine if post-drill BP improved past baseline
              let improved = false;
              if (isBP && analysis.preDrillAvgGap !== null && gap !== null) {
                improved = gap > (analysis.preDrillAvgGap + 5);
              }

              return (
                <div key={s.id} className="flex flex-col items-center gap-1 relative">
                  {i > 0 && (
                    <div className="absolute top-3 -left-full w-full h-px bg-slate-700" style={{ width: 'calc(100% - 16px)', right: '50%', transform: 'translateX(50%)' }} />
                  )}
                  <div className={cn(
                    "w-7 h-7 flex items-center justify-center text-[10px] font-bold z-10",
                    isDrill 
                      ? "bg-amber-500/20 border border-amber-500/40 text-amber-400 rotate-45 rounded-sm"
                      : improved 
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full"
                        : "bg-red-500/20 border border-red-500/40 text-red-400 rounded-full"
                  )}>
                    <span className={isDrill ? "-rotate-45" : ""}>
                      {gap !== null ? gap.toFixed(0) : '?'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500">{format(s.sessionDate, 'M/d')}</span>
                  <span className={cn("text-[9px] font-medium uppercase",
                    isDrill ? "text-amber-400" : "text-slate-500"
                  )}>
                    {isDrill ? 'DRILL' : 'BP'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Transfer sentence */}
          <p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg px-4 py-3 leading-relaxed">
            {analysis.transferSentence}
          </p>
        </CardContent>
      </Card>

      {/* SECTION C: Drill History */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">Drill History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {[...analysis.drillSessions].reverse().map(drill => {
              // Compare each drill against the baseline at the time
              const bpBefore = sessions
                .filter(s => s.sessionType === 'bp' && s.sessionDate.getTime() < drill.sessionDate.getTime())
                .slice(-5);
              
              const compareMetrics: { key: MetricKey; label: string }[] = [
                { key: 'pelvis_torso_gap_ms', label: 'P→T Gap' },
                { key: 'torso_ke', label: 'Torso KE' },
                { key: 'p_to_t_gain', label: 'P→T Gain' },
              ];

              return (
                <div key={drill.id} className="flex items-center gap-4 py-2.5 border-b border-slate-800/50 last:border-0">
                  <span className="text-sm text-slate-400 w-20 shrink-0">
                    {format(drill.sessionDate, 'MMM d')}
                  </span>
                  <span className="text-sm text-white font-medium truncate min-w-0 flex-1">
                    {drill.drillName || 'Unnamed Drill'}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    {compareMetrics.map(({ key, label }) => {
                      const drillVal = drill.metrics[key] as number | null;
                      const baselineVal = avg(bpBefore.map(s => s.metrics[key] as number | null));
                      const config = METRIC_CONFIG[key];
                      let arrow: 'up' | 'down' | 'flat' = 'flat';
                      if (drillVal !== null && baselineVal !== null) {
                        const improved = config.higherIsBetter ? drillVal > baselineVal : drillVal < baselineVal;
                        const regressed = config.higherIsBetter ? drillVal < baselineVal : drillVal > baselineVal;
                        arrow = improved ? 'up' : regressed ? 'down' : 'flat';
                      }
                      return (
                        <div key={key} className="flex items-center gap-1 text-xs">
                          <span className="text-slate-500">{label}</span>
                          {arrow === 'up' && <ArrowUp className="h-3 w-3 text-teal-400" />}
                          {arrow === 'down' && <ArrowDown className="h-3 w-3 text-red-400" />}
                          {arrow === 'flat' && <Minus className="h-3 w-3 text-slate-600" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
