import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Video, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";

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
}

const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: Clock, label: "Pending" },
  uploading: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Loader2, label: "Uploading" },
  processing: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Loader2, label: "Processing" },
  complete: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle, label: "Complete" },
  failed: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, label: "Failed" },
};

export function PlayerUploadHistory({ playerId }: PlayerUploadHistoryProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: uploads, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['reboot-uploads', playerId],
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
            <div className="grid grid-cols-6 gap-2 text-xs font-medium text-slate-400 px-3 py-2 border-b border-slate-700">
              <span>Date</span>
              <span className="col-span-2">Filename</span>
              <span>Status</span>
              <span>FPS</span>
              <span>Score</span>
            </div>
            {uploads.map((upload) => (
              <div 
                key={upload.id} 
                className="grid grid-cols-6 gap-2 items-center px-3 py-2 rounded-lg hover:bg-slate-800/50 text-sm"
              >
                <span className="text-slate-300">
                  {format(new Date(upload.created_at || upload.session_date), 'MM/dd/yy')}
                </span>
                <span className="col-span-2 text-slate-300 truncate" title={upload.video_filename || 'Unknown'}>
                  {upload.video_filename || 'Unknown'}
                </span>
                <span>{getStatusDisplay(upload.processing_status)}</span>
                <span className="text-slate-400">{upload.frame_rate || '-'}</span>
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
