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

  const { data: pendingAnalyses = [], isLoading: loadingPendingList } = useQuery({
    queryKey: ["pending-analyses-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, player_name, product_type, price_cents, created_at, status")
        .eq("status", "uploaded")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const { data: recentPlayers = [], isLoading: loadingRecentPlayers } = useQuery({
    queryKey: ["recent-players-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_profiles")
        .select(
          "id, first_name, last_name, organization, level, total_sessions, updated_at"
        )
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const formatProductType = (type: string, cents: number) => {
    const products: Record<string, string> = {
      single_swing: `Single $${cents / 100}`,
      complete: `Complete $${cents / 100}`,
      in_person: `In-Person $${cents / 100}`,
    };
    return products[type] || type;
  };

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
              onClick={() => navigate("/admin/new-session")}
              className="bg-red-600 hover:bg-red-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Session
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
              Send SMS
            </Button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Analyses */}
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-white">
                Pending Analyses
              </CardTitle>
              <Link
                to="/admin/analyzer"
                className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {loadingPendingList ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : pendingAnalyses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Player</TableHead>
                      <TableHead className="text-slate-400">Product</TableHead>
                      <TableHead className="text-slate-400">Uploaded</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAnalyses.map((session) => (
                      <TableRow
                        key={session.id}
                        className="border-slate-800 hover:bg-slate-800/50"
                      >
                        <TableCell className="font-medium text-white">
                          {session.player_name?.split(" ")[0]}{" "}
                          {session.player_name?.split(" ")[1]?.[0]}.
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-slate-700 text-slate-300"
                          >
                            {formatProductType(session.product_type, session.price_cents)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(session.created_at), {
                              addSuffix: true,
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() =>
                              navigate(`/admin/analyzer?session=${session.id}`)
                            }
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Analyze
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p>No pending analyses 🎉</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Players */}
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-white">
                Recent Players
              </CardTitle>
              <Link
                to="/admin/players"
                className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {loadingRecentPlayers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : recentPlayers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Player</TableHead>
                      <TableHead className="text-slate-400">Level</TableHead>
                      <TableHead className="text-slate-400 text-center">
                        Sessions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPlayers.map((player) => (
                      <TableRow
                        key={player.id}
                        className="cursor-pointer border-slate-800 hover:bg-slate-800/50"
                        onClick={() => navigate(`/admin/players/${player.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">
                              {player.first_name} {player.last_name || ""}
                            </p>
                            {player.organization && (
                              <p className="text-xs text-slate-500">
                                {player.organization}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {player.level ? (
                            <Badge
                              variant="secondary"
                              className="bg-slate-800 text-slate-300"
                            >
                              {player.level}
                            </Badge>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-white">
                          {player.total_sessions || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p className="mb-3">No players yet</p>
                  <Button
                    onClick={() => navigate("/admin/players/new")}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Player
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
