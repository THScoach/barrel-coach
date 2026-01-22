/**
 * Player Overview Tab - High-End Diagnostic Lab
 * ==============================================
 * Professional scouting report that identifies leaks and prescribes fixes
 * Dark #0A0A0B background with #DC2626 Swing Rehab Red accents
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  Upload,
  Loader2,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { usePlayerScorecard } from "@/hooks/usePlayerScorecard";
import { DiagnosticLabHeader } from "./DiagnosticLabHeader";
import { ScoutGaugeGrid } from "./ScoutGaugeGrid";
import { KineticLeakCard } from "./KineticLeakCard";
import { LeakDetectionCard } from "./LeakDetectionCard";
import { PrescriptionCard } from "./PrescriptionCard";
import { UnifiedDataUploadModal } from "@/components/UnifiedDataUploadModal";
import { RebootSessionDetail } from "@/components/RebootSessionDetail";
import { LaunchMonitorSessionDetail } from "@/components/LaunchMonitorSessionDetail";

interface PlayerOverviewTabProps {
  playerId: string;
  playersTableId?: string;
  playerName: string;
  playerLevel?: string;
  playerBats?: string;
  playerThrows?: string;
  onNavigateToScores?: () => void;
}

interface LatestSessionData {
  type: 'reboot' | 'analyzer';
  data: any;
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
  const [, setSearchParams] = useSearchParams();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [mappedPlayersId, setMappedPlayersId] = useState<string | null>(playersTableId || null);
  
  // Session detail modals
  const [selectedRebootSession, setSelectedRebootSession] = useState<any>(null);
  const [selectedLaunchSession, setSelectedLaunchSession] = useState<any>(null);
  const [latestSession, setLatestSession] = useState<LatestSessionData | null>(null);
  
  // Leak and prescription data
  const [leakData, setLeakData] = useState<{
    leakType: string | null;
    leakEvidence: string | null;
    motorProfile: string | null;
    priorityDrill: string | null;
  }>({
    leakType: null,
    leakEvidence: null,
    motorProfile: null,
    priorityDrill: null,
  });

  // Detailed leaks from dk-4b-inverse
  const [detailedLeaks, setDetailedLeaks] = useState<Array<{
    type: string;
    category: "brain" | "body" | "bat" | "ball";
    severity: "low" | "medium" | "high";
    description: string;
    metric_value: number;
    threshold: number;
  }>>([]);
  
  // Prescription drill data
  const [prescriptionDrill, setPrescriptionDrill] = useState<{
    name: string | null;
    whyItWorks: string | null;
    sets: number | null;
    reps: number | null;
    videoUrl: string | null;
  }>({
    name: null,
    whyItWorks: null,
    sets: null,
    reps: null,
    videoUrl: null,
  });
  
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

  // Load latest session and leak data
  useEffect(() => {
    if (mappedPlayersId) {
      loadLatestSession();
    }
  }, [mappedPlayersId, playerId]);

  const loadLatestSession = async () => {
    const [rebootRes, sessionsRes, kwonAnalysisRes] = await Promise.all([
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
      // Fetch kwon analyses with detailed leak data from dk-4b-inverse
      supabase
        .from('kwon_analyses')
        .select('id, player_id, possible_leaks, four_b_scores, motor_profile, priority_focus, created_at')
        .eq('player_id', mappedPlayersId)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    const reboot = rebootRes.data?.[0];
    const session = sessionsRes.data?.[0];
    const kwonAnalysis = kwonAnalysisRes.data?.[0];

    // Extract detailed leaks from kwon_analyses.possible_leaks if available
    if (kwonAnalysis?.possible_leaks) {
      const possibleLeaks = kwonAnalysis.possible_leaks as any;
      if (Array.isArray(possibleLeaks)) {
        // Map to expected format
        setDetailedLeaks(possibleLeaks.map((leak: any) => ({
          type: leak.type || leak.leak_type || 'unknown',
          category: leak.category || 'body',
          severity: leak.severity || 'medium',
          description: leak.description || leak.evidence || '',
          metric_value: leak.metric_value ?? leak.value ?? 0,
          threshold: leak.threshold ?? 0,
        })));
      }
    } else if (reboot) {
      // Synthesize leaks from low 4B scores when no kwon_analyses data exists
      const synthesizedLeaks: typeof detailedLeaks = [];
      const LEAK_THRESHOLD = 50; // Below Average on 20-80 scale
      const CRITICAL_THRESHOLD = 40;
      
      const scores = [
        { category: 'brain' as const, score: reboot.brain_score, name: 'Timing Variance', evidence: 'Inconsistent timing pattern' },
        { category: 'body' as const, score: reboot.body_score, name: 'Energy Transfer', evidence: 'Power leaking at core rotation phase' },
        { category: 'bat' as const, score: reboot.bat_score, name: 'Bat Path', evidence: 'Inefficient barrel delivery' },
      ];
      
      for (const item of scores) {
        if (item.score && item.score < LEAK_THRESHOLD) {
          synthesizedLeaks.push({
            type: item.name.toLowerCase().replace(/\s+/g, '_'),
            category: item.category,
            severity: item.score < CRITICAL_THRESHOLD ? 'high' : item.score < 45 ? 'medium' : 'low',
            description: `${item.name} detected: ${item.evidence}. Score ${item.score} is below the ${LEAK_THRESHOLD} threshold.`,
            metric_value: 100 - item.score, // Inverse - higher is worse
            threshold: 100 - LEAK_THRESHOLD, // 50 on inverted scale
          });
        }
      }
      
      if (synthesizedLeaks.length > 0) {
        setDetailedLeaks(synthesizedLeaks);
      }
    }

    if (reboot && session) {
      const rebootDate = new Date(reboot.created_at);
      const sessionDate = new Date(session.created_at);
      if (rebootDate > sessionDate) {
        setLatestSession({ type: 'reboot', data: reboot });
        extractLeakData(reboot);
      } else {
        setLatestSession({ type: 'analyzer', data: session });
        extractLeakDataFromSession(session);
      }
    } else if (reboot) {
      setLatestSession({ type: 'reboot', data: reboot });
      extractLeakData(reboot);
    } else if (session) {
      setLatestSession({ type: 'analyzer', data: session });
      extractLeakDataFromSession(session);
    }
  };

  const extractLeakData = (data: any) => {
    setLeakData({
      leakType: data.leak_detected || data.weakest_link,
      leakEvidence: data.leak_evidence,
      motorProfile: data.motor_profile,
      priorityDrill: data.priority_drill,
    });
    
    // Load prescription drill if available
    if (data.priority_drill) {
      loadPrescriptionDrill(data.priority_drill);
    }
  };

  const extractLeakDataFromSession = (data: any) => {
    setLeakData({
      leakType: data.leak_type || data.weakest_category,
      leakEvidence: data.coach_notes,
      motorProfile: null,
      priorityDrill: null,
    });
  };

  const loadPrescriptionDrill = async (drillName: string) => {
    const { data: drill } = await supabase
      .from('drills')
      .select('name, why_it_works, sets, reps, video_url')
      .ilike('name', `%${drillName}%`)
      .limit(1)
      .single();

    if (drill) {
      setPrescriptionDrill({
        name: drill.name,
        whyItWorks: drill.why_it_works,
        sets: drill.sets,
        reps: drill.reps,
        videoUrl: drill.video_url,
      });
    } else {
      // Use the drill name from the session if not found in drills table
      setPrescriptionDrill({
        name: drillName,
        whyItWorks: null,
        sets: null,
        reps: null,
        videoUrl: null,
      });
    }
  };

  const handleViewLatestReport = () => {
    if (!latestSession) {
      toast.info('No KRS report available yet');
      return;
    }

    if (latestSession.type === 'reboot') {
      setSelectedRebootSession(latestSession.data);
    } else {
      toast.info('Analyzer session detail coming soon');
    }
  };

  const handleOpenProgression = () => {
    setSearchParams({ tab: 'scores', subtab: 'progression' });
  };

  const handleAssignDrill = () => {
    toast.success('Drill assigned to player');
  };

  return (
    <div className="space-y-6 bg-[#0A0A0B] min-h-screen -m-6 p-6">
      {/* ===== DIAGNOSTIC LAB HEADER ===== */}
      <DiagnosticLabHeader
        compositeScore={scorecardData?.fourBScores.composite ?? null}
        prevCompositeScore={scorecardData?.fourBScores.prevComposite ?? null}
        grade={scorecardData?.fourBScores.grade ?? null}
        weakestLink={scorecardData?.fourBScores.weakestLink ?? null}
        playerLevel={playerLevel}
        playerBats={playerBats}
        playerThrows={playerThrows}
        isLoading={scorecardLoading}
        onViewReport={handleViewLatestReport}
        onOpenProgression={handleOpenProgression}
      />

      {/* ===== 4B SCOUT GAUGE GRID ===== */}
      {scorecardLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
        </div>
      ) : scorecardData ? (
        <ScoutGaugeGrid
          brainScore={scorecardData.fourBScores.brain}
          bodyScore={scorecardData.fourBScores.body}
          batScore={scorecardData.fourBScores.bat}
          ballScore={scorecardData.fourBScores.ball}
          weakestLink={scorecardData.fourBScores.weakestLink}
          onCategoryClick={(category) => {
            toast.info(`${category.toUpperCase()} details coming soon`);
          }}
        />
      ) : (
        <Card className="bg-[#111113] border-[#1a1a1c]">
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400 font-medium">No diagnostic data available</p>
            <p className="text-sm text-slate-600 mt-1">Upload session data to generate 4B scores</p>
            <Button
              className="mt-4 bg-[#DC2626] hover:bg-[#b91c1c] text-white"
              onClick={() => setUploadModalOpen(true)}
              disabled={!mappedPlayersId}
              style={{ boxShadow: '0 4px 20px rgba(220, 38, 38, 0.3)' }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload First Session
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ===== LEAK DETECTION CARD (from dk-4b-inverse) ===== */}
      {(detailedLeaks.length > 0 || !scorecardLoading) && (
        <LeakDetectionCard
          leaks={detailedLeaks}
          weakestCategory={scorecardData?.fourBScores.weakestLink}
          isLoading={scorecardLoading}
        />
      )}

      {/* ===== KINETIC LEAK + PRESCRIPTION GRID ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kinetic Leak Warning */}
        <KineticLeakCard
          leakType={leakData.leakType}
          leakEvidence={leakData.leakEvidence}
          weakestLink={scorecardData?.fourBScores.weakestLink ?? null}
          motorProfile={leakData.motorProfile}
          isLoading={scorecardLoading}
        />

        {/* Training Prescription */}
        <PrescriptionCard
          drillName={prescriptionDrill.name || leakData.priorityDrill}
          whyItWorks={prescriptionDrill.whyItWorks}
          leakType={leakData.leakType}
          drillSets={prescriptionDrill.sets}
          drillReps={prescriptionDrill.reps}
          drillVideoUrl={prescriptionDrill.videoUrl}
          onAssignDrill={handleAssignDrill}
          isLoading={scorecardLoading}
        />
      </div>

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
