import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getGrade } from "@/lib/reboot-parser";

interface RebootUpload {
  id: string;
  session_date: string;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  composite_score: number | null;
  grade: string | null;
  ground_flow_score: number | null;
  core_flow_score: number | null;
  upper_flow_score: number | null;
  pelvis_velocity: number | null;
  torso_velocity: number | null;
  x_factor: number | null;
  bat_ke: number | null;
  transfer_efficiency: number | null;
  consistency_cv: number | null;
  consistency_grade: string | null;
  weakest_link: string | null;
  ik_file_uploaded: boolean;
  me_file_uploaded: boolean;
}

interface RebootSessionDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: RebootUpload | null;
  onDelete: () => void;
}

export function RebootSessionDetail({
  open,
  onOpenChange,
  session,
  onDelete
}: RebootSessionDetailProps) {
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
        .from("reboot_uploads")
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
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-500" />
            Reboot Motion Session
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{formatDate(session.session_date)}</p>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Main Scores */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Brain', score: session.brain_score },
              { label: 'Body', score: session.body_score },
              { label: 'Bat', score: session.bat_score },
              { label: 'Composite', score: session.composite_score },
            ].map(({ label, score }) => (
              <div 
                key={label}
                className={`p-3 rounded-lg text-center text-white ${getScoreBgColor(score)}`}
              >
                <div className="text-xs opacity-90">{label}</div>
                <div className="text-2xl font-bold">{score ?? '--'}</div>
                <div className="text-xs opacity-90">
                  {score ? getGrade(score) : 'No data'}
                </div>
              </div>
            ))}
          </div>
          
          {/* Weakest Link */}
          {session.weakest_link && (
            <div className="text-center p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Weakest Link: </span>
              <span className="font-medium capitalize">{session.weakest_link}</span>
            </div>
          )}
          
          {/* Biomechanics Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">BIOMECHANICS</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pelvis Velocity:</span>
                  <span className="font-medium">{session.pelvis_velocity ?? '--'}°/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Torso Velocity:</span>
                  <span className="font-medium">{session.torso_velocity ?? '--'}°/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">X-Factor:</span>
                  <span className="font-medium">{session.x_factor ?? '--'}°</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">ENERGY TRANSFER</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bat KE:</span>
                  <span className="font-medium">{session.bat_ke ?? '--'} J</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transfer Eff:</span>
                  <span className="font-medium">{session.transfer_efficiency ?? '--'}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Consistency:</span>
                  <span className="font-medium">{session.consistency_cv ?? '--'}% CV</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sub-Scores */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">SUB-SCORES</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Ground Flow', score: session.ground_flow_score },
                { label: 'Core Flow', score: session.core_flow_score },
                { label: 'Upper Flow', score: session.upper_flow_score },
              ].map(({ label, score }) => (
                <div key={label} className="p-2 bg-muted rounded-lg text-center">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className={`text-lg font-bold ${getScoreColor(score)}`}>
                    {score ?? '--'}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* File Status */}
          <div className="flex gap-2">
            <Badge variant={session.ik_file_uploaded ? "default" : "secondary"}>
              IK {session.ik_file_uploaded ? "✓" : "✗"}
            </Badge>
            <Badge variant={session.me_file_uploaded ? "default" : "secondary"}>
              ME {session.me_file_uploaded ? "✓" : "✗"}
            </Badge>
          </div>
          
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
