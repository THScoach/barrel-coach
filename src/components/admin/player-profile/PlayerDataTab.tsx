/**
 * Rick Lab Player Data Tab - Interactive Control Panel
 * =====================================================
 * Fast, interactive dashboard: 4B tiles → detailed reports → sessions
 * Optimized for 3-second navigation to any data point.
 */

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  Upload, 
  FileText, 
  Video, 
  AlertCircle, 
  Loader2,
  ExternalLink,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Database,
  LineChart
} from "lucide-react";
import { UnifiedDataUploadModal } from "@/components/UnifiedDataUploadModal";
import { getBrandDisplayName, LaunchMonitorBrand } from "@/lib/csv-detector";
import { toast } from "sonner";
import { LaunchMonitorSessionDetail } from "@/components/LaunchMonitorSessionDetail";
import { RebootSessionDetail } from "@/components/RebootSessionDetail";
import { VideoAnalyzerTab } from "@/components/video-analyzer";
import { usePlayerScorecard } from "@/hooks/usePlayerScorecard";
import { Interactive4BTiles } from "./Interactive4BTiles";
import { RecentSessionsList } from "./RecentSessionsList";
import { PlayerProgressionDashboard } from "./PlayerProgressionDashboard";
import { cn } from "@/lib/utils";

interface PlayerDataTabProps {
  playerId: string; // This is player_profiles.id
  playerName: string;
}

type DataFilter = 'all' | 'analyzer' | 'reboot' | 'hittrax' | 'batsensor' | 'videos';

interface DataSession {
  id: string;
  type: 'analyzer' | 'reboot' | 'hittrax';
  typeName: string;
  date: Date;
  source?: string;
  scores?: {
    brain?: number;
    body?: number;
    bat?: number;
    ball?: number;
  };
  swingCount?: number;
  reviewed: boolean;
}

