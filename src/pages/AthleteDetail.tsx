import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  User,
  Calendar,
  Activity,
  Loader2,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

export default function AthleteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  // Fetch player info
  const { data: player, isLoading: playerLoading } = useQuery({
    queryKey: ["athlete", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, handedness, height_inches, weight_lbs, level, team, reboot_athlete_id")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch sessions with aggregated upload data
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["athlete-sessions", id],
    queryFn: async () => {
      // Get distinct sessions for this player
      const { data: rawSessions, error: sessError } = await supabase
        .from("reboot_sessions")
        .select("id, reboot_session_id, session_date, status, movement_type, created_at")
        .eq("player_id", id!)
        .order("created_at", { ascending: false });

      if (sessError) throw sessError;

      // Deduplicate by reboot_session_id
      const seen = new Set<string>();
      const uniqueSessions = (rawSessions || []).filter((s) => {
        if (seen.has(s.reboot_session_id)) return false;
        seen.add(s.reboot_session_id);
        return true;
      });

      // Fetch uploads for each session to get swing counts, grades, scores
      const { data: uploads, error: uplError } = await supabase
        .from("reboot_uploads")
        .select("reboot_session_id, composite_score, grade, processing_status")
        .eq("player_id", id!);

      if (uplError) throw uplError;

      // Group uploads by session
      const uploadsBySession = new Map<
        string,
        { count: number; avgScore: number | null; grade: string | null; complete: number }
      >();

      for (const u of uploads || []) {
        const sid = u.reboot_session_id;
        if (!sid) continue;
        const existing = uploadsBySession.get(sid) || {
          count: 0,
          scores: [] as number[],
          grade: null as string | null,
          complete: 0,
          avgScore: null as number | null,
        };
        existing.count++;
        if (u.processing_status === "complete") existing.complete++;
        if (u.grade && !existing.grade) existing.grade = u.grade;
        if (u.composite_score != null) {
          // accumulate for averaging
          const prev = uploadsBySession.get(sid);
          const scores = (prev as any)?._scores || [];
          scores.push(u.composite_score);
          (existing as any)._scores = scores;
          existing.avgScore =
            scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        }
        uploadsBySession.set(sid, existing);
      }

      return uniqueSessions.map((s) => {
        const uplData = uploadsBySession.get(s.reboot_session_id);
        return {
          ...s,
          swingCount: uplData?.count || 0,
          compositeScore: uplData?.avgScore || null,
          grade: uplData?.grade || null,
          completedSwings: uplData?.complete || 0,
        };
      });
    },
    enabled: !!id,
  });

  const formatHeight = (inches: number | null) => {
    if (!inches) return null;
    const ft = Math.floor(inches / 12);
    const rem = inches % 12;
    return `${ft}'${rem}"`;
  };

  const handleSyncSessions = async () => {
    if (!id || !player?.name) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("browserbase-reboot", {
        body: {
          action: "pull_reports",
          player_name: player.name,
          reboot_player_id: player.reboot_athlete_id,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Failed to pull reports from Reboot");
      }
      toast.success(data?.message || "Sessions synced from Reboot");
      queryClient.invalidateQueries({ queryKey: ["athlete-sessions", id] });
    } catch (err: any) {
      console.error("[Sync Sessions] Error:", err);
      toast.error(err.message || "Failed to sync sessions");
    } finally {
      setSyncing(false);
    }
  };

  const statusBadge = (status: string, completedSwings: number, swingCount: number) => {
    if (status === "completed" && completedSwings > 0) {
      return <Badge className="bg-green-900/50 text-green-400 border-green-800 text-[10px]">Complete</Badge>;
    }
    if (status === "completed") {
      return <Badge className="bg-blue-900/50 text-blue-400 border-blue-800 text-[10px]">Synced</Badge>;
    }
    return <Badge className="bg-yellow-900/50 text-yellow-400 border-yellow-800 text-[10px]">Processing</Badge>;
  };

  if (playerLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Header />
        <main className="flex-1 pt-24 pb-12 px-4 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Header />
        <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
          <Link
            to="/athletes"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Athletes
          </Link>
          <p className="text-slate-400 text-center py-20">Athlete not found</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header />
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Back button */}
        <Link
          to="/athletes"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Athletes
        </Link>

        {/* Athlete Bio Card */}
        <Card className="bg-slate-900/80 border-slate-800 mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                  <User className="w-7 h-7 text-slate-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white">{player.name}</h1>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-400">
                    {player.handedness && (
                      <span className="capitalize">{player.handedness}-handed</span>
                    )}
                    {player.level && (
                      <span className="capitalize">
                        {player.level.replace("_", " ")}
                      </span>
                    )}
                    {player.team && <span>{player.team}</span>}
                    {formatHeight(player.height_inches) && (
                      <span>{formatHeight(player.height_inches)}</span>
                    )}
                    {player.weight_lbs && <span>{player.weight_lbs} lbs</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleSyncSessions}
                  disabled={syncing || !player.reboot_athlete_id}
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:text-white"
                >
                  {syncing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {syncing ? "Syncing…" : "Sync from Reboot"}
                </Button>
                <Button
                  onClick={() => navigate(`/upload?athlete=${player.id}`)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Videos
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sessions List */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-400" />
            Sessions
            {sessions.length > 0 && (
              <span className="text-sm font-normal text-slate-500">
                ({sessions.length})
              </span>
            )}
          </h2>
        </div>

        {sessionsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : sessions.length === 0 ? (
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="py-16 text-center">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">No sessions yet</p>
              <p className="text-slate-500 text-sm mb-4">
                Upload videos or sync from Reboot to see sessions here
              </p>
              <Button
                onClick={() => navigate(`/upload?athlete=${player.id}`)}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:text-white"
              >
                Upload First Video
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {sessions.map((session) => (
              <Card
                key={session.reboot_session_id}
                className="bg-slate-900/80 border-slate-800 hover:border-slate-600 transition-colors cursor-pointer group"
                onClick={() => navigate(`/sessions/${session.reboot_session_id}`)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          {session.session_date
                            ? format(
                                new Date(session.session_date + "T00:00:00"),
                                "MMM d, yyyy"
                              )
                            : format(new Date(session.created_at), "MMM d, yyyy")}
                        </p>
                        {statusBadge(session.status, session.completedSwings, session.swingCount)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span>
                          {session.swingCount} swing{session.swingCount !== 1 ? "s" : ""}
                        </span>
                        {session.movement_type && (
                          <span className="capitalize">{session.movement_type}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {session.grade && (
                      <Badge
                        variant="outline"
                        className="border-slate-700 text-slate-300 text-xs"
                      >
                        {session.grade}
                      </Badge>
                    )}
                    {session.compositeScore != null && (
                      <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full font-mono">
                        {session.compositeScore.toFixed(1)}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
