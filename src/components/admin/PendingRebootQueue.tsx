import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  CheckCircle, 
  Eye, 
  Clock,
  User,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Video2DAnalysisCard } from "./Video2DAnalysisCard";

interface PendingRebootItem {
  id: string;
  player_id: string;
  player_name: string;
  player_age: number | null;
  player_level: string | null;
  uploaded_at: string;
  estimated_score: number | null;
  estimated_grade: string | null;
  original_video_url: string | null;
  video_2d_analysis: any;
  leak_detected: string | null;
  motor_profile: string | null;
  analysis_confidence: number | null;
}

export function PendingRebootQueue() {
  const [queue, setQueue] = useState<PendingRebootItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<PendingRebootItem | null>(null);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      // Query directly from reboot_uploads with join
      const { data, error } = await supabase
        .from("reboot_uploads")
        .select(`
          id,
          player_id,
          created_at,
          composite_score,
          grade,
          original_video_url,
          video_2d_analysis,
          leak_detected,
          motor_profile,
          analysis_confidence,
          players!inner(name, age, level)
        `)
        .eq("pending_reboot", true)
        .eq("analysis_type", "2d_video")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const formattedData: PendingRebootItem[] = (data || []).map((item: any) => ({
        id: item.id,
        player_id: item.player_id,
        player_name: item.players?.name || "Unknown",
        player_age: item.players?.age,
        player_level: item.players?.level,
        uploaded_at: item.created_at,
        estimated_score: item.composite_score,
        estimated_grade: item.grade,
        original_video_url: item.original_video_url,
        video_2d_analysis: item.video_2d_analysis,
        leak_detected: item.leak_detected,
        motor_profile: item.motor_profile,
        analysis_confidence: item.analysis_confidence,
      }));

      setQueue(formattedData);
    } catch (error) {
      console.error("Error loading queue:", error);
      toast.error("Failed to load pending queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleDownloadVideo = async (videoUrl: string, playerName: string) => {
    if (!videoUrl) {
      toast.error("No video URL available");
      return;
    }

    try {
      // If it's a Supabase storage URL, create a download link
      window.open(videoUrl, "_blank");
      toast.success(`Opening video for ${playerName}`);
    } catch (error) {
      console.error("Error downloading video:", error);
      toast.error("Failed to download video");
    }
  };

  const handleMarkComplete = async (item: PendingRebootItem) => {
    setMarkingComplete(item.id);
    try {
      const { error } = await supabase
        .from("reboot_uploads")
        .update({
          pending_reboot: false,
          analysis_type: "reboot_3d",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (error) throw error;

      toast.success(`Marked ${item.player_name}'s analysis as complete`);
      
      // Remove from local state
      setQueue(prev => prev.filter(q => q.id !== item.id));

      // Optionally trigger SMS notification to player
      // await supabase.functions.invoke("send-coach-rick-sms", {
      //   body: { player_id: item.player_id, type: "analysis_complete" }
      // });
    } catch (error) {
      console.error("Error marking complete:", error);
      toast.error("Failed to mark as complete");
    } finally {
      setMarkingComplete(null);
    }
  };

  const getLeakBadgeColor = (leak: string | null) => {
    if (!leak || leak === "CLEAN_TRANSFER") return "bg-green-500/10 text-green-500";
    return "bg-yellow-500/10 text-yellow-500";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Reboot Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Reboot Analysis
              {queue.length > 0 && (
                <Badge variant="secondary">{queue.length}</Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadQueue}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No pending videos in queue</p>
              <p className="text-sm">All player videos have been processed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.player_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>Uploaded {formatDistanceToNow(new Date(item.uploaded_at))} ago</span>
                        {item.player_level && (
                          <Badge variant="outline" className="text-xs">
                            {item.player_level}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* 2D Score */}
                    <div className="text-right">
                      <div className="font-bold text-lg">{item.estimated_score || "--"}</div>
                      <div className="text-xs text-muted-foreground">2D Score</div>
                    </div>

                    {/* Leak Badge */}
                    {item.leak_detected && (
                      <Badge className={getLeakBadgeColor(item.leak_detected)}>
                        {item.leak_detected === "CLEAN_TRANSFER" ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 mr-1" />
                        )}
                        {item.leak_detected.replace(/_/g, " ")}
                      </Badge>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => item.original_video_url && handleDownloadVideo(item.original_video_url, item.player_name)}
                        disabled={!item.original_video_url}
                        title="Download Video"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedItem(item)}
                        title="View 2D Analysis"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkComplete(item)}
                        disabled={markingComplete === item.id}
                        title="Mark Complete"
                        className="text-green-500 hover:text-green-600"
                      >
                        {markingComplete === item.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2D Analysis Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              2D Analysis - {selectedItem?.player_name}
            </DialogTitle>
          </DialogHeader>
          {selectedItem?.video_2d_analysis && (
            <Video2DAnalysisCard
              analysis={selectedItem.video_2d_analysis}
              isPaidUser={true}
              pendingReboot={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
