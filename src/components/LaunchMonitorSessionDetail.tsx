import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getBrandDisplayName, LaunchMonitorBrand } from "@/lib/csv-detector";
import { LaunchMonitorBoxScore } from "@/components/LaunchMonitorBoxScore";
import { 
  calculateEnhancedStats, 
  EnhancedLaunchMonitorStats,
  PlayerLevel
} from "@/lib/launch-monitor-metrics";

interface LaunchMonitorSession {
  id: string;
  session_date: string;
  source: string;
  total_swings: number;
  misses: number | null;
  fouls: number | null;
  balls_in_play: number | null;
  contact_rate: number | null;
  avg_exit_velo: number | null;
  max_exit_velo: number | null;
  min_exit_velo: number | null;
  velo_90_plus: number | null;
  velo_95_plus: number | null;
  velo_100_plus: number | null;
  avg_launch_angle: number | null;
  optimal_la_count: number | null;
  ground_ball_count: number | null;
  fly_ball_count: number | null;
  max_distance: number | null;
  avg_distance: number | null;
  quality_hits: number | null;
  barrel_hits: number | null;
  quality_hit_pct: number | null;
  barrel_pct: number | null;
  total_points: number | null;
  points_per_swing: number | null;
  ball_score: number | null;
  results_breakdown: Record<string, number> | null;
  hit_types_breakdown: Record<string, number> | null;
  raw_swings?: Array<{ exitVelo: number; launchAngle: number; distance?: number }>;
  // Player context for level-based thresholds
  player_level?: string;
}

interface LaunchMonitorSessionDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: LaunchMonitorSession | null;
  onDelete: () => void;
  playerLevel?: string;
}

export function LaunchMonitorSessionDetail({
  open,
  onOpenChange,
  session,
  onDelete,
  playerLevel = 'high_school'
}: LaunchMonitorSessionDetailProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  if (!session) return null;
  
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("launch_monitor_sessions")
        .delete()
        .eq("id", session.id);
      
      if (error) throw error;
      
      toast.success("Session deleted");
      onOpenChange(false);
      onDelete();
    } catch (error) {
      console.error("Error deleting session:", error);
      toast.error("Failed to delete session");
    } finally {
      setIsDeleting(false);
    }
  };

  // Build enhanced stats from stored session data
  // If we have raw_swings, use them for detailed calculation
  // Otherwise, construct synthetic swings from aggregates
  const buildEnhancedStats = (): EnhancedLaunchMonitorStats => {
    const rawSwings = session.raw_swings as Array<{ exitVelo: number; launchAngle: number; distance?: number }> | undefined;
    
    if (rawSwings && rawSwings.length > 0) {
      return calculateEnhancedStats(rawSwings, playerLevel);
    }

    // Fallback: construct stats from stored aggregates
    // This won't have full score drivers but will display what we have
    const totalSwings = session.total_swings;
    const ballsInPlay = session.balls_in_play ?? totalSwings - (session.misses ?? 0);
    const avgExitVelo = session.avg_exit_velo ?? 0;
    const maxExitVelo = session.max_exit_velo ?? 0;
    const avgLaunchAngle = session.avg_launch_angle ?? 0;
    const avgDistance = session.avg_distance ?? 0;
    const maxDistance = session.max_distance ?? 0;
    const barrelCount = session.barrel_hits ?? 0;
    const barrelRate = session.barrel_pct ?? 0;
    const ballScore = session.ball_score ?? 50;
    const contactRate = session.contact_rate ?? 0;
    
    // Estimate hard-hit from velo_95_plus if available
    const hardHitCount = session.velo_95_plus ?? 0;
    const hardHitRate = ballsInPlay > 0 ? (hardHitCount / ballsInPlay) * 100 : 0;
    
    // Construct LA distribution from stored counts
    const groundBall = session.ground_ball_count ?? 0;
    const flyBall = session.fly_ball_count ?? 0;
    const optimalLa = session.optimal_la_count ?? 0;
    // Estimate line drives as optimal LA count (roughly)
    const lineDrive = optimalLa;
    const popUp = Math.max(0, ballsInPlay - groundBall - flyBall - lineDrive);
    
    const laDistribution = {
      groundBall,
      lineDrive,
      flyBall,
      popUp,
      groundBallPct: ballsInPlay > 0 ? Math.round((groundBall / ballsInPlay) * 1000) / 10 : 0,
      lineDrivePct: ballsInPlay > 0 ? Math.round((lineDrive / ballsInPlay) * 1000) / 10 : 0,
      flyBallPct: ballsInPlay > 0 ? Math.round((flyBall / ballsInPlay) * 1000) / 10 : 0,
      popUpPct: ballsInPlay > 0 ? Math.round((popUp / ballsInPlay) * 1000) / 10 : 0,
    };

    // Get thresholds for the level
    const { getLevelThresholds, calculateScoreDrivers } = require('@/lib/launch-monitor-metrics');
    const thresholds = getLevelThresholds(playerLevel);
    const level = (playerLevel?.toLowerCase().replace(/[\s_-]/g, '_') || 'high_school') as PlayerLevel;
    
    const sweetSpotCount = optimalLa;
    const sweetSpotPct = ballsInPlay > 0 ? (sweetSpotCount / ballsInPlay) * 100 : 0;
    const optimalLaPct = sweetSpotPct;

    const scoreComponents = calculateScoreDrivers(
      avgExitVelo,
      contactRate,
      barrelRate,
      avgLaunchAngle,
      optimalLaPct,
      hardHitRate,
      level
    );

    return {
      totalSwings,
      ballsInPlay,
      contactRate: Math.round(contactRate * 10) / 10,
      avgExitVelo: Math.round(avgExitVelo * 10) / 10,
      maxExitVelo: Math.round(maxExitVelo * 10) / 10,
      avgLaunchAngle: Math.round(avgLaunchAngle * 10) / 10,
      avgDistance: Math.round(avgDistance),
      maxDistance: Math.round(maxDistance),
      ballScore,
      level,
      thresholds,
      barrelCount,
      barrelRate: Math.round(barrelRate * 10) / 10,
      hardHitCount,
      hardHitRate: Math.round(hardHitRate * 10) / 10,
      laDistribution,
      scoreComponents,
      sweetSpotCount,
      sweetSpotPct: Math.round(sweetSpotPct * 10) / 10,
    };
  };

  const enhancedStats = buildEnhancedStats();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Target className="h-5 w-5 text-blue-500" />
            Launch Monitor Session
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span>{formatDate(session.session_date)}</span>
            <Badge variant="outline" className="border-slate-700">
              {getBrandDisplayName(session.source as LaunchMonitorBrand)}
            </Badge>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* ESPN-Style Box Score */}
          <LaunchMonitorBoxScore 
            stats={enhancedStats} 
            showPeerComparison={true}
          />
          
          {/* Results Breakdown */}
          {session.results_breakdown && Object.keys(session.results_breakdown).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-slate-400">RESULTS BREAKDOWN</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(session.results_breakdown).map(([result, count]) => (
                  <Badge key={result} variant="secondary" className="bg-slate-800 text-slate-300">
                    {result}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Session
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
