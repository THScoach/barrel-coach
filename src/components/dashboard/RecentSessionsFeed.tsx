import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { LeakBadge } from "@/components/ui/LeakBadge";
import { MotorProfileBadge } from "@/components/ui/MotorProfileBadge";
import { Loader2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RecentSession {
  id: string;
  player_id: string | null;
  player_name: string;
  session_date: string;
  composite_score: number | null;
  motor_profile: string | null;
  leak_detected: string | null;
  data_source: string | null;
}

export function RecentSessionsFeed() {
  const navigate = useNavigate();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["recent-sessions-feed"],
    queryFn: async () => {
      // Get recent reboot_uploads with player info
      const { data: uploads, error } = await supabase
        .from("reboot_uploads")
        .select(`
          id,
          player_id,
          session_date,
          composite_score,
          upload_source,
          weakest_link,
          players!reboot_uploads_player_id_fkey (
            name,
            id
          )
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      return (uploads || []).map((u: any) => ({
        id: u.id,
        player_id: u.player_id,
        player_name: u.players?.name || "Unknown Player",
        session_date: u.session_date,
        composite_score: u.composite_score,
        motor_profile: null, // Would come from analysis
        leak_detected: u.weakest_link,
        data_source: u.upload_source || "reboot",
      })) as RecentSession[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No recent sessions found
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => session.player_id && navigate(`/admin/players/${session.player_id}`)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/50 transition-colors text-left group"
        >
          {/* Player Name */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {session.player_name}
            </p>
            <p className="text-xs text-slate-500">
              {formatDistanceToNow(new Date(session.session_date), { addSuffix: true })}
            </p>
          </div>

          {/* Score */}
          {session.composite_score && (
            <ScoreBadge score={session.composite_score} size="sm" />
          )}

          {/* Leak */}
          {session.leak_detected && (
            <LeakBadge leak={session.leak_detected} size="sm" />
          )}

          {/* Arrow */}
          <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
        </button>
      ))}
    </div>
  );
}
