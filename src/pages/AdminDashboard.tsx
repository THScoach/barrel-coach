import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Video,
  Users,
  TrendingUp,
  Plus,
  Upload,
  MessageSquare,
  BarChart3,
  Activity,
  Brain,
  Zap,
  Target,
  AlertTriangle,
  Dumbbell,
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { MobileBottomNav } from "@/components/admin/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, startOfWeek, subDays } from "date-fns";
import {
  MetricCard,
  RecentSessionsFeed,
  MotorProfileChart,
  LeakFrequencyChart,
  SyncStatusWidget,
} from "@/components/dashboard";
import {
  BrainScoreGauge,
  BodyScoreGauge,
  BatScoreGauge,
  BallScoreGauge,
} from "@/components/dashboard/ScoutScaleGauge";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const today = new Date();
  const greeting =
    today.getHours() < 12
      ? "Good morning"
      : today.getHours() < 17
      ? "Good afternoon"
      : "Good evening";

  // Total active players
  const { data: playerCount = 0, isLoading: loadingPlayers } = useQuery({
    queryKey: ["active-players-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Sessions this week
  const { data: weeklySessionData, isLoading: loadingSessions } = useQuery({
    queryKey: ["weekly-sessions"],
    queryFn: async () => {
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const lastWeekStart = subDays(weekStart, 7);

      const [{ count: thisWeek }, { count: lastWeek }] = await Promise.all([
        supabase
          .from("reboot_uploads")
          .select("*", { count: "exact", head: true })
          .gte("session_date", weekStart.toISOString().split("T")[0]),
        supabase
          .from("reboot_uploads")
          .select("*", { count: "exact", head: true })
          .gte("session_date", lastWeekStart.toISOString().split("T")[0])
          .lt("session_date", weekStart.toISOString().split("T")[0]),
      ]);

      return {
        count: thisWeek || 0,
        trend: (thisWeek || 0) - (lastWeek || 0),
      };
    },
  });

  // Average composite score
  const { data: avgScoreData, isLoading: loadingAvgScore } = useQuery({
    queryKey: ["avg-composite-score"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("latest_composite_score")
        .not("latest_composite_score", "is", null);

      if (!data || data.length === 0) return { avg: 0, count: 0 };

      const scores = data
        .map((p) => p.latest_composite_score)
        .filter((s): s is number => s !== null);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

      return { avg: Math.round(avg), count: scores.length };
    },
  });

  // 4B Scores from latest reboot_uploads
  const { data: fourBScores, isLoading: loadingFourB } = useQuery({
    queryKey: ["4b-averages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reboot_uploads")
        .select("brain_score, body_score, bat_score, composite_score")
        .not("composite_score", "is", null)
        .order("session_date", { ascending: false })
        .limit(50);

      if (!data || data.length === 0) {
        return { brain: null, body: null, bat: null, ball: null };
      }

      const avg = (arr: (number | null)[]) => {
        const valid = arr.filter((v): v is number => v !== null);
        return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
      };

      return {
        brain: avg(data.map((d) => d.brain_score)),
        body: avg(data.map((d) => d.body_score)),
        bat: avg(data.map((d) => d.bat_score)),
        ball: avg(data.map((d) => d.composite_score)), // Use composite as proxy for ball
      };
    },
  });

  // Players improved (comparing to 30 days ago - simplified)
  const { data: improvedData, isLoading: loadingImproved } = useQuery({
    queryKey: ["players-improved"],
    queryFn: async () => {
      // Get players with multiple uploads
      const { data } = await supabase
        .from("reboot_uploads")
        .select("player_id, composite_score, session_date")
        .not("composite_score", "is", null)
        .order("session_date", { ascending: true });

      if (!data || data.length === 0) return { improved: 0, total: 0 };

      // Group by player and check if latest > first
      const byPlayer = new Map<string, number[]>();
      data.forEach((row) => {
        if (!row.player_id) return;
        const scores = byPlayer.get(row.player_id) || [];
        scores.push(row.composite_score!);
        byPlayer.set(row.player_id, scores);
      });

      let improved = 0;
      let total = 0;
      byPlayer.forEach((scores) => {
        if (scores.length >= 2) {
          total++;
          if (scores[scores.length - 1] > scores[0]) {
            improved++;
          }
        }
      });

      return { improved, total };
    },
  });

  // Latest leak and training data
  const { data: leakData, isLoading: loadingLeak } = useQuery({
    queryKey: ["latest-leak-data"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reboot_uploads")
        .select("leak_detected, leak_evidence, weakest_link, priority_drill, player_id")
        .not("leak_detected", "is", null)
        .order("session_date", { ascending: false })
        .limit(1)
        .single();

      return data || null;
    },
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0B" }}>
      <AdminHeader />

      <main className={`container py-6 md:py-8 ${isMobile ? "pb-24" : ""}`}>
        {/* Greeting */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {greeting}, Coach Rick
          </h1>
          <p className="text-slate-400 text-sm md:text-base">
            {format(today, "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {/* 4B Scout Scale Gauges */}
        <Card 
          className="mb-6 md:mb-8 border-2"
          style={{ 
            backgroundColor: "#111113",
            borderColor: "rgba(220, 38, 38, 0.3)",
            boxShadow: "0 0 30px rgba(220, 38, 38, 0.15)",
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5" style={{ color: "#DC2626" }} />
              4B Bio-Engine Averages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFourB ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#DC2626", borderTopColor: "transparent" }} />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4">
                <BrainScoreGauge score={fourBScores?.brain ?? null} size="md" />
                <BodyScoreGauge score={fourBScores?.body ?? null} size="md" />
                <BatScoreGauge score={fourBScores?.bat ?? null} size="md" />
                <BallScoreGauge score={fourBScores?.ball ?? null} size="md" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Row - Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <MetricCard
            title="Total Players"
            value={playerCount}
            icon={Users}
            iconColor="text-[#DC2626]"
            iconBgColor="bg-[#DC2626]/15"
            loading={loadingPlayers}
            className="border-[#DC2626]/20"
            style={{ backgroundColor: "#111113" }}
          />
          <MetricCard
            title="Sessions This Week"
            value={weeklySessionData?.count || 0}
            trend={weeklySessionData?.trend}
            icon={Video}
            iconColor="text-[#DC2626]"
            iconBgColor="bg-[#DC2626]/15"
            loading={loadingSessions}
            className="border-[#DC2626]/20"
            style={{ backgroundColor: "#111113" }}
          />
          <Card className="border-[#DC2626]/20" style={{ backgroundColor: "#111113" }}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Avg. Composite</p>
                  {loadingAvgScore ? (
                    <div className="h-9 w-20 bg-slate-700 animate-pulse rounded" />
                  ) : (
                    <p className="text-3xl font-bold text-white">{avgScoreData?.avg || "—"}</p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-[#DC2626]/15">
                  <Activity className="h-6 w-6 text-[#DC2626]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <MetricCard
            title="Players Improved"
            value={
              improvedData?.total
                ? `${Math.round((improvedData.improved / improvedData.total) * 100)}%`
                : "—"
            }
            icon={TrendingUp}
            iconColor="text-[#DC2626]"
            iconBgColor="bg-[#DC2626]/15"
            loading={loadingImproved}
            className="border-[#DC2626]/20"
            style={{ backgroundColor: "#111113" }}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-6 md:mb-8">
          <h2 className="text-lg font-semibold text-white mb-3 md:mb-4">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-2 md:gap-3">
            <Button
              onClick={() => navigate("/admin/analyzer")}
              className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
            >
              <Upload className="h-4 w-4 mr-2" />
              Analyze Session
            </Button>
            <Button
              onClick={() => navigate("/admin/players/new")}
              variant="outline"
              className="border-[#DC2626]/50 text-white hover:bg-[#DC2626]/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
            <Button
              onClick={() => navigate("/admin/messages")}
              variant="outline"
              className="border-[#DC2626]/50 text-white hover:bg-[#DC2626]/20"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Send Message</span>
              <span className="sm:hidden">Message</span>
            </Button>
          </div>
        </div>

        {/* Kinetic Leak Warning & Training Prescription */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Kinetic Leak Warning */}
          <Card 
            className="border-2"
            style={{ 
              backgroundColor: "#111113",
              borderColor: "rgba(220, 38, 38, 0.4)",
              boxShadow: "0 0 20px rgba(220, 38, 38, 0.1)",
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#DC2626]/20">
                  <AlertTriangle className="h-5 w-5 text-[#DC2626]" />
                </div>
                Kinetic Leak Warning
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLeak ? (
                <div className="h-24 bg-slate-800 animate-pulse rounded-lg" />
              ) : leakData?.leak_detected ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">
                        Detected Leak
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-white">
                      {leakData.leak_detected}
                    </p>
                  </div>
                  
                  {leakData.leak_evidence && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Evidence
                      </p>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {leakData.leak_evidence}
                      </p>
                    </div>
                  )}
                  
                  {leakData.weakest_link && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                      <span className="text-xs text-slate-500">Weakest Link:</span>
                      <span className="text-sm font-bold text-[#DC2626] uppercase">
                        {leakData.weakest_link}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent leak data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Training Prescription */}
          <Card 
            className="border-2"
            style={{ 
              backgroundColor: "#111113",
              borderColor: "rgba(220, 38, 38, 0.4)",
              boxShadow: "0 0 20px rgba(220, 38, 38, 0.1)",
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#DC2626]/20">
                  <Dumbbell className="h-5 w-5 text-[#DC2626]" />
                </div>
                Training Prescription
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLeak ? (
                <div className="h-24 bg-slate-800 animate-pulse rounded-lg" />
              ) : leakData?.priority_drill ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-[#DC2626]/15 to-[#DC2626]/5 border border-[#DC2626]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">
                        Priority Drill
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-white">
                      {leakData.priority_drill}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Why It Works
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      This drill targets the {leakData.weakest_link || "identified"} weakness by 
                      reinforcing proper kinetic sequencing and energy transfer patterns.
                    </p>
                  </div>
                  
                  <Button 
                    className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white mt-2"
                    onClick={() => navigate("/admin/library")}
                  >
                    <Dumbbell className="h-4 w-4 mr-2" />
                    View Full Drill Library
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No prescription available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Middle Row - Charts + Sync Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          <Card className="border-[#DC2626]/20" style={{ backgroundColor: "#111113" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#DC2626]" />
                Motor Profile Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MotorProfileChart />
            </CardContent>
          </Card>

          <Card className="border-[#DC2626]/20" style={{ backgroundColor: "#111113" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#DC2626]" />
                Most Common Leaks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeakFrequencyChart />
            </CardContent>
          </Card>

          <SyncStatusWidget />
        </div>

        {/* Bottom Row - Recent Activity */}
        <Card className="border-[#DC2626]/20" style={{ backgroundColor: "#111113" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-white">
              Recent Sessions
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/players")}
              className="text-slate-400 hover:text-white hover:bg-[#DC2626]/20"
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <RecentSessionsFeed />
          </CardContent>
        </Card>
      </main>

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
}
