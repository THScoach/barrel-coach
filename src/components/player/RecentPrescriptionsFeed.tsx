/**
 * Recent Prescriptions Feed - Stack-style video prescription cards
 * Shows auto-assigned training content from Admin Vault
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Play, CheckCircle2, Brain, Activity, Zap, Target, Video, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProcessingStatusBadge } from "./ProcessingStatusBadge";

interface PrescribedVideo {
  id: string;
  video_id: string;
  prescribed_reason: string | null;
  four_b_category: string | null;
  is_completed: boolean;
  video: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    four_b_category: string | null;
    gumlet_playback_url: string | null;
  };
}

interface RecentPrescriptionsFeedProps {
  playerId: string;
  weakestCategory?: string | null;
  onVideoClick?: (video: PrescribedVideo) => void;
  maxItems?: number;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Brain; color: string }> = {
  brain: { icon: Brain, color: "text-purple-400" },
  body: { icon: Activity, color: "text-blue-400" },
  bat: { icon: Zap, color: "text-orange-400" },
  ball: { icon: Target, color: "text-emerald-400" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function RecentPrescriptionsFeed({ 
  playerId, 
  weakestCategory, 
  onVideoClick,
  maxItems = 4 
}: RecentPrescriptionsFeedProps) {
  const [prescriptions, setPrescriptions] = useState<PrescribedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrescriptions();
  }, [playerId, weakestCategory]);

  async function loadPrescriptions() {
    try {
      const { data, error } = await supabase
        .from("player_video_prescriptions")
        .select(`
          id,
          video_id,
          prescribed_reason,
          four_b_category,
          is_completed,
          video:drill_videos(
            id,
            title,
            description,
            thumbnail_url,
            duration_seconds,
            four_b_category,
            gumlet_playback_url
          )
        `)
        .eq("player_id", playerId)
        .eq("is_completed", false)
        .order("created_at", { ascending: false })
        .limit(maxItems);

      if (error) throw error;

      const valid = (data || []).filter(
        (p): p is PrescribedVideo => p.video !== null
      );
      setPrescriptions(valid);
    } catch (err) {
      console.error("Error loading prescriptions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function markComplete(prescriptionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase
      .from("player_video_prescriptions")
      .update({ 
        is_completed: true, 
        watched_at: new Date().toISOString(),
        watch_progress_pct: 100 
      })
      .eq("id", prescriptionId);

    setPrescriptions(prev => prev.filter(p => p.id !== prescriptionId));
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Your Prescriptions
        </h3>
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="animate-pulse bg-slate-800/50 rounded-lg h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (prescriptions.length === 0) {
    return (
      <div className="text-center py-6 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <Video className="h-8 w-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No prescriptions yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Complete an assessment to get personalized drills
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Your Prescriptions
        </h3>
        {weakestCategory && (
          <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">
            Focus: {weakestCategory}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {prescriptions.map(prescription => {
          const category = prescription.four_b_category?.toLowerCase() || 'brain';
          const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.brain;
          const Icon = config.icon;

          return (
            <button
              key={prescription.id}
              onClick={() => onVideoClick?.(prescription)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg text-left",
                "bg-slate-800/50 border border-slate-700/50",
                "hover:bg-slate-700/50 hover:border-slate-600 transition-all"
              )}
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-12 bg-slate-700 rounded overflow-hidden shrink-0">
                {prescription.video.thumbnail_url ? (
                  <img 
                    src={prescription.video.thumbnail_url} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="h-4 w-4 text-slate-500" />
                  </div>
                )}
                {prescription.video.duration_seconds && (
                  <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] px-1 rounded">
                    {formatDuration(prescription.video.duration_seconds)}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("h-3 w-3 shrink-0", config.color)} />
                  <span className="text-sm font-medium text-white truncate">
                    {prescription.video.title}
                  </span>
                </div>
                {prescription.prescribed_reason && (
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {prescription.prescribed_reason}
                  </p>
                )}
              </div>

              {/* Actions */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                onClick={(e) => markComplete(prescription.id, e)}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            </button>
          );
        })}
      </div>
    </div>
  );
}
