import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Video, Clock, CheckCircle, XCircle, Loader2, ChevronRight, Play } from "lucide-react";
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
          <div className="space-y-2">
            <div className="grid grid-cols-8 gap-2 text-xs font-medium text-slate-400 px-3 py-2 border-b border-slate-700">
              <span>Date</span>
              <span className="col-span-2">Filename</span>
              <span>Source</span>
              <span>Status</span>
              <span>Score</span>
              <span>Action</span>
              <span></span>
            </div>
            {uploads.map((upload) => (
              <div 
                key={upload.id} 
                className="grid grid-cols-8 gap-2 items-center px-3 py-2 rounded-lg hover:bg-slate-800/50 text-sm cursor-pointer transition-colors"
                onClick={() => setSelectedSession(upload)}
              >
                <span className="text-slate-300">
                  {format(new Date(upload.created_at || upload.session_date), 'MM/dd/yy')}
                </span>
                <span className="col-span-2 text-slate-300 truncate" title={upload.video_filename || 'Unknown'}>
                  {upload.video_filename || 'Unknown'}
                </span>
                <span className="text-slate-400 text-xs">
                  {upload.upload_source === 'reboot_api' ? 'Reboot' : upload.upload_source === 'admin_upload' ? 'Upload' : '-'}
                </span>
                <span>{getStatusDisplay(upload.processing_status)}</span>
                <span className={getGradeColor(upload.grade)}>
                  {upload.composite_score ? (
                    <span className="font-medium">
                      {upload.composite_score} <span className="text-xs opacity-75">({upload.grade})</span>
                    </span>
                  ) : upload.processing_status === 'failed' ? (
                    <span className="text-red-400 text-xs" title={upload.error_message || undefined}>Error</span>
                  ) : (
                    '-'
                  )}
                </span>
                <span>
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
                </span>
                <span className="text-slate-500">
                  <ChevronRight className="h-4 w-4" />
                </span>
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
