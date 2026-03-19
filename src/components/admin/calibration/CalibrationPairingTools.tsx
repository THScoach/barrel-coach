import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link2, Loader2, Zap, CheckCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function BackfillPairsButton() {
  const queryClient = useQueryClient();

  const backfillMutation = useMutation({
    mutationFn: async () => {
      // Get all unlinked player_sessions
      const { data: unlinked, error: e1 } = await supabase
        .from("player_sessions")
        .select("id, player_id, session_date")
        .is("video_2d_session_id", null);
      if (e1) throw e1;
      if (!unlinked || unlinked.length === 0) return { found: 0, linked: 0 };

      // Get all video_2d_sessions
      const { data: videos, error: e2 } = await supabase
        .from("video_2d_sessions")
        .select("id, player_id, session_date");
      if (e2) throw e2;
      if (!videos || videos.length === 0) return { found: 0, linked: 0 };

      // Build a map: player_id+date → video_2d_session id
      const videoMap = new Map<string, string>();
      for (const v of videos) {
        const key = `${v.player_id}|${v.session_date}`;
        videoMap.set(key, v.id);
      }

      // Find matches
      let found = 0;
      let linked = 0;
      for (const ps of unlinked) {
        const psDate = ps.session_date ? new Date(ps.session_date).toISOString().split("T")[0] : null;
        if (!psDate || !ps.player_id) continue;
        const key = `${ps.player_id}|${psDate}`;
        const videoId = videoMap.get(key);
        if (videoId) {
          found++;
          const { error } = await supabase
            .from("player_sessions")
            .update({ video_2d_session_id: videoId })
            .eq("id", ps.id);
          if (!error) linked++;
        }
      }
      return { found, linked };
    },
    onSuccess: (data) => {
      toast.success(`Found ${data.found} pairs, linked ${data.linked} sessions`);
      queryClient.invalidateQueries({ queryKey: ["calibration-paired-sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => backfillMutation.mutate()}
      disabled={backfillMutation.isPending}
      className="border-[#1E2535] text-slate-300 hover:bg-[#111827]"
    >
      {backfillMutation.isPending ? (
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
      ) : (
        <Zap className="h-4 w-4 mr-1.5" />
      )}
      Backfill Pairs
    </Button>
  );
}

export function ManualPairDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [selectedReboot, setSelectedReboot] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  // Fetch players that have at least one unlinked session
  const { data: players } = useQuery({
    queryKey: ["manual-pair-players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Unlinked reboot sessions for selected player
  const { data: rebootSessions, isLoading: loadingReboot } = useQuery({
    queryKey: ["manual-pair-reboot", selectedPlayer],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_sessions")
        .select("id, session_date, overall_score, body_score, brain_score, bat_score")
        .eq("player_id", selectedPlayer)
        .is("video_2d_session_id", null)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedPlayer && open,
  });

  // Unlinked video sessions for selected player
  const { data: videoSessions, isLoading: loadingVideo } = useQuery({
    queryKey: ["manual-pair-video", selectedPlayer],
    queryFn: async () => {
      // Get video_2d_session_ids already linked
      const { data: linked } = await supabase
        .from("player_sessions")
        .select("video_2d_session_id")
        .eq("player_id", selectedPlayer)
        .not("video_2d_session_id", "is", null);

      const linkedIds = (linked || []).map((l: any) => l.video_2d_session_id).filter(Boolean);

      let query = supabase
        .from("video_2d_sessions")
        .select("id, session_date, composite_score, body_score, brain_score, bat_score, leak_detected")
        .eq("player_id", selectedPlayer)
        .order("session_date", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      // Filter out already-linked ones
      return (data || []).filter((v: any) => !linkedIds.includes(v.id));
    },
    enabled: !!selectedPlayer && open,
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReboot || !selectedVideo) throw new Error("Select both sessions");
      const { error } = await supabase
        .from("player_sessions")
        .update({ video_2d_session_id: selectedVideo })
        .eq("id", selectedReboot);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sessions linked!");
      setSelectedReboot(null);
      setSelectedVideo(null);
      queryClient.invalidateQueries({ queryKey: ["manual-pair-reboot", selectedPlayer] });
      queryClient.invalidateQueries({ queryKey: ["manual-pair-video", selectedPlayer] });
      queryClient.invalidateQueries({ queryKey: ["calibration-paired-sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setSelectedPlayer("");
      setSelectedReboot(null);
      setSelectedVideo(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-[#1E2535] text-slate-300 hover:bg-[#111827]">
          <Link2 className="h-4 w-4 mr-1.5" />
          Manual Pair
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0A0D1A] border-[#1E2535] max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Manual Session Pairing</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Player selector */}
          <Select value={selectedPlayer} onValueChange={(v) => { setSelectedPlayer(v); setSelectedReboot(null); setSelectedVideo(null); }}>
            <SelectTrigger className="bg-[#111827] border-[#1E2535] text-white">
              <SelectValue placeholder="Select a player…" />
            </SelectTrigger>
            <SelectContent className="bg-[#111827] border-[#1E2535]">
              {(players || []).map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-white">{p.name || "Unnamed"}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPlayer && (
            <div className="grid grid-cols-2 gap-4">
              {/* LEFT: Unlinked Reboot Sessions */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Unlinked 3D Reboot Sessions
                </h3>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {loadingReboot ? (
                    <p className="text-slate-500 text-xs text-center py-4">Loading…</p>
                  ) : !rebootSessions?.length ? (
                    <p className="text-slate-500 text-xs text-center py-4">No unlinked Reboot sessions</p>
                  ) : rebootSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedReboot(s.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all text-xs",
                        selectedReboot === s.id
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-[#1E2535] bg-[#111827] hover:border-slate-600"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          {s.session_date ? format(new Date(s.session_date), "MMM d, yyyy") : "No date"}
                        </span>
                        {selectedReboot === s.id && <CheckCircle className="h-3.5 w-3.5 text-purple-400" />}
                      </div>
                      <div className="flex gap-3 mt-1 text-slate-400">
                        <span>Body: {s.body_score?.toFixed(0) ?? "—"}</span>
                        <span>Brain: {s.brain_score?.toFixed(0) ?? "—"}</span>
                        <span>Bat: {s.bat_score?.toFixed(0) ?? "—"}</span>
                        <span className="text-slate-300">Σ {s.overall_score?.toFixed(0) ?? "—"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* RIGHT: Unlinked Video Sessions */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Unlinked 2D Video Sessions
                </h3>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {loadingVideo ? (
                    <p className="text-slate-500 text-xs text-center py-4">Loading…</p>
                  ) : !videoSessions?.length ? (
                    <p className="text-slate-500 text-xs text-center py-4">No unlinked video sessions</p>
                  ) : videoSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedVideo(s.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all text-xs",
                        selectedVideo === s.id
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-[#1E2535] bg-[#111827] hover:border-slate-600"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          {s.session_date ? format(new Date(s.session_date), "MMM d, yyyy") : "No date"}
                        </span>
                        {selectedVideo === s.id && <CheckCircle className="h-3.5 w-3.5 text-blue-400" />}
                      </div>
                      <div className="flex gap-3 mt-1 text-slate-400">
                        <span>Body: {s.body_score?.toFixed(0) ?? "—"}</span>
                        <span>Brain: {s.brain_score?.toFixed(0) ?? "—"}</span>
                        <span>Bat: {s.bat_score?.toFixed(0) ?? "—"}</span>
                        <span className="text-slate-300">Σ {s.composite_score?.toFixed(0) ?? "—"}</span>
                      </div>
                      {s.leak_detected && (
                        <div className="mt-1 text-slate-500">Leak: {s.leak_detected}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Link button */}
          {selectedReboot && selectedVideo && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => linkMutation.mutate()}
                disabled={linkMutation.isPending}
                className="bg-[#E63946] hover:bg-[#E63946]/90 text-white"
              >
                {linkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-1.5" />
                )}
                Link Selected Sessions
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
