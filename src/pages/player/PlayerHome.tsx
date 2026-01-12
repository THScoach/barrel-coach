import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Target, 
  ChevronRight,
  MessageSquare,
  Upload,
  Calendar,
  Clock,
  Video,
  Zap,
  Play
} from "lucide-react";
import { VideoSwingUploadModal } from "@/components/video-analyzer";
import { calculateComposite4B, getGrade, getWeakestLink } from "@/lib/fourb-composite";
import { MembershipUpgradeBanner } from "@/components/player/MembershipUpgradeBanner";

interface LatestScores {
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
}

interface NextAction {
  id: string;
  type: 'drill' | 'upload' | 'retest' | 'checkin';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  link?: string;
  action?: () => void;
}

export default function PlayerHome() {
  const [player, setPlayer] = useState<any>(null);
  const [latestScores, setLatestScores] = useState<LatestScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInSeason, setIsInSeason] = useState(false);
  const [weeklyCheckinDue, setWeeklyCheckinDue] = useState(false);
  const [videoUploadOpen, setVideoUploadOpen] = useState(false);
  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  const [weakestLink, setWeakestLink] = useState<string | null>(null);
  const [membershipPlan, setMembershipPlan] = useState<"assessment" | "monthly" | "annual" | "none">("none");
  const [isFoundingMember, setIsFoundingMember] = useState(false);

  useEffect(() => {
    loadPlayerData();
  }, []);

  const loadPlayerData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();

    if (playerData) {
      setPlayer(playerData);
      setIsInSeason(playerData.is_in_season || false);
      await loadLatestScores(playerData.id);
      
      if (playerData.is_in_season) {
        await checkWeeklyCheckinStatus(playerData.id);
      }
      
      // Build next actions based on player state
      buildNextActions(playerData);
    }
    setLoading(false);
  };

  const checkWeeklyCheckinStatus = async (playerId: string) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const { data: report } = await supabase
      .from('game_weekly_reports')
      .select('status, completed_at')
      .eq('player_id', playerId)
      .eq('week_start', weekStartStr)
      .single();

    if (report?.status === 'completed') {
      setWeeklyCheckinDue(false);
    } else {
      setWeeklyCheckinDue(true);
    }
  };

  const loadLatestScores = async (playerId: string) => {
    // First try fourb_scores table (from Reboot)
    const { data: fourbData } = await supabase
      .from('fourb_scores')
      .select('brain_score, body_score, bat_score, ball_score')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fourbData?.[0]) {
      const scores = {
        brain_score: fourbData[0].brain_score,
        body_score: fourbData[0].body_score,
        bat_score: fourbData[0].bat_score,
        ball_score: fourbData[0].ball_score,
      };
      setLatestScores(scores);
      setWeakestLink(getWeakestLink(
        scores.brain_score,
        scores.body_score,
        scores.bat_score,
        scores.ball_score
      ));
      return;
    }

    // Fallback to sessions table
    const { data } = await supabase
      .from('sessions')
      .select('four_b_brain, four_b_body, four_b_bat, four_b_ball')
      .eq('player_id', playerId)
      .not('four_b_brain', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data?.[0]) {
      const scores = {
        brain_score: data[0].four_b_brain,
        body_score: data[0].four_b_body,
        bat_score: data[0].four_b_bat,
        ball_score: data[0].four_b_ball,
      };
      setLatestScores(scores);
      setWeakestLink(getWeakestLink(
        scores.brain_score,
        scores.body_score,
        scores.bat_score,
        scores.ball_score
      ));
    }
  };

  const buildNextActions = (playerData: any) => {
    const actions: NextAction[] = [];
    
    // Always suggest uploading if they haven't recently
    actions.push({
      id: 'upload',
      type: 'upload',
      title: 'Upload New Swings',
      description: 'Keep me updated on your progress',
      priority: 'high',
      action: () => setVideoUploadOpen(true)
    });

    // If weakest link identified, suggest drill
    if (weakestLink) {
      const drillMap: Record<string, { title: string; desc: string }> = {
        body: { title: 'Ground Flow Drill', desc: 'Build from the ground up' },
        bat: { title: 'Connection Drill', desc: 'Tighten your transfer' },
        ball: { title: 'Exit Velo Session', desc: 'Focus on barrel awareness' },
        brain: { title: 'Timing Drill', desc: 'Sharpen your approach' }
      };
      const drill = drillMap[weakestLink] || { title: 'Review Drills', desc: 'Fix your weak link' };
      actions.push({
        id: 'drill',
        type: 'drill',
        title: drill.title,
        description: drill.desc,
        priority: 'medium',
        link: '/player/drills'
      });
    }

    setNextActions(actions.slice(0, 3)); // Max 3 actions
  };

  const getCompositeData = () => {
    if (!latestScores) return { composite: 0, grade: 'No Data' };
    return calculateComposite4B(
      latestScores.brain_score,
      latestScores.body_score,
      latestScores.bat_score,
      latestScores.ball_score
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500/50 bg-red-500/5';
      case 'medium': return 'border-yellow-500/50 bg-yellow-500/5';
      default: return 'border-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 md:ml-56">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const compositeData = getCompositeData();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 md:ml-56">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">My Swing Lab</h1>
        <p className="text-muted-foreground">
          Your current state. Your next step.
        </p>
      </div>

      {/* Membership Status Banner */}
      <MembershipUpgradeBanner 
        currentPlan={membershipPlan} 
        isFoundingMember={isFoundingMember} 
      />

      {/* Weekly Check-In Card (for in-season players) */}
      {isInSeason && weeklyCheckinDue && (
        <Card className="border-accent bg-accent/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">Weekly Check-In</h3>
                  <p className="text-sm text-muted-foreground">
                    How'd last week go?
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/player/weekly-checkin">
                  <Calendar className="w-4 h-4 mr-2" />
                  Start
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Catch Barrel Score Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Catch Barrel Score
              </CardTitle>
              <CardDescription>Your current movement pattern</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-primary">
                {compositeData.composite || '--'}
              </div>
              <Badge variant="outline" className="mt-1">
                {compositeData.grade}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 4B Score Grid */}
          {latestScores ? (
            <>
              <div className="grid grid-cols-4 gap-2 text-center mb-4">
                {[
                  { key: 'brain', label: 'Brain', score: latestScores.brain_score },
                  { key: 'body', label: 'Body', score: latestScores.body_score },
                  { key: 'bat', label: 'Bat', score: latestScores.bat_score },
                  { key: 'ball', label: 'Ball', score: latestScores.ball_score },
                ].map(item => (
                  <div 
                    key={item.key} 
                    className={`p-3 rounded-lg ${weakestLink === item.key ? 'bg-red-500/10 border border-red-500/30' : 'bg-muted/50'}`}
                  >
                    <p className="text-2xl font-bold">{item.score || '--'}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    {weakestLink === item.key && (
                      <Badge variant="destructive" className="text-[10px] mt-1">
                        Focus
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="link" className="p-0 h-auto text-sm" asChild>
                <Link to="/player/data">View full breakdown →</Link>
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-3">No scores yet</p>
              <Button onClick={() => setVideoUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Your First Swing
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next Actions */}
      {nextActions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Next Actions
            </CardTitle>
            <CardDescription>1-3 things to do right now</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {nextActions.map(action => (
              <div 
                key={action.id}
                className={`p-4 rounded-lg border ${getPriorityColor(action.priority)} cursor-pointer hover:bg-muted/50 transition-colors`}
                onClick={() => action.action ? action.action() : null}
              >
                {action.link ? (
                  <Link to={action.link} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    {action.type === 'upload' && <Upload className="h-5 w-5 text-primary" />}
                    {action.type === 'drill' && <Play className="h-5 w-5 text-primary" />}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Upload Swings
          </CardTitle>
          <CardDescription>
            This is how I keep eyes on you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setVideoUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Videos
            </Button>
            <Button variant="outline" asChild>
              <Link to="/player/data?tab=video">
                View Sessions
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-between" asChild>
            <Link to="/player/data">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                My Scores & Progress
              </span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" className="w-full justify-between" asChild>
            <Link to="/player/messages">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Message Coach Rick
              </span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Video Upload Modal */}
      {player && (
        <VideoSwingUploadModal
          open={videoUploadOpen}
          onOpenChange={setVideoUploadOpen}
          playerId={player.id}
          playerName={player.name || 'Player'}
          source="player_upload"
          onSuccess={() => {
            // Refresh data after upload
            loadPlayerData();
          }}
        />
      )}
    </div>
  );
}
