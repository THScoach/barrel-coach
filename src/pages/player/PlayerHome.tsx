import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { 
  TrendingUp, 
  Zap, 
  Target, 
  ChevronRight,
  MessageSquare,
  BarChart3,
  Dumbbell,
  Upload
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
}

interface LatestScores {
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
}

export default function PlayerHome() {
  const [player, setPlayer] = useState<any>(null);
  const [stats, setStats] = useState({
    latestBatSpeed: null as number | null,
    latestExitVelo: null as number | null,
    drillsThisWeek: 0,
    dayStreak: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [latestScores, setLatestScores] = useState<LatestScores | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayerData();
  }, []);

  const loadPlayerData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch player data by email (since players table might not have user_id yet)
    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();

    if (playerData) {
      setPlayer(playerData);
      await loadStats(playerData.id);
      await loadRecentActivity(playerData.id);
      await loadLatestScores(playerData.id);
    }
    setLoading(false);
  };

  const loadStats = async (playerId: string) => {
    // Get latest launch monitor data for exit velo
    const { data: launchData } = await supabase
      .from('launch_monitor_sessions')
      .select('avg_exit_velo')
      .eq('player_id', playerId)
      .order('session_date', { ascending: false })
      .limit(1);

    setStats({
      latestBatSpeed: null, // Would come from bat sensor data
      latestExitVelo: launchData?.[0]?.avg_exit_velo || null,
      drillsThisWeek: 0,
      dayStreak: 0,
    });
  };

  const loadRecentActivity = async (playerId: string) => {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, created_at, product_type, composite_score')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(5);

    const activity: ActivityItem[] = (sessions || []).map(s => ({
      id: s.id,
      type: 'analysis',
      title: 'Swing Analysis',
      description: `Score: ${s.composite_score || 'Pending'}`,
      date: new Date(s.created_at!),
    }));

    setRecentActivity(activity);
  };

  const loadLatestScores = async (playerId: string) => {
    const { data } = await supabase
      .from('sessions')
      .select('four_b_brain, four_b_body, four_b_bat, four_b_ball')
      .eq('player_id', playerId)
      .not('four_b_brain', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data?.[0]) {
      setLatestScores({
        brain_score: data[0].four_b_brain,
        body_score: data[0].four_b_body,
        bat_score: data[0].four_b_bat,
        ball_score: data[0].four_b_ball,
      });
    }
  };

  const getGrade = (score: number | null) => {
    if (!score) return { label: '--', variant: 'secondary' as const };
    if (score >= 70) return { label: 'Plus-Plus', variant: 'default' as const };
    if (score >= 60) return { label: 'Plus', variant: 'default' as const };
    if (score >= 55) return { label: 'Above Avg', variant: 'secondary' as const };
    if (score >= 45) return { label: 'Average', variant: 'secondary' as const };
    if (score >= 40) return { label: 'Below Avg', variant: 'outline' as const };
    return { label: 'Developing', variant: 'outline' as const };
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 md:ml-56">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 md:ml-56">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          Welcome back{player?.name ? `, ${player.name.split(' ')[0]}` : ''}! 👋
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your training.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-primary">
              {stats.latestBatSpeed?.toFixed(1) || '--'}
            </div>
            <p className="text-xs text-muted-foreground">Bat Speed (mph)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-primary">
              {stats.latestExitVelo?.toFixed(1) || '--'}
            </div>
            <p className="text-xs text-muted-foreground">Exit Velo (mph)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Dumbbell className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{stats.drillsThisWeek}</p>
            <p className="text-xs text-muted-foreground">Drills This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{stats.dayStreak}</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </CardContent>
        </Card>
      </div>

      {/* 4B Scores Card */}
      {latestScores && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Your 4B Scores</CardTitle>
            <CardDescription>From your most recent assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-bold">{latestScores.brain_score || '--'}</p>
                <p className="text-xs text-muted-foreground">Brain</p>
                <Badge variant={getGrade(latestScores.brain_score).variant} className="text-xs">
                  {getGrade(latestScores.brain_score).label}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{latestScores.body_score || '--'}</p>
                <p className="text-xs text-muted-foreground">Body</p>
                <Badge variant={getGrade(latestScores.body_score).variant} className="text-xs">
                  {getGrade(latestScores.body_score).label}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{latestScores.bat_score || '--'}</p>
                <p className="text-xs text-muted-foreground">Bat</p>
                <Badge variant={getGrade(latestScores.bat_score).variant} className="text-xs">
                  {getGrade(latestScores.bat_score).label}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{latestScores.ball_score || '--'}</p>
                <p className="text-xs text-muted-foreground">Ball</p>
                <Badge variant={getGrade(latestScores.ball_score).variant} className="text-xs">
                  {getGrade(latestScores.ball_score).label}
                </Badge>
              </div>
            </div>
            <div className="mt-4">
              <Button variant="link" className="p-0 h-auto text-sm" asChild>
                <Link to="/player/data">View detailed breakdown →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two Column: Activity + Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent activity yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(item => (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(item.date, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link to="/player/data">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  View My Progress
                </span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link to="/player/drills">
                <span className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4" />
                  Today's Drills
                </span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link to="/player/messages">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Message Coach
                </span>
                {unreadMessages > 0 && (
                  <Badge variant="destructive" className="mr-2">{unreadMessages}</Badge>
                )}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button className="w-full" asChild>
              <Link to="/analyze">
                <Upload className="h-4 w-4 mr-2" />
                Upload Swing Video
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Coach Feedback (if unread) */}
      {unreadMessages > 0 && (
        <Card className="border-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              New Message from Coach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You have {unreadMessages} unread message{unreadMessages > 1 ? 's' : ''}.
            </p>
            <Button variant="link" className="p-0 h-auto text-sm mt-2" asChild>
              <Link to="/player/messages">Read messages →</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
