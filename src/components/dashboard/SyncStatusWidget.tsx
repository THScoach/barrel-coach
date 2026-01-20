import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SyncLog {
  id: string;
  sync_type: string;
  players_checked: number;
  sessions_processed: number;
  errors_count: number;
  duration_ms: number;
  created_at: string;
}

export function SyncStatusWidget() {
  const { data: latestSync, isLoading } = useQuery({
    queryKey: ["latest-sync-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching sync logs:", error);
        return null;
      }
      return data as SyncLog | null;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const hasErrors = latestSync && latestSync.errors_count > 0;
  const isHealthy = latestSync && latestSync.errors_count === 0;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-slate-400" />
          Reboot Sync Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-32 bg-slate-700 animate-pulse rounded" />
            <div className="h-4 w-24 bg-slate-700 animate-pulse rounded" />
          </div>
        ) : !latestSync ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Clock className="h-4 w-4" />
            <span>No sync runs yet</span>
          </div>
        ) : (
          <>
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <Badge
                variant={hasErrors ? "destructive" : "default"}
                className={
                  hasErrors
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : "bg-green-500/20 text-green-400 border-green-500/30"
                }
              >
                {hasErrors ? (
                  <>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {latestSync.errors_count} Error{latestSync.errors_count > 1 ? "s" : ""}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Healthy
                  </>
                )}
              </Badge>
              <span className="text-xs text-slate-500">
                {formatDistanceToNow(new Date(latestSync.created_at), { addSuffix: true })}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center">
                <p className="text-lg font-bold text-white">
                  {latestSync.players_checked}
                </p>
                <p className="text-xs text-slate-400">Players</p>
              </div>
              <div className="text-center border-x border-slate-700">
                <p className="text-lg font-bold text-amber-400">
                  {latestSync.sessions_processed}
                </p>
                <p className="text-xs text-slate-400">Synced</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-300">
                  {(latestSync.duration_ms / 1000).toFixed(1)}s
                </p>
                <p className="text-xs text-slate-400">Duration</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
