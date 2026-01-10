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
  Video, Users, DollarSign, Plus, Upload, MessageSquare,
  ChevronRight, Loader2, Clock, ArrowRight
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { format, formatDistanceToNow, startOfWeek } from "date-fns";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";

  // Pending analyses count
  const { data: pendingCount = 0, isLoading: loadingPending } = useQuery({
    queryKey: ['pending-analyses-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'uploaded');
      if (error) throw error;
      return count || 0;
    }
  });

  // Active players count
  const { data: playerCount = 0, isLoading: loadingPlayers } = useQuery({
    queryKey: ['active-players-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('player_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count || 0;
    }
  });

  // Revenue this week
  const { data: weeklyRevenue = 0, isLoading: loadingRevenue } = useQuery({
    queryKey: ['weekly-revenue'],
    queryFn: async () => {
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const { data, error } = await supabase
        .from('sessions')
        .select('price_cents')
        .gte('paid_at', weekStart.toISOString())
        .not('paid_at', 'is', null);
      if (error) throw error;
      const total = data?.reduce((sum, s) => sum + (s.price_cents || 0), 0) || 0;
      return total / 100;
    }
  });

  // Pending analyses (top 5)
  const { data: pendingAnalyses = [], isLoading: loadingPendingList } = useQuery({
    queryKey: ['pending-analyses-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, player_name, product_type, price_cents, created_at, status')
        .eq('status', 'uploaded')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    }
  });

  // Recent players (top 5)
  const { data: recentPlayers = [], isLoading: loadingRecentPlayers } = useQuery({
    queryKey: ['recent-players-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_profiles')
        .select('id, first_name, last_name, organization, level, total_sessions, updated_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    }
  });

  const formatProductType = (type: string, cents: number) => {
    const products: Record<string, string> = {
      'single_swing': `Single $${cents / 100}`,
      'complete': `Complete $${cents / 100}`,
      'in_person': `In-Person $${cents / 100}`,
    };
    return products[type] || type;
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <main className="container py-6">
        {/* Greeting */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">{greeting}, Coach Rick</h1>
            <p className="text-muted-foreground">{format(today, 'EEEE, MMMM d, yyyy')}</p>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <Video className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {loadingPending ? <Loader2 className="h-6 w-6 animate-spin" /> : pendingCount}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending Analyses</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {loadingPlayers ? <Loader2 className="h-6 w-6 animate-spin" /> : playerCount}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Players</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {loadingRevenue ? <Loader2 className="h-6 w-6 animate-spin" /> : `$${weeklyRevenue.toLocaleString()}`}
                  </p>
                  <p className="text-sm text-muted-foreground">This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/admin/new-session')}>
              <Plus className="h-4 w-4 mr-2" />
              New Session
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/videos')}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Video
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/messages')}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Send SMS
            </Button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Analyses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Pending Analyses</CardTitle>
              <Link to="/admin/analyzer" className="text-sm text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {loadingPendingList ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingAnalyses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAnalyses.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          {session.player_name?.split(' ')[0]} {session.player_name?.split(' ')[1]?.[0]}.
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {formatProductType(session.product_type, session.price_cents)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate(`/admin/analyzer?session=${session.id}`)}
                          >
                            Analyze
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No pending analyses</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Players */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Recent Players</CardTitle>
              <Link to="/admin/players" className="text-sm text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {loadingRecentPlayers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : recentPlayers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead className="text-center">Sessions</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPlayers.map((player) => (
                      <TableRow 
                        key={player.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/admin/players/${player.id}`)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {player.first_name} {player.last_name || ''}
                            </div>
                            {player.organization && (
                              <div className="text-xs text-muted-foreground">
                                {player.organization}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {player.level ? (
                            <Badge variant="secondary">{player.level}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {player.total_sessions || 0}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No players yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => navigate('/admin/players/new')}
                  >
                    <Plus className="h-4 w-4 mr-1" />
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
