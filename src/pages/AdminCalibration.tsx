import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { BackfillPairsButton, ManualPairDialog } from "@/components/admin/calibration/CalibrationPairingTools";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Line, ComposedChart, Cell } from "recharts";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Target, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type SortKey = "player" | "date" | "d_body" | "d_brain" | "d_bat" | "d_composite" | "v2d_body" | "v3d_body" | "v2d_brain" | "v3d_brain" | "v2d_bat" | "v3d_bat" | "v2d_composite" | "v3d_composite" | "v2d_leak" | "v3d_leak";

interface PairedSession {
  id: string;
  playerName: string;
  date: string;
  // 2D (video)
  v2d_body: number | null;
  v2d_brain: number | null;
  v2d_bat: number | null;
  v2d_ball: number | null;
  v2d_composite: number | null;
  v2d_leak: string | null;
  v2d_motor_profile: string | null;
  v2d_coach_take: string | null;
  v2d_confidence: number | null;
  v2d_video_url: string | null;
  v2d_analysis_json: any;
  // 3D (reboot)
  v3d_body: number | null;
  v3d_brain: number | null;
  v3d_bat: number | null;
  v3d_ball: number | null;
  v3d_composite: number | null;
  v3d_leak: string | null;
  v3d_raw_metrics: any;
  v3d_transfer_ratio: number | null;
  v3d_timing_gap_pct: number | null;
  v3d_sequence_order: string | null;
  v3d_x_factor_max: number | null;
  v3d_tempo_ratio: number | null;
  v3d_coaching_summary: string | null;
  // KRS
  krs_classification: any;
  krs_prescription: any;
  krs_weakest_b: string | null;
  // Deltas
  d_body: number;
  d_brain: number;
  d_bat: number;
  d_composite: number;
}

function deltaColor(d: number) {
  const abs = Math.abs(d);
  if (abs < 5) return "text-[#4ecdc4]";
  if (abs <= 15) return "text-yellow-400";
  return "text-[#E63946]";
}

function deltaBg(d: number) {
  const abs = Math.abs(d);
  if (abs < 5) return "bg-[#4ecdc4]/10";
  if (abs <= 15) return "bg-yellow-400/10";
  return "bg-[#E63946]/10";
}

function generateDeltaSummary(pillar: string, v2d: number | null, v3d: number | null, rawMetrics: any): string {
  const delta = (v2d ?? 0) - (v3d ?? 0);
  const abs = Math.abs(delta);
  if (abs <= 10) return `${pillar} scores aligned — 2D estimate is reliable for this swing type.`;

  if (delta > 10) {
    let worstMetric = "a metric the camera couldn't capture";
    if (rawMetrics && typeof rawMetrics === "object") {
      const rm = rawMetrics as Record<string, number>;
      if (rm.arms_energy_pct && rm.arms_energy_pct > 60) worstMetric = `arm dominance (${rm.arms_energy_pct.toFixed(0)}% arms)`;
      else if (rm.trunk_forward_tilt_sd && rm.trunk_forward_tilt_sd > 4) worstMetric = `trunk instability (${rm.trunk_forward_tilt_sd.toFixed(1)}° SD)`;
      else if (rm.timing_gap_pct && rm.timing_gap_pct > 15) worstMetric = `timing gap (${rm.timing_gap_pct.toFixed(0)}%)`;
    }
    return `Gemini overestimated ${pillar} by ${abs.toFixed(0)} points — likely missed ${worstMetric} that Reboot measured.`;
  }

  return `Gemini underestimated ${pillar} by ${abs.toFixed(0)} points — the swing is better than it looks on video.`;
}

