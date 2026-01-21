import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Target, 
  ChevronRight,
  MessageSquare,
  Upload,
  Calendar,
  Clock,
  Video,
  Zap,
  Play,
  User,
  History,
  TrendingUp,
  Activity,
  Plus,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoSwingUploadModal } from "@/components/video-analyzer";
import { calculateComposite4B, getWeakestLink } from "@/lib/fourb-composite";
import { MembershipUpgradeBanner } from "@/components/player/MembershipUpgradeBanner";
import { ActiveSessionPanel } from "@/components/player/ActiveSessionPanel";
import { PrescribedVideos } from "@/components/player/PrescribedVideos";
import { LockerRoomMessages } from "@/components/player/LockerRoomMessages";
import { format } from "date-fns";

interface LatestScores {
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
}

interface PreviousSession {
  composite: number | null;
  brain: number | null;
  body: number | null;
  bat: number | null;
  ball: number | null;
  date: string;
}

interface RecentProgress {
  delta30Days: number | null;
  mostImproved: { b: string; delta: number } | null;
  lagging: { b: string; delta: number } | null;
  recentSessions: { date: string; composite: number }[];
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

interface SessionHistory {
  id: string;
  session_date: string;
  video_count: number;
  status: string;
  context?: string;
  source: 'video' | 'reboot';
  composite_score?: number | null;
  grade?: string | null;
}

export default function PlayerHome() {
  const navigate = useNavigate();
  const [player, setPlayer] = useState<any>(null);
  const [latestScores, setLatestScores] = useState<LatestScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInSeason, setIsInSeason] = useState(false);
  const [weeklyCheckinDue, setWeeklyCheckinDue] = useState(false);
  const [videoUploadOpen, setVideoUploadOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  const [weakestLink, setWeakestLink] = useState<string | null>(null);
  const [membershipPlan, setMembershipPlan] = useState<"assessment" | "monthly" | "annual" | "none">("none");
  const [isFoundingMember, setIsFoundingMember] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([]);
  const [previousSession, setPreviousSession] = useState<PreviousSession | null>(null);
  const [recentProgress, setRecentProgress] = useState<RecentProgress | null>(null);

  // Check for active session
  const checkActiveSession = useCallback(async (playerId: string) => {
    const { data } = await supabase
      .from('video_swing_sessions')
      .select('id')
      .eq('player_id', playerId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    
    setHasActiveSession(!!data);
    setActiveSessionId(data?.id || null);
  }, []);

  useEffect(() => {
    loadPlayerData();
  }, []);

  const loadPlayerData = useCallback(async () => {
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
      await Promise.all([
        loadLatestScores(playerData.id),
        loadSessionHistory(playerData.id),
        loadProgressData(playerData.id),
        checkActiveSession(playerData.id),
      ]);
      
      if (playerData.is_in_season) {
        await checkWeeklyCheckinStatus(playerData.id);
      }
      
      // Build next actions based on player state
      buildNextActions(playerData);
    }
    setLoading(false);
  }, [checkActiveSession]);

  // Realtime subscription for progress chart updates
  useEffect(() => {
    if (!player?.id) return;

    const channel = supabase
      .channel(`progress-updates-${player.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reboot_uploads',
          filter: `player_id=eq.${player.id}`,
        },
        (payload) => {
          console.log('[Realtime] New reboot session:', payload);
          // Refresh progress data and session history
          loadProgressData(player.id);
          loadSessionHistory(player.id);
          loadLatestScores(player.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reboot_uploads',
          filter: `player_id=eq.${player.id}`,
        },
        (payload) => {
          console.log('[Realtime] Reboot session updated:', payload);
          loadProgressData(player.id);
          loadSessionHistory(player.id);
          loadLatestScores(player.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'video_swing_sessions',
          filter: `player_id=eq.${player.id}`,
        },
        (payload) => {
          console.log('[Realtime] New video session:', payload);
          loadSessionHistory(player.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_swing_sessions',
          filter: `player_id=eq.${player.id}`,
        },
        (payload) => {
          console.log('[Realtime] Video session updated:', payload);
          loadSessionHistory(player.id);
          loadProgressData(player.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'swing_4b_scores',
          filter: `player_id=eq.${player.id}`,
        },
        (payload) => {
          console.log('[Realtime] New 4B score:', payload);
          loadLatestScores(player.id);
          loadProgressData(player.id);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [player?.id]);

  // Start a new session
  const handleStartSession = async () => {
    if (!player) return;
    
    setIsStartingSession(true);
    try {
      // Create a new video_swing_session with is_active = true
      const { data, error } = await supabase
        .from('video_swing_sessions')
        .insert({
          player_id: player.id,
          session_date: new Date().toISOString().split('T')[0],
          source: 'player_upload',
          context: 'practice',
          status: 'pending',
          video_count: 0,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      setActiveSessionId(data.id);
      setHasActiveSession(true);
      setVideoUploadOpen(true);
      toast.success('Session started! Upload 5-15 swings.');
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start session');
    } finally {
      setIsStartingSession(false);
    }
  };

  // Handle session end callback
  const handleSessionEnd = (sessionId: string, results: any) => {
    setHasActiveSession(false);
    setActiveSessionId(null);
    // Refresh all data
    loadPlayerData();
  };

  const loadSessionHistory = async (playerId: string) => {
    // Fetch from video_swing_sessions
    const { data: videoSessions } = await supabase
      .from('video_swing_sessions')
      .select('id, session_date, video_count, status, context')
      .eq('player_id', playerId)
      .order('session_date', { ascending: false })
      .limit(10);
    
    // Fetch from reboot_uploads (3D sensor sessions)
    const { data: rebootSessions } = await supabase
      .from('reboot_uploads')
      .select('id, session_date, composite_score, grade, processing_status, upload_source')
      .eq('player_id', playerId)
      .order('session_date', { ascending: false })
      .limit(10);
    
    // Merge and sort both sources
    const merged: SessionHistory[] = [
      ...(videoSessions || []).map(s => ({
        ...s,
        source: 'video' as const,
        composite_score: null,
        grade: null,
        context: s.context || 'Practice',
      })),
      ...(rebootSessions || []).map(s => ({
        id: s.id,
        session_date: s.session_date,
        video_count: 1, // Reboot sessions are single-session
        status: s.processing_status === 'complete' ? 'analyzed' : s.processing_status || 'pending',
        context: s.upload_source === 'reboot_api' ? 'Reboot 3D' : '3D Sensor',
        source: 'reboot' as const,
        composite_score: s.composite_score,
        grade: s.grade,
      })),
    ];
    
    // Sort by date descending and limit to 5
    merged.sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
    setSessionHistory(merged.slice(0, 5));
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
    // Fetch latest two scores to calculate delta
    const { data: fourbData } = await supabase
      .from('swing_4b_scores')
      .select('brain_score, body_score, bat_score, ball_score, created_at')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(2);

    if (fourbData?.[0]) {
      const latest = fourbData[0];
      const scores = {
        brain_score: latest.brain_score,
        body_score: latest.body_score,
        bat_score: latest.bat_score,
        ball_score: latest.ball_score,
      };
      setLatestScores(scores);
      setWeakestLink(getWeakestLink(
        scores.brain_score,
        scores.body_score,
        scores.bat_score,
        scores.ball_score
      ));
      
      // Set previous session for delta calculation
      if (fourbData[1]) {
        const prev = fourbData[1];
        setPreviousSession({
          composite: calculateComposite4B(prev.brain_score, prev.body_score, prev.bat_score, prev.ball_score).composite,
          brain: prev.brain_score,
          body: prev.body_score,
          bat: prev.bat_score,
          ball: prev.ball_score,
          date: prev.created_at || '',
        });
      }
      return;
    }

    // Fallback to sessions table
    const { data } = await supabase
      .from('sessions')
      .select('four_b_brain, four_b_body, four_b_bat, four_b_ball, created_at')
      .eq('player_id', playerId)
      .not('four_b_brain', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2);

    if (data?.[0]) {
      const latest = data[0];
      const scores = {
        brain_score: latest.four_b_brain,
        body_score: latest.four_b_body,
        bat_score: latest.four_b_bat,
        ball_score: latest.four_b_ball,
      };
      setLatestScores(scores);
      setWeakestLink(getWeakestLink(
        scores.brain_score,
        scores.body_score,
        scores.bat_score,
        scores.ball_score
      ));
      
      if (data[1]) {
        const prev = data[1];
        setPreviousSession({
          composite: calculateComposite4B(prev.four_b_brain, prev.four_b_body, prev.four_b_bat, prev.four_b_ball).composite,
          brain: prev.four_b_brain,
          body: prev.four_b_body,
          bat: prev.four_b_bat,
          ball: prev.four_b_ball,
          date: prev.created_at || '',
        });
      }
    }
  };

  const loadProgressData = async (playerId: string) => {
    // Get sessions from the last 30 days for progress calculation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentScores } = await supabase
      .from('swing_4b_scores')
      .select('brain_score, body_score, bat_score, ball_score, composite_score, created_at')
      .eq('player_id', playerId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (recentScores && recentScores.length >= 2) {
      const first = recentScores[0];
      const last = recentScores[recentScores.length - 1];

      // Calculate 30-day delta
      const delta30Days = (last.composite_score || 0) - (first.composite_score || 0);

      // Find most improved and lagging B
      const bScores = [
        { b: 'Brain', first: first.brain_score, last: last.brain_score },
        { b: 'Body', first: first.body_score, last: last.body_score },
        { b: 'Bat', first: first.bat_score, last: last.bat_score },
        { b: 'Ball', first: first.ball_score, last: last.ball_score },
      ].map(s => ({
        ...s,
        delta: (s.last || 0) - (s.first || 0),
      }));

      const sorted = [...bScores].sort((a, b) => b.delta - a.delta);
      const mostImproved = sorted[0].delta > 0 ? { b: sorted[0].b, delta: sorted[0].delta } : null;
      const lagging = sorted[sorted.length - 1].delta < sorted[0].delta 
        ? { b: sorted[sorted.length - 1].b, delta: sorted[sorted.length - 1].delta }
        : null;

      // Get recent sessions for mini chart (limit to 10)
      const recentSessions = recentScores
        .slice(-10)
        .filter(s => s.composite_score !== null)
        .map(s => ({
          date: format(new Date(s.created_at || new Date()), 'MMM d'),
          composite: s.composite_score || 0,
        }));

      setRecentProgress({
        delta30Days,
        mostImproved,
        lagging,
        recentSessions,
      });
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
      {/* Player Header */}
      {player && (
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{player.name || 'Player'}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              {player.level && (
                <Badge variant="secondary" className="text-xs">{player.level}</Badge>
              )}
              {player.handedness && (
                <Badge variant="outline" className="text-xs">
                  {player.handedness === 'R' ? 'Right-Handed' : player.handedness === 'L' ? 'Left-Handed' : 'Switch'}
                </Badge>
              )}
              {player.position && (
                <Badge variant="outline" className="text-xs">{player.position}</Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section Title */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-muted-foreground">My Swing Lab</h2>
        <p className="text-sm text-muted-foreground">
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
          
          {/* GOATY-style delta line */}
          {previousSession && latestScores && (
            <div className="flex items-center gap-2 text-sm mt-2">
              <span className="text-muted-foreground">Last session: {previousSession.composite}</span>
              <span className="text-muted-foreground">•</span>
              <span className={cn(
                "font-semibold",
                (compositeData.composite - (previousSession.composite || 0)) > 0 
                  ? "text-emerald-500" 
                  : (compositeData.composite - (previousSession.composite || 0)) < 0 
                  ? "text-red-500" 
                  : "text-muted-foreground"
              )}>
                Change: {(compositeData.composite - (previousSession.composite || 0)) > 0 ? '+' : ''}
                {compositeData.composite - (previousSession.composite || 0)} points
              </span>
            </div>
          )}
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

      {/* Progress Chart - Moved from Progress tab */}
      {recentProgress && recentProgress.recentSessions.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Score Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-end gap-1">
              {recentProgress.recentSessions.map((session, i, arr) => {
                const min = Math.min(...arr.map(s => s.composite), 20);
                const max = Math.max(...arr.map(s => s.composite), 80);
                const range = max - min || 1;
                const height = ((session.composite - min) / range) * 100;
                const isLast = i === arr.length - 1;
                const prevScore = i > 0 ? arr[i - 1].composite : null;
                const delta = prevScore !== null ? session.composite - prevScore : null;

                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1 min-w-0"
                  >
                    <div className="relative w-full">
                      {isLast && delta !== null && (
                        <div className={cn(
                          "absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap",
                          delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground"
                        )}>
                          {delta > 0 ? '+' : ''}{Math.round(delta)}
                        </div>
                      )}
                      <div 
                        className={cn(
                          "w-full rounded-t transition-all",
                          isLast ? "bg-primary" : "bg-muted/50"
                        )}
                        style={{ height: `${Math.max(height, 8)}%`, minHeight: '8px' }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                      {session.date}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Progress summary */}
            <div className="flex items-center justify-between mt-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">30-day change:</span>
                <span className={cn(
                  "font-semibold",
                  recentProgress.delta30Days && recentProgress.delta30Days > 0 ? "text-emerald-400" : 
                  recentProgress.delta30Days && recentProgress.delta30Days < 0 ? "text-red-400" : "text-muted-foreground"
                )}>
                  {recentProgress.delta30Days && recentProgress.delta30Days > 0 ? '+' : ''}
                  {Math.round(recentProgress.delta30Days || 0)} pts
                </span>
              </div>
              {recentProgress.mostImproved && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  <span>{recentProgress.mostImproved.b}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prescribed for You - Video recommendations based on weakest 4B */}
      {player && weakestLink && (
        <PrescribedVideos 
          playerId={player.id} 
          weakestCategory={weakestLink}
        />
      )}

      {/* Locker Room Messages - AI coaching messages */}
      {player && (
        <LockerRoomMessages 
          playerId={player.id} 
          compact
          maxMessages={5}
        />
      )}

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

      {/* Session Management - Session-Based Architecture */}
      {player && (
        hasActiveSession ? (
          <ActiveSessionPanel
            playerId={player.id}
            onSessionEnd={handleSessionEnd}
            onUploadClick={(sessionId) => {
              setActiveSessionId(sessionId);
              setVideoUploadOpen(true);
            }}
          />
        ) : (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Swing Analysis
              </CardTitle>
              <CardDescription>
                Start a session, upload 5-15 swings, then end it to get your 4B scores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleStartSession}
                disabled={isStartingSession}
                size="lg"
                className="w-full sm:w-auto"
              >
                {isStartingSession ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Start New Session
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )
      )}

      {/* Session History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Recent Sessions
          </CardTitle>
          <CardDescription>Your past swing analysis sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionHistory.length > 0 ? (
            <div className="space-y-2">
              {sessionHistory.map(session => (
                <Link
                  key={session.id}
                  to={session.source === 'video' 
                    ? `/player/data?tab=video&session=${session.id}` 
                    : `/player/data?tab=scores`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {session.source === 'reboot' ? (
                      <Activity className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Video className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(session.session_date), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.source === 'reboot' ? 'Reboot 3D' : `${session.video_count} video${session.video_count !== 1 ? 's' : ''}`} • {session.context || 'Practice'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Show composite score if available */}
                    {session.composite_score && (
                      <span className="text-sm font-bold text-primary">
                        {Math.round(session.composite_score)}
                      </span>
                    )}
                    {session.grade && (
                      <Badge variant="outline" className="text-xs">
                        {session.grade}
                      </Badge>
                    )}
                    {!session.composite_score && (
                      <Badge 
                        variant={session.status === 'analyzed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {session.status === 'analyzed' ? 'Analyzed' : session.status === 'pending' ? 'Pending' : session.status}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
              <Button variant="link" className="p-0 h-auto text-sm" asChild>
                <Link to="/player/data?tab=scores">View all sessions →</Link>
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No sessions yet</p>
              <p className="text-xs mt-1">Upload your first swing to get started</p>
            </div>
          )}
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
          activeSessionId={activeSessionId || undefined}
          onSuccess={() => {
            // Refresh data after upload
            loadPlayerData();
          }}
        />
      )}
    </div>
  );
}
