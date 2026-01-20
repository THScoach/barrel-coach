import { Link } from "react-router-dom";
import { Play, Clock, Target, Activity, Zap, Circle, Brain, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Drill {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  four_b_category: string | null;
  focus_area: string | null;
  video_thumbnail_url: string | null;
  sets: number | null;
  reps: number | null;
  is_premium: boolean | null;
  skill_levels: string[] | null;
}

interface DrillCardProps {
  drill: Drill;
  showAssignedReason?: string | null;
}

const categoryConfig: Record<string, { icon: typeof Brain; color: string; bgColor: string; label: string }> = {
  brain: { icon: Brain, color: "text-purple-400", bgColor: "bg-purple-500/20", label: "Brain" },
  body: { icon: Activity, color: "text-blue-400", bgColor: "bg-blue-500/20", label: "Body" },
  bat: { icon: Zap, color: "text-orange-400", bgColor: "bg-orange-500/20", label: "Bat" },
  ball: { icon: Circle, color: "text-green-400", bgColor: "bg-green-500/20", label: "Ball" },
  general: { icon: Target, color: "text-gray-400", bgColor: "bg-gray-500/20", label: "General" },
};

const focusLabels: Record<string, string> = {
  ground_flow: "Ground Flow",
  core_flow: "Core Flow",
  upper_flow: "Upper Flow",
  timing: "Timing",
  consistency: "Consistency",
  general: "General",
};

export function DrillCard({ drill, showAssignedReason }: DrillCardProps) {
  const category = drill.four_b_category || "general";
  const config = categoryConfig[category] || categoryConfig.general;
  const Icon = config.icon;
  const slug = drill.slug || drill.id;

  return (
    <Link
      to={`/drills/${slug}`}
      className={cn(
        "group block bg-[#111113] rounded-xl border border-gray-800/50 overflow-hidden",
        "hover:border-[#DC2626]/50 hover:shadow-xl hover:shadow-red-900/10 transition-all duration-300",
        "hover:scale-[1.02]"
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-900 overflow-hidden">
        {drill.video_thumbnail_url ? (
          <img
            src={drill.video_thumbnail_url}
            alt={drill.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
            <Icon className={cn("h-12 w-12", config.color, "opacity-50")} />
          </div>
        )}
        
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-[#DC2626] flex items-center justify-center">
            <Play className="h-6 w-6 text-white ml-1" fill="white" />
          </div>
        </div>

        {/* Premium badge */}
        {drill.is_premium && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-amber-500/90 text-black text-xs font-bold">
              <Lock className="h-3 w-3 mr-1" />
              PRO
            </Badge>
          </div>
        )}

        {/* Duration */}
        {(drill.sets || drill.reps) && (
          <div className="absolute bottom-2 right-2 bg-black/70 rounded px-2 py-1 flex items-center gap-1">
            <Clock className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-300">
              {drill.sets || 3}×{drill.reps || 10}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category & Focus */}
        <div className="flex items-center gap-2 mb-2">
          <Badge className={cn("text-xs font-bold uppercase tracking-wider", config.bgColor, config.color, "border-0")}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
          {drill.focus_area && (
            <span className="text-xs text-gray-500">
              {focusLabels[drill.focus_area] || drill.focus_area}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-bold text-white text-lg mb-2 group-hover:text-[#DC2626] transition-colors">
          {drill.name}
        </h3>

        {/* Description */}
        {drill.description && (
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
            {drill.description}
          </p>
        )}

        {/* Assigned Reason */}
        {showAssignedReason && (
          <div className="mt-3 pt-3 border-t border-gray-800">
            <p className="text-xs text-[#DC2626] font-medium">
              {showAssignedReason}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}