export default function AdminCalibration() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pillarFilter, setPillarFilter] = useState<"all" | "body" | "brain" | "bat">("all");
  const tableRef = useRef<HTMLDivElement>(null);

  const { data: pairedSessions, isLoading } = useQuery({
    queryKey: ["calibration-paired-sessions"],
    queryFn: async () => {
      // Fetch player_sessions with video_2d_session_id not null
      const { data: ps, error: psErr } = await supabase
        .from("player_sessions")
        .select(`
          id, player_id, session_date, body_score, brain_score, bat_score, ball_score, overall_score,
          leak_type, raw_metrics, transfer_ratio, timing_gap_pct, sequence_order, x_factor_max,
          tempo_ratio, coaching_summary, video_2d_session_id,
          players!player_sessions_player_id_fkey ( name )
        `)
        .not("video_2d_session_id", "is", null);

      if (psErr) throw psErr;
      if (!ps || ps.length === 0) return [];

      const videoIds = ps.map((p: any) => p.video_2d_session_id).filter(Boolean);
      
      const { data: v2d, error: v2dErr } = await supabase
        .from("video_2d_sessions")
        .select(`
          id, body_score, brain_score, bat_score, ball_score, composite_score,
          leak_detected, motor_profile, coach_rick_take, analysis_confidence,
          video_url, analysis_json
        `)
        .in("id", videoIds);
      
      if (v2dErr) throw v2dErr;

      const videoMap = new Map((v2d ?? []).map((v: any) => [v.id, v]));

      // Also try to get KRS data
      const psIds = ps.map((p: any) => p.id);
      const { data: krs } = await supabase
        .from("hitting_4b_krs_sessions")
        .select("player_session_id, coach_barrels_classification, coach_barrels_prescription, weakest_b")
        .in("player_session_id", psIds);

      const krsMap = new Map((krs ?? []).map((k: any) => [k.player_session_id, k]));

      return ps.map((p: any) => {
        const v = videoMap.get(p.video_2d_session_id) ?? {};
        const k = krsMap.get(p.id);
        const v2dComposite = v.composite_score ?? null;
        const v3dComposite = p.overall_score ?? null;

        return {
          id: p.id,
          playerName: p.players?.name ?? "Unknown",
          date: p.session_date,
          v2d_body: v.body_score ?? null,
          v2d_brain: v.brain_score ?? null,
          v2d_bat: v.bat_score ?? null,
          v2d_ball: v.ball_score ?? null,
          v2d_composite: v2dComposite,
          v2d_leak: v.leak_detected ?? null,
          v2d_motor_profile: v.motor_profile ?? null,
          v2d_coach_take: v.coach_rick_take ?? null,
          v2d_confidence: v.analysis_confidence ?? null,
          v2d_video_url: v.video_url ?? null,
          v2d_analysis_json: v.analysis_json ?? null,
          v3d_body: p.body_score,
          v3d_brain: p.brain_score,
          v3d_bat: p.bat_score,
          v3d_ball: p.ball_score,
          v3d_composite: v3dComposite,
          v3d_leak: p.leak_type,
          v3d_raw_metrics: p.raw_metrics,
          v3d_transfer_ratio: p.transfer_ratio,
          v3d_timing_gap_pct: p.timing_gap_pct,
          v3d_sequence_order: p.sequence_order,
          v3d_x_factor_max: p.x_factor_max,
          v3d_tempo_ratio: p.tempo_ratio,
          v3d_coaching_summary: p.coaching_summary,
          krs_classification: k?.coach_barrels_classification ?? null,
          krs_prescription: k?.coach_barrels_prescription ?? null,
          krs_weakest_b: k?.weakest_b ?? null,
          d_body: (v.body_score ?? 0) - (p.body_score ?? 0),
          d_brain: (v.brain_score ?? 0) - (p.brain_score ?? 0),
          d_bat: (v.bat_score ?? 0) - (p.bat_score ?? 0),
          d_composite: (v2dComposite ?? 0) - (v3dComposite ?? 0),
        } as PairedSession;
      });
    },
  });

  const sorted = useMemo(() => {
    if (!pairedSessions) return [];
    const arr = [...pairedSessions];
    arr.sort((a, b) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "player": va = a.playerName; vb = b.playerName; break;
        case "date": va = a.date; vb = b.date; break;
        default: va = (a as any)[sortKey] ?? 0; vb = (b as any)[sortKey] ?? 0;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [pairedSessions, sortKey, sortDir]);

  const stats = useMemo(() => {
    if (!pairedSessions || pairedSessions.length === 0) return null;
    const n = pairedSessions.length;
    const maeBody = pairedSessions.reduce((s, p) => s + Math.abs(p.d_body), 0) / n;
    const maeBrain = pairedSessions.reduce((s, p) => s + Math.abs(p.d_brain), 0) / n;
    const maeBat = pairedSessions.reduce((s, p) => s + Math.abs(p.d_bat), 0) / n;
    const maeComposite = pairedSessions.reduce((s, p) => s + Math.abs(p.d_composite), 0) / n;
    const rating = maeComposite < 8 ? "HIGH" : maeComposite <= 15 ? "MODERATE" : "LOW";
    return { n, maeBody, maeBrain, maeBat, maeComposite, rating };
  }, [pairedSessions]);

  const worstMisses = useMemo(() => {
    if (!pairedSessions) return [];
    return [...pairedSessions].sort((a, b) => Math.abs(b.d_composite) - Math.abs(a.d_composite)).slice(0, 3);
  }, [pairedSessions]);

  const scatterData = useMemo(() => {
    if (!pairedSessions) return [];
    const points: { x: number; y: number; pillar: string; player: string }[] = [];
    pairedSessions.forEach((p) => {
      if (pillarFilter === "all" || pillarFilter === "body") {
        if (p.v2d_body != null && p.v3d_body != null) points.push({ x: p.v2d_body, y: p.v3d_body, pillar: "Body", player: p.playerName });
      }
      if (pillarFilter === "all" || pillarFilter === "brain") {
        if (p.v2d_brain != null && p.v3d_brain != null) points.push({ x: p.v2d_brain, y: p.v3d_brain, pillar: "Brain", player: p.playerName });
      }
      if (pillarFilter === "all" || pillarFilter === "bat") {
        if (p.v2d_bat != null && p.v3d_bat != null) points.push({ x: p.v2d_bat, y: p.v3d_bat, pillar: "Bat", player: p.playerName });
      }
    });
    return points;
  }, [pairedSessions, pillarFilter]);

  // Simple linear regression for trend line
  const regressionLine = useMemo(() => {
    if (scatterData.length < 2) return [];
    const n = scatterData.length;
    const sumX = scatterData.reduce((s, p) => s + p.x, 0);
    const sumY = scatterData.reduce((s, p) => s + p.y, 0);
    const sumXY = scatterData.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = scatterData.reduce((s, p) => s + p.x * p.x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const minX = Math.min(...scatterData.map((p) => p.x));
    const maxX = Math.max(...scatterData.map((p) => p.x));
    return [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept },
    ];
  }, [scatterData]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  const scrollToRow = (id: string) => {
    setExpandedId(id);
    setTimeout(() => {
      document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const pillarColor = (pillar: string) => {
    switch (pillar) {
      case "Body": return "#E63946";
      case "Brain": return "#00B4D8";
      case "Bat": return "#ffa500";
      default: return "#888";
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D1A]">
      <AdminHeader />
      <div className="container py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Calibration Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Compare 2D video estimates (Gemini) against 3D Reboot ground truth</p>
          </div>
          <div className="flex gap-2">
            <BackfillPairsButton />
            <ManualPairDialog />
          </div>
        </div>

        {isLoading ? (
          <div className="text-slate-400 text-center py-20">Loading paired sessions…</div>
        ) : !pairedSessions || pairedSessions.length === 0 ? (
          <Card className="bg-[#111827] border-[#1E2535]">
            <CardContent className="py-16 text-center">
              <Target className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">No paired sessions found.</p>
              <p className="text-slate-500 text-sm mt-2">When a player has both a video upload and a Reboot session on the same date, they auto-pair here.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Section 3: Aggregate Stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard label="Paired Sessions" value={stats.n.toString()} />
                <StatCard label="MAE Body" value={stats.maeBody.toFixed(1)} />
                <StatCard label="MAE Brain" value={stats.maeBrain.toFixed(1)} />
                <StatCard label="MAE Bat" value={stats.maeBat.toFixed(1)} />
                <StatCard label="MAE Composite" value={stats.maeComposite.toFixed(1)} />
                <Card className="bg-[#111827] border-[#1E2535]">
                  <CardContent className="py-4 px-4 text-center">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">2D Accuracy</p>
                    <Badge className={cn(
                      "text-sm font-bold px-3 py-1",
                      stats.rating === "HIGH" ? "bg-[#4ecdc4]/20 text-[#4ecdc4] border-[#4ecdc4]/30" :
                      stats.rating === "MODERATE" ? "bg-yellow-400/20 text-yellow-400 border-yellow-400/30" :
                      "bg-[#E63946]/20 text-[#E63946] border-[#E63946]/30"
                    )}>
                      {stats.rating}
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Section 5: Worst Misses */}
            {worstMisses.length > 0 && (
              <Card className="bg-[#111827] border-[#1E2535]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#E63946]" />
                    Worst Misses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    {worstMisses.map((s) => (
                      <div key={s.id} className="bg-[#0A0D1A] rounded-lg p-4 border border-[#1E2535]">
                        <p className="text-white font-semibold">{s.playerName}</p>
                        <p className="text-slate-500 text-xs">{format(new Date(s.date), "MMM d, yyyy")}</p>
                        <div className="mt-2 flex justify-between text-sm">
                          <span className="text-slate-400">2D: <span className="text-white">{s.v2d_composite?.toFixed(0) ?? "—"}</span></span>
                          <span className="text-slate-400">3D: <span className="text-white">{s.v3d_composite?.toFixed(0) ?? "—"}</span></span>
                          <span className={deltaColor(s.d_composite)}>Δ {s.d_composite > 0 ? "+" : ""}{s.d_composite.toFixed(0)}</span>
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-slate-500">
                          <span>2D Leak: {s.v2d_leak ?? "—"}</span>
                          <span>3D Leak: {s.v3d_leak ?? "—"}</span>
                        </div>
                        <Button size="sm" variant="outline" className="mt-3 w-full text-xs border-[#1E2535] text-slate-300" onClick={() => scrollToRow(s.id)}>
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Section 4: Calibration Chart */}
            <Card className="bg-[#111827] border-[#1E2535]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#00B4D8]" />
                    Calibration Scatter
                  </CardTitle>
                  <div className="flex gap-1">
                    {(["all", "body", "brain", "bat"] as const).map((p) => (
                      <Button
                        key={p}
                        size="sm"
                        variant={pillarFilter === p ? "default" : "secondary"}
                        className={cn("text-xs capitalize", pillarFilter === p && "bg-[#E63946] hover:bg-[#E63946]/90")}
                        onClick={() => setPillarFilter(p)}
                      >
                        {p === "all" ? "All" : p}
                      </Button>
                    ))}
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-1">X = 2D (Gemini) · Y = 3D (Reboot) · Dots above line = Gemini underestimates</p>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E2535" />
                      <XAxis type="number" dataKey="x" domain={[0, 100]} label={{ value: "2D Score (Gemini)", position: "bottom", fill: "#64748b", fontSize: 12 }} stroke="#334155" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis type="number" dataKey="y" domain={[0, 100]} label={{ value: "3D Score (Reboot)", angle: -90, position: "left", fill: "#64748b", fontSize: 12 }} stroke="#334155" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="#334155" strokeDasharray="5 5" label={{ value: "Perfect", fill: "#475569", fontSize: 10 }} />
                      {regressionLine.length === 2 && (
                        <ReferenceLine segment={regressionLine} stroke="#E63946" strokeWidth={2} strokeDasharray="8 4" />
                      )}
                      <Scatter data={scatterData} fill="#E63946" shape="circle">
                        {scatterData.map((entry, i) => (
                          <Cell key={i} fill={pillarColor(entry.pillar)} />
                        ))}
                      </Scatter>
                      <ChartTooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-[#111827] border border-[#1E2535] rounded-lg px-3 py-2 text-xs shadow-xl">
                            <p className="text-white font-semibold">{d.player}</p>
                            <p className="text-slate-400">{d.pillar}: 2D={d.x?.toFixed(0)} → 3D={d.y?.toFixed(0)}</p>
                          </div>
                        );
                      }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 justify-center mt-2 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#E63946] inline-block" /> Body</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#00B4D8] inline-block" /> Brain</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#ffa500] inline-block" /> Bat</span>
                </div>
              </CardContent>
            </Card>

            {/* Section 1: Paired Sessions Table */}
            <div ref={tableRef}>
              <Card className="bg-[#111827] border-[#1E2535]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg">Paired Sessions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#1E2535] hover:bg-transparent">
                          <SortableHead col="player" label="Player" />
                          <SortableHead col="date" label="Date" />
                          <SortableHead col="v2d_body" label="2D Body" />
                          <SortableHead col="v3d_body" label="3D Body" />
                          <SortableHead col="d_body" label="Δ Body" />
                          <SortableHead col="v2d_brain" label="2D Brain" />
                          <SortableHead col="v3d_brain" label="3D Brain" />
                          <SortableHead col="d_brain" label="Δ Brain" />
                          <SortableHead col="v2d_bat" label="2D Bat" />
                          <SortableHead col="v3d_bat" label="3D Bat" />
                          <SortableHead col="d_bat" label="Δ Bat" />
                          <SortableHead col="v2d_composite" label="2D Comp" />
                          <SortableHead col="v3d_composite" label="3D Comp" />
                          <SortableHead col="d_composite" label="Δ Comp" />
                          <SortableHead col="v2d_leak" label="2D Leak" />
                          <SortableHead col="v3d_leak" label="3D Leak" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.map((s) => (
                          <SessionRow key={s.id} session={s} isExpanded={expandedId === s.id} onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );

  function SortableHead({ col, label }: { col: SortKey; label: string }) {
    return (
      <TableHead className="cursor-pointer select-none text-slate-400 text-xs whitespace-nowrap" onClick={() => toggleSort(col)}>
        {label}<SortIcon col={col} />
      </TableHead>
    );
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-[#111827] border-[#1E2535]">
      <CardContent className="py-4 px-4 text-center">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

function SessionRow({ session: s, isExpanded, onToggle }: { session: PairedSession; isExpanded: boolean; onToggle: () => void }) {
  const score = (v: number | null) => v != null ? v.toFixed(0) : "—";
  const delta = (d: number) => (
    <span className={cn("font-mono text-xs px-1.5 py-0.5 rounded", deltaColor(d), deltaBg(d))}>
      {d > 0 ? "+" : ""}{d.toFixed(0)}
    </span>
  );

  return (
    <>
      <TableRow id={`row-${s.id}`} className="border-[#1E2535] cursor-pointer hover:bg-[#161B2A]" onClick={onToggle}>
        <TableCell className="text-white font-medium text-sm">{s.playerName}</TableCell>
        <TableCell className="text-slate-400 text-xs">{format(new Date(s.date), "MMM d, yyyy")}</TableCell>
        <TableCell className="text-slate-300 text-xs">{score(s.v2d_body)}</TableCell>
        <TableCell className="text-slate-300 text-xs">{score(s.v3d_body)}</TableCell>
        <TableCell>{delta(s.d_body)}</TableCell>
        <TableCell className="text-slate-300 text-xs">{score(s.v2d_brain)}</TableCell>
        <TableCell className="text-slate-300 text-xs">{score(s.v3d_brain)}</TableCell>
        <TableCell>{delta(s.d_brain)}</TableCell>
        <TableCell className="text-slate-300 text-xs">{score(s.v2d_bat)}</TableCell>
        <TableCell className="text-slate-300 text-xs">{score(s.v3d_bat)}</TableCell>
        <TableCell>{delta(s.d_bat)}</TableCell>
        <TableCell className="text-white font-semibold text-xs">{score(s.v2d_composite)}</TableCell>
        <TableCell className="text-white font-semibold text-xs">{score(s.v3d_composite)}</TableCell>
        <TableCell>{delta(s.d_composite)}</TableCell>
        <TableCell className="text-slate-400 text-xs max-w-[100px] truncate">{s.v2d_leak ?? "—"}</TableCell>
        <TableCell className="text-slate-400 text-xs max-w-[100px] truncate">{s.v3d_leak ?? "—"}</TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="border-[#1E2535] bg-[#0A0D1A]">
          <TableCell colSpan={16} className="p-0">
            <ExpandedDetail session={s} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ExpandedDetail({ session: s }: { session: PairedSession }) {
  const rawMetrics = s.v3d_raw_metrics as Record<string, any> | null;

  return (
    <div className="p-6 space-y-6">
      {/* Two-column comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* LEFT: 2D Video Analysis */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#E63946] uppercase tracking-wider">2D Video Analysis (Gemini)</h3>
          {s.v2d_video_url && (
            <div className="rounded-lg overflow-hidden bg-black aspect-video max-h-48">
              <video src={s.v2d_video_url} className="w-full h-full object-contain" controls preload="metadata" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <MetricBox label="Body" value={s.v2d_body} />
            <MetricBox label="Brain" value={s.v2d_brain} />
            <MetricBox label="Bat" value={s.v2d_bat} />
            <MetricBox label="Ball" value={s.v2d_ball} />
          </div>
          <div className="space-y-2 text-sm">
            <DetailRow label="Leak Detected" value={s.v2d_leak} />
            <DetailRow label="Motor Profile" value={s.v2d_motor_profile} />
            <DetailRow label="Coach Take" value={s.v2d_coach_take} longText />
            <DetailRow label="Confidence" value={s.v2d_confidence != null ? `${(s.v2d_confidence * 100).toFixed(0)}%` : null} />
          </div>
        </div>

        {/* RIGHT: 3D Reboot Analysis */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#00B4D8] uppercase tracking-wider">3D Reboot Analysis</h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricBox label="Body" value={s.v3d_body} />
            <MetricBox label="Brain" value={s.v3d_brain} />
            <MetricBox label="Bat" value={s.v3d_bat} />
            <MetricBox label="Ball" value={s.v3d_ball} />
          </div>
          <div className="space-y-2 text-sm">
            <DetailRow label="Transfer Ratio" value={s.v3d_transfer_ratio?.toFixed(2)} />
            <DetailRow label="Timing Gap %" value={s.v3d_timing_gap_pct != null ? `${s.v3d_timing_gap_pct.toFixed(1)}%` : null} />
            <DetailRow label="Sequence Order" value={s.v3d_sequence_order} />
            <DetailRow label="X-Factor Max" value={s.v3d_x_factor_max?.toFixed(1)} />
            <DetailRow label="Tempo Ratio" value={s.v3d_tempo_ratio?.toFixed(2)} />
            {rawMetrics && (
              <>
                <DetailRow label="Arms Energy %" value={rawMetrics.arms_energy_pct?.toFixed(1)} />
                <DetailRow label="Trunk Tilt SD" value={rawMetrics.trunk_forward_tilt_sd?.toFixed(2)} />
                <DetailRow label="Pelvis Peak Mom." value={rawMetrics.pelvis_peak_momentum?.toFixed(1)} />
                <DetailRow label="TKE Peak" value={rawMetrics.tke_peak?.toFixed(1)} />
                <DetailRow label="TKE at Contact %" value={rawMetrics.tke_at_contact_pct?.toFixed(1)} />
                <DetailRow label="Hand KE" value={rawMetrics.hand_ke?.toFixed(1)} />
                <DetailRow label="Swing Duration" value={rawMetrics.swing_duration_ms ? `${rawMetrics.swing_duration_ms}ms` : null} />
              </>
            )}
            <DetailRow label="Leak/Flag" value={s.v3d_leak} />
            <DetailRow label="Coaching Summary" value={s.v3d_coaching_summary} longText />
          </div>
          {s.krs_classification && (
            <div className="mt-3 p-3 bg-[#111827] rounded-lg border border-[#1E2535]">
              <p className="text-xs text-slate-500 uppercase mb-1">Coach Barrels Classification</p>
              <p className="text-xs text-slate-300">{typeof s.krs_classification === "string" ? s.krs_classification : JSON.stringify(s.krs_classification)}</p>
            </div>
          )}
          {s.krs_prescription && (
            <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2535]">
              <p className="text-xs text-slate-500 uppercase mb-1">Coach Barrels Prescription</p>
              <p className="text-xs text-slate-300">{typeof s.krs_prescription === "string" ? s.krs_prescription : JSON.stringify(s.krs_prescription)}</p>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM: Delta Analysis */}
      <div className="border-t border-[#1E2535] pt-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Delta Analysis</h3>
        <div className="grid md:grid-cols-4 gap-4 mb-4">
          {(["Body", "Brain", "Bat", "Ball"] as const).map((pillar) => {
            const key = pillar.toLowerCase() as "body" | "brain" | "bat" | "ball";
            const v2d = s[`v2d_${key}` as keyof PairedSession] as number | null;
            const v3d = s[`v3d_${key}` as keyof PairedSession] as number | null;
            const d = (v2d ?? 0) - (v3d ?? 0);
            return (
              <div key={pillar} className="text-center">
                <p className="text-xs text-slate-500 mb-1">{pillar}</p>
                <div className="relative h-24 flex items-end justify-center">
                  <div
                    className={cn("w-10 rounded-t transition-all", d >= 0 ? "bg-[#E63946]/60" : "bg-[#00B4D8]/60")}
                    style={{ height: `${Math.min(Math.abs(d), 50) * 2}%` }}
                  />
                </div>
                <p className={cn("text-sm font-mono font-bold mt-1", deltaColor(d))}>
                  {d > 0 ? "+" : ""}{d.toFixed(0)}
                </p>
              </div>
            );
          })}
        </div>
        <div className="space-y-2 text-sm text-slate-400">
          <p>{generateDeltaSummary("Body", s.v2d_body, s.v3d_body, s.v3d_raw_metrics)}</p>
          <p>{generateDeltaSummary("Brain", s.v2d_brain, s.v3d_brain, s.v3d_raw_metrics)}</p>
          <p>{generateDeltaSummary("Bat", s.v2d_bat, s.v3d_bat, s.v3d_raw_metrics)}</p>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-[#111827] rounded-lg p-3 border border-[#1E2535] text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-white">{value != null ? value.toFixed(0) : "—"}</p>
    </div>
  );
}

function DetailRow({ label, value, longText }: { label: string; value: string | number | null | undefined; longText?: boolean }) {
  if (value == null || value === "") return null;
  return (
    <div className={cn("flex gap-2", longText ? "flex-col" : "justify-between")}>
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={cn("text-slate-300 text-xs", longText && "leading-relaxed")}>{String(value)}</span>
    </div>
  );
}
