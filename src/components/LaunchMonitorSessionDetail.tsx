import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getBrandDisplayName, LaunchMonitorBrand } from "@/lib/csv-detector";
import { getScoreGrade } from "@/lib/launch-monitor-parser";

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
}

interface LaunchMonitorSessionDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: LaunchMonitorSession | null;
  onDelete: () => void;
}

export function LaunchMonitorSessionDetail({
  open,
  onOpenChange,
  session,
  onDelete
}: LaunchMonitorSessionDetailProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  if (!session) return null;
  
  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 60) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };
  
  const getScoreBgColor = (score: number | null) => {
    if (score === null) return "bg-muted";
    if (score >= 60) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };
  
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
  
  const ballScore = session.ball_score;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Launch Monitor Session
          </DialogTitle>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{formatDate(session.session_date)}</p>
            <Badge variant="outline">{getBrandDisplayName(session.source as LaunchMonitorBrand)}</Badge>
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Ball Score */}
          <div className={`p-4 rounded-lg text-center text-white ${getScoreBgColor(ballScore)}`}>
            <div className="text-sm opacity-90">Ball Score</div>
            <div className="text-4xl font-bold">{ballScore ?? '--'}</div>
            <div className="text-sm opacity-90">
              {ballScore ? getScoreGrade(ballScore) : 'No data'}
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">CONTACT</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Swings:</span>
                  <span className="font-medium">{session.total_swings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Misses:</span>
                  <span className="font-medium">
                    {session.misses ?? 0} ({session.total_swings > 0 ? Math.round(((session.misses ?? 0) / session.total_swings) * 100) : 0}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact Rate:</span>
                  <span className="font-medium">{session.contact_rate ?? '--'}%</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">EXIT VELOCITY</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average:</span>
                  <span className="font-medium">{session.avg_exit_velo ?? '--'} mph</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max:</span>
                  <span className="font-medium">{session.max_exit_velo ?? '--'} mph</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">100+ mph:</span>
                  <span className="font-medium">{session.velo_100_plus ?? 0} swings</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">LAUNCH ANGLE</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average:</span>
                  <span className="font-medium">{session.avg_launch_angle ?? '--'}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Optimal (10-25°):</span>
                  <span className="font-medium">{session.optimal_la_count ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ground Balls:</span>
                  <span className="font-medium">{session.ground_ball_count ?? 0}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">QUALITY METRICS</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quality Hit %:</span>
                  <span className="font-medium">{session.quality_hit_pct ?? '--'}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Barrel %:</span>
                  <span className="font-medium">{session.barrel_pct ?? '--'}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Points/Swing:</span>
                  <span className="font-medium">{session.points_per_swing ?? '--'}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Results Breakdown */}
          {session.results_breakdown && Object.keys(session.results_breakdown).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">RESULTS BREAKDOWN</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(session.results_breakdown).map(([result, count]) => (
                  <Badge key={result} variant="secondary">
                    {result}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Hit Types Breakdown */}
          {session.hit_types_breakdown && Object.keys(session.hit_types_breakdown).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">HIT TYPES</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(session.hit_types_breakdown).map(([type, count]) => (
                  <Badge key={type} variant="outline">
                    {type}: {count}
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
