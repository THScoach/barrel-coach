import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Video,
  Users,
  DollarSign,
  Plus,
  Upload,
  MessageSquare,
  ChevronRight,
  Loader2,
  Clock,
  TrendingUp,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { DashboardWidgets } from "@/components/admin/DashboardWidgets";
import { format, formatDistanceToNow, startOfWeek } from "date-fns";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const today = new Date();
  const greeting =
    today.getHours() < 12
      ? "Good morning"
      : today.getHours() < 17
      ? "Good afternoon"
      : "Good evening";

  const { data: pendingCount = 0, isLoading: loadingPending } = useQuery({
    queryKey: ["pending-analyses-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("status", "uploaded");
      return count || 0;
    },
  });

  const { data: playerCount = 0, isLoading: loadingPlayers } = useQuery({
    queryKey: ["active-players-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("player_profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      return count || 0;
    },
  });

  const { data: weeklyRevenue = 0, isLoading: loadingRevenue } = useQuery({
    queryKey: ["weekly-revenue"],
    queryFn: async () => {
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const { data } = await supabase
        .from("sessions")
        .select("price_cents")
        .gte("paid_at", weekStart.toISOString())
        .not("paid_at", "is", null);
      return (data?.reduce((sum, s) => sum + (s.price_cents || 0), 0) || 0) / 100;
    },
  });

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />

      <main className="container py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{greeting}, Coach Rick</h1>
          <p className="text-slate-400">{format(today, "EEEE, MMMM d, yyyy")}</p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Pending Analyses</p>
                  <p className="text-3xl font-bold text-white">
                    {loadingPending ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      pendingCount
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10">
                  <Video className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Active Players</p>
                  <p className="text-3xl font-bold text-white">
                    {loadingPlayers ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      playerCount
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">This Week</p>
                  <p className="text-3xl font-bold text-white">
                    {loadingRevenue ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      `$${weeklyRevenue.toLocaleString()}`
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => navigate("/admin/players/new")}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
            <Button
              onClick={() => navigate("/admin/videos")}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Video
            </Button>
            <Button
              onClick={() => navigate("/admin/messages")}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </div>
        </div>

        {/* Two Column Layout: Activity Feed + Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Left: Activity Feed */}
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-white">
                Activity Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed />
            </CardContent>
          </Card>

          {/* Right: Widgets */}
          <div className="space-y-4">
            <DashboardWidgets />
          </div>
        </div>
      </main>
    </div>
  );
}
