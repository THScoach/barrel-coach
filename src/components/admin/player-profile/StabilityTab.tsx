/**
 * Stability Tab — Coach-facing stability and consistency metrics
 * Platform Score + history → Variability Grid → Stability Gauges → Training Focus
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, Target, Activity, AlertTriangle, Crosshair } from "lucide-react";
import { format } from "date-fns";

interface StabilityTabProps {
  playersTableId: string;
  playerName: string;
}

interface SessionData {
  id: string;
  session_date: string;
  raw_metrics: any;
  body_score: number | null;
  brain_score: number | null;
}

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Elite', color: 'text-[#4ecdc4]' };
  if (score >= 80) return { label: 'Good', color: 'text-[#4ecdc4]' };
  if (score >= 60) return { label: 'Working', color: 'text-[#ffa500]' };
  return { label: 'Priority', color: 'text-[#ff6b6b]' };
}

function getVariabilityColor(value: number, target: number): string {
  if (value <= target) return 'text-[#4ecdc4]';
  if (value <= target * 2) return 'text-[#ffa500]';
  return 'text-[#ff6b6b]';
}

function getVariabilityBg(value: number, target: number): string {
  if (value <= target) return 'bg-[#4ecdc4]';
  if (value <= target * 2) return 'bg-[#ffa500]';
  return 'bg-[#ff6b6b]';
}

function getGaugeBarColor(value: number, isInverted: boolean, goodMax: number, badThresh: number): string {
  if (isInverted) {
    // Higher = worse (like COM drift)
    if (value <= goodMax) return 'bg-[#4ecdc4]';
    if (value <= badThresh) return 'bg-[#ffa500]';
    return 'bg-[#ff6b6b]';
  }
  // Higher = better (like brake efficiency)
  if (value >= goodMax) return 'bg-[#4ecdc4]';
  if (value >= badThresh) return 'bg-[#ffa500]';
  return 'bg-[#ff6b6b]';
}

export function StabilityTab({ playersTableId, playerName }: StabilityTabProps) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [playersTableId]);

  const loadSessions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('player_sessions')
      .select('id, session_date, raw_metrics, body_score, brain_score')
      .eq('player_id', playersTableId)
      .not('raw_metrics', 'is', null)
      .order('session_date', { ascending: false })
      .limit(10);

    setSessions((data as SessionData[]) || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const session = sessions[selectedIdx];
  if (!session?.raw_metrics) {
    return (
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No stability data available yet. Run a Reboot session to generate this report.</p>
        </CardContent>
      </Card>
    );
  }

  const rm = session.raw_metrics;
  const platformScore = rm.platform_score;
  const trunkCV = rm.trunk_variability_cv;
  const armCV = rm.arm_variability_cv;
  const windowScore = rm.swing_window_score;
  const windowTiming = rm.window_timing;
  const windowSpace = rm.window_space;
  const brakeEff = rm.brake_efficiency != null ? Math.round(rm.brake_efficiency * 100) : null;

  // Platform score history (last 5 sessions)
  const platformHistory = sessions.slice(0, 5).reverse().map(s => ({
    date: s.session_date,
    score: s.raw_metrics?.platform_score,
  })).filter(h => h.score != null);

  // Determine training focus priorities
  const worstMetrics = [
    { label: 'Trunk Variability', value: trunkCV, target: 10, category: 'Body' },
    { label: 'Arm Variability', value: armCV, target: 8, category: 'Brain' },
  ].filter(m => m.value != null).sort((a, b) => (b.value / b.target) - (a.value / a.target));

  const priority1 = worstMetrics[0];
  const priority2 = worstMetrics[1];

  return (
    <div className="space-y-4">
      {/* Session Selector */}
      {sessions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sessions.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelectedIdx(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === selectedIdx
                  ? 'bg-[#E63946] text-white'
                  : 'bg-[#111] border border-[#222] text-muted-foreground hover:border-[#333]'
              }`}
            >
              {format(new Date(s.session_date), 'MMM d, yyyy')}
            </button>
          ))}
        </div>
      )}

      {/* A) PLATFORM SCORE CARD */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Platform Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            {/* Score display */}
            <div className="text-center">
              <div className="text-4xl font-bold text-white font-mono" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                {platformScore ?? '—'}
              </div>
              {platformScore != null && (
                <Badge variant="outline" className={`text-xs mt-1 ${getScoreLabel(platformScore).color} border-current/30`}>
                  {getScoreLabel(platformScore).label}
                </Badge>
              )}
            </div>

            {/* Mini bar chart — platform history */}
            {platformHistory.length > 1 && (
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground mb-2">Session History</div>
                <div className="flex items-end gap-1 h-12">
                  {platformHistory.map((h, i) => {
                    const maxScore = Math.max(...platformHistory.map(x => x.score));
                    const height = maxScore > 0 ? (h.score / maxScore) * 100 : 50;
                    const isLast = i === platformHistory.length - 1;
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-t transition-all ${isLast ? 'bg-[#4ecdc4]' : 'bg-[#333]'}`}
                        style={{ height: `${height}%`, minHeight: '4px' }}
                        title={`${format(new Date(h.date), 'MMM d')}: ${h.score}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Swing Window */}
            {windowScore != null && (
              <div className="text-center border-l border-[#222] pl-6">
                <div className="text-[10px] text-muted-foreground mb-1">Swing Window</div>
                <div className="text-2xl font-bold text-white font-mono">{windowScore}</div>
                <div className="flex gap-3 mt-1">
                  <div className="text-center">
                    <div className="text-[9px] text-muted-foreground">Time</div>
                    <div className="text-xs font-mono text-white">{windowTiming ?? '—'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-muted-foreground">Space</div>
                    <div className="text-xs font-mono text-white">{windowSpace ?? '—'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* B) VARIABILITY GRID — 3 tiles (trunk, arm, drift) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Trunk Variability', value: trunkCV, unit: '%', target: 10, icon: Activity },
          { label: 'Arm Variability', value: armCV, unit: '%', target: 8, icon: Crosshair },
          { label: 'Brake Efficiency', value: brakeEff, unit: '%', target: 75, inverted: false, icon: Shield },
        ].map((tile) => {
          const isGood = tile.inverted === false
            ? (tile.value != null && tile.value >= tile.target)
            : (tile.value != null && tile.value <= tile.target);
          return (
            <Card key={tile.label} className="bg-[#111] border-[#222]">
              <CardContent className="py-5 text-center">
                <tile.icon className="h-4 w-4 mx-auto text-muted-foreground mb-2" />
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{tile.label}</div>
                <div className={`text-3xl font-bold font-mono ${
                  tile.value != null
                    ? (tile.inverted === false
                      ? (tile.value >= tile.target ? 'text-[#4ecdc4]' : tile.value >= tile.target * 0.8 ? 'text-[#ffa500]' : 'text-[#ff6b6b]')
                      : getVariabilityColor(tile.value, tile.target))
                    : 'text-muted-foreground'
                }`}>
                  {tile.value != null ? `${tile.value}${tile.unit}` : '—'}
                </div>
                <div className="text-[9px] text-muted-foreground mt-1">
                  Target: {tile.inverted === false ? `≥${tile.target}${tile.unit}` : `<${tile.target}${tile.unit}`}
                </div>
                {tile.value != null && (
                  <div className="mt-2 h-1.5 bg-[#222] rounded-full overflow-hidden mx-4">
                    <div
                      className={`h-full rounded-full ${
                        tile.inverted === false
                          ? getGaugeBarColor(tile.value, false, tile.target, tile.target * 0.8)
                          : getVariabilityBg(tile.value, tile.target)
                      }`}
                      style={{ width: `${Math.min(100, (tile.value / (tile.target * 2)) * 100)}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* C) STABILITY GAUGES */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Consistency Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Legs KE CV', value: rm.cvLegsKE, unit: '%', maxBar: 50, inverted: true, goodMax: 10, badThresh: 25 },
            { label: 'Torso KE CV', value: rm.cvTorsoKE, unit: '%', maxBar: 50, inverted: true, goodMax: 10, badThresh: 25 },
            { label: 'Arms KE CV', value: rm.cvArmsKE, unit: '%', maxBar: 50, inverted: true, goodMax: 10, badThresh: 25 },
            { label: 'Output CV', value: rm.cvOutput, unit: '%', maxBar: 100, inverted: true, goodMax: 15, badThresh: 40 },
            { label: 'Brake Efficiency', value: brakeEff, unit: '%', maxBar: 100, inverted: false, goodMax: 75, badThresh: 50 },
          ].map((gauge) => (
            <div key={gauge.label} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{gauge.label}</span>
                <span className="text-sm font-mono font-bold text-white">
                  {gauge.value != null ? `${gauge.value}${gauge.unit}` : '—'}
                </span>
              </div>
              {gauge.value != null && (
                <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      getGaugeBarColor(gauge.value, gauge.inverted, gauge.goodMax, gauge.badThresh)
                    }`}
                    style={{ width: `${Math.min(100, (gauge.value / gauge.maxBar) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* D) TRAINING FOCUS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {priority1 && (
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="py-5">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-[#E63946]/10 flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4 text-[#E63946]" />
                </div>
                <div>
                  <div className="text-[10px] text-[#E63946] font-semibold uppercase tracking-wide">Priority 1 — {priority1.category}</div>
                  <div className="text-sm font-bold text-white mt-1">{priority1.label}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Currently at {priority1.value}% (target &lt;{priority1.target}%). 
                    {priority1.category === 'Body'
                      ? ' Focus on repeatable core loading pattern.'
                      : ' Simplify the hand path for consistency.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {priority2 && (
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="py-5">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-[#ffa500]/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-[#ffa500]" />
                </div>
                <div>
                  <div className="text-[10px] text-[#ffa500] font-semibold uppercase tracking-wide">Priority 2 — {priority2.category}</div>
                  <div className="text-sm font-bold text-white mt-1">{priority2.label}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Currently at {priority2.value}% (target &lt;{priority2.target}%). 
                    {priority2.category === 'Brain'
                      ? ' Work on repeating the same swing every time.'
                      : ' Build a more stable base and loading pattern.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
