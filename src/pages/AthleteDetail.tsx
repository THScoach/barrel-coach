import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
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
  Download,
} from "lucide-react";
import { format } from "date-fns";

export default function AthleteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [sessionIdInput, setSessionIdInput] = useState("");

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

  // Fetch sessions from both reboot_sessions and player_sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["athlete-sessions", id],
    queryFn: async () => {
      // Fetch from player_sessions (where 4B scores land from imports)
      const { data: playerSessions, error: psError } = await supabase
        .from("player_sessions")
        .select("id, session_date, brain_score, body_score, bat_score, ball_score, overall_score, overall_grade, swing_count, data_quality, leak_type, created_at")
        .eq("player_id", id!)
        .order("session_date", { ascending: false });

      if (psError) throw psError;

      // Fetch from reboot_sessions (from video uploads)
      const { data: rebootSessions, error: rsError } = await supabase
        .from("reboot_sessions")
        .select("id, reboot_session_id, session_date, status, movement_type, created_at")
        .eq("player_id", id!)
        .order("created_at", { ascending: false });

      if (rsError) throw rsError;

      // Fetch uploads for reboot sessions
      const { data: uploads } = await supabase
        .from("reboot_uploads")
        .select("reboot_session_id, composite_score, grade, processing_status")
        .eq("player_id", id!);

      const uploadsBySession = new Map<string, { count: number; avgScore: number | null; grade: string | null; complete: number }>();
      for (const u of uploads || []) {
        const sid = u.reboot_session_id;
        if (!sid) continue;
        const existing = uploadsBySession.get(sid) || { count: 0, avgScore: null, grade: null, complete: 0, _scores: [] as number[] };
        existing.count++;
        if (u.processing_status === "complete") existing.complete++;
        if (u.grade && !existing.grade) existing.grade = u.grade;
        if (u.composite_score != null) {
          (existing as any)._scores.push(u.composite_score);
          existing.avgScore = (existing as any)._scores.reduce((a: number, b: number) => a + b, 0) / (existing as any)._scores.length;
        }
        uploadsBySession.set(sid, existing);
      }

      // Build unified session list
      type SessionItem = {
        id: string;
        source: "player_sessions" | "reboot_sessions";
        sessionDate: string;
        status: string;
        swingCount: number;
        overallScore: number | null;
        grade: string | null;
        completedSwings: number;
        rebootSessionId: string | null;
        leakType: string | null;
        dataQuality: string | null;
      };

      const results: SessionItem[] = [];

      // Add player_sessions (from CSV imports / 4B calculations)
      for (const ps of playerSessions || []) {
        results.push({
          id: ps.id,
          source: "player_sessions",
          sessionDate: ps.session_date,
          status: "complete",
          swingCount: ps.swing_count || 0,
          overallScore: ps.overall_score,
          grade: ps.overall_grade,
          completedSwings: ps.swing_count || 0,
          rebootSessionId: null,
          leakType: ps.leak_type,
          dataQuality: ps.data_quality,
        });
      }

      // Add reboot_sessions (from video uploads), deduped
      const seen = new Set<string>();
      for (const rs of rebootSessions || []) {
        if (seen.has(rs.reboot_session_id)) continue;
        seen.add(rs.reboot_session_id);
        const uplData = uploadsBySession.get(rs.reboot_session_id);
        results.push({
          id: rs.id,
          source: "reboot_sessions",
          sessionDate: rs.session_date || rs.created_at,
          status: rs.status,
          swingCount: uplData?.count || 0,
          overallScore: uplData?.avgScore || null,
          grade: uplData?.grade || null,
          completedSwings: uplData?.complete || 0,
          rebootSessionId: rs.reboot_session_id,
          leakType: null,
          dataQuality: null,
        });
      }

      // Sort by date descending
      results.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
      return results;
    },
    enabled: !!id,
  });

  const formatHeight = (inches: number | null) => {
    if (!inches) return null;
    const ft = Math.floor(inches / 12);
    const rem = inches % 12;
    return `${ft}'${rem}"`;
  };

  const handleImportSession = async () => {
    const trimmedId = sessionIdInput.trim();
    if (!trimmedId || !id) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reboot-export-data", {
        body: {
          session_id: trimmedId,
          player_id: id,
          trigger_analysis: true,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Import failed");
      }
      const resultSessionId = data.analysis_result?.session_id;
      toast.success(
        `Session imported — ${data.data_types_exported?.length || 0} data types, score: ${data.analysis_result?.scores?.overall ?? "pending"}`
      );
      setSessionIdInput("");
      await queryClient.invalidateQueries({ queryKey: ["athlete-sessions", id] });
      // Navigate to the newly created session if we have one
      if (resultSessionId) {
        toast.info("Scores calculated — view details below");
      }
    } catch (err: any) {
      console.error("[Import Session] Error:", err);
      toast.error(err.message || "Failed to import session");
    } finally {
      setImporting(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "complete" || status === "completed") {
      return <Badge className="bg-green-900/50 text-green-400 border-green-800 text-[10px]">Complete</Badge>;
    }
    if (status === "exported") {
      return <Badge className="bg-blue-900/50 text-blue-400 border-blue-800 text-[10px]">Exported</Badge>;
    }
    if (status === "processing") {
      return <Badge className="bg-yellow-900/50 text-yellow-400 border-yellow-800 text-[10px]">Processing</Badge>;
    }
    return <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]">{status}</Badge>;
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

        {/* Import Session by ID */}
        <Card className="bg-slate-900/80 border-slate-800 mb-8">
          <CardContent className="p-4">
            <label className="text-sm font-medium text-slate-300 mb-2 block">
              Reboot Session ID
            </label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Paste session ID from Reboot dashboard…"
                value={sessionIdInput}
                onChange={(e) => setSessionIdInput(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 flex-1"
              />
              <Button
                onClick={handleImportSession}
                disabled={importing || !sessionIdInput.trim()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold shrink-0"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {importing ? "Importing…" : "Import Session"}
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Copy a session ID from the Reboot Motion dashboard and paste it here to import CSV data and calculate 4B scores.
            </p>
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
                key={session.id}
                className="bg-slate-900/80 border-slate-800 hover:border-slate-600 transition-colors cursor-pointer group"
                onClick={() => {
                  if (session.source === "reboot_sessions" && session.rebootSessionId) {
                    navigate(`/sessions/${session.rebootSessionId}`);
                  }
                  // player_sessions don't have a detail view yet — could navigate to a score summary
                }}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          {format(new Date(session.sessionDate), "MMM d, yyyy")}
                        </p>
                        {statusBadge(session.status)}
                        {session.dataQuality && (
                          <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]">
                            {session.dataQuality}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span>
                          {session.swingCount} swing{session.swingCount !== 1 ? "s" : ""}
                        </span>
                        {session.leakType && session.leakType !== "unknown" && (
                          <span className="text-orange-400 capitalize">
                            {session.leakType.replace(/_/g, " ")}
                          </span>
                        )}
                        {session.source === "player_sessions" && (
                          <span className="text-blue-400">4B Import</span>
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
                    {session.overallScore != null && (
                      <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full font-mono">
                        {session.overallScore}
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
