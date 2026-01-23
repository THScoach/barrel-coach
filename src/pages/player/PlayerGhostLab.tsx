/**
 * Ghost Lab Dashboard - Player-facing swing analytics
 * Shows 4B Scorecard, Virtual Statcast, Weapon Panel, Hot Zone Map, and Scout Brief
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Upload, 
  RefreshCw,
  FlaskConical,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { 
  GhostLab4BScorecard, 
  VirtualStatcastCard, 
  HotZoneMap, 
  ScoutBriefGenerator 
} from "@/components/ghostlab";
import { VideoSwingUploadModal } from "@/components/video-analyzer";
import { WeaponPanel, WeaponMetricsComparison, WeaponDrillPrescription } from "@/components/sensor";
import { useWeaponMetrics } from "@/hooks/useWeaponMetrics";

interface SessionData {
  id: string;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  overall_score: number | null;
  leak_type: string | null;
  session_date: string;
}

interface SwingData {
  attack_angle_deg: number;
}

interface PlayerInfo {
  id: string;
  name: string;
  level: string | null;
}

export default function PlayerGhostLab() {
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [latestSession, setLatestSession] = useState<SessionData | null>(null);
  const [swings, setSwings] = useState<SwingData[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Session context for pitch speed
  const [estimatedPitchSpeed, setEstimatedPitchSpeed] = useState<number>(50);
  const [avgBatSpeed, setAvgBatSpeed] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Get player info
    const { data: playerData } = await supabase
      .from('players')
      .select('id, name, level')
      .eq('email', user.email)
      .maybeSingle();

    if (!playerData) {
      setLoading(false);
      return;
    }

    setPlayer(playerData);

    // Get latest session with 4B scores
    const { data: sessionData } = await supabase
      .from('player_sessions')
      .select(`
        id, 
        brain_score, 
        body_score, 
        bat_score, 
        ball_score, 
        overall_score,
        leak_type,
        session_date
      `)
      .eq('player_id', playerData.id)
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionData) {
      setLatestSession(sessionData);
    }

    // Get swing data for hot zone and bat speed (from sensor_swings)
    const { data: swingData } = await supabase
      .from('sensor_swings')
      .select('attack_angle_deg, bat_speed_mph')
      .eq('player_id', playerData.id)
      .not('attack_angle_deg', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (swingData && swingData.length > 0) {
      setSwings(swingData.map(s => ({
        attack_angle_deg: s.attack_angle_deg ?? 0,
      })));
      
      // Calculate average bat speed
      const validBatSpeeds = swingData.filter(s => s.bat_speed_mph !== null).map(s => s.bat_speed_mph as number);
      if (validBatSpeeds.length > 0) {
        setAvgBatSpeed(validBatSpeeds.reduce((a, b) => a + b, 0) / validBatSpeeds.length);
      }
    }

    setLoading(false);
  };

  const handleUploadSuccess = () => {
    setUploadModalOpen(false);
    toast.success("Session uploaded! Refreshing data...");
    loadData();
  };

  // Calculate average VBA (using attack_angle_deg as proxy)
  const avgVBA = swings.length > 0
    ? swings.reduce((sum, s) => sum + s.attack_angle_deg, 0) / swings.length
    : null;

  // Parse leaks
  const leaks = latestSession?.leak_type ? [latestSession.leak_type] : [];

  // Determine weakest link from scores
  const getWeakestLink = (): string | null => {
    if (!latestSession) return null;
    const scores = [
      { name: 'brain', score: latestSession.brain_score },
      { name: 'body', score: latestSession.body_score },
      { name: 'bat', score: latestSession.bat_score },
      { name: 'ball', score: latestSession.ball_score },
    ].filter(s => s.score !== null);
    
    if (scores.length === 0) return null;
    return scores.sort((a, b) => (a.score ?? 100) - (b.score ?? 100))[0].name;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 md:ml-56 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Ghost Lab...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:ml-56 pb-24 md:pb-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-black text-white">Ghost Lab</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Your swing, translated into scout-speak
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setUploadModalOpen(true)} className="bg-primary hover:bg-primary/90">
            <Upload className="h-4 w-4 mr-2" />
            Upload Session
          </Button>
        </div>
      </div>

      {/* Player Badge */}
      {player && (
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm border-slate-600">
            {player.name}
          </Badge>
          {player.level && (
            <Badge className="bg-slate-800 text-slate-300">
              {player.level}
            </Badge>
          )}
          {latestSession && (
            <Badge variant="outline" className="text-xs border-primary/50 text-primary">
              Last session: {new Date(latestSession.session_date).toLocaleDateString()}
            </Badge>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* 4B Scorecard */}
          <GhostLab4BScorecard
            brainScore={latestSession?.brain_score ?? null}
            bodyScore={latestSession?.body_score ?? null}
            batScore={latestSession?.bat_score ?? null}
            ballScore={latestSession?.ball_score ?? null}
            compositeScore={latestSession?.overall_score ?? null}
            weakestLink={getWeakestLink()}
            leaks={leaks.map(l => ({ type: l, severity: 'moderate' as const }))}
          />

          {/* Virtual Statcast */}
          <VirtualStatcastCard
            batSpeed={avgBatSpeed}
            pitchSpeed={estimatedPitchSpeed}
            verticalBatAngle={avgVBA}
            approachAngle={null}
          />

          {/* Weapon Panel - DK Metrics */}
          <WeaponPanelWrapper playerId={player?.id ?? null} />

          {/* Weapon Metrics Comparison */}
          <WeaponComparisonWrapper playerId={player?.id ?? null} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Hot Zone Map */}
          <HotZoneMap
            avgVBA={avgVBA}
            swings={swings.map(s => ({ vba: s.attack_angle_deg }))}
          />

          {/* Scout Brief Generator with Weapon Metrics */}
          <ScoutBriefWithWeapons
            playerName={player?.name ?? 'Player'}
            playerId={player?.id ?? null}
            brainScore={latestSession?.brain_score ?? null}
            bodyScore={latestSession?.body_score ?? null}
            batScore={latestSession?.bat_score ?? null}
            ballScore={latestSession?.ball_score ?? null}
            compositeScore={latestSession?.overall_score ?? null}
            weakestLink={getWeakestLink()}
            leaks={leaks}
            projectedEV={
              avgBatSpeed
                ? Math.round(avgBatSpeed * 1.2 + estimatedPitchSpeed * 0.2)
                : null
            }
            avgVBA={avgVBA}
          />

          {/* Weapon Drill Prescription */}
          <WeaponDrillWrapper playerId={player?.id ?? null} />
        </div>
      </div>

      {/* No Data State */}
      {!latestSession && swings.length === 0 && (
        <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-slate-800">
          <FlaskConical className="h-16 w-16 mx-auto text-slate-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Lab Data Yet</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Upload your first swing session to see your 4B Scorecard, projected stats, 
            and get your personalized scout brief.
          </p>
          <Button 
            onClick={() => setUploadModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white font-bold px-8"
          >
            <Upload className="h-5 w-5 mr-2" />
            Upload Your First Session
          </Button>
        </div>
      )}

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

// Wrapper component to use hook conditionally
function WeaponPanelWrapper({ playerId }: { playerId: string | null }) {
  const { metrics, isLoading, swingCount } = useWeaponMetrics({ playerId });
  
  const hasData = swingCount > 0;
  
  return (
    <WeaponPanel 
      metrics={metrics} 
      isConnected={hasData || !isLoading}
    />
  );
}

// Wrapper for WeaponMetricsComparison
function WeaponComparisonWrapper({ playerId }: { playerId: string | null }) {
  const { metrics, swingCount } = useWeaponMetrics({ playerId });
  
  if (swingCount < 5) return null; // Need minimum swings for comparison
  
  return (
    <WeaponMetricsComparison metrics={metrics} />
  );
}

// Wrapper to pass weapon metrics to ScoutBriefGenerator
function ScoutBriefWithWeapons({ 
  playerId, 
  ...props 
}: { 
  playerId: string | null;
  playerName: string;
  brainScore: number | null;
  bodyScore: number | null;
  batScore: number | null;
  ballScore: number | null;
  compositeScore: number | null;
  weakestLink: string | null;
  leaks: string[];
  projectedEV: number | null;
  avgVBA: number | null;
}) {
  const { metrics } = useWeaponMetrics({ playerId });
  
  return (
    <ScoutBriefGenerator
      {...props}
      weaponMetrics={metrics}
    />
  );
}

// Wrapper for WeaponDrillPrescription
function WeaponDrillWrapper({ playerId }: { playerId: string | null }) {
  const { metrics, swingCount } = useWeaponMetrics({ playerId });
  
  if (swingCount < 5) return null;
  
  return (
    <WeaponDrillPrescription metrics={metrics} />
  );
}
