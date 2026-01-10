import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HitTraxSession {
  id: string;
  session_date: string;
  total_swings: number;
  misses: number;
  fouls: number;
  balls_in_play: number;
  contact_rate: number;
  avg_exit_velo: number;
  max_exit_velo: number;
  min_exit_velo: number | null;
  velo_90_plus: number;
  velo_95_plus: number;
  velo_100_plus: number;
  avg_launch_angle: number;
  optimal_la_count: number;
  ground_ball_count: number;
  fly_ball_count: number;
  max_distance: number | null;
  avg_distance: number | null;
  quality_hits: number;
  barrel_hits: number;
  quality_hit_pct: number | null;
  barrel_pct: number | null;
  total_points: number;
  points_per_swing: number;
  ball_score: number;
  results_breakdown: Record<string, number> | null;
  hit_types_breakdown: Record<string, number> | null;
}

interface HitTraxSessionDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: HitTraxSession | null;
  onDelete: () => void;
}

export function HitTraxSessionDetail({
  open,
  onOpenChange,
  session,
  onDelete
}: HitTraxSessionDetailProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  if (!session) return null;
  
  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };
  
  const getScoreBgColor = (score: number) => {
    if (score >= 60) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };
  
  const getScoreGrade = (score: number) => {
    if (score >= 70) return 'Plus-Plus';
    if (score >= 60) return 'Plus';
    if (score >= 55) return 'Above Avg';
    if (score >= 50) return 'Average';
    if (score >= 45) return 'Below Avg';
    if (score >= 40) return 'Fringe';
    return 'Poor';
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('hittrax_sessions')
        .delete()
        .eq('id', session.id);
      
      if (error) throw error;
      
      toast.success('Session deleted');
      onOpenChange(false);
      onDelete();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            HitTrax Session - {formatDate(session.session_date)}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Ball Score Card */}
          <div className="bg-muted rounded-xl p-6 text-center">
            <div className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
              Ball Score
            </div>
            <div className={`text-6xl font-bold ${getScoreColor(session.ball_score)}`}>
              {session.ball_score}
            </div>
            <Badge className={`mt-2 ${getScoreBgColor(session.ball_score)} text-white`}>
              {getScoreGrade(session.ball_score)}
            </Badge>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Contact Section */}
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Contact
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Swings</span>
                  <span className="font-medium">{session.total_swings}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Misses</span>
                  <span className="font-medium text-red-500">{session.misses} ({((session.misses / session.total_swings) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Fouls</span>
                  <span className="font-medium">{session.fouls}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Contact Rate</span>
                  <span className="font-medium text-green-500">{session.contact_rate}%</span>
                </div>
              </div>
            </div>
            
            {/* Exit Velocity Section */}
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Exit Velocity
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Avg Exit Velo</span>
                  <span className="font-medium">{session.avg_exit_velo} mph</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Max Exit Velo</span>
                  <span className="font-medium text-green-500">{session.max_exit_velo} mph</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>90+ mph</span>
                  <span className="font-medium">{session.velo_90_plus}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>95+ mph</span>
                  <span className="font-medium">{session.velo_95_plus}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>100+ mph</span>
                  <span className="font-medium text-green-500">{session.velo_100_plus}</span>
                </div>
              </div>
            </div>
            
            {/* Launch Angle Section */}
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Launch Angle
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Avg Launch Angle</span>
                  <span className="font-medium">{session.avg_launch_angle}°</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Optimal (10-25°)</span>
                  <span className="font-medium text-green-500">{session.optimal_la_count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Ground Balls</span>
                  <span className="font-medium">{session.ground_ball_count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Fly Balls</span>
                  <span className="font-medium">{session.fly_ball_count}</span>
                </div>
              </div>
            </div>
            
            {/* Quality Metrics Section */}
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Quality Metrics
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Quality Hits</span>
                  <span className="font-medium">{session.quality_hits} ({session.quality_hit_pct || 0}%)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Barrels</span>
                  <span className="font-medium text-green-500">{session.barrel_hits} ({session.barrel_pct || 0}%)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Points</span>
                  <span className="font-medium">{session.total_points.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Points/Swing</span>
                  <span className="font-medium">{session.points_per_swing}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Results Breakdown */}
          {session.results_breakdown && Object.keys(session.results_breakdown).length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Results Breakdown
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(session.results_breakdown)
                  .sort(([,a], [,b]) => b - a)
                  .map(([result, count]) => (
                    <Badge key={result} variant="outline">
                      {result}: {count}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
          
          {/* Hit Types Breakdown */}
          {session.hit_types_breakdown && Object.keys(session.hit_types_breakdown).length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Hit Types
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(session.hit_types_breakdown)
                  .sort(([,a], [,b]) => b - a)
                  .map(([type, count]) => (
                    <Badge key={type} variant="secondary">
                      {type}: {count}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Session
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
