import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  BarChart3, 
  Activity, 
  ChevronRight,
  Upload,
  TrendingUp
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
import { PlayerScoresSection } from "@/components/player/PlayerScoresSection";

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
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [progressData, setProgressData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("scores");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: playerData } = await supabase
      .from('players')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (!playerData) {
      setLoading(false);
      return;
    }

    setPlayerId(playerData.id);

    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('id, created_at, product_type, composite_score, four_b_brain, four_b_body, four_b_bat, four_b_ball')
      .eq('player_id', playerData.id)
      .order('created_at', { ascending: false });

    setSessions(sessionsData || []);

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scores" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Scores
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="mt-4">
          {playerId ? (
            <PlayerScoresSection playerId={playerId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No player data found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          {progressData.length > 1 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Progress Over Time</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Need more sessions to show progress</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
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
                        <BarChart3 className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}