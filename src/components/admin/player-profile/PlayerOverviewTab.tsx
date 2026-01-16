/**
 * Rick Lab Player Overview Tab - Interactive Control Panel
 * =========================================================
 * Fast access dashboard: Player header → 4B tiles → Quick actions → Coach To-Do
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  LineChart,
  Upload,
  MessageSquare,
  CheckCircle,
  Circle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Plus,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { usePlayerScorecard } from "@/hooks/usePlayerScorecard";
import { Interactive4BTiles } from "./Interactive4BTiles";
import { UnifiedDataUploadModal } from "@/components/UnifiedDataUploadModal";
import { RebootSessionDetail } from "@/components/RebootSessionDetail";
import { LaunchMonitorSessionDetail } from "@/components/LaunchMonitorSessionDetail";

interface PlayerOverviewTabProps {
  playerId: string; // player_profiles.id
  playersTableId?: string; // players.id for data tables
  playerName: string;
  playerLevel?: string;
  playerBats?: string;
  playerThrows?: string;
  onNavigateToScores?: () => void;
}

interface ToDoItem {
  id: string;
  label: string;
  completed: boolean;
  action?: () => void;
}

export function PlayerOverviewTab({ 
  playerId, 
  playersTableId,
  playerName,
  playerLevel,
  playerBats,
  playerThrows,
  onNavigateToScores
}: PlayerOverviewTabProps) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [mappedPlayersId, setMappedPlayersId] = useState<string | null>(playersTableId || null);
  
  // Session detail modals
  const [selectedRebootSession, setSelectedRebootSession] = useState<any>(null);
  const [selectedLaunchSession, setSelectedLaunchSession] = useState<any>(null);
  const [latestSession, setLatestSession] = useState<any>(null);
  
  // Scorecard data
  const { 
    data: scorecardData, 
    loading: scorecardLoading,
    refresh: refreshScorecard 
  } = usePlayerScorecard(mappedPlayersId);

  // Resolve players_id if not provided
  useEffect(() => {
    if (!playersTableId && playerId) {
      resolvePlayersId();
    }
  }, [playerId, playersTableId]);

  const resolvePlayersId = async () => {
    try {
      const { data: linkedPlayerId, error } = await supabase
        .rpc('ensure_player_linked', { p_profile_id: playerId });
      
      if (!error && linkedPlayerId) {
        setMappedPlayersId(linkedPlayerId);
      }
    } catch (error) {
      console.error('[PlayerOverviewTab] Error resolving players_id:', error);
    }
  };

  // Load latest session for "View Latest KRS Report"
  useEffect(() => {
    if (mappedPlayersId) {
      loadLatestSession();
    }
  }, [mappedPlayersId, playerId]);

  const loadLatestSession = async () => {
    const [rebootRes, sessionsRes] = await Promise.all([
      supabase
        .from('reboot_uploads')
        .select('*')
        .eq('player_id', mappedPlayersId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('sessions')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    // Get the most recent session across types
    const reboot = rebootRes.data?.[0];
    const session = sessionsRes.data?.[0];

    if (reboot && session) {
      const rebootDate = new Date(reboot.created_at);
      const sessionDate = new Date(session.created_at);
      setLatestSession(rebootDate > sessionDate 
        ? { type: 'reboot', data: reboot } 
        : { type: 'analyzer', data: session }
      );
    } else if (reboot) {
      setLatestSession({ type: 'reboot', data: reboot });
    } else if (session) {
      setLatestSession({ type: 'analyzer', data: session });
    }
  };

  const handleViewLatestReport = () => {
    if (!latestSession) {
      toast.info('No KRS report available yet');
      return;
    }

    if (latestSession.type === 'reboot') {
      setSelectedRebootSession(latestSession.data);
    } else if (latestSession.type === 'analyzer') {
      toast.info('Analyzer session detail coming soon');
    }
  };

  const handleOpenProgression = () => {
    // Navigate to Scores tab with sub-tab set to progression
    setSearchParams({ tab: 'scores', subtab: 'progression' });
  };

  // Trend helper
  const getTrend = (current: number | null, prev: number | null) => {
    if (current === null || prev === null) return 'flat';
    if (current > prev) return 'up';
    if (current < prev) return 'down';
    return 'flat';
  };

  // Dynamic Coach To-Do items based on player state
  const generateTodos = (): ToDoItem[] => {
    const todos: ToDoItem[] = [];
    
    if (!latestSession) {
      todos.push({
        id: 'first-session',
        label: 'Upload first KRS session',
        completed: false,
        action: () => setUploadModalOpen(true),
      });
    } else {
      todos.push({
        id: 'review-report',
        label: 'Review latest KRS report',
        completed: false,
        action: handleViewLatestReport,
      });
    }

    if (scorecardData?.fourBScores.weakestLink) {
      todos.push({
        id: 'assign-drill',
        label: `Assign drill for ${scorecardData.fourBScores.weakestLink.toUpperCase()} focus`,
        completed: false,
      });
    }

    todos.push({
      id: 'send-message',
      label: 'Send check-in message',
      completed: false,
      action: () => setSearchParams({ tab: 'communication' }),
    });

    todos.push({
      id: 'review-progression',
      label: 'Check progression trends',
      completed: false,
      action: handleOpenProgression,
    });

    return todos.slice(0, 5);
  };

  const todos = generateTodos();

  return (
    <div className="space-y-6">
      {/* ===== HERO HEADER: Catch Barrel Score + Primary Actions ===== */}
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

              {/* Player Quick Info */}
              <div className="hidden md:block border-l border-slate-700 pl-6 space-y-1">
                {playerLevel && (
                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-300 mr-2">
                    {playerLevel}
                  </Badge>
                )}
                {playerBats && (
                  <span className="text-xs text-slate-400">
                    Bats: {playerBats}
                  </span>
                )}
                {playerThrows && (
                  <span className="text-xs text-slate-400 ml-2">
                    Throws: {playerThrows}
                  </span>
                )}
                {scorecardData?.fourBScores.weakestLink && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Focus: {scorecardData.fourBScores.weakestLink.toUpperCase()}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Primary Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-semibold"
                onClick={handleViewLatestReport}
                disabled={!latestSession}
              >
                <FileText className="h-4 w-4 mr-2" />
                View Latest KRS Report
              </Button>
              
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={handleOpenProgression}
              >
                <LineChart className="h-4 w-4 mr-2" />
                Open Progression
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== INTERACTIVE 4B TILES ===== */}
      {scorecardLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : scorecardData ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            4B Breakdown — Click to Expand
          </h3>
          <Interactive4BTiles fourBScores={scorecardData.fourBScores} />
        </div>
      ) : (
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-slate-500 mb-3" />
            <p className="text-slate-400 font-medium">No player data available</p>
            <p className="text-sm text-slate-500 mt-1">Upload data to generate 4B scores</p>
            <Button
              className="mt-4 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
              onClick={() => setUploadModalOpen(true)}
              disabled={!mappedPlayersId}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload First Session
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ===== COACH TO-DO ===== */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Coach To-Do
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {todos.map((todo) => (
            <div 
              key={todo.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer group"
              onClick={todo.action}
            >
              {todo.completed ? (
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-500 group-hover:text-slate-400 shrink-0" />
              )}
              <span className={`text-sm ${todo.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                {todo.label}
              </span>
              {todo.action && (
                <span className="ml-auto text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to action →
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ===== MODALS ===== */}
      <UnifiedDataUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        playerId={mappedPlayersId || ''}
        playerName={playerName}
        onSuccess={() => {
          refreshScorecard();
          loadLatestSession();
        }}
      />

      <RebootSessionDetail
        open={!!selectedRebootSession}
        onOpenChange={(open) => !open && setSelectedRebootSession(null)}
        session={selectedRebootSession}
        onDelete={() => {
          setSelectedRebootSession(null);
          loadLatestSession();
        }}
      />

      <LaunchMonitorSessionDetail
        open={!!selectedLaunchSession}
        onOpenChange={(open) => !open && setSelectedLaunchSession(null)}
        session={selectedLaunchSession}
        onDelete={() => {
          setSelectedLaunchSession(null);
          loadLatestSession();
        }}
      />
    </div>
  );
}
