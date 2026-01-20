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
  ScoreGauge,
  SyncStatusWidget,
} from "@/components/dashboard";

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

  return (
    <div className="min-h-screen bg-slate-950">
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

        {/* Top Row - Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <MetricCard
            title="Total Players"
            value={playerCount}
            icon={Users}
            iconColor="text-blue-500"
            iconBgColor="bg-blue-500/15"
            loading={loadingPlayers}
          />
          <MetricCard
            title="Sessions This Week"
            value={weeklySessionData?.count || 0}
            trend={weeklySessionData?.trend}
            icon={Video}
            iconColor="text-amber-500"
            iconBgColor="bg-amber-500/15"
            loading={loadingSessions}
          />
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Avg. Composite</p>
                  {loadingAvgScore ? (
                    <div className="h-9 w-20 bg-slate-700 animate-pulse rounded" />
                  ) : (
                    <ScoreGauge
                      score={avgScoreData?.avg || 50}
                      size="sm"
                      showGrade={false}
                    />
                  )}
                </div>
                <div className="p-3 rounded-xl bg-teal-500/15">
                  <Activity className="h-6 w-6 text-teal-500" />
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
            iconColor="text-green-500"
            iconBgColor="bg-green-500/15"
            loading={loadingImproved}
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
              className="btn-primary"
            >
              <Upload className="h-4 w-4 mr-2" />
              Analyze Session
            </Button>
            <Button
              onClick={() => navigate("/admin/players/new")}
              className="btn-secondary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
            <Button
              onClick={() => navigate("/admin/messages")}
              className="btn-secondary"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Send Message</span>
              <span className="sm:hidden">Message</span>
            </Button>
          </div>
        </div>

        {/* Middle Row - Charts + Sync Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-400" />
                Motor Profile Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MotorProfileChart />
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-400" />
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
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-white">
              Recent Sessions
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/players")}
              className="text-slate-400 hover:text-white"
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
