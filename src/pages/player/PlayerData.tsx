import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Video,
  Loader2,
  LayoutDashboard,
  Database,
  CheckCircle2,
  Lock,
  ArrowRight
} from "lucide-react";
import { PlayerScoresSection } from "@/components/player/PlayerScoresSection";
import { VideoAnalyzerTab } from "@/components/video-analyzer";
import { Player4BScorecard } from "@/components/scorecards";
import { usePlayerScorecard } from "@/hooks/usePlayerScorecard";
import { UnifiedDataUploadModal } from "@/components/UnifiedDataUploadModal";
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
  source?: 'session' | '2d_video';
  analysis_type?: string;
  leak_detected?: string;
  grade?: string;
}

export default function PlayerData() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  
  // Scorecard hook
  const { 
    data: scorecardData, 
    loading: scorecardLoading, 
    timeWindow, 
    setTimeWindow,
    refresh: refreshScorecard 
  } = usePlayerScorecard(playerId);
  
  // Get initial tab from URL params or default to "scorecard"
  const initialTab = searchParams.get('tab') || 'scorecard';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'scorecard') {
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

    // Fetch traditional sessions
    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('id, created_at, product_type, composite_score, four_b_brain, four_b_body, four_b_bat, four_b_ball')
      .eq('player_id', playerData.id)
      .order('created_at', { ascending: false });

    // Fetch 2D video analyses from reboot_uploads
    const { data: videoAnalysesData } = await supabase
      .from('reboot_uploads')
      .select('id, created_at, analysis_type, composite_score, brain_score, body_score, bat_score, grade, leak_detected, processing_status')
      .eq('player_id', playerData.id)
      .eq('analysis_type', '2d_video')
      .eq('processing_status', 'complete')
      .order('created_at', { ascending: false });

    // Combine and sort all sessions
    const combinedSessions: Session[] = [
      ...(sessionsData || []).map(s => ({
        ...s,
        source: 'session' as const,
      })),
      ...(videoAnalysesData || []).map(v => ({
        id: v.id,
        created_at: v.created_at || new Date().toISOString(),
        product_type: '2d_video',
        composite_score: v.composite_score,
        four_b_brain: v.brain_score,
        four_b_body: v.body_score,
        four_b_bat: v.bat_score,
        four_b_ball: null,
        source: '2d_video' as const,
        analysis_type: v.analysis_type,
        leak_detected: v.leak_detected,
        grade: v.grade,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setSessions(combinedSessions);
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
        <Button onClick={() => navigate('/player')} variant="outline">
          <Upload className="h-4 w-4 mr-2" /> Upload Swings
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="scorecard" className="flex items-center gap-1 text-xs">
            <LayoutDashboard className="h-3 w-3" />
            <span className="hidden sm:inline">4B Card</span>
          </TabsTrigger>
          <TabsTrigger value="sources" className="flex items-center gap-1 text-xs">
            <Database className="h-3 w-3" />
            <span className="hidden sm:inline">Sources</span>
          </TabsTrigger>
          <TabsTrigger value="scores" className="flex items-center gap-1 text-xs">
            <TrendingUp className="h-3 w-3" />
            <span className="hidden sm:inline">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-1 text-xs">
            <Activity className="h-3 w-3" />
            <span className="hidden sm:inline">Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="video" className="flex items-center gap-1 text-xs">
            <Video className="h-3 w-3" />
            <span className="hidden sm:inline">Video</span>
          </TabsTrigger>
        </TabsList>

        {/* 4B Scorecard Tab */}
        <TabsContent value="scorecard" className="mt-4">
          {scorecardLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : scorecardData ? (
            <Player4BScorecard
              data={scorecardData}
              timeWindow={timeWindow}
              onTimeWindowChange={setTimeWindow}
              onUploadVideo={() => handleTabChange('video')}
              onUploadData={() => setUploadModalOpen(true)}
              onViewVideoSession={(sessionId) => {
                searchParams.set('tab', 'video');
                searchParams.set('session', sessionId);
                setSearchParams(searchParams);
                setActiveTab('video');
              }}
              onWeeklyCheckin={() => navigate('/player/weekly-checkin')}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No player data found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Data Sources Tab */}
        <TabsContent value="sources" className="mt-4">
          <DataSourcesSection onUploadData={() => setUploadModalOpen(true)} />
        </TabsContent>
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
                  {sessions.map(session => {
                    const is2DVideo = session.source === '2d_video';
                    const linkTo = is2DVideo ? `/player/data?tab=sessions&view=${session.id}` : `/results/${session.id}`;
                    
                    return (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        onClick={() => {
                          if (is2DVideo) {
                            // Show 2D analysis in a modal or expand inline
                            toast.info("2D Video Analysis - viewing inline");
                          } else {
                            navigate(`/results/${session.id}`);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {is2DVideo ? (
                            <Video className="h-4 w-4 text-amber-500" />
                          ) : (
                            <BarChart3 className="h-4 w-4 text-primary" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-white">
                                {is2DVideo ? '2D Video Analysis' : 'Swing Analysis'}
                              </p>
                              {is2DVideo && session.leak_detected && session.leak_detected !== 'CLEAN_TRANSFER' && (
                                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                                  {session.leak_detected.replace(/_/g, ' ')}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(session.created_at!), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-right text-slate-400">
                            {session.composite_score && (
                              <span className="font-medium text-white mr-2">{session.composite_score}</span>
                            )}
                            {session.grade && is2DVideo && (
                              <span className="text-slate-500">({session.grade})</span>
                            )}
                            {!is2DVideo && (
                              <>
                                {session.four_b_brain && <span>B:{session.four_b_brain} </span>}
                                {session.four_b_body && <span>Bo:{session.four_b_body} </span>}
                                {session.four_b_bat && <span>Ba:{session.four_b_bat}</span>}
                              </>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
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

      {/* Upload Modal */}
      {playerId && (
        <UnifiedDataUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          playerId={playerId}
          playerName={playerName}
          onSuccess={() => {
            refreshScorecard();
            setUploadModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ===== Data Sources Section Component =====
interface DataSource {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'available';
  statusText: string;
  description: string;
  buttonText: string;
  metrics?: string[];
  badge?: string;
}

const dataSources: DataSource[] = [
  {
    id: 'video',
    name: 'VIDEO ANALYSIS',
    icon: '📹',
    status: 'connected',
    statusText: 'Connected',
    description: 'Powers your BODY and BRAIN scores',
    buttonText: 'Upload Video',
  },
  {
    id: 'diamond-kinetics',
    name: 'DIAMOND KINETICS',
    icon: '🦇',
    status: 'available',
    statusText: 'Connect DK Account',
    description: 'Powers your BAT score with real sensor data',
    buttonText: 'Connect Diamond Kinetics',
    metrics: ['Bat Speed', 'Attack Angle', 'Hand Speed'],
  },
  {
    id: 'batted-ball',
    name: 'BATTED BALL DATA',
    icon: '⚾',
    status: 'available',
    statusText: 'Upload Data',
    description: 'Powers your BALL score with real outcomes',
    buttonText: 'Upload Batted Ball Data',
    metrics: ['Exit Velo', 'Launch Angle', 'Distance'],
  },
  {
    id: 'reboot',
    name: 'REBOOT MOTION',
    icon: '🎯',
    status: 'available',
    statusText: 'Upload 3D Capture',
    description: 'Upgrades BODY and BRAIN to precise 3D measurement',
    buttonText: 'Upload Reboot File',
    badge: 'PRO',
  },
];

const dataCoverage = [
  { score: 'BODY', percentage: 75, source: 'video', color: 'bg-blue-500' },
  { score: 'BRAIN', percentage: 75, source: 'video', color: 'bg-purple-500' },
  { score: 'BAT', percentage: 0, source: 'no DK connected', color: 'bg-orange-500' },
  { score: 'BALL', percentage: 0, source: 'no batted ball data', color: 'bg-green-500' },
];

function DataSourcesSection({ onUploadData }: { onUploadData: () => void }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-2">MY DATA SOURCES</h2>
        <p className="text-sm text-muted-foreground">
          The more data you connect, the stronger your 4B Score becomes.
        </p>
      </div>

      {/* Data Source Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {dataSources.map((source) => (
          <Card key={source.id} className="relative bg-slate-900/50 border-slate-700 p-4">
            {source.badge && (
              <Badge className="absolute top-3 right-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs">
                {source.badge}
              </Badge>
            )}

            <div className="flex items-start gap-3 mb-3">
              <div className="text-2xl">{source.icon}</div>
              <div className="flex-1">
                <h3 className="font-bold text-white text-sm">{source.name}</h3>
                <div className="flex items-center gap-1 mt-0.5">
                  {source.status === 'connected' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-500">{source.statusText}</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">{source.statusText}</span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-3">{source.description}</p>

            {source.id === 'batted-ball' && source.status !== 'connected' && (
              <p className="text-[10px] text-slate-500 mb-3">
                Accepts: Hittrax, Rapsodo, Trackman CSV
              </p>
            )}

            <Button 
              size="sm"
              className={`w-full text-xs ${
                source.status === 'connected' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700'
              }`}
              onClick={source.id === 'video' || source.id === 'batted-ball' ? onUploadData : undefined}
            >
              {source.status === 'connected' ? (
                <>
                  <Upload className="w-3 h-3 mr-1" />
                  Upload More
                </>
              ) : (
                source.buttonText
              )}
            </Button>
          </Card>
        ))}
      </div>

      {/* Coverage Section */}
      <Card className="bg-slate-900/50 border-slate-700 p-4">
        <h3 className="font-bold text-white text-sm mb-4 text-center">YOUR 4B DATA COVERAGE</h3>
        
        <div className="space-y-3">
          {dataCoverage.map((item) => (
            <div key={item.score} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">{item.score}</span>
                <span className="text-slate-400">
                  {item.percentage}% ({item.source})
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${item.color} transition-all duration-500`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <ArrowRight className="w-3 h-3 text-orange-400" />
            <span className="text-orange-400 font-medium">Connect Diamond Kinetics</span>
            <span>to complete your BAT score</span>
          </p>
        </div>
      </Card>
    </div>
  );
}