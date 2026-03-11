/**
 * Kinetic Sequence Tab — Full coach-facing kinetic chain report
 * Root Cause → Energy Chain → Rhythm/Cascade → Segment Gains → Coaching Read
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface KineticSequenceTabProps {
  playersTableId: string;
  playerName: string;
}

interface SessionData {
  id: string;
  session_date: string;
  raw_metrics: any;
  leak_type: string | null;
  overall_score: number | null;
}

const FLOW_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  STRONG: { bg: 'bg-[#4ecdc4]/10', text: 'text-[#4ecdc4]', border: 'border-[#4ecdc4]/30' },
  OK: { bg: 'bg-[#ffa500]/10', text: 'text-[#ffa500]', border: 'border-[#ffa500]/30' },
  LOSING: { bg: 'bg-[#ff6b6b]/10', text: 'text-[#ff6b6b]', border: 'border-[#ff6b6b]/30' },
};

function getFlowColor(label: string) {
  return FLOW_COLORS[label] || FLOW_COLORS.OK;
}

function getGapColor(gapMs: number | null): string {
  if (gapMs == null) return 'text-muted-foreground';
  if (gapMs < 0) return 'text-[#ff6b6b]';
  if (gapMs < 14) return 'text-[#ffa500]';
  return 'text-[#4ecdc4]';
}

function getBarColor(value: number, targetMin: number, targetMax: number): string {
  if (value >= targetMin && value <= targetMax) return 'bg-[#4ecdc4]';
  if (value >= targetMin * 0.7 && value <= targetMax * 1.3) return 'bg-[#ffa500]';
  return 'bg-[#ff6b6b]';
}

function getGainColor(gain: number): string {
  if (gain >= 1.3) return 'text-[#4ecdc4]';
  if (gain >= 1.0) return 'text-[#ffa500]';
  return 'text-[#ff6b6b]';
}

export function KineticSequenceTab({ playersTableId, playerName }: KineticSequenceTabProps) {
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
      .select('id, session_date, raw_metrics, leak_type, overall_score')
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
          <p className="text-muted-foreground">No kinetic sequence data available yet. Run a Reboot session to generate this report.</p>
        </CardContent>
      </Card>
    );
  }

  const rm = session.raw_metrics;
  const rootCause = rm.root_cause || {};
  const energyFlow = rm.energy_flow || {};
  const story = rm.story || {};
  const hasRootIssue = rootCause.issue && rootCause.issue !== 'None detected';

  const gains = [
    { from: 'Pelvis', to: 'Torso', value: rm.pelvis_torso_gain, flow: energyFlow.hip_to_body },
    { from: 'Torso', to: 'Arms', value: rm.torso_arm_gain, flow: energyFlow.body_to_arms },
    { from: 'Arms', to: 'Barrel', value: rm.arm_bat_gain, flow: energyFlow.arms_to_barrel },
  ];

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

      {/* A) ROOT CAUSE CARD */}
      {hasRootIssue ? (
        <Card className="bg-[#111] border-[#E63946]/30 border">
          <CardContent className="py-5 px-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[#E63946] shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div className="text-lg font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {rootCause.issue}
                </div>
                <p className="text-sm text-muted-foreground">{rootCause.what}</p>
                <div className="mt-3 p-3 bg-[#4ecdc4]/5 rounded-lg border border-[#4ecdc4]/20">
                  <div className="text-xs text-[#4ecdc4] font-semibold uppercase mb-1">What to Build</div>
                  <p className="text-sm text-white">{rootCause.build}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#111] border-[#4ecdc4]/20 border">
          <CardContent className="py-5 px-6 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#4ecdc4]" />
            <div>
              <div className="text-sm font-semibold text-white">No Root Issues Detected</div>
              <p className="text-xs text-muted-foreground">{rootCause.what || 'Swing is functioning well'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* B) ENERGY CHAIN VISUALIZATION */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Energy Chain
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Chain nodes */}
          <div className="flex items-center justify-between gap-1 mb-4">
            {['Pelvis', 'Torso', 'Arms', 'Barrel'].map((node, i) => {
              const flowKey = i === 0 ? null : gains[i - 1]?.flow;
              const fc = flowKey ? getFlowColor(flowKey) : null;
              const nodeColor = i === 0
                ? 'border-[#4ecdc4] bg-[#4ecdc4]/10'
                : fc
                  ? `${fc.border} ${fc.bg}`
                  : 'border-[#333] bg-[#111]';

              return (
                <div key={node} className="flex items-center flex-1">
                  {i > 0 && (
                    <div className="flex flex-col items-center flex-1 mx-1">
                      <div className={`h-[2px] w-full ${fc ? fc.bg.replace('/10', '/40') : 'bg-[#333]'}`} />
                      {gains[i - 1]?.value != null && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] mt-1 px-1.5 py-0 ${fc ? `${fc.text} ${fc.border}` : ''}`}
                        >
                          {gains[i - 1].value}×
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center shrink-0 ${nodeColor}`}>
                    <span className="text-[10px] font-bold text-white">{node.slice(0, 3).toUpperCase()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Flow pills */}
          <div className="flex gap-2 justify-center">
            {gains.map((g) => {
              const fc = getFlowColor(g.flow);
              return (
                <Badge
                  key={g.from}
                  variant="outline"
                  className={`text-xs ${fc.text} ${fc.border} ${fc.bg}`}
                >
                  {g.from}→{g.to}: {g.flow || '—'}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* C) SWING RHYTHM + CASCADE TIMING — 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Swing Rhythm */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Swing Rhythm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`text-center text-lg font-bold tracking-widest ${
              rm.beat?.includes('→') && !rm.beat?.includes('reversed')
                ? 'text-[#4ecdc4]'
                : 'text-[#ff6b6b]'
            }`} style={{ fontFamily: "'DM Mono', monospace" }}>
              {rm.beat || 'N/A'}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#222]">
              <span className="text-xs text-muted-foreground">Pelvis→Torso Gap</span>
              <span className={`text-sm font-bold font-mono ${getGapColor(rm.pelvis_torso_gap_ms)}`}>
                {rm.pelvis_torso_gap_ms != null ? `${rm.pelvis_torso_gap_ms}ms` : '—'}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground text-right">Target: 14–18ms</div>
          </CardContent>
        </Card>

        {/* Right: Cascade Timing */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Cascade Timing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'KE Brake Window', value: rm.ke_brake_ms, unit: 'ms', min: 10, max: 20 },
              { label: 'KE Cascade Window', value: rm.ke_cascade_ms, unit: 'ms', min: 40, max: 60 },
              { label: 'Brake Efficiency', value: rm.brake_efficiency != null ? Math.round(rm.brake_efficiency * 100) : null, unit: '%', min: 75, max: 90 },
            ].map((m) => (
              <div key={m.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-mono text-white">
                    {m.value != null ? `${m.value}${m.unit}` : '—'}
                  </span>
                </div>
                {m.value != null && (
                  <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getBarColor(m.value, m.min, m.max)}`}
                      style={{ width: `${Math.min(100, (m.value / (m.max * 1.5)) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* D) SEGMENT GAINS — 4 tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pelvis Peak', value: rm.avgPelvisVelocity, unit: '°/s', target: 600 },
          { label: 'P→T Gain', value: rm.pelvis_torso_gain, unit: '×', target: 1.3 },
          { label: 'T→A Gain', value: rm.torso_arm_gain, unit: '×', target: 1.3 },
          { label: 'A→Bat Gain', value: rm.arm_bat_gain, unit: '×', target: 1.3 },
        ].map((tile) => (
          <Card key={tile.label} className="bg-[#111] border-[#222]">
            <CardContent className="py-4 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{tile.label}</div>
              <div className={`text-2xl font-bold font-mono ${
                tile.value != null
                  ? (tile.unit === '×'
                    ? getGainColor(tile.value)
                    : tile.value >= tile.target ? 'text-[#4ecdc4]' : 'text-[#ffa500]')
                  : 'text-muted-foreground'
              }`}>
                {tile.value != null ? `${tile.value}${tile.unit}` : '—'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* E) COACHING READ — 3 story blocks */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Coaching Read
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Base', text: story.base },
            { label: 'Rhythm', text: story.rhythm },
            { label: 'Barrel', text: story.barrel },
          ].filter(s => s.text).map(s => (
            <div key={s.label} className="flex gap-3 p-3 bg-[#0a0a0a] rounded-lg border-l-2 border-[#E63946]/50">
              <Badge variant="outline" className="shrink-0 text-[10px] h-5 border-[#333] text-muted-foreground">
                {s.label}
              </Badge>
              <span className="text-sm text-white">{s.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
