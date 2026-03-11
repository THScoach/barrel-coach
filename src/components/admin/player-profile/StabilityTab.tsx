/**
 * Stability Tab — Coach-facing stability and consistency metrics
 * Shows trunk/arm variability, platform score, swing window, and archetype
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, Target, Activity } from "lucide-react";

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

function getStabilityLabel(cv: number): { label: string; color: string } {
  if (cv <= 10) return { label: 'Rock Solid', color: 'text-emerald-400' };
  if (cv <= 20) return { label: 'Stable', color: 'text-emerald-400' };
  if (cv <= 30) return { label: 'Developing', color: 'text-amber-400' };
  return { label: 'Inconsistent', color: 'text-red-400' };
}

function getScoreGrade(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Elite', color: 'text-emerald-400' };
  if (score >= 80) return { label: 'Good', color: 'text-blue-400' };
  if (score >= 60) return { label: 'Working', color: 'text-amber-400' };
  return { label: 'Priority', color: 'text-red-400' };
}

export function StabilityTab({ playersTableId, playerName }: StabilityTabProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLatestSession();
  }, [playersTableId]);

  const loadLatestSession = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('player_sessions')
      .select('id, session_date, raw_metrics, body_score, brain_score')
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
          <p className="text-muted-foreground">No stability data available yet. Run a Reboot session to generate this report.</p>
        </CardContent>
      </Card>
    );
  }

  const rm = session.raw_metrics;
  const trunkCV = rm.trunk_variability_cv;
  const armCV = rm.arm_variability_cv;
  const platformScore = rm.platform_score;
  const windowScore = rm.swing_window_score;
  const windowTiming = rm.window_timing;
  const windowSpace = rm.window_space;
  const archetype = rm.archetype;

  const trunkStability = trunkCV != null ? getStabilityLabel(trunkCV) : null;
  const armStability = armCV != null ? getStabilityLabel(armCV) : null;

  return (
    <div className="space-y-6">
      {/* Archetype Card */}
      {archetype && (
        <Card className="bg-card border-border">
          <CardContent className="py-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Swing Archetype</div>
              <div className="text-xl font-bold text-foreground">{archetype}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variability Metrics */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Repeatability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trunk Variability */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">Trunk (Core) Variability</span>
                {trunkStability && (
                  <Badge variant="outline" className={`text-xs ${trunkStability.color}`}>
                    {trunkStability.label}
                  </Badge>
                )}
              </div>
              <div className="text-2xl font-bold text-foreground font-mono">
                {trunkCV != null ? `${trunkCV}%` : '—'}
              </div>
              {trunkCV != null && (
                <Progress value={Math.max(0, 100 - trunkCV * 2)} className="h-2" />
              )}
              <p className="text-xs text-muted-foreground">
                {trunkCV != null && trunkCV <= 15
                  ? 'Your core energy is very repeatable swing to swing.'
                  : trunkCV != null && trunkCV <= 25
                  ? 'Your core is fairly consistent but has room to tighten up.'
                  : 'Your core energy changes a lot between swings. Focus on a consistent load.'}
              </p>
            </div>

            {/* Arm Variability */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">Arm Variability</span>
                {armStability && (
                  <Badge variant="outline" className={`text-xs ${armStability.color}`}>
                    {armStability.label}
                  </Badge>
                )}
              </div>
              <div className="text-2xl font-bold text-foreground font-mono">
                {armCV != null ? `${armCV}%` : '—'}
              </div>
              {armCV != null && (
                <Progress value={Math.max(0, 100 - armCV * 2)} className="h-2" />
              )}
              <p className="text-xs text-muted-foreground">
                {armCV != null && armCV <= 15
                  ? 'Your hand path is very repeatable.'
                  : armCV != null && armCV <= 25
                  ? 'Arm action is fairly consistent. Keep working on path.'
                  : 'Your arms are doing something different each swing. Simplify the path.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Score */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Platform Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground font-mono">
                {platformScore ?? '—'}
              </div>
              {platformScore != null && (
                <Badge variant="outline" className={`text-xs mt-1 ${getScoreGrade(platformScore).color}`}>
                  {getScoreGrade(platformScore).label}
                </Badge>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {platformScore != null && platformScore >= 80
                  ? 'Your ground force production is consistent and reliable. Your lower half is a strength.'
                  : platformScore != null && platformScore >= 60
                  ? 'Your lower half is working but inconsistent. Some swings have a strong base, others don\'t.'
                  : 'Your ground force changes significantly swing to swing. This is the foundation — needs to be solid.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Swing Window (IK-dependent) */}
      {windowScore != null && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Swing Window
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Timing</div>
                <div className="text-2xl font-bold text-foreground font-mono">{windowTiming ?? '—'}</div>
                <p className="text-xs text-muted-foreground mt-1">Sequence timing quality</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Space</div>
                <div className="text-2xl font-bold text-foreground font-mono">{windowSpace ?? '—'}</div>
                <p className="text-xs text-muted-foreground mt-1">Separation quality</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Window</div>
                <div className="text-2xl font-bold text-foreground font-mono">{windowScore}</div>
                {windowScore != null && (
                  <Badge variant="outline" className={`text-xs mt-1 ${getScoreGrade(windowScore).color}`}>
                    {getScoreGrade(windowScore).label}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
