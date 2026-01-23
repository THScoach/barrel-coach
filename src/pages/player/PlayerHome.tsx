/**
 * Player Home - Stack-style mobile-first dashboard
 * Clean 4B gauge grid, large CTA, quick actions, and prescriptions feed
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Target, 
  ChevronRight,
  MessageSquare,
  User,
  History,
  Activity,
  Video,
  Bell,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoSwingUploadModal } from "@/components/video-analyzer";
import { calculateComposite4B, getWeakestLink } from "@/lib/fourb-composite";
import { ActiveSessionPanel } from "@/components/player/ActiveSessionPanel";
import { FourBGaugeGrid } from "@/components/player/FourBGaugeGrid";
import { QuickActionsRow } from "@/components/player/QuickActionsRow";
import { StartAssessmentCTA } from "@/components/player/StartAssessmentCTA";
import { RecentPrescriptionsFeed } from "@/components/player/RecentPrescriptionsFeed";
import { ProcessingStatusBadge } from "@/components/player/ProcessingStatusBadge";
import { format } from "date-fns";

interface LatestScores {
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
}

interface PreviousSession {
  composite: number | null;
  date: string;
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
  const [videoUploadOpen, setVideoUploadOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [weakestLink, setWeakestLink] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([]);
  const [previousSession, setPreviousSession] = useState<PreviousSession | null>(null);
  const [processingStatus, setProcessingStatus] = useState<'pending' | 'processing' | 'complete' | null>(null);

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
      await Promise.all([
        loadLatestScores(playerData.id),
        loadSessionHistory(playerData.id),
        checkActiveSession(playerData.id),
        checkProcessingStatus(playerData.id),
      ]);
    }
    setLoading(false);
  }, [checkActiveSession]);

  // Realtime subscription for progress updates
  useEffect(() => {
    if (!player?.id) return;

    const channel = supabase
      .channel(`player-home-${player.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'swing_4b_scores',
          filter: `player_id=eq.${player.id}`,
        },
        () => {
          loadLatestScores(player.id);
          setProcessingStatus('complete');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reboot_uploads',
          filter: `player_id=eq.${player.id}`,
        },
        () => {
          loadSessionHistory(player.id);
          loadLatestScores(player.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [player?.id]);

  // Start a new session
  const handleStartSession = async () => {
    if (!player) return;
    
    setIsStartingSession(true);
    try {
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
  const handleSessionEnd = () => {
    setHasActiveSession(false);
    setActiveSessionId(null);
    setProcessingStatus('processing');
    loadPlayerData();
  };

  // Handle "Why?" click - navigate to drills for that category
  const handleWhyClick = (category: 'brain' | 'body' | 'bat' | 'ball') => {
    navigate(`/player/drills?focus=${category}`);
  };

  const checkProcessingStatus = async (playerId: string) => {
    const { data } = await supabase
      .from('video_swing_sessions')
      .select('status')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.status === 'processing' || data?.status === 'pending') {
      setProcessingStatus(data.status as 'pending' | 'processing');
    } else {
      setProcessingStatus(null);
    }
  };

  const loadSessionHistory = async (playerId: string) => {
    const { data: videoSessions } = await supabase
      .from('video_swing_sessions')
      .select('id, session_date, video_count, status, context')
      .eq('player_id', playerId)
      .order('session_date', { ascending: false })
      .limit(5);
    
    const { data: rebootSessions } = await supabase
      .from('reboot_uploads')
      .select('id, session_date, composite_score, grade, processing_status, upload_source')
      .eq('player_id', playerId)
      .order('session_date', { ascending: false })
      .limit(5);
    
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
        video_count: 1,
        status: s.processing_status === 'complete' ? 'analyzed' : s.processing_status || 'pending',
        context: s.upload_source === 'reboot_api' ? 'Reboot 3D' : '3D Sensor',
        source: 'reboot' as const,
        composite_score: s.composite_score,
        grade: s.grade,
      })),
    ];
    
    merged.sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
    setSessionHistory(merged.slice(0, 5));
  };

  const loadLatestScores = async (playerId: string) => {
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
      
      if (fourbData[1]) {
        const prev = fourbData[1];
        setPreviousSession({
          composite: calculateComposite4B(prev.brain_score, prev.body_score, prev.bat_score, prev.ball_score).composite,
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
          date: prev.created_at || '',
        });
      }
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center md:ml-56">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  const compositeData = getCompositeData();
  const delta = previousSession?.composite 
    ? compositeData.composite - previousSession.composite 
    : null;

  return (
    <div className="min-h-screen bg-slate-950 md:ml-56">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        
        {/* Header - Greeting with player name */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
              <User className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                {player?.name ? `Hey, ${player.name.split(' ')[0]}!` : 'Welcome!'}
              </h1>
              <p className="text-sm text-slate-400">Let's catch some barrels.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {processingStatus && (
              <ProcessingStatusBadge status={processingStatus} />
            )}
            <Button variant="ghost" size="icon" asChild>
              <Link to="/player/messages">
                <Bell className="h-5 w-5 text-slate-400" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Composite Score Header */}
        <div className="text-center py-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Catch Barrel Score</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-black text-white">
              {compositeData.composite || '—'}
            </span>
            {delta !== null && delta !== 0 && (
              <div className={cn(
                "flex items-center gap-0.5 text-sm font-semibold",
                delta > 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {delta > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {delta > 0 ? '+' : ''}{delta}
              </div>
            )}
          </div>
          <Badge variant="outline" className="mt-2 border-slate-700 text-slate-300">
            {compositeData.grade}
          </Badge>
        </div>

        {/* 4B Gauge Grid - Stack-style 2x2 */}
        <FourBGaugeGrid
          brain={latestScores?.brain_score ?? null}
          body={latestScores?.body_score ?? null}
          bat={latestScores?.bat_score ?? null}
          ball={latestScores?.ball_score ?? null}
          weakestLink={weakestLink}
          onWhyClick={handleWhyClick}
        />

        {/* Quick Actions Row */}
        <QuickActionsRow
          onShareProgress={() => toast.info('Share feature coming soon!')}
          onSpecialSession={() => handleStartSession()}
          onViewHistory={() => navigate('/player/data?tab=scores')}
          onChangeProgram={() => navigate('/player/drills')}
          onCompletedPrograms={() => navigate('/player/data?tab=completed')}
        />

        {/* Start Assessment CTA */}
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
            <StartAssessmentCTA
              onStart={handleStartSession}
              isLoading={isStartingSession}
              hasActiveSession={hasActiveSession}
            />
          )
        )}

        {/* Recent Prescriptions Feed */}
        {player && (
          <RecentPrescriptionsFeed
            playerId={player.id}
            weakestCategory={weakestLink}
            onVideoClick={(video) => {
              navigate(`/player/drills?video=${video.video_id}`);
            }}
            maxItems={4}
          />
        )}

        {/* Session History - Compact */}
        {sessionHistory.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Sessions
              </h3>
              <Button variant="link" className="text-xs p-0 h-auto text-slate-500" asChild>
                <Link to="/player/data?tab=scores">View all →</Link>
              </Button>
            </div>

            <div className="space-y-2">
              {sessionHistory.slice(0, 3).map(session => (
                <Link
                  key={session.id}
                  to={session.source === 'video' 
                    ? `/player/data?tab=video&session=${session.id}` 
                    : `/player/data?tab=scores`}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {session.source === 'reboot' ? (
                      <Activity className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Video className="h-4 w-4 text-slate-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">
                        {format(new Date(session.session_date), 'MMM d')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {session.context}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.composite_score && (
                      <span className="text-sm font-bold text-white">
                        {Math.round(session.composite_score)}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button 
            variant="outline" 
            className="h-12 border-slate-700 bg-slate-800/50 text-white hover:bg-slate-700/50" 
            asChild
          >
            <Link to="/player/data">
              <Target className="h-4 w-4 mr-2" />
              My Scores
            </Link>
          </Button>
          <Button 
            variant="outline" 
            className="h-12 border-slate-700 bg-slate-800/50 text-white hover:bg-slate-700/50" 
            asChild
          >
            <Link to="/player/messages">
              <MessageSquare className="h-4 w-4 mr-2" />
              Coach Rick
            </Link>
          </Button>
        </div>
      </div>

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
            loadPlayerData();
          }}
        />
      )}
    </div>
  );
}
