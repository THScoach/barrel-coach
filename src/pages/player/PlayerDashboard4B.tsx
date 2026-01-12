/**
 * Player Dashboard - 4B First Layout (GOATY-inspired)
 * =====================================================
 * Brain / Body / Bat / Ball as core navigation
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, MessageSquare, Dumbbell, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { calculateComposite4B, getGrade } from "@/lib/fourb-composite";
import { VideoSwingUploadModal } from "@/components/video-analyzer";
import { 
  BarrelScoreGauge, 
  FourBNavStrip, 
  BTabContent,
  type FourBCategory 
} from "@/components/player/dashboard";
import type { SessionMetricsData, MetricItem } from "@/components/player/dashboard/BTabContent";

interface ScoreSession {
  id: string;
  date: Date;
  brain: number | null;
  body: number | null;
  bat: number | null;
  ball: number | null;
  composite: number | null;
  type: 'reboot' | 'analyzer';
  // Detailed metrics
  consistencyCV?: number | null;
  legsKEPeak?: number | null;
  torsoKEPeak?: number | null;
  transferPct?: number | null;
  groundFlowScore?: number | null;
  coreFlowScore?: number | null;
  armsKEPeak?: number | null;
  batKE?: number | null;
  upperFlowScore?: number | null;
  transferEfficiency?: number | null;
  primaryLeak?: string | null;
  pelvisVelocity?: number | null;
  torsoVelocity?: number | null;
  xFactor?: number | null;
}

interface HitTraxData {
  avgExitVelo: number | null;
  maxExitVelo: number | null;
  hardHitPct: number | null;
  barrelPct: number | null;
  sweetSpotPct: number | null;
}

interface PlayerData {
  id: string;
  name: string;
  level: string | null;
  handedness: string | null;
  position: string | null;
}

// Metric definitions for each B category
const B_SUBTITLES: Record<FourBCategory, string> = {
  brain: 'Timing & Consistency',
  body: 'Movement & Sequencing',
  bat: 'Energy Transfer',
  ball: 'Contact Quality',
};

export default function PlayerDashboard4B() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialB = (searchParams.get('b') as FourBCategory) || 'brain';
  
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [sessions, setSessions] = useState<ScoreSession[]>([]);
  const [hitTraxData, setHitTraxData] = useState<HitTraxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeB, setActiveB] = useState<FourBCategory>(initialB);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    loadPlayerData();
  }, []);

  const loadPlayerData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Load player info
    const { data: playerData } = await supabase
      .from('players')
      .select('id, name, level, handedness, position')
      .eq('email', user.email)
      .maybeSingle();

    if (playerData) {
      setPlayer(playerData);
      await Promise.all([
        loadSessions(playerData.id),
        loadHitTraxData(playerData.id),
      ]);
    }
    setLoading(false);
  };

  const loadSessions = async (playerId: string) => {
    // Fetch from swing_4b_scores with detailed metrics
    const { data: fourbData } = await supabase
      .from('swing_4b_scores')
      .select(`
        id, created_at, brain_score, body_score, bat_score, ball_score, composite_score,
        consistency_cv, ground_flow_score, core_flow_score, upper_flow_score,
        bat_ke, transfer_efficiency, pelvis_velocity, torso_velocity, x_factor,
        primary_issue_category, weakest_link
      `)
      .eq('player_id', playerId)
      .order('created_at', { ascending: true });

    // Fetch from sessions table (analyzer data)
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('id, created_at, four_b_brain, four_b_body, four_b_bat, four_b_ball, composite_score, leak_type')
      .eq('player_id', playerId)
      .not('four_b_brain', 'is', null)
      .order('created_at', { ascending: true });

    const allSessions: ScoreSession[] = [
      ...(fourbData || []).map(s => ({
        id: s.id,
        date: new Date(s.created_at || new Date()),
        brain: s.brain_score,
        body: s.body_score,
        bat: s.bat_score,
        ball: s.ball_score,
        composite: s.composite_score,
        type: 'reboot' as const,
        // Detailed metrics
        consistencyCV: s.consistency_cv,
        groundFlowScore: s.ground_flow_score,
        coreFlowScore: s.core_flow_score,
        upperFlowScore: s.upper_flow_score,
        batKE: s.bat_ke,
        transferEfficiency: s.transfer_efficiency,
        pelvisVelocity: s.pelvis_velocity,
        torsoVelocity: s.torso_velocity,
        xFactor: s.x_factor,
        primaryLeak: s.primary_issue_category || s.weakest_link,
      })),
      ...(sessionData || []).map(s => ({
        id: s.id,
        date: new Date(s.created_at || new Date()),
        brain: s.four_b_brain,
        body: s.four_b_body,
        bat: s.four_b_bat,
        ball: s.four_b_ball,
        composite: s.composite_score,
        type: 'analyzer' as const,
        primaryLeak: s.leak_type,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    setSessions(allSessions);
  };

  const loadHitTraxData = async (playerId: string) => {
    // Load latest HitTrax/launch monitor session
    const { data: hittrax } = await supabase
      .from('launch_monitor_sessions')
      .select('avg_exit_velo, max_exit_velo, barrel_pct, optimal_la_count, balls_in_play, velo_95_plus')
      .eq('player_id', playerId)
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (hittrax) {
      const ballsInPlay = hittrax.balls_in_play || 1;
      setHitTraxData({
        avgExitVelo: hittrax.avg_exit_velo,
        maxExitVelo: hittrax.max_exit_velo,
        hardHitPct: hittrax.velo_95_plus ? (hittrax.velo_95_plus / ballsInPlay) * 100 : null,
        barrelPct: hittrax.barrel_pct,
        sweetSpotPct: hittrax.optimal_la_count ? (hittrax.optimal_la_count / ballsInPlay) * 100 : null,
      });
    }
  };

  const handleSelectB = (b: FourBCategory) => {
    setActiveB(b);
    setSearchParams({ b });
  };

  const handleUploadSuccess = (sessionId: string) => {
    setUploadModalOpen(false);
    if (player) {
      loadSessions(player.id);
    }
    toast.success("Session uploaded! Scores updating...");
  };

  // Calculate current and previous scores
  const latestSession = sessions[sessions.length - 1];
  const previousSession = sessions.length > 1 ? sessions[sessions.length - 2] : null;

  const currentScores = latestSession ? {
    brain: latestSession.brain,
    body: latestSession.body,
    bat: latestSession.bat,
    ball: latestSession.ball,
    composite: latestSession.composite || calculateComposite4B(
      latestSession.brain, latestSession.body, latestSession.bat, latestSession.ball
    ).composite,
  } : { brain: null, body: null, bat: null, ball: null, composite: 0 };

  const previousScores = previousSession ? {
    brain: previousSession.brain,
    body: previousSession.body,
    bat: previousSession.bat,
    ball: previousSession.ball,
    composite: previousSession.composite || calculateComposite4B(
      previousSession.brain, previousSession.body, previousSession.bat, previousSession.ball
    ).composite,
  } : null;

  // Build 4B nav data
  const fourBScores = {
    brain: {
      score: currentScores.brain,
      previousScore: previousScores?.brain,
      trend: sessions.slice(-6).map(s => s.brain).filter((s): s is number => s !== null),
    },
    body: {
      score: currentScores.body,
      previousScore: previousScores?.body,
      trend: sessions.slice(-6).map(s => s.body).filter((s): s is number => s !== null),
    },
    bat: {
      score: currentScores.bat,
      previousScore: previousScores?.bat,
      trend: sessions.slice(-6).map(s => s.bat).filter((s): s is number => s !== null),
    },
    ball: {
      score: currentScores.ball,
      previousScore: previousScores?.ball,
      trend: sessions.slice(-6).map(s => s.ball).filter((s): s is number => s !== null),
    },
  };

  // Get sessions for active B
  const getSessionsForB = (b: FourBCategory) => {
    return sessions
      .filter(s => s[b] !== null)
      .map(s => ({
        id: s.id,
        date: s.date,
        score: s[b] as number,
      }));
  };

  // Get metrics for each B category with complete cards
  const getMetricsForB = (b: FourBCategory): MetricItem[] => {
    const latest = latestSession;
    
    // Calculate kinetic potential EV from bat KE (if available)
    const kineticPotentialEV = latest?.batKE 
      ? Math.round(2.5 * Math.sqrt(latest.batKE) * 1.15) // Simplified formula
      : null;
    
    switch (b) {
      case 'brain':
        return [
          { 
            label: 'Consistency (CV)', 
            value: latest?.consistencyCV?.toFixed(1) ?? null,
            unit: '%',
            isMeasured: latest?.consistencyCV !== null && latest?.consistencyCV !== undefined,
            description: 'Lower is more consistent'
          },
          { 
            label: 'Brain Score', 
            value: latest?.brain ?? null,
            isMeasured: latest?.brain !== null,
          },
        ];
      
      case 'body':
        return [
          { 
            label: 'Ground Flow Score', 
            value: latest?.groundFlowScore?.toFixed(0) ?? null,
            isMeasured: latest?.groundFlowScore !== null && latest?.groundFlowScore !== undefined,
          },
          { 
            label: 'Core Flow Score', 
            value: latest?.coreFlowScore?.toFixed(0) ?? null,
            isMeasured: latest?.coreFlowScore !== null && latest?.coreFlowScore !== undefined,
          },
          { 
            label: 'Pelvis Velocity', 
            value: latest?.pelvisVelocity?.toFixed(0) ?? null,
            unit: '°/s',
            isMeasured: latest?.pelvisVelocity !== null && latest?.pelvisVelocity !== undefined,
          },
          { 
            label: 'Torso Velocity', 
            value: latest?.torsoVelocity?.toFixed(0) ?? null,
            unit: '°/s',
            isMeasured: latest?.torsoVelocity !== null && latest?.torsoVelocity !== undefined,
          },
        ];
      
      case 'bat':
        return [
          { 
            label: 'Upper Flow Score', 
            value: latest?.upperFlowScore?.toFixed(0) ?? null,
            isMeasured: latest?.upperFlowScore !== null && latest?.upperFlowScore !== undefined,
          },
          { 
            label: 'Transfer Efficiency', 
            value: latest?.transferEfficiency?.toFixed(0) ?? null,
            unit: '%',
            isMeasured: latest?.transferEfficiency !== null && latest?.transferEfficiency !== undefined,
          },
          { 
            label: 'Bat KE', 
            value: latest?.batKE?.toFixed(0) ?? null,
            unit: 'J',
            isMeasured: latest?.batKE !== null && latest?.batKE !== undefined && latest.batKE > 0,
            description: 'Kinetic energy at bat'
          },
          { 
            label: 'Kinetic EV Potential', 
            value: kineticPotentialEV ?? null,
            unit: 'mph',
            isMeasured: kineticPotentialEV !== null,
            highlight: true,
            description: 'Estimated exit velocity'
          },
        ];
      
      case 'ball':
        // Calculate kinetic potential for comparison
        const latestKineticEV = latest?.batKE 
          ? Math.round(2.5 * Math.sqrt(latest.batKE) * 1.15)
          : null;
        
        return [
          { 
            label: 'Kinetic EV Potential', 
            value: latestKineticEV ?? null,
            unit: 'mph',
            isMeasured: latestKineticEV !== null,
            description: 'From swing mechanics'
          },
          { 
            label: 'Avg Exit Velo (Actual)', 
            value: hitTraxData?.avgExitVelo?.toFixed(1) ?? null,
            unit: 'mph',
            isMeasured: hitTraxData?.avgExitVelo !== null && hitTraxData?.avgExitVelo !== undefined,
            highlight: true,
            description: 'From HitTrax'
          },
          { 
            label: 'Max Exit Velo', 
            value: hitTraxData?.maxExitVelo?.toFixed(1) ?? null,
            unit: 'mph',
            isMeasured: hitTraxData?.maxExitVelo !== null && hitTraxData?.maxExitVelo !== undefined,
          },
          { 
            label: 'Barrel %', 
            value: hitTraxData?.barrelPct?.toFixed(1) ?? null,
            unit: '%',
            isMeasured: hitTraxData?.barrelPct !== null && hitTraxData?.barrelPct !== undefined,
          },
        ];
      
      default:
        return [];
    }
  };
  
  // Get session metrics for coaching note generation
  const getSessionMetrics = (): SessionMetricsData => {
    const latest = latestSession;
    const kineticPotentialEV = latest?.batKE 
      ? Math.round(2.5 * Math.sqrt(latest.batKE) * 1.15)
      : null;
    
    return {
      consistencyCV: latest?.consistencyCV,
      groundFlowScore: latest?.groundFlowScore,
      coreFlowScore: latest?.coreFlowScore,
      upperFlowScore: latest?.upperFlowScore,
      batKE: latest?.batKE,
      transferEfficiency: latest?.transferEfficiency,
      primaryLeak: latest?.primaryLeak,
      kineticPotentialEV,
      // HitTrax data
      avgExitVelo: hitTraxData?.avgExitVelo,
      maxExitVelo: hitTraxData?.maxExitVelo,
      hardHitPct: hitTraxData?.hardHitPct,
      barrelPct: hitTraxData?.barrelPct,
      sweetSpotPct: hitTraxData?.sweetSpotPct,
    };
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 md:ml-56 flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const compositeGrade = getGrade(currentScores.composite);

  return (
    <div className="container mx-auto px-4 py-4 space-y-4 md:ml-56 pb-24 md:pb-8">
      {/* Fixed Header Section */}
      <div className="space-y-4">
        {/* Player Info Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{player?.name || 'Player'}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {player?.level && <span>{player.level}</span>}
                {player?.handedness && (
                  <>
                    <span>•</span>
                    <span>{player.handedness === 'R' ? 'RHH' : player.handedness === 'L' ? 'LHH' : 'Switch'}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Desktop: New Session button inline */}
          <Button 
            onClick={() => setUploadModalOpen(true)}
            className="hidden md:flex"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Session
          </Button>
        </div>

        {/* Barrel Score Gauge - Centered */}
        <div className="flex justify-center py-4">
          <BarrelScoreGauge
            score={currentScores.composite}
            previousScore={previousScores?.composite}
            grade={compositeGrade}
            size="lg"
          />
        </div>

        {/* 4B Navigation Strip */}
        <FourBNavStrip
          activeB={activeB}
          onSelectB={handleSelectB}
          scores={fourBScores}
        />
      </div>

      {/* Active B Content */}
      <BTabContent
        category={activeB}
        score={currentScores[activeB]}
        previousScore={previousScores?.[activeB] ?? null}
        grade={compositeGrade}
        sessionMetrics={getSessionMetrics()}
        subtitle={B_SUBTITLES[activeB]}
        sessions={getSessionsForB(activeB)}
        metrics={getMetricsForB(activeB)}
        onViewSession={(id) => {
          // Navigate to session detail
          toast.info(`Opening session ${id}`);
        }}
        onViewAllSessions={() => {
          // Navigate to filtered history
          toast.info(`View all ${activeB} sessions`);
        }}
      />

      {/* Mobile FAB for New Session */}
      <div className="fixed bottom-20 right-4 md:hidden z-50">
        <Button 
          size="lg"
          className="rounded-full w-14 h-14 shadow-lg"
          onClick={() => setUploadModalOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Bottom Nav - Communication & Drills outside 4B */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t md:hidden z-40">
        <div className="flex justify-around py-2">
          <Link 
            to="/player" 
            className="flex flex-col items-center gap-1 p-2 text-primary"
          >
            <User className="h-5 w-5" />
            <span className="text-[10px]">Dashboard</span>
          </Link>
          <Link 
            to="/player/messages" 
            className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px]">Messages</span>
          </Link>
          <Link 
            to="/player/drills" 
            className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-foreground"
          >
            <Dumbbell className="h-5 w-5" />
            <span className="text-[10px]">Drills</span>
          </Link>
        </div>
      </div>

      {/* Upload Modal */}
      {player && (
        <VideoSwingUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          playerId={player.id}
          playerName={player.name}
          source="player_upload"
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
