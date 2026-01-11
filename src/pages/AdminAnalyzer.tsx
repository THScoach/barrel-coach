import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  User,
  Mail,
  Phone,
  Play,
  FileText,
  Send,
  Clock,
  Video,
  ChevronRight,
  Save,
  RefreshCw,
  Brain,
  Activity,
  Zap,
  Target,
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { ScoreInput } from "@/components/analyzer/ScoreInput";
import { ProblemSelector } from "@/components/analyzer/ProblemSelector";
import { DrillRecommendations } from "@/components/analyzer/DrillRecommendations";
import { VideoPlayer, VideoMarker, MaskAnnotation } from "@/components/analyzer/VideoPlayer";
import { format, formatDistanceToNow } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Session {
  id: string;
  player_name: string;
  player_email: string;
  player_phone: string | null;
  player_age: number;
  player_level: string;
  product_type: string;
  environment: string;
  status: string;
  created_at: string;
  swings_required: number;
  composite_score: number | null;
  four_b_brain: number | null;
  four_b_body: number | null;
  four_b_bat: number | null;
  four_b_ball: number | null;
  problems_identified: string[] | null;
  grade: string | null;
  analyzed_at: string | null;
  price_cents: number;
}

interface Swing {
  id: string;
  session_id: string;
  swing_index: number;
  video_url: string | null;
  status: string;
}

interface Analysis {
  id: string;
  session_id: string;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  overall_score: number | null;
  weakest_category: string | null;
  primary_problem: string;
  secondary_problems: string[] | null;
  motor_profile: string | null;
  coach_notes: string | null;
  private_notes: string | null;
  recommended_drill_ids: string[] | null;
  report_generated_at: string | null;
  results_sent_at: string | null;
}

const statusColors: Record<string, string> = {
  pending_upload: "bg-slate-500",
  uploading: "bg-yellow-500",
  pending_payment: "bg-orange-500",
  paid: "bg-blue-500",
  analyzing: "bg-purple-500",
  complete: "bg-green-500",
  failed: "bg-red-500",
};

const MOTOR_PROFILES = ["force", "rhythm", "timing", "balance"];

