import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Edit,
  Loader2,
  Brain,
  Dumbbell,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface PendingSwing {
  id: string;
  session_id: string;
  swing_index: number;
  video_url: string | null;
  thumbnail_url: string | null;
  status: string | null;
  frame_rate: number | null;
  sequence_score: number | null;
  sequence_analysis: any;
  created_at: string;
  session: {
    id: string;
    player_id: string;
    session_date: string;
    context: string | null;
    player: {
      id: string;
      name: string;
      level: string | null;
    } | null;
  } | null;
}

interface ValidationModalProps {
  swing: PendingSwing;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface MetricScore {
  raw: number | null;
  score_20_80: number;
}

const LEAK_OPTIONS = [
  { value: "early_torso", label: "Early Torso Rotation" },
  { value: "bar_drag", label: "Bat Drag" },
  { value: "casting", label: "Casting" },
  { value: "lunging", label: "Lunging" },
  { value: "spinning", label: "Spinning Off" },
  { value: "no_separation", label: "No Hip-Shoulder Separation" },
  { value: "late_brace", label: "Late Lead Leg Brace" },
  { value: "early_extension", label: "Early Extension" },
  { value: "no_leak", label: "No Major Leak Detected" },
];

const getScoreColor = (score: number): string => {
  if (score >= 70) return "text-green-400";
  if (score >= 55) return "text-blue-400";
  if (score >= 45) return "text-yellow-400";
  return "text-red-400";
};

export function ValidationModal({
  swing,
  isOpen,
  onClose,
  onComplete,
}: ValidationModalProps) {
  // Extract metrics from sequence_analysis if available
  const analysis = swing.sequence_analysis || {};
  
  const [metrics, setMetrics] = useState({
    load_sequence: { raw: analysis.load_sequence_ms ?? null, score_20_80: analysis.load_sequence_score ?? 50 },
    tempo: { raw: analysis.tempo_ratio ?? null, score_20_80: analysis.tempo_score ?? 50 },
    separation: { raw: analysis.separation_degrees ?? null, score_20_80: analysis.separation_score ?? 50 },
    lead_leg_braking: { raw: analysis.lead_leg_braking_ms ?? null, score_20_80: analysis.lead_leg_braking_score ?? 50 },
    sync_score: analysis.sync_score ?? 50,
  });

  const [bodyScore, setBodyScore] = useState(analysis.body_score ?? 50);
  const [brainScore, setBrainScore] = useState(analysis.brain_score ?? 50);
  const [primaryLeak, setPrimaryLeak] = useState(analysis.primary_leak ?? "");
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // Calculate composite from individual metrics
  const calculateBodyScore = () => {
    return Math.round(
      metrics.load_sequence.score_20_80 * 0.30 +
      metrics.separation.score_20_80 * 0.30 +
      metrics.lead_leg_braking.score_20_80 * 0.40
    );
  };

  const calculateBrainScore = () => {
    return Math.round(
      metrics.tempo.score_20_80 * 0.50 +
      metrics.sync_score * 0.50
    );
  };

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: async (withEdits: boolean) => {
      const finalBodyScore = withEdits ? bodyScore : calculateBodyScore();
      const finalBrainScore = withEdits ? brainScore : calculateBrainScore();

      // Update the swing record
      const { error: swingError } = await supabase
        .from("video_swings")
        .update({
          status: "validated",
          sequence_score: Math.round((finalBodyScore + finalBrainScore) / 2),
          sequence_analysis: {
            ...analysis,
            load_sequence_ms: metrics.load_sequence.raw,
            load_sequence_score: metrics.load_sequence.score_20_80,
            tempo_ratio: metrics.tempo.raw,
            tempo_score: metrics.tempo.score_20_80,
            separation_degrees: metrics.separation.raw,
            separation_score: metrics.separation.score_20_80,
            lead_leg_braking_ms: metrics.lead_leg_braking.raw,
            lead_leg_braking_score: metrics.lead_leg_braking.score_20_80,
            sync_score: metrics.sync_score,
            body_score: finalBodyScore,
            brain_score: finalBrainScore,
            primary_leak: primaryLeak,
            validation_notes: notes,
            validated_at: new Date().toISOString(),
            was_edited: withEdits,
          },
        })
        .eq("id", swing.id);

      if (swingError) throw swingError;

      // Update player's latest scores if we have a player
      if (swing.session?.player?.id) {
        const { error: playerError } = await supabase
          .from("players")
          .update({
            latest_body_score: finalBodyScore,
            latest_brain_score: finalBrainScore,
            updated_at: new Date().toISOString(),
          })
          .eq("id", swing.session.player.id);

        if (playerError) {
          console.error("Failed to update player scores:", playerError);
        }
      }

      return { bodyScore: finalBodyScore, brainScore: finalBrainScore };
    },
    onSuccess: (data) => {
      toast.success(`Approved! BODY: ${data.bodyScore}, BRAIN: ${data.brainScore}`);
      onComplete();
    },
    onError: (error: any) => {
      toast.error(`Approval failed: ${error.message}`);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("video_swings")
        .update({
          status: "rejected",
          sequence_analysis: {
            ...analysis,
            rejected_at: new Date().toISOString(),
            reject_reason: rejectReason,
          },
        })
        .eq("id", swing.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Swing rejected. Player will be notified.");
      onComplete();
    },
    onError: (error: any) => {
      toast.error(`Rejection failed: ${error.message}`);
    },
  });