export function PlayerDataTab({ playerId, playerName }: PlayerDataTabProps) {
  const [sessions, setSessions] = useState<DataSession[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteSession, setDeleteSession] = useState<DataSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'progression' | 'sessions' | 'video'>('dashboard');
  
  // playersTableId is the stable ID from the `players` table (FK target for data tables)
  const [playersTableId, setPlayersTableId] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);
  
  // Session detail modals
  const [selectedLaunchMonitorSession, setSelectedLaunchMonitorSession] = useState<any>(null);
  const [selectedRebootSession, setSelectedRebootSession] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Scorecard hook
  const { 
    data: scorecardData, 
    loading: scorecardLoading, 
    timeWindow, 
    setTimeWindow,
    refresh: refreshScorecard 
  } = usePlayerScorecard(playersTableId);

  // Resolve or create the players_id mapping using the RPC function
  const resolvePlayersId = async (): Promise<string | null> => {
    try {
      const { data: linkedPlayerId, error } = await supabase
        .rpc('ensure_player_linked', { p_profile_id: playerId });
      
      if (error) {
        console.error('[PlayerDataTab] Error ensuring player linked:', error);
        setMappingError(`Cannot link player: ${error.message}`);
        return null;
      }
      
      if (!linkedPlayerId) {
        setMappingError('Failed to link player profile to players table');
        return null;
      }
      
      setPlayersTableId(linkedPlayerId);
      return linkedPlayerId;
    } catch (error: any) {
      console.error('[PlayerDataTab] Exception resolving players_id:', error);
      setMappingError(error.message || 'Unknown error resolving player mapping');
      return null;
    }
  };

  useEffect(() => {
    const init = async () => {
      setMappingError(null);
      const pId = await resolvePlayersId();
      if (pId) {
        loadSessions(pId);
      } else {
        setLoading(false);
      }
    };
    init();
  }, [playerId]);

  const loadSessions = async (pId: string) => {
    setLoading(true);
    
    const [sessionsRes, launchRes, rebootRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('player_id', playerId),
      supabase.from('launch_monitor_sessions').select('*').eq('player_id', pId),
      supabase.from('reboot_uploads').select('*').eq('player_id', pId),
    ]);

    const allSessions: DataSession[] = [
      ...(sessionsRes.data || []).map(s => ({
        id: s.id,
        type: 'analyzer' as const,
        typeName: 'Swing Analysis',
        date: new Date(s.created_at || new Date()),
        scores: {
          brain: s.four_b_brain ?? undefined,
          body: s.four_b_body ?? undefined,
          bat: s.four_b_bat ?? undefined,
        },
        reviewed: s.status === 'completed',
        swingCount: s.swing_count ?? undefined,
      })),
      ...(launchRes.data || []).map(s => ({
        id: s.id,
        type: 'hittrax' as const,
        typeName: getBrandDisplayName((s.source || 'generic') as LaunchMonitorBrand),
        date: new Date(s.session_date),
        source: s.source || undefined,
        swingCount: s.total_swings,
        scores: {
          ball: s.ball_score ?? undefined,
        },
        reviewed: true,
      })),
      ...(rebootRes.data || []).map(s => ({
        id: s.id,
        type: 'reboot' as const,
        typeName: s.ik_file_uploaded && s.me_file_uploaded ? 'Reboot IK+ME' : s.ik_file_uploaded ? 'Reboot IK' : 'Reboot ME',
        date: new Date(s.created_at || new Date()),
        scores: {
          brain: s.brain_score ?? undefined,
          body: s.body_score ?? undefined,
          bat: s.bat_score ?? undefined,
        },
        reviewed: true,
      })),
    ];

    allSessions.sort((a, b) => b.date.getTime() - a.date.getTime());
    setSessions(allSessions);
    setLoading(false);
  };

  const handleDeleteSession = async () => {
    if (!deleteSession) return;
    
    setDeleting(true);
    try {
      let error: { message: string } | null = null;
      
      switch (deleteSession.type) {
        case 'analyzer':
          ({ error } = await supabase.from('sessions').delete().eq('id', deleteSession.id));
          break;
        case 'hittrax':
          ({ error } = await supabase.from('launch_monitor_sessions').delete().eq('id', deleteSession.id));
          break;
        case 'reboot':
          ({ error } = await supabase.from('reboot_uploads').delete().eq('id', deleteSession.id));
          break;
        default:
          throw new Error('Unknown session type');
      }

      if (error) throw error;

      toast.success('Session deleted');
      setDeleteSession(null);
      if (playersTableId) {
        loadSessions(playersTableId);
      }
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error(error?.message || 'Failed to delete session');
    } finally {
      setDeleting(false);
    }
  };

  // Handle viewing session details
  const handleViewSession = async (session: DataSession) => {
    setLoadingDetail(true);
    try {
      if (session.type === 'hittrax' && playersTableId) {
        const { data, error } = await supabase
          .from('launch_monitor_sessions')
          .select('*')
          .eq('id', session.id)
          .single();
        
        if (error) throw error;
        setSelectedLaunchMonitorSession(data);
      } else if (session.type === 'reboot' && playersTableId) {
        const { data, error } = await supabase
          .from('reboot_uploads')
          .select('*')
          .eq('id', session.id)
          .single();
        
        if (error) throw error;
        setSelectedRebootSession(data);
      } else if (session.type === 'analyzer') {
        toast.info('Analyzer session detail coming soon');
      } else {
        toast.info('Session detail view not available for this type');
      }
    } catch (error: any) {
      console.error('Error loading session detail:', error);
      toast.error('Failed to load session details');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Get latest KRS session for the "View Latest Report" button
  const latestKRSSession = sessions.find(s => s.type === 'analyzer' || s.type === 'reboot');

  // Trend helper
  const getTrend = (current: number | null, prev: number | null) => {
    if (current === null || prev === null) return 'flat';
    if (current > prev) return 'up';
    if (current < prev) return 'down';
    return 'flat';
  };

  // Show error state if mapping failed
  if (mappingError) {
    return (
      <Card className="bg-red-900/20 border-red-800">
        <CardContent className="py-8">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="h-6 w-6" />
            <div>
              <p className="font-semibold">Player Mapping Error</p>
              <p className="text-sm text-red-400/80">{mappingError}</p>
              <p className="text-xs text-red-400/60 mt-1">Cannot save session data without a valid player mapping.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== HERO HEADER: Catch Barrel Score + View Latest Report ===== */}
      <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700 overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Catch Barrel Score */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">
                  CATCH BARREL SCORE
                </p>
                {scorecardLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-slate-500 mx-auto" />
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-5xl font-black text-white">
                      {scorecardData?.fourBScores.composite ?? '—'}
                    </span>
                    {scorecardData?.fourBScores.prevComposite !== null && (
                      <>
                        {getTrend(
                          scorecardData?.fourBScores.composite ?? null,
                          scorecardData?.fourBScores.prevComposite ?? null
                        ) === 'up' && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                        {getTrend(
                          scorecardData?.fourBScores.composite ?? null,
                          scorecardData?.fourBScores.prevComposite ?? null
                        ) === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                      </>
                    )}
                  </div>
                )}
                {scorecardData?.fourBScores.grade && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {scorecardData.fourBScores.grade}
                  </Badge>
                )}
              </div>

              {scorecardData?.fourBScores.weakestLink && (
                <div className="hidden md:block border-l border-slate-700 pl-6">
                  <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Focus: {scorecardData.fourBScores.weakestLink.toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>

            {/* Right: Primary Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-semibold"
                onClick={() => {
                  if (latestKRSSession) {
                    handleViewSession(latestKRSSession);
                  } else {
                    toast.info('No KRS report available yet');
                  }
                }}
                disabled={!latestKRSSession}
              >
                <FileText className="h-4 w-4 mr-2" />
                View Latest KRS Report
              </Button>
              
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => {
                  if (!playersTableId) {
                    toast.error("Player mapping missing");
                    return;
                  }
                  setUploadModalOpen(true);
                }}
                disabled={!playersTableId}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== TAB NAVIGATION ===== */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <TabsList className="grid w-full grid-cols-4 max-w-lg bg-slate-800/50">
          <TabsTrigger 
            value="dashboard" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            4B Scores
          </TabsTrigger>
          <TabsTrigger 
            value="progression" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <LineChart className="h-4 w-4 mr-1" />
            Progression
          </TabsTrigger>
          <TabsTrigger 
            value="sessions" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            Sessions ({sessions.length})
          </TabsTrigger>
          <TabsTrigger 
            value="video" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <Video className="h-4 w-4 mr-1" />
            Video
          </TabsTrigger>
        </TabsList>

        {/* ===== DASHBOARD TAB: Interactive 4B Tiles + Recent Sessions ===== */}
        <TabsContent value="dashboard" className="mt-6 space-y-6">
          {scorecardLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : scorecardData ? (
            <>
              {/* Interactive 4B Tiles */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  4B Breakdown — Click to Expand
                </h3>
                <Interactive4BTiles 
                  fourBScores={scorecardData.fourBScores}
                />
              </div>

              {/* Recent Sessions */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Recent Sessions
                </h3>
                <RecentSessionsList
                  sessions={sessions}
                  loading={loading}
                  onViewSession={handleViewSession}
                  onViewAll={() => setActiveView('sessions')}
                  maxItems={5}
                />
              </div>
            </>
          ) : (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-12 text-center">
                <Database className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">No player data available</p>
                <p className="text-sm text-slate-500 mt-1">Upload data to generate 4B scores</p>
                <Button
                  className="mt-4 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
                  onClick={() => setUploadModalOpen(true)}
                  disabled={!playersTableId}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload First Session
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== PROGRESSION TAB: Long-term Trends ===== */}
        <TabsContent value="progression" className="mt-6">
          {playersTableId ? (
            <PlayerProgressionDashboard
              playerId={playerId}
              playersTableId={playersTableId}
              playerName={playerName}
              onViewSession={(sessionId, type) => {
                const session = sessions.find(s => s.id === sessionId);
                if (session) {
                  handleViewSession(session);
                }
              }}
            />
          ) : (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500 mx-auto" />
                <p className="text-slate-400 mt-2">Loading player data...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== SESSIONS TAB: Full Sessions List ===== */}
        <TabsContent value="sessions" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">All Sessions</h3>
            <Button
              onClick={() => setUploadModalOpen(true)}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
              disabled={!playersTableId}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Data
            </Button>
          </div>

          {loading ? (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500 mx-auto" />
              </CardContent>
            </Card>
          ) : sessions.length === 0 ? (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-12 text-center">
                <Database className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No sessions found</p>
                <p className="text-slate-500 text-sm mt-1">Upload data to get started</p>
              </CardContent>
            </Card>
          ) : (
            <RecentSessionsList
              sessions={sessions}
              loading={loading}
              onViewSession={handleViewSession}
              maxItems={100}
            />
          )}
        </TabsContent>

        {/* ===== VIDEO TAB ===== */}
        <TabsContent value="video" className="mt-6">
          {playersTableId ? (
            <VideoAnalyzerTab
              playerId={playersTableId}
              playerName={playerName}
              source="admin_upload"
            />
          ) : (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500 mx-auto" />
                <p className="text-slate-400 mt-2">Loading player data...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== MODALS ===== */}
      
      {/* Upload Modal */}
      {playersTableId && (
        <UnifiedDataUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          playerId={playersTableId}
          playerName={playerName}
          linkVerified={true}
          onSuccess={() => {
            loadSessions(playersTableId);
            refreshScorecard();
            setUploadModalOpen(false);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSession} onOpenChange={(open) => !open && setDeleteSession(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete this session?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This cannot be undone. All data associated with this session will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSession}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Launch Monitor Session Detail */}
      <LaunchMonitorSessionDetail
        open={!!selectedLaunchMonitorSession}
        onOpenChange={(open) => !open && setSelectedLaunchMonitorSession(null)}
        session={selectedLaunchMonitorSession}
        onDelete={() => {
          setSelectedLaunchMonitorSession(null);
          if (playersTableId) loadSessions(playersTableId);
        }}
      />

      {/* Reboot Session Detail */}
      <RebootSessionDetail
        open={!!selectedRebootSession}
        onOpenChange={(open) => !open && setSelectedRebootSession(null)}
        session={selectedRebootSession}
        onDelete={() => {
          setSelectedRebootSession(null);
          if (playersTableId) loadSessions(playersTableId);
        }}
      />
    </div>
  );
}
