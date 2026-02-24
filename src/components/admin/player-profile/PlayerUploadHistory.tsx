import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Video, Clock, CheckCircle, XCircle, Loader2, ChevronRight, Play, AlertTriangle, Target, MessageSquare, X } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { SessionDetailModal } from "./SessionDetailModal";
import { toast } from "sonner";

interface PlayerUploadHistoryProps {
  playerId: string;
}

interface RebootUpload {
  id: string;
  video_filename: string | null;
  processing_status: string | null;
  frame_rate: number | null;
  session_date: string;
  created_at: string | null;
  composite_score: number | null;
  grade: string | null;
  error_message: string | null;
  upload_source: string | null;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
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
  reboot_session_id: string | null;
  video_url: string | null;
  // AI coaching notes
  leak_detected: string | null;
  leak_evidence: string | null;
  motor_profile: string | null;
  motor_profile_evidence: string | null;
  priority_drill: string | null;
  analysis_confidence: number | null;
}

const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: Clock, label: "Pending" },
  pending_2d_analysis: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock, label: "Pending 2D" },
  uploading: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Loader2, label: "Uploading" },
  processing: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Loader2, label: "Processing" },
  complete: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle, label: "Complete" },
  failed: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, label: "Failed" },
};

export function PlayerUploadHistory({ playerId }: PlayerUploadHistoryProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedSession, setSelectedSession] = useState<RebootUpload | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [clearingStuck, setClearingStuck] = useState(false);
  const queryClient = useQueryClient();

  const { data: uploads, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['player-upload-history', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reboot_uploads')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as RebootUpload[];
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Auto-enable refresh if there are processing items
  useEffect(() => {
    const hasProcessing = uploads?.some(u => 
      u.processing_status === 'processing' || u.processing_status === 'uploading'
    );
    setAutoRefresh(!!hasProcessing);
  }, [uploads]);

  const handleRunAnalysis = async (upload: RebootUpload, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!upload.video_url) {
      toast.error("No video URL found for this upload");
      return;
    }

    setAnalyzingId(upload.id);

    try {
      // Step 1: Create video_swing_sessions record
      const { data: sessionData, error: sessionError } = await supabase
        .from("video_swing_sessions")
        .insert({
          player_id: playerId,
          session_date: upload.session_date,
          source: "admin_upload",
          context: "practice",
          status: "pending",
          swing_count: 1,
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(`Failed to create session: ${sessionError.message}`);
      }

      // Step 2: Create video_swings record
      const storagePath = upload.video_url.split('/swing-videos/')[1] || '';
      const { error: swingError } = await supabase
        .from("video_swings")
        .insert({
          session_id: sessionData.id,
          video_storage_path: storagePath,
          video_url: upload.video_url,
          swing_index: 1,
          frame_rate: upload.frame_rate || 240,
          status: "pending",
        });

      if (swingError) {
        throw new Error(`Failed to create swing record: ${swingError.message}`);
      }

      // Step 3: Update reboot_uploads status
      await supabase
        .from("reboot_uploads")
        .update({ processing_status: "processing" })
        .eq("id", upload.id);

      // Step 4: Trigger analysis
      const { error: analysisError } = await supabase.functions.invoke(
        "analyze-video-swing-session",
        { body: { sessionId: sessionData.id } }
      );

      if (analysisError) {
        await supabase
          .from("reboot_uploads")
          .update({ processing_status: "failed", error_message: analysisError.message })
          .eq("id", upload.id);
        throw analysisError;
      }

      // Update reboot_uploads status to complete
      await supabase
        .from("reboot_uploads")
        .update({ processing_status: "complete" })
        .eq("id", upload.id);

      toast.success("Analysis complete!");
      refetch();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Analysis failed";
      toast.error(msg);
    } finally {
      setAnalyzingId(null);
    }
  };

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const hasStuckRows = uploads?.some(u =>
    u.processing_status !== 'complete' && u.processing_status !== 'failed' &&
    u.created_at && u.created_at < cutoff
  );

  const handleClearStuck = async () => {
    setClearingStuck(true);
    try {
      await supabase
        .from('reboot_sessions')
        .delete()
        .eq('player_id', playerId)
        .neq('status', 'complete')
        .lt('created_at', cutoff);

      await supabase
        .from('reboot_uploads')
        .delete()
        .eq('player_id', playerId)
        .is('composite_score', null)
        .lt('created_at', cutoff);

      toast.success('Cleared stuck sessions');
      refetch();
    } catch {
      toast.error('Failed to clear stuck sessions');
    } finally {
      setClearingStuck(false);
    }
  };

  const getStatusDisplay = (status: string | null) => {
    const config = statusConfig[status || 'pending'] || statusConfig.pending;
    const Icon = config.icon;
    const isAnimated = status === 'uploading' || status === 'processing';
    
    return (
      <Badge variant="outline" className={config.color}>
        <Icon className={`h-3 w-3 mr-1 ${isAnimated ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    );
  };

  const getGradeColor = (grade: string | null) => {
    if (!grade) return 'text-slate-400';
    if (grade.includes('Plus')) return 'text-emerald-400';
    if (grade === 'Above Avg') return 'text-green-400';
    if (grade === 'Average') return 'text-amber-400';
    return 'text-orange-400';
  };

  return (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white flex items-center gap-2">
          <Video className="h-5 w-5" />
          Upload History
        </CardTitle>
        <div className="flex items-center gap-2">
          {autoRefresh && (
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Auto-refreshing
            </span>
          )}
          {hasStuckRows && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearStuck}
              disabled={clearingStuck}
              className="text-red-500 hover:text-red-400 text-xs h-7 px-2"
            >
              {clearingStuck ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
              Clear Stuck
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : !uploads || uploads.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Video className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No video uploads yet</p>
            <p className="text-sm mt-1">Upload a swing video to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {uploads.map((upload) => (
              <div 
                key={upload.id} 
                className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 cursor-pointer transition-colors"
                onClick={() => setSelectedSession(upload)}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300 text-sm">
                      {format(new Date(upload.created_at || upload.session_date), 'MMM d, yyyy')}
                    </span>
                    <span className="text-slate-400 text-xs truncate max-w-[200px]" title={upload.video_filename || 'Unknown'}>
                      {upload.video_filename || 'Unknown'}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {upload.upload_source === 'reboot_api' ? 'Reboot' : upload.upload_source === 'admin_upload' ? 'Upload' : 'Import'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusDisplay(upload.processing_status)}
                    {upload.composite_score && (
                      <span className={`font-bold ${getGradeColor(upload.grade)}`}>
                        {upload.composite_score} <span className="text-xs opacity-75">({upload.grade})</span>
                      </span>
                    )}
                    {(upload.processing_status === 'pending_2d_analysis' || upload.processing_status === 'pending' || upload.processing_status === 'failed') && upload.video_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleRunAnalysis(upload, e)}
                        disabled={analyzingId === upload.id}
                        className="h-7 px-2 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                      >
                        {analyzingId === upload.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            Analyze
                          </>
                        )}
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </div>
                </div>

                {/* AI Coaching Notes - Only show if analysis complete */}
                {upload.processing_status === 'complete' && (upload.leak_detected || upload.priority_drill || upload.motor_profile) && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                    {/* Leak & Motor Profile Row */}
                    <div className="flex flex-wrap gap-3 text-xs">
                      {upload.leak_detected && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
                          <AlertTriangle className="h-3 w-3 text-red-400" />
                          <span className="text-red-300 font-medium">{upload.leak_detected.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {upload.motor_profile && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                          <Target className="h-3 w-3 text-blue-400" />
                          <span className="text-blue-300 font-medium">{upload.motor_profile}</span>
                        </div>
                      )}
                      {upload.analysis_confidence && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-500/10 border border-slate-500/20">
                          <span className="text-slate-400">{Math.round(upload.analysis_confidence * 100)}% confidence</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Leak Evidence */}
                    {upload.leak_evidence && (
                      <div className="flex items-start gap-2 text-xs">
                        <MessageSquare className="h-3 w-3 text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-slate-300 line-clamp-2">{upload.leak_evidence}</p>
                      </div>
                    )}
                    
                    {/* Priority Drill */}
                    {upload.priority_drill && (
                      <div className="flex items-start gap-2 text-xs">
                        <Target className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <p className="text-emerald-300">
                          <span className="font-medium">Priority:</span> {upload.priority_drill}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <SessionDetailModal 
        open={!!selectedSession} 
        onOpenChange={(open) => !open && setSelectedSession(null)}
        session={selectedSession}
      />
    </Card>
  );
}
