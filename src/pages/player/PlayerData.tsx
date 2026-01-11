import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  BarChart3, 
  Target, 
  Activity, 
  ChevronRight,
  Upload
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Session {
  id: string;
  created_at: string;
  product_type: string;
  composite_score: number | null;
  four_b_brain: number | null;
  four_b_body: number | null;
  four_b_bat: number | null;
  four_b_ball: number | null;
}

interface ChartData {
  date: string;
  brain: number | null;
  body: number | null;
  bat: number | null;
  ball: number | null;
}

export default function PlayerData() {
  const [latestScores, setLatestScores] = useState<{
    brain: number | null;
    body: number | null;
    bat: number | null;
    ball: number | null;
  } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [progressData, setProgressData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Get player by email
    const { data: playerData } = await supabase
      .from('players')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (!playerData) {
      setLoading(false);
      return;
    }

    // Load sessions
    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('id, created_at, product_type, composite_score, four_b_brain, four_b_body, four_b_bat, four_b_ball')
      .eq('player_id', playerData.id)
      .order('created_at', { ascending: false });

    setSessions(sessionsData || []);

    // Latest scores
    const scored = (sessionsData || []).find(s => s.four_b_brain !== null);
    if (scored) {
      setLatestScores({
        brain: scored.four_b_brain,
        body: scored.four_b_body,
        bat: scored.four_b_bat,
        ball: scored.four_b_ball,
      });
    }

    // Progress data for charts
    const chartData: ChartData[] = (sessionsData || [])
      .filter(s => s.four_b_brain !== null)
      .slice(0, 10)
      .reverse()
      .map(s => ({
        date: format(new Date(s.created_at!), 'MMM d'),
        brain: s.four_b_brain,
        body: s.four_b_body,
        bat: s.four_b_bat,
        ball: s.four_b_ball,
      }));
    setProgressData(chartData);

    setLoading(false);
  };

  const getGrade = (score: number | null): string => {
    if (!score) return '--';
    if (score >= 70) return 'Plus-Plus';
    if (score >= 60) return 'Plus';
    if (score >= 55) return 'Above Avg';
    if (score >= 45) return 'Average';
    if (score >= 40) return 'Below Avg';
    return 'Developing';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'analyzer': return <BarChart3 className="h-4 w-4" />;
      case 'hittrax': return <Target className="h-4 w-4" />;
      case 'reboot': return <Activity className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Data</h1>
        <Button asChild>
          <Link to="/analyze">
            <Upload className="h-4 w-4 mr-2" /> Upload Video
          </Link>
        </Button>
      </div>

      {/* Latest 4B Scores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Latest 4B Scores</CardTitle>
          <CardDescription>Your most recent assessment results</CardDescription>
        </CardHeader>
        <CardContent>
          {latestScores ? (
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="space-y-1">
                <p className="text-3xl font-bold text-primary">
                  {latestScores.brain || '--'}
                </p>
                <p className="text-xs text-muted-foreground">Brain</p>
                <p className="text-xs font-medium">
                  {getGrade(latestScores.brain)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-primary">
                  {latestScores.body || '--'}
                </p>
                <p className="text-xs text-muted-foreground">Body</p>
                <p className="text-xs font-medium">
                  {getGrade(latestScores.body)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-primary">
                  {latestScores.bat || '--'}
                </p>
                <p className="text-xs text-muted-foreground">Bat</p>
                <p className="text-xs font-medium">
                  {getGrade(latestScores.bat)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-primary">
                  {latestScores.ball || '--'}
                </p>
                <p className="text-xs text-muted-foreground">Ball</p>
                <p className="text-xs font-medium">
                  {getGrade(latestScores.ball)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assessment data yet. Upload a swing video to get started!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progress Chart */}
      {progressData.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Progress Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="4bscores">
              <TabsList className="mb-4">
                <TabsTrigger value="4bscores">4B Scores</TabsTrigger>
                <TabsTrigger value="brain">Brain</TabsTrigger>
                <TabsTrigger value="body">Body</TabsTrigger>
                <TabsTrigger value="bat">Bat</TabsTrigger>
              </TabsList>

              <TabsContent value="4bscores">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis domain={[30, 80]} className="text-xs" />
                      <Tooltip />
                      <Line type="monotone" dataKey="brain" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Brain" />
                      <Line type="monotone" dataKey="body" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} name="Body" />
                      <Line type="monotone" dataKey="bat" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 4 }} name="Bat" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="brain">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis domain={[30, 80]} className="text-xs" />
                      <Tooltip />
                      <Line type="monotone" dataKey="brain" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Brain" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="body">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis domain={[30, 80]} className="text-xs" />
                      <Tooltip />
                      <Line type="monotone" dataKey="body" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} name="Body" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="bat">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis domain={[30, 80]} className="text-xs" />
                      <Tooltip />
                      <Line type="monotone" dataKey="bat" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 4 }} name="Bat" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Session History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Session History</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No sessions yet. Upload your first swing video!
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => (
                <Link
                  key={session.id}
                  to={`/results/${session.id}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getTypeIcon('analyzer')}
                    <div>
                      <p className="font-medium text-sm">Swing Analysis</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(session.created_at!), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-right">
                      {session.four_b_brain && <span>B:{session.four_b_brain} </span>}
                      {session.four_b_body && <span>Bo:{session.four_b_body} </span>}
                      {session.four_b_bat && <span>Ba:{session.four_b_bat}</span>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
