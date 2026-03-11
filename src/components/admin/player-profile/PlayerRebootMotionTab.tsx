import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Activity,
  Link2,
  Unlink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Calendar,
  Hash,
  ChevronRight,
  RefreshCw,
  Video,
} from "lucide-react";
import { format } from "date-fns";
import { RebootSessionDetailDrawer } from "./RebootSessionDetailDrawer";
import { ManualRebootUpload } from "./ManualRebootUpload";

/** Shows Reboot sessions that originated from video uploads (source = 'video_upload') */
function RebootVideoSessionsStatus({ playersTableId }: { playersTableId: string }) {
  const { data: videoSessions, isLoading } = useQuery({
    queryKey: ["reboot-video-sessions", playersTableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reboot_sessions")
        .select("id, session_date, status, reboot_session_id, created_at, notes")
        .eq("player_id", playersTableId)
        .in("source", ["video_upload", "auto"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!playersTableId,
    refetchInterval: 30000, // Auto-refresh every 30s for in-progress sessions
  });

  if (isLoading || !videoSessions || videoSessions.length === 0) return null;

  const statusColor = (s: string | null) => {
    if (s === "scored") return "bg-teal-500/15 text-teal-400 border-teal-500/30";
    if (s === "completed") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (s === "processing" || s === "exported" || s === "uploaded") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-slate-700/50 text-slate-400 border-slate-600";
  };

  const inProgress = videoSessions.filter(s => 
    ["uploaded", "processing", "exported", "ready_for_processing"].includes(s.status || "")
  );
  const completed = videoSessions.filter(s => 
    ["completed", "scored"].includes(s.status || "")
  );

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Video className="h-4 w-4" />
          Video Upload → 3D Analysis
          {inProgress.length > 0 && (
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-400 border-amber-500/30 ml-2">
              {inProgress.length} in progress
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {videoSessions.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            No video-to-Reboot sessions yet. Upload swing videos with the "Send to Reboot" option.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {videoSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-white flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-500" />
                      {session.session_date
                        ? format(new Date(session.session_date), "MMM d, yyyy")
                        : session.created_at
                          ? format(new Date(session.created_at), "MMM d, yyyy h:mm a")
                          : "Pending"}
                    </span>
                    <Badge variant="outline" className={statusColor(session.status)}>
                      {session.status || "unknown"}
                    </Badge>
                  </div>
                  {session.reboot_session_id && (
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Hash className="h-3 w-3" />
                      {session.reboot_session_id}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PlayerRebootMotionTabProps {
  playersTableId?: string | null;
  playerName?: string;
}

export function PlayerRebootMotionTab({
  playersTableId,
  playerName,
}: PlayerRebootMotionTabProps) {
  const queryClient = useQueryClient();
  const [manualId, setManualId] = useState("");
  const [selectedSession, setSelectedSession] = useState<any>(null);

  // Fetch player's reboot IDs from players table
  const { data: playerData, isLoading: loadingPlayer } = useQuery({
    queryKey: ["reboot-link", playersTableId],
    queryFn: async () => {
      if (!playersTableId) return null;
      const { data, error } = await supabase
        .from("players")
        .select("reboot_athlete_id, reboot_player_id, name, height_inches, weight_lbs, handedness")
        .eq("id", playersTableId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!playersTableId,
  });

  const isLinked = !!playerData?.reboot_athlete_id;

  // Link mutation — save a Reboot athlete ID to the player record
  const linkMutation = useMutation({
    mutationFn: async (rebootId: string) => {
      if (!playersTableId) throw new Error("No player record");
      const { error } = await supabase
        .from("players")
        .update({ reboot_athlete_id: rebootId })
        .eq("id", playersTableId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Linked to Reboot Motion athlete");
      setManualId("");
      queryClient.invalidateQueries({ queryKey: ["reboot-link", playersTableId] });
      queryClient.invalidateQueries({ queryKey: ["reboot-sessions", playersTableId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Unlink mutation
  const unlinkMutation = useMutation({
    mutationFn: async () => {
      if (!playersTableId) throw new Error("No player record");
      const { error } = await supabase
        .from("players")
        .update({ reboot_athlete_id: null, reboot_player_id: null })
        .eq("id", playersTableId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Unlinked from Reboot Motion");
      queryClient.invalidateQueries({ queryKey: ["reboot-link", playersTableId] });
      queryClient.invalidateQueries({ queryKey: ["reboot-sessions", playersTableId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-register via edge function
  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("create-reboot-athlete", {
        body: {
          name: playerName || "Unknown",
          handedness: playerData?.handedness || null,
          height_inches: playerData?.height_inches || null,
          weight_lbs: playerData?.weight_lbs || null,
        },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });
      if (error) throw new Error(error.message || "Failed to register");
      if (!data?.success) throw new Error("Registration failed");

      // Save the returned athlete_id
      const { error: updateErr } = await supabase
        .from("players")
        .update({
          reboot_athlete_id: data.athlete_id,
          reboot_player_id: data.org_player_id || data.athlete_id,
        })
        .eq("id", playersTableId!);
      if (updateErr) throw updateErr;

      return data;
    },
    onSuccess: () => {
      toast.success("Registered with Reboot Motion");
      queryClient.invalidateQueries({ queryKey: ["reboot-link", playersTableId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sync sessions from Reboot for THIS player only
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!playersTableId) throw new Error("No player record");
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("sync-reboot-sessions", {
        body: { player_id: playersTableId },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });
      if (error) throw new Error(error.message || "Sync failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Sessions synced");
      queryClient.invalidateQueries({ queryKey: ["reboot-sessions", playersTableId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Fetch reboot sessions for this player
  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["reboot-sessions", playersTableId],
    queryFn: async () => {
      if (!playersTableId) return [];
      const { data, error } = await supabase
        .from("reboot_sessions")
        .select("*")
        .eq("player_id", playersTableId)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!playersTableId && isLinked,
  });

  if (!playersTableId) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-10 w-10 text-slate-600 mb-3" />
          <p className="text-slate-400">Player must be linked to an analytics profile first.</p>
        </CardContent>
      </Card>
    );
  }

  const statusColor = (s: string | null) => {
    if (s === "scored") return "bg-teal-500/15 text-teal-400 border-teal-500/30";
    if (s === "completed") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (s === "processing" || s === "exported") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    if (s === "uploaded" || s === "ready_for_processing") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    return "bg-red-500/15 text-red-400 border-red-500/30";
  };

  return (
    <div className="space-y-6">
      {/* ── LINK REBOOT ATHLETE ── */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Link Reboot Athlete
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPlayer ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : isLinked ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Linked — {playerData.reboot_athlete_id}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unlinkMutation.mutate()}
                disabled={unlinkMutation.isPending}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Unlink className="h-3.5 w-3.5 mr-1" />
                Unlink
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Badge className="bg-slate-700/50 text-slate-400 border-slate-600 gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Not Linked
              </Badge>

              {/* Option 1: Auto-register */}
              <div>
                <Button
                  size="sm"
                  onClick={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending}
                  className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600"
                >
                  {registerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4 mr-2" />
                  )}
                  Register New Athlete
                </Button>
                <p className="text-xs text-slate-500 mt-1">
                  Creates a new athlete in Reboot Motion and links automatically.
                </p>
              </div>

              {/* Option 2: Manual ID entry */}
              <div className="flex gap-2">
                <Input
                  placeholder="Paste existing Reboot athlete ID…"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  className="max-w-xs h-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!manualId.trim() || linkMutation.isPending}
                  onClick={() => linkMutation.mutate(manualId.trim())}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  {linkMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Link"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── VIDEO-UPLOAD REBOOT SESSIONS ── */}
      {isLinked && (
        <RebootVideoSessionsStatus playersTableId={playersTableId!} />
      )}

      {/* ── MANUAL CSV UPLOAD (only when linked) ── */}
      {isLinked && (
        <ManualRebootUpload
          playersTableId={playersTableId!}
          playerName={playerName}
        />
      )}

      {/* ── REBOOT SESSIONS (only when linked) ── */}
      {isLinked && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Reboot Sessions
                {sessions && sessions.length > 0 && (
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300 ml-2">
                    {sessions.length}
                  </Badge>
                )}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                {syncMutation.isPending ? "Syncing…" : "Sync Sessions"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading sessions…
              </div>
            ) : !sessions || sessions.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Activity className="h-10 w-10 text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">No sessions yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Upload videos or export data from Reboot Motion to see sessions here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className="flex items-center gap-3 py-3 group hover:bg-slate-800/30 -mx-4 px-4 rounded transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          {session.session_date
                            ? format(new Date(session.session_date), "MMM d, yyyy")
                            : "No date"}
                        </span>
                        <Badge variant="outline" className={statusColor(session.status)}>
                          {session.status || "unknown"}
                        </Badge>
                        {(session as any).source === "manual_upload" && (
                          <Badge variant="outline" className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30 text-xs">
                            Manual Upload
                          </Badge>
                        )}
                        {session.movement_type && (session as any).source !== "manual_upload" && (
                          <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                            {session.movement_type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        {session.reboot_session_id && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]">
                            <Hash className="h-3 w-3" />
                            {session.reboot_session_id}
                          </span>
                        )}
                        {session.location && <span>{session.location}</span>}
                        {session.notes && (
                          <span className="truncate max-w-[200px]">{session.notes}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <RebootSessionDetailDrawer
        open={!!selectedSession}
        onOpenChange={(open) => !open && setSelectedSession(null)}
        session={selectedSession}
      />
    </div>
  );
}
