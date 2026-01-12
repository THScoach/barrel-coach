/**
 * Rick Lab Player Scores Tab - KRS Reports + Progression
 * =======================================================
 * Two sub-tabs: KRS Reports table and Progression dashboard
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  FileText, 
  LineChart, 
  Loader2,
  ExternalLink,
  Database,
  Upload,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { toast } from "sonner";
import { UnifiedDataUploadModal } from "@/components/UnifiedDataUploadModal";
import { RebootSessionDetail } from "@/components/RebootSessionDetail";
import { LaunchMonitorSessionDetail } from "@/components/LaunchMonitorSessionDetail";
import { PlayerProgressionDashboard } from "./PlayerProgressionDashboard";
import { cn } from "@/lib/utils";

interface PlayerScoresTabNewProps {
  playerId: string; // player_profiles.id
  playersTableId?: string; // players.id
  playerName: string;
}

interface KRSReport {
  id: string;
  type: 'reboot' | 'analyzer' | 'hittrax';
  typeName: string;
  date: Date;
  compositeScore: number | null;
  mainLeak: string | null;
  scores: {
    brain?: number;
    body?: number;
    bat?: number;
    ball?: number;
  };
  rawData: any;
}

export function PlayerScoresTabNew({ playerId, playersTableId, playerName }: PlayerScoresTabNewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSubTab = searchParams.get('subtab') || 'reports';
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);
  
  const [reports, setReports] = useState<KRSReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [mappedPlayersId, setMappedPlayersId] = useState<string | null>(playersTableId || null);
  
  // Session detail modals
  const [selectedRebootSession, setSelectedRebootSession] = useState<any>(null);
  const [selectedLaunchSession, setSelectedLaunchSession] = useState<any>(null);

  // Sync sub-tab with URL
  useEffect(() => {
    const subtab = searchParams.get('subtab');
    if (subtab === 'progression' || subtab === 'reports') {
      setActiveSubTab(subtab);
    }
  }, [searchParams]);

  const handleSubTabChange = (value: string) => {
    setActiveSubTab(value);
    setSearchParams({ tab: 'scores', subtab: value });
  };

  // Resolve players_id if not provided
  useEffect(() => {
    if (!playersTableId && playerId) {
      resolvePlayersId();
    } else if (playersTableId) {
      setMappedPlayersId(playersTableId);
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
      console.error('[PlayerScoresTabNew] Error resolving players_id:', error);
    }
  };

  // Load KRS reports
  useEffect(() => {
    if (mappedPlayersId) {
      loadReports();
    }
  }, [mappedPlayersId, playerId]);

  const loadReports = async () => {
    if (!mappedPlayersId) return;
    
    setLoading(true);
    
    const [rebootRes, sessionsRes, launchRes] = await Promise.all([
      supabase
        .from('reboot_uploads')
        .select('*')
        .eq('player_id', mappedPlayersId)
        .order('created_at', { ascending: false }),
      supabase
        .from('sessions')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('launch_monitor_sessions')
        .select('*')
        .eq('player_id', mappedPlayersId)
        .order('session_date', { ascending: false }),
    ]);

    const allReports: KRSReport[] = [
      ...(rebootRes.data || []).map(s => ({
        id: s.id,
        type: 'reboot' as const,
        typeName: s.ik_file_uploaded && s.me_file_uploaded ? 'Reboot IK+ME' : s.ik_file_uploaded ? 'Reboot IK' : 'Reboot ME',
        date: new Date(s.created_at || new Date()),
        compositeScore: s.composite_score,
        mainLeak: s.weakest_link,
        scores: {
          brain: s.brain_score ?? undefined,
          body: s.body_score ?? undefined,
          bat: s.bat_score ?? undefined,
        },
        rawData: s,
      })),
      ...(sessionsRes.data || []).map(s => ({
        id: s.id,
        type: 'analyzer' as const,
        typeName: s.product_type || 'Video Analysis',
        date: new Date(s.created_at || new Date()),
        compositeScore: s.composite_score,
        mainLeak: s.weakest_category || s.leak_type,
        scores: {
          brain: s.four_b_brain ?? undefined,
          body: s.four_b_body ?? undefined,
          bat: s.four_b_bat ?? undefined,
          ball: s.four_b_ball ?? undefined,
        },
        rawData: s,
      })),
      ...(launchRes.data || []).map(s => ({
        id: s.id,
        type: 'hittrax' as const,
        typeName: s.source || 'HitTrax',
        date: new Date(s.session_date),
        compositeScore: s.ball_score,
        mainLeak: null,
        scores: {
          ball: s.ball_score ?? undefined,
        },
        rawData: s,
      })),
    ];

    allReports.sort((a, b) => b.date.getTime() - a.date.getTime());
    setReports(allReports);
    setLoading(false);
  };

  const handleViewReport = (report: KRSReport) => {
    if (report.type === 'reboot') {
      setSelectedRebootSession(report.rawData);
    } else if (report.type === 'hittrax') {
      setSelectedLaunchSession(report.rawData);
    } else {
      toast.info('Analyzer session detail coming soon');
    }
  };

  const getScoreBadgeColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'bg-slate-700 text-slate-400';
    if (score >= 70) return 'bg-emerald-900/50 text-emerald-400 border-emerald-700';
    if (score >= 50) return 'bg-yellow-900/50 text-yellow-400 border-yellow-700';
    return 'bg-red-900/50 text-red-400 border-red-700';
  };

  const getLeakBadge = (leak: string | null) => {
    if (!leak) return null;
    
    const leakLabels: Record<string, { label: string; color: string }> = {
      'late_legs': { label: 'Late Legs', color: 'border-blue-500/50 text-blue-400' },
      'early_arms': { label: 'Early Arms', color: 'border-purple-500/50 text-purple-400' },
      'torso_bypass': { label: 'Torso Bypass', color: 'border-amber-500/50 text-amber-400' },
      'arm_bar': { label: 'Arm Bar', color: 'border-red-500/50 text-red-400' },
      'brain': { label: 'Brain', color: 'border-pink-500/50 text-pink-400' },
      'body': { label: 'Body', color: 'border-blue-500/50 text-blue-400' },
      'bat': { label: 'Bat', color: 'border-orange-500/50 text-orange-400' },
      'ball': { label: 'Ball', color: 'border-green-500/50 text-green-400' },
    };

    const config = leakLabels[leak.toLowerCase()] || { label: leak, color: 'border-slate-500/50 text-slate-400' };
    
    return (
      <Badge variant="outline" className={cn("text-xs", config.color)}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={handleSubTabChange}>
        <TabsList className="bg-slate-800/50">
          <TabsTrigger 
            value="reports" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            KRS Reports
          </TabsTrigger>
          <TabsTrigger 
            value="progression" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <LineChart className="h-4 w-4 mr-2" />
            Progression
          </TabsTrigger>
        </TabsList>

        {/* ===== KRS REPORTS TABLE ===== */}
        <TabsContent value="reports" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              All KRS Sessions
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() => setUploadModalOpen(true)}
              disabled={!mappedPlayersId}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Data
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-12 text-center">
                <Database className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">No KRS reports yet</p>
                <p className="text-sm text-slate-500 mt-1">Upload data to generate reports</p>
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
          ) : (
            <Card className="bg-slate-900/80 border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Date</TableHead>
                    <TableHead className="text-slate-400">Type</TableHead>
                    <TableHead className="text-slate-400 text-center">Score</TableHead>
                    <TableHead className="text-slate-400">Main Leak</TableHead>
                    <TableHead className="text-slate-400 text-center">4B</TableHead>
                    <TableHead className="text-slate-400 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow 
                      key={report.id} 
                      className="border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => handleViewReport(report)}
                    >
                      <TableCell className="text-white font-medium">
                        {format(report.date, 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs">
                          {report.typeName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {report.compositeScore !== null ? (
                          <Badge className={cn("text-sm font-bold", getScoreBadgeColor(report.compositeScore))}>
                            {report.compositeScore}
                          </Badge>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getLeakBadge(report.mainLeak)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          {report.scores.brain !== undefined && (
                            <span className="text-xs text-pink-400">Br:{report.scores.brain}</span>
                          )}
                          {report.scores.body !== undefined && (
                            <span className="text-xs text-blue-400">Bo:{report.scores.body}</span>
                          )}
                          {report.scores.bat !== undefined && (
                            <span className="text-xs text-orange-400">Ba:{report.scores.bat}</span>
                          )}
                          {report.scores.ball !== undefined && (
                            <span className="text-xs text-green-400">Bl:{report.scores.ball}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewReport(report);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ===== PROGRESSION DASHBOARD ===== */}
        <TabsContent value="progression" className="mt-6">
          {mappedPlayersId ? (
            <PlayerProgressionDashboard
              playerId={playerId}
              playersTableId={mappedPlayersId}
              playerName={playerName}
              onViewSession={(sessionId, type) => {
                const report = reports.find(r => r.id === sessionId);
                if (report) {
                  handleViewReport(report);
                }
              }}
            />
          ) : (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== MODALS ===== */}
      <UnifiedDataUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        playerId={mappedPlayersId || ''}
        playerName={playerName}
        onSuccess={loadReports}
      />

      <RebootSessionDetail
        open={!!selectedRebootSession}
        onOpenChange={(open) => !open && setSelectedRebootSession(null)}
        session={selectedRebootSession}
        onDelete={() => {
          setSelectedRebootSession(null);
          loadReports();
        }}
      />

      <LaunchMonitorSessionDetail
        open={!!selectedLaunchSession}
        onOpenChange={(open) => !open && setSelectedLaunchSession(null)}
        session={selectedLaunchSession}
        onDelete={() => {
          setSelectedLaunchSession(null);
          loadReports();
        }}
      />
    </div>
  );
}
