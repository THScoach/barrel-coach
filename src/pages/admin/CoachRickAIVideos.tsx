import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Video, Upload, Loader2, CheckCircle2, AlertCircle,
  BookOpen, MessageSquare, Sparkles, Play, ExternalLink
} from "lucide-react";
import { Link } from "react-router-dom";

interface ProcessedVideo {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  processed_at: string;
  knowledge_count: number;
  scenarios_count: number;
  cues_count: number;
}

export default function CoachRickAIVideos() {
  const queryClient = useQueryClient();
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [contentType, setContentType] = useState<"teaching" | "analysis" | "both">("both");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null);

  // Load available drill videos
  const { data: drillVideos = [] } = useQuery({
    queryKey: ["drill-videos-for-learning"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drill_videos")
        .select("id, title, video_url, thumbnail_url, transcript, status")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Get knowledge/scenario counts for stats
  const { data: stats } = useQuery({
    queryKey: ["coach-rick-stats"],
    queryFn: async () => {
      const [knowledge, scenarios, cues] = await Promise.all([
        supabase.from("clawdbot_knowledge").select("id", { count: "exact", head: true }),
        supabase.from("clawdbot_scenarios").select("id", { count: "exact", head: true }),
        supabase.from("clawdbot_cues").select("id", { count: "exact", head: true }),
      ]);
      return {
        knowledge: knowledge.count || 0,
        scenarios: scenarios.count || 0,
        cues: cues.count || 0,
      };
    },
  });

  const processVideo = async (url: string, title: string, videoId?: string) => {
    setIsProcessing(true);
    setProgress(10);
    setLastResult(null);

    try {
      setProgress(30);
      
      const { data, error } = await supabase.functions.invoke("process-coach-rick-video", {
        body: {
          videoUrl: url,
          videoId,
          title,
          contentType,
        },
      });

      setProgress(90);

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Processing failed");

      setProgress(100);
      setLastResult(data);
      
      toast.success(
        `Added ${data.results.knowledge_added} knowledge entries, ${data.results.scenarios_added} scenarios, ${data.results.cues_added} cues`
      );
      
      queryClient.invalidateQueries({ queryKey: ["coach-rick-stats"] });
    } catch (err) {
      console.error("Process error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to process video");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUrlSubmit = () => {
    if (!videoUrl.trim()) {
      toast.error("Enter a video URL");
      return;
    }
    processVideo(videoUrl, videoTitle || "Untitled Video");
  };

  const handleDrillVideoSelect = (video: typeof drillVideos[0]) => {
    processVideo(video.video_url, video.title, video.id);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0B" }}>
      <AdminHeader />

      <main className="container py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/admin/coach-rick-ai">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="p-3 rounded-xl bg-purple-500/20">
            <Video className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Video Learning</h1>
            <p className="text-slate-400 text-sm">Train Coach Rick AI from coaching videos</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}>
            <CardContent className="p-4 text-center">
              <BookOpen className="h-5 w-5 mx-auto mb-2 text-blue-400" />
              <p className="text-2xl font-bold text-white">{stats?.knowledge || 0}</p>
              <p className="text-xs text-slate-400">Knowledge Entries</p>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}>
            <CardContent className="p-4 text-center">
              <MessageSquare className="h-5 w-5 mx-auto mb-2 text-green-400" />
              <p className="text-2xl font-bold text-white">{stats?.scenarios || 0}</p>
              <p className="text-xs text-slate-400">Q&A Scenarios</p>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}>
            <CardContent className="p-4 text-center">
              <Sparkles className="h-5 w-5 mx-auto mb-2 text-yellow-400" />
              <p className="text-2xl font-bold text-white">{stats?.cues || 0}</p>
              <p className="text-xs text-slate-400">Coaching Cues</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <Card style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}>
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Process Video
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">Video URL</Label>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-slate-800 border-slate-700 text-white"
                  disabled={isProcessing}
                />
              </div>
              <div>
                <Label className="text-slate-300">Title (optional)</Label>
                <Input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Video title for context"
                  className="bg-slate-800 border-slate-700 text-white"
                  disabled={isProcessing}
                />
              </div>
              <div>
                <Label className="text-slate-300">Content Type</Label>
                <Select value={contentType} onValueChange={(v: any) => setContentType(v)} disabled={isProcessing}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teaching">Teaching Content</SelectItem>
                    <SelectItem value="analysis">Swing Analysis</SelectItem>
                    <SelectItem value="both">Both Types</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-slate-400 text-center">
                    {progress < 30 ? "Starting..." : progress < 90 ? "Transcribing & extracting..." : "Saving..."}
                  </p>
                </div>
              )}

              <Button
                onClick={handleUrlSubmit}
                disabled={isProcessing || !videoUrl.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Process & Learn
                  </>
                )}
              </Button>

              {/* Last Result */}
              {lastResult && (
                <div className="mt-4 p-4 rounded-lg bg-green-900/20 border border-green-700/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-green-400 font-medium">Processing Complete</span>
                  </div>
                  <div className="text-sm text-slate-300 space-y-1">
                    <p>✅ {lastResult.results.knowledge_added} knowledge entries added</p>
                    <p>✅ {lastResult.results.scenarios_added} Q&A scenarios added</p>
                    <p>✅ {lastResult.results.cues_added} coaching cues added</p>
                    {lastResult.results.errors?.length > 0 && (
                      <p className="text-yellow-400">⚠️ {lastResult.results.errors.length} items skipped</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Existing Videos */}
          <Card style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}>
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Video className="h-5 w-5" />
                Academy Videos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {drillVideos.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No videos in academy yet</p>
                  ) : (
                    drillVideos.map((video) => (
                      <div
                        key={video.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                      >
                        <div className="w-16 h-10 rounded bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Play className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{video.title}</p>
                          <p className="text-xs text-slate-400">
                            {video.transcript ? "Has transcript" : "No transcript"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDrillVideoSelect(video)}
                          disabled={isProcessing}
                          className="text-purple-400 hover:text-purple-300"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
