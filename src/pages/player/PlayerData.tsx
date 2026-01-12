import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  BarChart3, 
  Activity, 
  ChevronRight,
  Upload,
  TrendingUp,
  MessageCircle,
  Video
} from "lucide-react";
import { PlayerScoresSection } from "@/components/player/PlayerScoresSection";
import { VideoAnalyzerTab } from "@/components/video-analyzer";
import { toast } from "sonner";

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

export default function PlayerData() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Get initial tab from URL params or default to "scores"
  const initialTab = searchParams.get('tab') || 'scores';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'scores') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', value);
    }
    setSearchParams(searchParams, { replace: true });
  };

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
      .select('id, name')
      .eq('email', user.email)
      .maybeSingle();

    if (!playerData) {
      setLoading(false);
      return;
    }

    setPlayerId(playerData.id);
    setPlayerName(playerData.name || '');

    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('id, created_at, product_type, composite_score, four_b_brain, four_b_body, four_b_bat, four_b_ball')
      .eq('player_id', playerData.id)
      .order('created_at', { ascending: false });

    setSessions(sessionsData || []);
    setLoading(false);
  };

  const handleAskRick = (context: string) => {
    // Store context in localStorage for the widget to pick up
    localStorage.setItem('coach-rick-preload-context', context);
    toast.info("Opening Coach Rick with your data...");
    // The widget will be opened by clicking the floating button or we scroll to it
    const widget = document.querySelector('[data-coach-rick-trigger]');
    if (widget) (widget as HTMLElement).click();
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
        <h1 className="text-2xl font-bold">My Scores</h1>
        <Button asChild variant="outline">
          <Link to="/player/new-session">
            <Upload className="h-4 w-4 mr-2" /> Upload Session
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scores" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Scores
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="video" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Video Analyzer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="mt-4">
          {playerId ? (
            <PlayerScoresSection 
              playerId={playerId} 
              playerName={playerName}
              onAskRick={handleAskRick}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No player data found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <Card className="border-slate-700 bg-slate-900/50">
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
                      className="flex items-center justify-between p-3 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium text-sm text-white">Swing Analysis</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(session.created_at!), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-right text-slate-400">
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

        <TabsContent value="video" className="mt-4">
          {playerId ? (
            <VideoAnalyzerTab
              playerId={playerId}
              playerName={playerName}
              source="player_upload"
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No player data found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}