export default function AdminAnalyzer() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [swings, setSwings] = useState<Swing[]>([]);
  const [existingAnalysis, setExistingAnalysis] = useState<Analysis | null>(
    null
  );
  const [loadingSwings, setLoadingSwings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [currentSwingIndex, setCurrentSwingIndex] = useState(0);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [swingMarkers, setSwingMarkers] = useState<VideoMarker[]>([]);
  
  // SAM3 annotations state (in-memory for now)
  const [savedAnnotations, setSavedAnnotations] = useState<MaskAnnotation[]>([]);

  // Analysis form state
  const [scores, setScores] = useState({ brain: 5, body: 5, bat: 5, ball: 5 });
  const [primaryProblem, setPrimaryProblem] = useState("");
  const [secondaryProblems, setSecondaryProblems] = useState<string[]>([]);
  const [motorProfile, setMotorProfile] = useState("");
  const [coachNotes, setCoachNotes] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [selectedDrillIds, setSelectedDrillIds] = useState<string[]>([]);

  const fetchSessions = useCallback(async () => {
    try {
      const { data: queueData, error: queueError } = await supabase
        .from("sessions")
        .select("*")
        .in("status", [
          "pending_upload",
          "uploading",
          "pending_payment",
          "paid",
          "analyzing",
        ])
        .order("created_at", { ascending: true });

      if (queueError) throw queueError;
      setSessions(queueData || []);

      const { data: completedData, error: completedError } = await supabase
        .from("sessions")
        .select("*")
        .eq("status", "complete")
        .order("analyzed_at", { ascending: false })
        .limit(50);

      if (completedError) throw completedError;
      setCompletedSessions(completedData || []);
    } catch (error) {
      console.error("Failed to load sessions:", error);
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const selectSession = async (session: Session) => {
    setSelectedSession(session);
    setLoadingSwings(true);
    setCurrentSwingIndex(0);
    setSwingMarkers([]); // Reset markers when switching sessions
    setCurrentVideoTime(0);

    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/get-session?sessionId=${session.id}`,
        {
          headers: { Authorization: `Bearer ${authSession?.access_token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setSwings(data.swings || []);
      }

      const { data: analysisData } = await supabase
        .from("swing_analyses")
        .select("*")
        .eq("session_id", session.id)
        .maybeSingle();

      if (analysisData) {
        setExistingAnalysis(analysisData);
        setScores({
          brain: analysisData.brain_score || 5,
          body: analysisData.body_score || 5,
          bat: analysisData.bat_score || 5,
          ball: analysisData.ball_score || 5,
        });
        setPrimaryProblem(analysisData.primary_problem || "");
        setSecondaryProblems(analysisData.secondary_problems || []);
        setMotorProfile(analysisData.motor_profile || "");
        setCoachNotes(analysisData.coach_notes || "");
        setPrivateNotes(analysisData.private_notes || "");
        setSelectedDrillIds(analysisData.recommended_drill_ids || []);
      } else {
        setExistingAnalysis(null);
        setScores({ brain: 5, body: 5, bat: 5, ball: 5 });
        setPrimaryProblem("");
        setSecondaryProblems([]);
        setMotorProfile("");
        setCoachNotes("");
        setPrivateNotes("");
        setSelectedDrillIds([]);
      }
    } catch (error) {
      console.error("Failed to load session details:", error);
    } finally {
      setLoadingSwings(false);
    }
  };

  const getWeakestCategory = () => {
    const entries = Object.entries(scores);
    return entries.reduce(
      (min, [key, val]) => (val < min.val ? { key, val } : min),
      { key: "brain", val: 10 }
    ).key;
  };

  const isCompleteReview = selectedSession?.product_type === "complete_assessment";
  const maxDrills = isCompleteReview ? 5 : 1;
  const maxSecondaryProblems = isCompleteReview ? 3 : 0;

  const handleSaveDraft = async () => {
    if (!selectedSession || !primaryProblem) {
      toast.error("Please select a primary problem");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/save-analysis`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authSession?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: selectedSession.id,
          brain_score: scores.brain,
          body_score: scores.body,
          bat_score: scores.bat,
          ball_score: scores.ball,
          primary_problem: primaryProblem,
          secondary_problems: secondaryProblems,
          motor_profile: motorProfile || null,
          coach_notes: coachNotes,
          private_notes: privateNotes,
          recommended_drill_ids: selectedDrillIds,
          is_draft: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }

      toast.success("Draft saved!");
      await fetchSessions();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedSession || !primaryProblem) {
      toast.error("Please select a primary problem");
      return;
    }

    if (selectedDrillIds.length === 0) {
      toast.error("Please select at least one drill");
      return;
    }

    setGenerating(true);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/save-analysis`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authSession?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: selectedSession.id,
          brain_score: scores.brain,
          body_score: scores.body,
          bat_score: scores.bat,
          ball_score: scores.ball,
          primary_problem: primaryProblem,
          secondary_problems: secondaryProblems,
          motor_profile: motorProfile || null,
          coach_notes: coachNotes,
          private_notes: privateNotes,
          recommended_drill_ids: selectedDrillIds,
          is_draft: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate report");
      }

      toast.success("Report generated! Ready to send.");
      await fetchSessions();

      const { data: updated } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", selectedSession.id)
        .maybeSingle();
      if (updated) setSelectedSession(updated);
    } catch (error) {
      console.error("Generate error:", error);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendResults = async () => {
    if (!selectedSession) return;

    if (!selectedSession.player_phone) {
      toast.error("No phone number for this player");
      return;
    }

    setSending(true);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-results`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authSession?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: selectedSession.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send");
      }

      toast.success(`Results sent to ${selectedSession.player_phone}!`);
    } catch (error) {
      console.error("Send error:", error);
      toast.error("Failed to send results");
    } finally {
      setSending(false);
    }
  };

  const currentSwing = swings[currentSwingIndex];
  const pendingCount = sessions.filter((s) => s.status === "paid").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />

      <main className="container py-8">
        {selectedSession ? (
          /* ========== ANALYZER DETAIL VIEW ========== */
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedSession(null)}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Queue
                </Button>
                <h1 className="text-2xl font-bold text-white">
                  {selectedSession.player_name}
                </h1>
                <Badge
                  className={`${statusColors[selectedSession.status]} text-white`}
                >
                  {selectedSession.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={saving}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Draft
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Video Player */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardContent className="p-4">
                    {loadingSwings ? (
                      <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                      </div>
                    ) : currentSwing?.video_url ? (
                      <div className="space-y-3">
                        <VideoPlayer
                          key={currentSwing.id}
                          src={currentSwing.video_url}
                          markers={swingMarkers}
                          onTimeUpdate={setCurrentVideoTime}
                          enableSAM3={true}
                          savedAnnotations={savedAnnotations}
                          onAnnotationSave={(a) => setSavedAnnotations(prev => [a, ...prev])}
                        />
                        {/* Marker Setting Controls */}
                        <div className="flex items-center justify-center gap-2 flex-wrap pt-2 border-t border-slate-700">
                          <span className="text-xs text-slate-400 mr-2">Set Marker at Current Frame:</span>
                          {(['load', 'trigger', 'contact', 'finish'] as const).map((markerType) => {
                            const exists = swingMarkers.some(m => m.id === markerType);
                            return (
                              <Button
                                key={markerType}
                                variant={exists ? "default" : "outline"}
                                size="sm"
                                className="h-6 px-2 text-xs capitalize"
                                onClick={() => {
                                  setSwingMarkers(prev => {
                                    // Remove existing marker of this type
                                    const filtered = prev.filter(m => m.id !== markerType);
                                    // Add new marker at current time
                                    return [...filtered, {
                                      id: markerType,
                                      label: markerType.charAt(0).toUpperCase() + markerType.slice(1),
                                      time: currentVideoTime
                                    }].sort((a, b) => a.time - b.time);
                                  });
                                }}
                              >
                                {markerType} {exists ? '✓' : ''}
                              </Button>
                            );
                          })}
                          {swingMarkers.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-slate-500"
                              onClick={() => setSwingMarkers([])}
                            >
                              Clear All
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video bg-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500">
                        <Video className="h-12 w-12 mb-2 opacity-50" />
                        <p>No video uploaded yet</p>
                      </div>
                    )}
                    {swings.length > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        {swings.map((_, idx) => (
                          <Button
                            key={idx}
                            size="sm"
                            variant={
                              idx === currentSwingIndex ? "default" : "outline"
                            }
                            onClick={() => setCurrentSwingIndex(idx)}
                            className={
                              idx === currentSwingIndex
                                ? "bg-red-600"
                                : "border-slate-700 text-slate-400"
                            }
                          >
                            Swing {idx + 1}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 4B Scores */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-red-500/20">
                        <Target className="h-4 w-4 text-red-400" />
                      </div>
                      4B Scores
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScoreInput scores={scores} onChange={setScores} />
                  </CardContent>
                </Card>

                {/* Problems */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Problem Identification
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProblemSelector
                      primaryProblem={primaryProblem}
                      secondaryProblems={secondaryProblems}
                      onPrimaryChange={setPrimaryProblem}
                      onSecondaryChange={setSecondaryProblems}
                      weakestCategory={getWeakestCategory()}
                      maxSecondary={maxSecondaryProblems}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Player Info */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Player Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                      <User className="h-3 w-3" />
                      <span className="text-slate-500">Name</span>
                      <span className="text-white ml-auto">
                        {selectedSession.player_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Mail className="h-3 w-3" />
                      <span className="text-slate-500">Email</span>
                      <span className="text-white ml-auto text-xs">
                        {selectedSession.player_email}
                      </span>
                    </div>
                    {selectedSession.player_phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="h-3 w-3" />
                        <span className="text-slate-500">Phone</span>
                        <span className="text-white ml-auto">
                          {selectedSession.player_phone}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-slate-500 text-xs">Product</span>
                        <p className="text-slate-300 text-sm">
                          {selectedSession.product_type.replace(/_/g, " ")}
                        </p>
                      </div>
                      <p className="text-white font-semibold">
                        ${(selectedSession.price_cents / 100).toFixed(0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Clock className="h-3 w-3" />
                      {format(
                        new Date(selectedSession.created_at),
                        "MMM d, yyyy h:mm a"
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Motor Profile */}
                {isCompleteReview && (
                  <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-sm flex items-center gap-2">
                        <Brain className="h-4 w-4 text-purple-400" />
                        Motor Profile
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup
                        value={motorProfile}
                        onValueChange={setMotorProfile}
                        className="grid grid-cols-2 gap-2"
                      >
                        {MOTOR_PROFILES.map((profile) => (
                          <div
                            key={profile}
                            className="flex items-center space-x-2"
                          >
                            <RadioGroupItem
                              value={profile}
                              id={`profile-${profile}`}
                              className="border-slate-600"
                            />
                            <Label
                              htmlFor={`profile-${profile}`}
                              className="text-slate-300 capitalize cursor-pointer"
                            >
                              {profile}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </CardContent>
                  </Card>
                )}

                {/* Drills */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-sm">
                      Drills ({isCompleteReview ? "3-5" : "1"})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DrillRecommendations
                      selectedDrillIds={selectedDrillIds}
                      onSelectionChange={setSelectedDrillIds}
                      maxDrills={maxDrills}
                      weakestCategory={getWeakestCategory()}
                      primaryProblem={primaryProblem}
                    />
                  </CardContent>
                </Card>

                {/* Notes */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-sm">Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-slate-400 text-xs">
                        Shown to player
                      </Label>
                      <Textarea
                        value={coachNotes}
                        onChange={(e) => setCoachNotes(e.target.value)}
                        placeholder="Your lower body is spinning open..."
                        rows={3}
                        className="mt-1 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs">
                        Private (internal)
                      </Label>
                      <Textarea
                        value={privateNotes}
                        onChange={(e) => setPrivateNotes(e.target.value)}
                        placeholder="Reminds me of player X..."
                        rows={2}
                        className="mt-1 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-4 space-y-3">
                    <Button
                      className="w-full bg-red-600 hover:bg-red-700"
                      disabled={
                        generating ||
                        !primaryProblem ||
                        selectedDrillIds.length === 0
                      }
                      onClick={handleGenerateReport}
                    >
                      {generating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      Generate Report
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                      disabled={
                        sending || selectedSession.status !== "complete"
                      }
                      onClick={handleSendResults}
                    >
                      {sending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send Results
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          /* ========== QUEUE LIST VIEW ========== */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">Swing Analyzer</h1>
                <p className="text-slate-400">
                  Review and analyze player swings
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Badge className="bg-red-500/20 text-red-400 text-lg px-4 py-2">
                  Queue: {pendingCount}
                </Badge>
                <Button
                  variant="outline"
                  onClick={fetchSessions}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-slate-900 border border-slate-800">
                <TabsTrigger
                  value="pending"
                  className="data-[state=active]:bg-red-600"
                >
                  Pending ({pendingCount})
                </TabsTrigger>
                <TabsTrigger
                  value="in_progress"
                  className="data-[state=active]:bg-red-600"
                >
                  In Progress
                </TabsTrigger>
                <TabsTrigger
                  value="completed"
                  className="data-[state=active]:bg-red-600"
                >
                  Completed
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                <Card className="bg-slate-900/50 border-slate-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead className="text-slate-400">Player</TableHead>
                        <TableHead className="text-slate-400">Product</TableHead>
                        <TableHead className="text-slate-400">
                          Uploaded
                        </TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let filtered: Session[] = [];
                        if (activeTab === "pending")
                          filtered = sessions.filter(
                            (s) => s.status === "paid"
                          );
                        else if (activeTab === "in_progress")
                          filtered = sessions.filter(
                            (s) => s.status === "analyzing"
                          );
                        else if (activeTab === "completed")
                          filtered = completedSessions;

                        if (filtered.length === 0) {
                          return (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center text-slate-500 py-12"
                              >
                                No sessions in this category
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return filtered.map((session) => (
                          <TableRow
                            key={session.id}
                            className="border-slate-800 hover:bg-slate-800/50"
                          >
                            <TableCell>
                              <p className="font-medium text-white">
                                {session.player_name}
                              </p>
                              <p className="text-sm text-slate-500">
                                {session.player_email}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-slate-700 text-slate-300">
                                {session.product_type.replace(/_/g, " ")}
                              </Badge>
                              <span className="ml-2 text-slate-400">
                                ${(session.price_cents / 100).toFixed(0)}
                              </span>
                            </TableCell>
                            <TableCell className="text-slate-400">
                              {formatDistanceToNow(
                                new Date(session.created_at),
                                { addSuffix: true }
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`${statusColors[session.status]} text-white`}
                              >
                                {session.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => selectSession(session)}
                                disabled={
                                  !["paid", "analyzing", "complete"].includes(
                                    session.status
                                  )
                                }
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {session.status === "paid" ? (
                                  <>
                                    <Play className="mr-1 h-3 w-3" /> Analyze
                                  </>
                                ) : (
                                  "View"
                                )}
                                <ChevronRight className="ml-1 h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
