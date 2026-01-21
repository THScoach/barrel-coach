/**
 * Live DK 4B Dashboard - Real-time swing capture and 4B score updates
 * ====================================================================
 * Subscribes to sensor_swings table and calculates running 4B scores
 * Dark #0A0A0B with live pulse animations
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Activity,
  Brain,
  Zap,
  Target,
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGrade } from "@/lib/fourb-composite";

interface SwingData {
  id: string;
  bat_speed_mph: number;
  hand_speed_mph: number | null;
  trigger_to_impact_ms: number | null;
  attack_angle_deg: number | null;
  hand_to_bat_ratio: number | null;
  created_at: string;
}

interface Live4BScores {
  brain: number;
  body: number;
  bat: number;
  ball: number;
  composite: number;
}

interface LiveDK4BDashboardProps {
  playerId: string;
  sessionId?: string;
  onSessionComplete?: (scores: Live4BScores) => void;
}

// Statistical helpers
const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const stdDev = (arr: number[]) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / arr.length);
};
const cv = (arr: number[]) => arr.length > 1 ? (stdDev(arr) / mean(arr)) * 100 : 0;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function LiveDK4BDashboard({
  playerId,
  sessionId,
  onSessionComplete,
}: LiveDK4BDashboardProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [swings, setSwings] = useState<SwingData[]>([]);
  const [scores, setScores] = useState<Live4BScores>({
    brain: 50,
    body: 50,
    bat: 50,
    ball: 50,
    composite: 50,
  });
  const [lastSwingTime, setLastSwingTime] = useState<Date | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Calculate 4B scores from accumulated swings
  const calculate4BScores = useCallback((swingData: SwingData[]): Live4BScores => {
    if (swingData.length === 0) {
      return { brain: 50, body: 50, bat: 50, ball: 50, composite: 50 };
    }

    const batSpeeds = swingData.map(s => s.bat_speed_mph).filter(Boolean) as number[];
    const timings = swingData.map(s => s.trigger_to_impact_ms).filter(Boolean) as number[];
    const ratios = swingData.map(s => s.hand_to_bat_ratio).filter(Boolean) as number[];
    const angles = swingData.map(s => s.attack_angle_deg).filter(Boolean) as number[];

    // BRAIN: Timing consistency (lower CV = better)
    const timingCV = cv(timings);
    const brain = clamp(Math.round(80 - timingCV * 2.5), 20, 80);

    // BODY: Hand-to-bat ratio efficiency (ideal ~0.75-0.85)
    const avgRatio = mean(ratios);
    const ratioScore = avgRatio >= 0.75 && avgRatio <= 0.85
      ? 70
      : avgRatio >= 0.65 && avgRatio <= 0.95
        ? 55
        : 40;
    const body = clamp(Math.round(ratioScore + (batSpeeds.length > 0 ? (mean(batSpeeds) - 60) / 2 : 0)), 20, 80);

    // BAT: Attack angle optimization (ideal -5 to +15 degrees)
    const avgAngle = mean(angles);
    const angleScore = avgAngle >= -5 && avgAngle <= 15
      ? 70
      : avgAngle >= -10 && avgAngle <= 25
        ? 55
        : 40;
    const bat = clamp(Math.round(angleScore + (batSpeeds.length > 0 ? (mean(batSpeeds) - 60) / 3 : 0)), 20, 80);

    // BALL: Exit velocity projection (bat speed * 1.2 + pitch estimate)
    const avgBatSpeed = mean(batSpeeds);
    const projectedEV = avgBatSpeed * 1.2 + 10; // Assuming ~50mph pitch
    const ball = clamp(Math.round(30 + (projectedEV - 60) * 0.7), 20, 80);

    // Composite: Weighted average
    const composite = Math.round(
      brain * 0.20 +
      body * 0.35 +
      bat * 0.30 +
      ball * 0.15
    );

    return { brain, body, bat, ball, composite };
  }, []);

  // Handle new swing data
  const handleNewSwing = useCallback((payload: any) => {
    console.log("[LiveDK] New swing received:", payload);
    const newSwing = payload.new as SwingData;

    setSwings(prev => {
      const updated = [...prev, newSwing];
      const newScores = calculate4BScores(updated);
      setScores(newScores);
      return updated;
    });

    setLastSwingTime(new Date());
    setPulseActive(true);
    setTimeout(() => setPulseActive(false), 1000);

    toast.success(`Swing #${swings.length + 1} captured!`, {
      description: `Bat Speed: ${newSwing.bat_speed_mph} mph`,
    });
  }, [swings.length, calculate4BScores]);

  // Subscribe to realtime updates
  useEffect(() => {
    const filter = sessionId
      ? `session_id=eq.${sessionId}`
      : `player_id=eq.${playerId}`;

    console.log(`[LiveDK] Subscribing to sensor_swings with filter: ${filter}`);

    const channel = supabase
      .channel(`live-dk-${playerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_swings",
          filter,
        },
        handleNewSwing
      )
      .subscribe((status) => {
        console.log("[LiveDK] Subscription status:", status);
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      console.log("[LiveDK] Unsubscribing from channel");
      supabase.removeChannel(channel);
    };
  }, [playerId, sessionId, handleNewSwing]);

  // Load existing swings for session
  useEffect(() => {
    const loadExistingSwings = async () => {
      if (!sessionId) return;

      const { data, error } = await supabase
        .from("sensor_swings")
        .select("*")
        .eq("session_id", sessionId)
        .eq("is_valid", true)
        .order("swing_number", { ascending: true });

      if (data && !error) {
        setSwings(data as SwingData[]);
        setScores(calculate4BScores(data as SwingData[]));
      }
    };

    loadExistingSwings();
  }, [sessionId, calculate4BScores]);

  // Finalize session and call dk-4b-inverse
  const handleFinalizeSession = async () => {
    if (swings.length < 3) {
      toast.error("Need at least 3 swings to finalize");
      return;
    }

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("dk-4b-inverse", {
        body: {
          session_id: sessionId,
          player_id: playerId,
          swings: swings.map(s => ({
            bat_speed_mph: s.bat_speed_mph,
            hand_speed_mph: s.hand_speed_mph,
            trigger_to_impact_ms: s.trigger_to_impact_ms,
            attack_angle_deg: s.attack_angle_deg,
            hand_to_bat_ratio: s.hand_to_bat_ratio,
          })),
        },
      });

      if (error) throw error;

      const finalScores = data?.scores || scores;
      setScores(finalScores);
      onSessionComplete?.(finalScores);

      toast.success("Session analyzed!", {
        description: `Composite Score: ${finalScores.composite} (${getGrade(finalScores.composite)})`,
      });
    } catch (err) {
      console.error("[LiveDK] Finalize error:", err);
      toast.error("Failed to analyze session");
    } finally {
      setIsCalculating(false);
    }
  };

  const scoreConfig = [
    { key: "brain", label: "BRAIN", icon: Brain, color: "text-pink-400", bgColor: "bg-pink-500/10" },
    { key: "body", label: "BODY", icon: Activity, color: "text-blue-400", bgColor: "bg-blue-500/10" },
    { key: "bat", label: "BAT", icon: Zap, color: "text-orange-400", bgColor: "bg-orange-500/10" },
    { key: "ball", label: "BALL", icon: Target, color: "text-green-400", bgColor: "bg-green-500/10" },
  ] as const;

  return (
    <Card
      className={cn(
        "bg-[#0A0A0B] border-[#1a1a1c] overflow-hidden transition-all",
        pulseActive && "ring-2 ring-emerald-500/50"
      )}
      style={{
        boxShadow: isConnected
          ? "0 0 40px rgba(16, 185, 129, 0.1), inset 0 0 60px rgba(16, 185, 129, 0.02)"
          : undefined,
      }}
    >
      {/* Live connection indicator */}
      <div
        className={cn(
          "h-1 transition-all",
          isConnected ? "bg-emerald-500" : "bg-red-500"
        )}
        style={{
          animation: isConnected ? "pulse 2s infinite" : undefined,
        }}
      />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white">
            <Radio className={cn("h-4 w-4", isConnected ? "text-emerald-400" : "text-red-400")} />
            LIVE 4B SCORING
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "text-xs font-bold flex items-center gap-1",
                isConnected
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              )}
            >
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isConnected ? "CONNECTED" : "DISCONNECTED"}
            </Badge>
            <Badge className="bg-[#DC2626]/20 text-[#DC2626] text-xs font-bold">
              {swings.length} SWING{swings.length !== 1 ? "S" : ""}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Composite Score Hero */}
        <div className="text-center py-4">
          <div
            className={cn(
              "inline-flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 transition-all",
              "bg-gradient-to-br from-[#111113] to-[#0A0A0B]",
              scores.composite >= 60
                ? "border-emerald-500/50"
                : scores.composite >= 45
                  ? "border-yellow-500/50"
                  : "border-red-500/50"
            )}
            style={{
              boxShadow: pulseActive
                ? "0 0 30px rgba(16, 185, 129, 0.4)"
                : "0 0 20px rgba(0, 0, 0, 0.5)",
            }}
          >
            <span className="text-4xl font-black text-white">{scores.composite}</span>
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {getGrade(scores.composite)}
            </span>
          </div>
          {lastSwingTime && (
            <p className="text-xs text-slate-500 mt-3">
              Last swing: {lastSwingTime.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* 4B Score Grid */}
        <div className="grid grid-cols-2 gap-3">
          {scoreConfig.map(({ key, label, icon: Icon, color, bgColor }) => {
            const score = scores[key as keyof Live4BScores];
            return (
              <div
                key={key}
                className={cn(
                  "p-4 rounded-lg border border-[#1a1a1c] transition-all",
                  bgColor,
                  pulseActive && "scale-[1.02]"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn("h-4 w-4", color)} />
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {label}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black text-white">{score}</span>
                  <span className={cn("text-xs font-medium", color)}>
                    {getGrade(score)}
                  </span>
                </div>
                <Progress
                  value={((score - 20) / 60) * 100}
                  className="h-1 mt-2 bg-slate-800"
                />
              </div>
            );
          })}
        </div>

        {/* Recent Swings Feed */}
        {swings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Recent Swings
            </h4>
            <div className="max-h-32 overflow-y-auto space-y-1.5">
              {swings.slice(-5).reverse().map((swing, i) => (
                <div
                  key={swing.id}
                  className={cn(
                    "flex items-center justify-between p-2 rounded bg-[#111113] border border-[#1a1a1c] text-sm",
                    i === 0 && pulseActive && "border-emerald-500/50"
                  )}
                >
                  <span className="text-slate-400">#{swings.length - i}</span>
                  <span className="text-white font-semibold">{swing.bat_speed_mph} mph</span>
                  {swing.trigger_to_impact_ms && (
                    <span className="text-slate-500">{swing.trigger_to_impact_ms}ms</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-[#111113] border-[#1a1a1c] text-slate-300"
            onClick={() => {
              setSwings([]);
              setScores({ brain: 50, body: 50, bat: 50, ball: 50, composite: 50 });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
            disabled={swings.length < 3 || isCalculating}
            onClick={handleFinalizeSession}
          >
            {isCalculating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4 mr-2" />
            )}
            Finalize Session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
