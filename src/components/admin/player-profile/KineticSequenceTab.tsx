/**
 * Kinetic Sequence Tab — Coach-facing kinetic chain breakdown
 * Shows energy flow, gains, beat pattern, story, and root cause
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";

interface KineticSequenceTabProps {
  playersTableId: string;
  playerName: string;
}

interface SessionData {
  id: string;
  session_date: string;
  raw_metrics: any;
  leak_type: string | null;
  leak_caption: string | null;
  leak_training: string | null;
  overall_score: number | null;
}

const FLOW_COLORS: Record<string, string> = {
  STRONG: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  OK: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  LOSING: 'text-red-400 bg-red-400/10 border-red-400/30',
};

export function KineticSequenceTab({ playersTableId, playerName }: KineticSequenceTabProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLatestSession();
  }, [playersTableId]);

  const loadLatestSession = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('player_sessions')
      .select('id, session_date, raw_metrics, leak_type, leak_caption, leak_training, overall_score')
      .eq('player_id', playersTableId)
      .not('raw_metrics', 'is', null)
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    setSession(data as SessionData | null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.raw_metrics) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No kinetic sequence data available yet. Run a Reboot session to generate this report.</p>
        </CardContent>
      </Card>
    );
  }

  const rm = session.raw_metrics;
  const gains = [
    { label: 'Hips → Torso', value: rm.pelvis_torso_gain, flow: rm.energy_flow?.hip_to_body },
    { label: 'Torso → Arms', value: rm.torso_arm_gain, flow: rm.energy_flow?.body_to_arms },
    { label: 'Arms → Barrel', value: rm.arm_bat_gain, flow: rm.energy_flow?.arms_to_barrel },
  ];

  const story = rm.story || {};
  const rootCause = rm.root_cause || {};

  return (
    <div className="space-y-6">
      {/* Beat Pattern */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Kinetic Sequence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <Zap className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold text-foreground font-mono">
              {rm.beat || 'N/A'}
            </span>
          </div>
          {rm.archetype && (
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              {rm.archetype} Swing Type
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Energy Flow Chain */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Energy Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gains.map((g, i) => (
              <div key={g.label} className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">{g.label}</span>
                  {i < gains.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground hidden md:block" />
                  )}
                </div>
                <div className="text-2xl font-bold text-foreground font-mono">
                  {g.value != null ? `${g.value}x` : '—'}
                </div>
                {g.flow && (
                  <Badge variant="outline" className={`text-xs mt-1 ${FLOW_COLORS[g.flow] || ''}`}>
                    {g.flow}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timing Metrics */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Timing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'KE Cascade', value: rm.ke_cascade_ms, unit: 'ms' },
              { label: 'KE Brake', value: rm.ke_brake_ms, unit: 'ms' },
              { label: 'Pelvis→Torso Gap', value: rm.pelvis_torso_gap_ms, unit: 'ms' },
              { label: 'Brake Efficiency', value: rm.brake_efficiency != null ? Math.round(rm.brake_efficiency * 100) : null, unit: '%' },
            ].map(m => (
              <div key={m.label} className="text-center">
                <div className="text-xs text-muted-foreground mb-1">{m.label}</div>
                <div className="text-lg font-bold text-foreground font-mono">
                  {m.value != null ? `${m.value}${m.unit}` : '—'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Story */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            What the Data Says
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Base', text: story.base },
            { label: 'Rhythm', text: story.rhythm },
            { label: 'Barrel', text: story.barrel },
          ].filter(s => s.text).map(s => (
            <div key={s.label} className="flex gap-3">
              <Badge variant="outline" className="shrink-0 text-xs h-5">{s.label}</Badge>
              <span className="text-sm text-foreground">{s.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Root Cause */}
      {rootCause.issue && rootCause.issue !== 'None detected' && (
        <Card className="bg-card border-red-500/20 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-red-400 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Root Cause
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-bold text-foreground">{rootCause.issue}</div>
            <p className="text-sm text-muted-foreground">{rootCause.what}</p>
            <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="text-xs text-primary font-semibold uppercase mb-1">What to Build</div>
              <p className="text-sm text-foreground">{rootCause.build}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {rootCause.issue === 'None detected' && (
        <Card className="bg-card border-emerald-500/20 border">
          <CardContent className="py-6 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <div>
              <div className="text-sm font-semibold text-foreground">No Root Issues Detected</div>
              <p className="text-xs text-muted-foreground">{rootCause.what}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
