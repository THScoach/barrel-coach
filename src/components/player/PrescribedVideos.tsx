/**
 * Prescribed Videos - Embedded video player for player prescriptions
 * Shows videos directly in the dashboard based on 4B weakest category
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GumletVideoPlayer } from "@/components/video/GumletVideoPlayer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Play, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Brain,
  Activity,
  Zap,
  Target,
  Video
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PrescribedVideo {
  id: string;
  video_id: string;
  prescribed_reason: string | null;
  four_b_category: string | null;
  is_completed: boolean;
  watch_progress_pct: number;
  video: {
    id: string;
    title: string;
    description: string | null;
    video_url: string;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    four_b_category: string | null;
    gumlet_playback_url: string | null;
    gumlet_hls_url: string | null;
  };
}

interface PrescribedVideosProps {
  playerId: string;
  weakestCategory?: string | null;
  compact?: boolean;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Brain; color: string; label: string }> = {
  brain: { icon: Brain, color: "text-purple-400", label: "Brain" },
  body: { icon: Activity, color: "text-blue-400", label: "Body" },
  bat: { icon: Zap, color: "text-orange-400", label: "Bat" },
  ball: { icon: Target, color: "text-emerald-400", label: "Ball" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function PrescribedVideos({ playerId, weakestCategory, compact = false }: PrescribedVideosProps) {
  const [prescriptions, setPrescriptions] = useState<PrescribedVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<PrescribedVideo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrescriptions();
  }, [playerId, weakestCategory]);

  async function loadPrescriptions() {
    try {
      // First try to get existing prescriptions
      const { data: existing, error: existingError } = await supabase
        .from("player_video_prescriptions")
        .select(`
          id,
          video_id,
          prescribed_reason,
          four_b_category,
          is_completed,
          watch_progress_pct,
          video:drill_videos(
            id,
            title,
            description,
            video_url,
            thumbnail_url,
            duration_seconds,
            four_b_category,
            gumlet_playback_url,
            gumlet_hls_url
          )
        `)
        .eq("player_id", playerId)
        .eq("is_completed", false)
        .order("created_at", { ascending: false })
        .limit(6);

      if (existingError) throw existingError;

      // Filter out null videos and cast properly
      const validPrescriptions = (existing || []).filter(
        (p): p is PrescribedVideo => p.video !== null
      );

      // If no prescriptions exist and we have a weakest category, auto-prescribe
      if (validPrescriptions.length === 0 && weakestCategory) {
        await supabase.rpc("prescribe_videos_for_player", {
          p_player_id: playerId,
          p_weakest_category: weakestCategory,
        });
        
        // Reload after prescribing
        const { data: newPrescriptions } = await supabase
          .from("player_video_prescriptions")
          .select(`
            id,
            video_id,
            prescribed_reason,
            four_b_category,
            is_completed,
            watch_progress_pct,
            video:drill_videos(
              id,
              title,
              description,
              video_url,
              thumbnail_url,
              duration_seconds,
              four_b_category,
              gumlet_playback_url,
              gumlet_hls_url
            )
          `)
          .eq("player_id", playerId)
          .eq("is_completed", false)
          .order("created_at", { ascending: false })
          .limit(6);

        const valid = (newPrescriptions || []).filter(
          (p): p is PrescribedVideo => p.video !== null
        );
        setPrescriptions(valid);
      } else {
        setPrescriptions(validPrescriptions);
      }
    } catch (err) {
      console.error("Error loading prescriptions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsWatched(prescriptionId: string) {
    await supabase
      .from("player_video_prescriptions")
      .update({ 
        is_completed: true, 
        watched_at: new Date().toISOString(),
        watch_progress_pct: 100 
      })
      .eq("id", prescriptionId);

    setPrescriptions((prev) => prev.filter((p) => p.id !== prescriptionId));
    setActiveVideo(null);
  }

  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (prescriptions.length === 0) {
    return null; // Don't show if no prescriptions
  }

  const CategoryIcon = activeVideo?.four_b_category 
    ? CATEGORY_CONFIG[activeVideo.four_b_category.toLowerCase()]?.icon || Video
    : Video;

  return (
    <Card className="bg-card/50 border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Prescribed for You
          </CardTitle>
          {weakestCategory && (
            <Badge variant="secondary" className="text-xs">
              Focus: {weakestCategory.charAt(0).toUpperCase() + weakestCategory.slice(1)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Active Video Player */}
        {activeVideo && (
          <div className="border-b border-border">
            <div className="aspect-video bg-black">
              <GumletVideoPlayer
                src={activeVideo.video.gumlet_hls_url || activeVideo.video.gumlet_playback_url || activeVideo.video.video_url}
                poster={activeVideo.video.thumbnail_url || undefined}
                autoPlay
                showControls
                onEnded={() => markAsWatched(activeVideo.id)}
              />
            </div>
            <div className="p-4 bg-muted/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">{activeVideo.video.title}</h3>
                  {activeVideo.prescribed_reason && (
                    <p className="text-sm text-muted-foreground mt-1">{activeVideo.prescribed_reason}</p>
                  )}
                </div>
                <Button 
                  size="sm" 
                  onClick={() => markAsWatched(activeVideo.id)}
                  className="shrink-0"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Mark Complete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Video List */}
        <ScrollArea className={cn("p-4", compact ? "max-h-[200px]" : "max-h-[300px]")}>
          <div className="space-y-2">
            {prescriptions.map((prescription) => {
              const isActive = activeVideo?.id === prescription.id;
              const config = CATEGORY_CONFIG[prescription.video.four_b_category?.toLowerCase() || "brain"];
              const Icon = config?.icon || Video;

              return (
                <button
                  key={prescription.id}
                  onClick={() => setActiveVideo(prescription)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                    isActive 
                      ? "bg-primary/10 border border-primary/30" 
                      : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                  )}
                >
                  {/* Thumbnail */}
                  <div className="relative w-20 h-12 bg-muted rounded overflow-hidden shrink-0">
                    {prescription.video.thumbnail_url ? (
                      <img 
                        src={prescription.video.thumbnail_url} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    {prescription.video.duration_seconds && (
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                        {formatDuration(prescription.video.duration_seconds)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-3 w-3", config?.color || "text-muted-foreground")} />
                      <span className="text-sm font-medium truncate">{prescription.video.title}</span>
                    </div>
                    {prescription.prescribed_reason && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {prescription.prescribed_reason}
                      </p>
                    )}
                  </div>

                  <ChevronRight className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    isActive ? "text-primary rotate-90" : "text-muted-foreground"
                  )} />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
