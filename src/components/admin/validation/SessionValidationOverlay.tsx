import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Video,
  Activity,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isSameDay } from "date-fns";

interface SessionValidationOverlayProps {
  playerId: string;
  playerName: string;
  videoSessionId?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface VideoSession {
  id: string;
  session_date: string;
  composite_score: number | null;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  primary_leak: string | null;
  weakest_link: string | null;
  analyzed_count: number | null;
  validation_status: string | null;
  correlated_reboot_id: string | null;
  accuracy_tier: string | null;
}

interface RebootSession {
  id: string;
  session_date: string;
  composite_score: number | null;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  leak_detected: string | null;
  weakest_link: string | null;
  motor_profile: string | null;
  correlated_video_session_id: string | null;
}

const getScoreColor = (score: number | null): string => {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-green-400";
  if (score >= 55) return "text-blue-400";
  if (score >= 45) return "text-yellow-400";
  return "text-red-400";
};

const getAccuracyBadge = (tier: string | null) => {
  switch (tier) {
    case "high":
      return <Badge className="bg-green-500/20 text-green-400">High Accuracy (&lt;5 pts)</Badge>;
    case "medium":
      return <Badge className="bg-yellow-500/20 text-yellow-400">Medium Accuracy (5-10 pts)</Badge>;
    default:
      return <Badge className="bg-red-500/20 text-red-400">Low Accuracy (&gt;10 pts)</Badge>;
  }
};

const getDeltaIcon = (delta: number | null) => {
  if (delta === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (Math.abs(delta) < 5) return <CheckCircle className="h-4 w-4 text-green-400" />;
  if (delta > 0) return <TrendingUp className="h-4 w-4 text-blue-400" />;
  return <TrendingDown className="h-4 w-4 text-red-400" />;
};

export function SessionValidationOverlay({
  playerId,
  playerName,
  videoSessionId,
  isOpen,
  onClose,
}: SessionValidationOverlayProps) {
  const queryClient = useQueryClient();
  const [selectedVideoSession, setSelectedVideoSession] = useState<string | null>(videoSessionId || null);
  const [selectedRebootSession, setSelectedRebootSession] = useState<string | null>(null);

  // Fetch video sessions for this player
  const { data: videoSessions = [], isLoading: loadingVideo } = useQuery({
    queryKey: ["validation-video-sessions", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_swing_sessions")
        .select("*")
        .eq("player_id", playerId)
        .eq("is_active", false)
        .not("composite_score", "is", null)
        .order("session_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as VideoSession[];
    },
    enabled: isOpen,
  });

  // Fetch reboot sessions for this player
  const { data: rebootSessions = [], isLoading: loadingReboot } = useQuery({
    queryKey: ["validation-reboot-sessions", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reboot_uploads")
        .select("*")
        .eq("player_id", playerId)
        .eq("processing_status", "complete")
        .not("composite_score", "is", null)
        .order("session_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as RebootSession[];
    },
    enabled: isOpen,
  });

  // Auto-match reboot sessions from same date
  const matchedRebootSessions = useMemo(() => {
    if (!selectedVideoSession) return [];
    const videoSession = videoSessions.find((s) => s.id === selectedVideoSession);
    if (!videoSession) return [];

    return rebootSessions.filter((rs) => {
      try {
        const videoDate = parseISO(videoSession.session_date);
        const rebootDate = parseISO(rs.session_date);
        return isSameDay(videoDate, rebootDate);
      } catch {
        return false;
      }
    });
  }, [selectedVideoSession, videoSessions, rebootSessions]);

  // Auto-select first matching reboot session
  useMemo(() => {
    if (matchedRebootSessions.length > 0 && !selectedRebootSession) {
      setSelectedRebootSession(matchedRebootSessions[0].id);
    }
  }, [matchedRebootSessions, selectedRebootSession]);

  const selectedVideo = videoSessions.find((s) => s.id === selectedVideoSession);
  const selectedReboot = rebootSessions.find((s) => s.id === selectedRebootSession);

  // Calculate delta
  const compositeDelta = useMemo(() => {
    if (!selectedVideo?.composite_score || !selectedReboot?.composite_score) return null;
    return selectedVideo.composite_score - selectedReboot.composite_score;
  }, [selectedVideo, selectedReboot]);

  const accuracyTier = useMemo(() => {
    if (compositeDelta === null) return null;
    if (Math.abs(compositeDelta) < 5) return "high";
    if (Math.abs(compositeDelta) < 10) return "medium";
    return "low";
  }, [compositeDelta]);

  // Correlate mutation
  const correlateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVideoSession || !selectedRebootSession || compositeDelta === null) {
        throw new Error("Please select both sessions");
      }

      // Update video session
      const { error: videoError } = await supabase
        .from("video_swing_sessions")
        .update({
          correlated_reboot_id: selectedRebootSession,
          reboot_composite_delta: compositeDelta,
          accuracy_tier: accuracyTier,
          validation_status: "validated",
          validated_at: new Date().toISOString(),
        })
        .eq("id", selectedVideoSession);

      if (videoError) throw videoError;

      // Update reboot session
      const { error: rebootError } = await supabase
        .from("reboot_uploads")
        .update({
          correlated_video_session_id: selectedVideoSession,
          video_composite_delta: -compositeDelta, // Inverse for reboot perspective
          validation_status: "validated",
        })
        .eq("id", selectedRebootSession);

      if (rebootError) throw rebootError;

      return { delta: compositeDelta, tier: accuracyTier };
    },
    onSuccess: (data) => {
      toast.success(`Sessions correlated! Delta: ${data.delta?.toFixed(1)} pts (${data.tier} accuracy)`);
      queryClient.invalidateQueries({ queryKey: ["validation-video-sessions", playerId] });
      queryClient.invalidateQueries({ queryKey: ["validation-reboot-sessions", playerId] });
      queryClient.invalidateQueries({ queryKey: ["player-upload-history", playerId] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(`Correlation failed: ${error.message}`);
    },
  });

  const isLoading = loadingVideo || loadingReboot;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Session Validation Overlay: {playerName}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Compare 2D Video scores with 3D Reboot IK data to validate accuracy
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: 2D Video Session */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Video className="h-5 w-5 text-amber-400" />
                  2D Video Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={selectedVideoSession || ""}
                  onValueChange={(val) => {
                    setSelectedVideoSession(val);
                    setSelectedRebootSession(null); // Reset reboot selection
                  }}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select video session..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {videoSessions.map((session) => (
                      <SelectItem
                        key={session.id}
                        value={session.id}
                        className="text-white hover:bg-slate-700"
                      >
                        {format(parseISO(session.session_date), "MMM d, yyyy")} - Score: {session.composite_score}
                        {session.correlated_reboot_id && " ✓"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedVideo && (
                  <div className="space-y-4">
                    {/* 4B Scores Grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Brain", score: selectedVideo.brain_score },
                        { label: "Body", score: selectedVideo.body_score },
                        { label: "Bat", score: selectedVideo.bat_score },
                        { label: "Ball", score: selectedVideo.ball_score },
                      ].map((item) => (
                        <div key={item.label} className="bg-slate-900/50 rounded-lg p-3 text-center">
                          <p className="text-xs text-slate-400 uppercase">{item.label}</p>
                          <p className={`text-2xl font-bold ${getScoreColor(item.score)}`}>
                            {item.score ?? "—"}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Composite */}
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-center">
                      <p className="text-sm text-amber-400 uppercase">Video Composite</p>
                      <p className="text-4xl font-bold text-amber-400">
                        {selectedVideo.composite_score?.toFixed(0) ?? "—"}
                      </p>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-slate-600">
                        {selectedVideo.analyzed_count} swings
                      </Badge>
                      {selectedVideo.primary_leak && (
                        <Badge variant="outline" className="border-red-500/50 text-red-400">
                          {selectedVideo.primary_leak.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {selectedVideo.weakest_link && (
                        <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                          Weak: {selectedVideo.weakest_link}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right: 3D Reboot Session */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-teal-400" />
                  3D Reboot Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={selectedRebootSession || ""}
                  onValueChange={setSelectedRebootSession}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select reboot session..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {matchedRebootSessions.length > 0 && (
                      <div className="px-2 py-1 text-xs text-teal-400 border-b border-slate-700">
                        Same-day matches
                      </div>
                    )}
                    {matchedRebootSessions.map((session) => (
                      <SelectItem
                        key={session.id}
                        value={session.id}
                        className="text-white hover:bg-slate-700"
                      >
                        {format(parseISO(session.session_date), "MMM d, yyyy")} - Score: {session.composite_score} ⭐
                      </SelectItem>
                    ))}
                    {rebootSessions.filter((s) => !matchedRebootSessions.includes(s)).map((session) => (
                      <SelectItem
                        key={session.id}
                        value={session.id}
                        className="text-white hover:bg-slate-700"
                      >
                        {format(parseISO(session.session_date), "MMM d, yyyy")} - Score: {session.composite_score}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedReboot && (
                  <div className="space-y-4">
                    {/* 4B Scores Grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Brain", score: selectedReboot.brain_score },
                        { label: "Body", score: selectedReboot.body_score },
                        { label: "Bat", score: selectedReboot.bat_score },
                        { label: "Ball", score: null }, // Reboot may not have ball
                      ].map((item) => (
                        <div key={item.label} className="bg-slate-900/50 rounded-lg p-3 text-center">
                          <p className="text-xs text-slate-400 uppercase">{item.label}</p>
                          <p className={`text-2xl font-bold ${getScoreColor(item.score)}`}>
                            {item.score ?? "—"}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Composite */}
                    <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4 text-center">
                      <p className="text-sm text-teal-400 uppercase">Reboot Composite</p>
                      <p className="text-4xl font-bold text-teal-400">
                        {selectedReboot.composite_score?.toFixed(0) ?? "—"}
                      </p>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-2">
                      {selectedReboot.motor_profile && (
                        <Badge variant="outline" className="border-teal-500/50 text-teal-400">
                          {selectedReboot.motor_profile}
                        </Badge>
                      )}
                      {selectedReboot.leak_detected && (
                        <Badge variant="outline" className="border-red-500/50 text-red-400">
                          {selectedReboot.leak_detected.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delta Comparison */}
        {selectedVideo && selectedReboot && compositeDelta !== null && (
          <Card className="bg-slate-800/50 border-slate-700 mt-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-amber-400" />
                    <span className="text-2xl font-bold text-amber-400">
                      {selectedVideo.composite_score?.toFixed(0)}
                    </span>
                  </div>
                  
                  <ArrowRight className="h-5 w-5 text-slate-500" />
                  
                  <div className="flex items-center gap-2">
                    {getDeltaIcon(compositeDelta)}
                    <span className={`text-xl font-bold ${
                      Math.abs(compositeDelta) < 5 ? "text-green-400" :
                      compositeDelta > 0 ? "text-blue-400" : "text-red-400"
                    }`}>
                      {compositeDelta > 0 ? "+" : ""}{compositeDelta.toFixed(1)} pts
                    </span>
                  </div>
                  
                  <ArrowRight className="h-5 w-5 text-slate-500" />
                  
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-teal-400" />
                    <span className="text-2xl font-bold text-teal-400">
                      {selectedReboot.composite_score?.toFixed(0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {getAccuracyBadge(accuracyTier)}
                  
                  <Button
                    onClick={() => correlateMutation.mutate()}
                    disabled={correlateMutation.isPending}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {correlateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Correlate Sessions
                  </Button>
                </div>
              </div>

              {/* Score Breakdown Comparison */}
              <div className="mt-6 grid grid-cols-4 gap-4">
                {["Brain", "Body", "Bat", "Ball"].map((category) => {
                  const videoScore = selectedVideo[`${category.toLowerCase()}_score` as keyof VideoSession] as number | null;
                  const rebootScore = category === "Ball" ? null : 
                    selectedReboot[`${category.toLowerCase()}_score` as keyof RebootSession] as number | null;
                  const categoryDelta = videoScore !== null && rebootScore !== null 
                    ? videoScore - rebootScore 
                    : null;

                  return (
                    <div key={category} className="bg-slate-900/50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 uppercase text-center mb-2">{category}</p>
                      <div className="flex items-center justify-center gap-2">
                        <span className={`font-bold ${getScoreColor(videoScore)}`}>
                          {videoScore ?? "—"}
                        </span>
                        {categoryDelta !== null && (
                          <>
                            <span className="text-slate-500">→</span>
                            <span className={`text-sm ${
                              Math.abs(categoryDelta) < 5 ? "text-green-400" :
                              categoryDelta > 0 ? "text-blue-400" : "text-red-400"
                            }`}>
                              {categoryDelta > 0 ? "+" : ""}{categoryDelta}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && (videoSessions.length === 0 || rebootSessions.length === 0) && (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-slate-400">
              {videoSessions.length === 0 && "No completed video sessions found. "}
              {rebootSessions.length === 0 && "No Reboot sessions found. "}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Both 2D video and 3D Reboot sessions are required for validation.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