  const updateMetricScore = (
    metric: keyof Omit<typeof metrics, "sync_score">,
    field: "raw" | "score_20_80",
    value: number | null
  ) => {
    setMetrics((prev) => ({
      ...prev,
      [metric]: {
        ...prev[metric],
        [field]: value,
      },
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            Review: {swing.session?.player?.name} - Swing #{swing.swing_index + 1}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Video */}
          <div className="space-y-4">
            <div className="aspect-video bg-slate-800 rounded-lg overflow-hidden">
              {swing.video_url ? (
                <video
                  src={swing.video_url}
                  controls
                  className="w-full h-full object-contain"
                  autoPlay
                  loop
                  muted
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  No video available
                </div>
              )}
            </div>

            {/* Confidence Flags */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={
                  swing.frame_rate && swing.frame_rate >= 120
                    ? "border-green-500 text-green-400"
                    : swing.frame_rate && swing.frame_rate >= 60
                    ? "border-yellow-500 text-yellow-400"
                    : "border-red-500 text-red-400"
                }
              >
                {swing.frame_rate ? `${swing.frame_rate} fps` : "Unknown FPS"}
              </Badge>
              <Badge variant="outline" className="border-slate-600 text-slate-400">
                {swing.session?.context || "No context"}
              </Badge>
              <Badge variant="outline" className="border-slate-600 text-slate-400">
                {swing.session?.player?.level || "Unknown level"}
              </Badge>
            </div>

            {/* Primary Leak Selection */}
            <div className="space-y-2">
              <Label className="text-slate-300">Primary Leak</Label>
              <Select value={primaryLeak} onValueChange={setPrimaryLeak}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select primary leak..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {LEAK_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-white hover:bg-slate-700"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-slate-300">Coach Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for the player..."
                className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
              />
            </div>
          </div>

          {/* Right: Metrics */}
          <div className="space-y-4">
            {/* 4B Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-4 text-center">
                <Dumbbell className={`h-8 w-8 mx-auto mb-2 ${getScoreColor(bodyScore)}`} />
                <p className="text-sm text-slate-400">BODY</p>
                <Input
                  type="number"
                  value={bodyScore}
                  onChange={(e) => setBodyScore(parseInt(e.target.value) || 0)}
                  className="w-20 mx-auto mt-2 bg-slate-700 border-slate-600 text-white text-center text-2xl font-bold"
                  min={20}
                  max={80}
                />
              </div>
              <div className="bg-slate-800 rounded-lg p-4 text-center">
                <Brain className={`h-8 w-8 mx-auto mb-2 ${getScoreColor(brainScore)}`} />
                <p className="text-sm text-slate-400">BRAIN</p>
                <Input
                  type="number"
                  value={brainScore}
                  onChange={(e) => setBrainScore(parseInt(e.target.value) || 0)}
                  className="w-20 mx-auto mt-2 bg-slate-700 border-slate-600 text-white text-center text-2xl font-bold"
                  min={20}
                  max={80}
                />
              </div>
            </div>

            {/* Individual Metrics */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
                Individual Metrics (20-80 Scale)
              </h4>

              {/* Load Sequence */}
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-slate-300">Load Sequence</Label>
                  <span className="text-xs text-slate-500">Elite: +75ms</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      value={metrics.load_sequence.raw ?? ""}
                      onChange={(e) =>
                        updateMetricScore("load_sequence", "raw", e.target.value ? parseFloat(e.target.value) : null)
                      }
                      placeholder="ms"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <span className="text-xs text-slate-500">Raw (ms)</span>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      value={metrics.load_sequence.score_20_80}
                      onChange={(e) =>
                        updateMetricScore("load_sequence", "score_20_80", parseInt(e.target.value) || 0)
                      }
                      className={`bg-slate-700 border-slate-600 text-center font-bold ${getScoreColor(
                        metrics.load_sequence.score_20_80
                      )}`}
                      min={20}
                      max={80}
                    />
                    <span className="text-xs text-slate-500">Score</span>
                  </div>
                </div>
              </div>

              {/* Tempo */}
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-slate-300">Tempo Ratio</Label>
                  <span className="text-xs text-slate-500">Elite: 2.1:1</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={metrics.tempo.raw ?? ""}
                      onChange={(e) =>
                        updateMetricScore("tempo", "raw", e.target.value ? parseFloat(e.target.value) : null)
                      }
                      placeholder="ratio"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <span className="text-xs text-slate-500">Raw (ratio)</span>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      value={metrics.tempo.score_20_80}
                      onChange={(e) => updateMetricScore("tempo", "score_20_80", parseInt(e.target.value) || 0)}
                      className={`bg-slate-700 border-slate-600 text-center font-bold ${getScoreColor(
                        metrics.tempo.score_20_80
                      )}`}
                      min={20}
                      max={80}
                    />
                    <span className="text-xs text-slate-500">Score</span>
                  </div>
                </div>
              </div>

              {/* Separation */}
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-slate-300">Separation</Label>
                  <span className="text-xs text-slate-500">Elite: 26°+</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      value={metrics.separation.raw ?? ""}
                      onChange={(e) =>
                        updateMetricScore("separation", "raw", e.target.value ? parseFloat(e.target.value) : null)
                      }
                      placeholder="degrees"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <span className="text-xs text-slate-500">Raw (°)</span>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      value={metrics.separation.score_20_80}
                      onChange={(e) =>
                        updateMetricScore("separation", "score_20_80", parseInt(e.target.value) || 0)
                      }
                      className={`bg-slate-700 border-slate-600 text-center font-bold ${getScoreColor(
                        metrics.separation.score_20_80
                      )}`}
                      min={20}
                      max={80}
                    />
                    <span className="text-xs text-slate-500">Score</span>
                  </div>
                </div>
              </div>

              {/* Lead Leg Braking */}
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-slate-300">Lead Leg Braking</Label>
                  <span className="text-xs text-slate-500">Elite: -35ms</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      value={metrics.lead_leg_braking.raw ?? ""}
                      onChange={(e) =>
                        updateMetricScore(
                          "lead_leg_braking",
                          "raw",
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      placeholder="ms before contact"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <span className="text-xs text-slate-500">Raw (ms)</span>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      value={metrics.lead_leg_braking.score_20_80}
                      onChange={(e) =>
                        updateMetricScore("lead_leg_braking", "score_20_80", parseInt(e.target.value) || 0)
                      }
                      className={`bg-slate-700 border-slate-600 text-center font-bold ${getScoreColor(
                        metrics.lead_leg_braking.score_20_80
                      )}`}
                      min={20}
                      max={80}
                    />
                    <span className="text-xs text-slate-500">Score</span>
                  </div>
                </div>
              </div>

              {/* Sync Score */}
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-slate-300">Sync Score (Composite)</Label>
                </div>
                <Input
                  type="number"
                  value={metrics.sync_score}
                  onChange={(e) =>
                    setMetrics((prev) => ({ ...prev, sync_score: parseInt(e.target.value) || 0 }))
                  }
                  className={`w-24 bg-slate-700 border-slate-600 text-center font-bold ${getScoreColor(
                    metrics.sync_score
                  )}`}
                  min={20}
                  max={80}
                />
              </div>
            </div>

            {/* Auto-calculated suggestion */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-sm text-blue-400">
                <strong>Auto-calculated:</strong> BODY = {calculateBodyScore()}, BRAIN ={" "}
                {calculateBrainScore()}
              </p>
            </div>
          </div>
        </div>

        {/* Reject Dialog */}
        {showRejectDialog && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <span className="text-red-400 font-medium">Reject this swing?</span>
            </div>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (will be shown to player)..."
              className="bg-slate-800 border-slate-700 text-white mb-3"
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate()}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Confirm Reject
              </Button>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!showRejectDialog && (
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
            <Button
              onClick={() => approveMutation.mutate(false)}
              disabled={approveMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve (Auto Scores)
            </Button>
            <Button
              onClick={() => approveMutation.mutate(true)}
              disabled={approveMutation.isPending}
              variant="outline"
              className="flex-1 border-green-600 text-green-400 hover:bg-green-600/20"
            >
              <Edit className="h-4 w-4 mr-2" />
              Approve with Edits
            </Button>
            <Button
              onClick={() => setShowRejectDialog(true)}
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-600/20"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
