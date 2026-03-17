import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Video, ExternalLink, Clock, Calendar, Play } from "lucide-react";
import { kommodoApi } from "@/hooks/useKommodoApi";

interface PlayerKommodoTabProps {
  playersTableId?: string | null;
  playerName?: string;
}

export function PlayerKommodoTab({ playersTableId, playerName }: PlayerKommodoTabProps) {
  const [selectedRecording, setSelectedRecording] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['player-kommodo-recordings', playersTableId],
    queryFn: () => kommodoApi.getPlayerRecordings(playersTableId!),
    enabled: !!playersTableId,
  });

  const recordings = data?.recordings || [];

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!playersTableId) {
    return (
      <Card className="bg-slate-900/80 border-slate-800">
        <CardContent className="py-12 text-center">
          <Video className="h-10 w-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">Player not linked to analytics profile.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Video className="h-5 w-5 text-orange-400" />
            Kommodo Recordings
            {recordings.length > 0 && (
              <Badge variant="secondary" className="ml-2">{recordings.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recordings.length === 0 ? (
            <div className="text-center py-8">
              <Video className="h-10 w-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400 text-sm">No Kommodo recordings linked to {playerName || 'this player'}.</p>
              <p className="text-slate-500 text-xs mt-1">Use the Kommodo Integration page to link recordings.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recordings.map((rec: any) => (
                <div
                  key={rec.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
                  onClick={() => setSelectedRecording(rec)}
                >
                  <div className="w-16 h-10 rounded bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {rec.thumbnail_url ? (
                      <img src={rec.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Play className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{rec.title || 'Untitled'}</p>
                    <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                      {rec.session_type && (
                        <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-400 px-1.5 py-0">
                          {rec.session_type}
                        </Badge>
                      )}
                      {rec.duration_seconds && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(rec.duration_seconds)}
                        </span>
                      )}
                      {(rec.recording_date || rec.recording_created_at) && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(rec.recording_date || rec.recording_created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400 shrink-0">
                    {rec.link_method === 'auto_member' ? 'Auto (member)' :
                     rec.link_method === 'auto_name' ? 'Auto (name)' : 'Manual'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video player modal */}
      <Dialog open={!!selectedRecording} onOpenChange={() => setSelectedRecording(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-white">{selectedRecording?.title || 'Recording'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRecording?.video_url ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={selectedRecording.video_url}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              </div>
            ) : selectedRecording?.page_url ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <iframe
                  src={selectedRecording.page_url}
                  className="w-full h-full border-0"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
                <p className="text-slate-400">No video URL available</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">
                {selectedRecording?.duration_seconds && (
                  <span>Duration: {formatDuration(selectedRecording.duration_seconds)}</span>
                )}
              </div>
              {selectedRecording?.page_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  onClick={() => window.open(selectedRecording.page_url, '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open in Kommodo
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
