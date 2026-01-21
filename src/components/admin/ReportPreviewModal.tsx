import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  Edit3,
  Smartphone,
  Brain,
  Target,
  Zap,
  Activity,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Dumbbell,
  Play,
} from "lucide-react";
import { format } from "date-fns";

interface ReportData {
  id: string;
  player_id: string;
  session_date: string;
  composite_score: number | null;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  leak_detected: string | null;
  motor_profile: string | null;
  priority_drill: string | null;
  eighth_grade_summary: string | null;
  coach_notes_edited: string | null;
  player: {
    name: string;
    level: string | null;
  } | null;
}

interface ReportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ReportData | null;
  onPublish: (reportId: string, coachNotes?: string) => void;
  isPublishing: boolean;
}

export function ReportPreviewModal({
  open,
  onOpenChange,
  report,
  onPublish,
  isPublishing,
}: ReportPreviewModalProps) {
  const [editedNotes, setEditedNotes] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (report) {
      setEditedNotes(
        report.coach_notes_edited ||
          report.eighth_grade_summary ||
          generateDefaultSummary(report)
      );
    }
  }, [report]);

  if (!report) return null;

  function generateDefaultSummary(r: ReportData): string {
    const score = r.composite_score?.toFixed(0) || "N/A";
    const leak = r.leak_detected || "No major leaks detected";
    const drill = r.priority_drill || "Focus on fundamentals";

    return `Your swing scored ${score} out of 100. ${
      r.leak_detected
        ? `We found a leak in your swing: ${leak}. This is costing you power.`
        : "Your mechanics look solid!"
    } Your priority drill is: ${drill}. Keep grinding! 💪`;
  }

  const handlePublish = () => {
    onPublish(report.id, editedNotes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl h-[90vh] p-0 overflow-hidden"
        style={{ backgroundColor: "#0A0A0B", border: "1px solid rgba(220, 38, 38, 0.3)" }}
      >
        <div className="flex h-full">
          {/* Left Side - Admin Controls */}
          <div className="w-1/2 p-6 border-r border-slate-700/50 overflow-y-auto">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5" style={{ color: "#DC2626" }} />
                Review Report
              </DialogTitle>
            </DialogHeader>

            {/* Player Info */}
            <div className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {report.player?.name || "Unknown Player"}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {format(new Date(report.session_date), "MMMM d, yyyy")}
                  </p>
                </div>
                {report.player?.level && (
                  <Badge
                    variant="outline"
                    className="border-[#DC2626]/50 text-[#DC2626]"
                  >
                    {report.player.level}
                  </Badge>
                )}
              </div>
            </div>

            {/* Scores Summary */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                4B Scores
              </h4>
              <div className="grid grid-cols-4 gap-3">
                <ScoreChip label="Brain" score={report.brain_score} icon={Brain} />
                <ScoreChip label="Body" score={report.body_score} icon={Activity} />
                <ScoreChip label="Bat" score={report.bat_score} icon={Zap} />
                <ScoreChip label="Comp" score={report.composite_score} icon={Target} />
              </div>
            </div>

            {/* Leak & Drill */}
            <div className="mb-6 space-y-3">
              {report.leak_detected && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Detected Leak
                  </div>
                  <p className="text-white">{report.leak_detected}</p>
                </div>
              )}
              {report.priority_drill && (
                <div className="p-3 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30">
                  <div className="flex items-center gap-2 text-[#DC2626] text-sm font-medium mb-1">
                    <Dumbbell className="h-4 w-4" />
                    Priority Drill
                  </div>
                  <p className="text-white">{report.priority_drill}</p>
                </div>
              )}
            </div>

            <Separator className="bg-slate-700 my-6" />

            {/* Editable Notes */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  8th Grade Summary
                </h4>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[#DC2626] hover:bg-[#DC2626]/20"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  {isEditing ? "Done" : "Edit"}
                </Button>
              </div>
              {isEditing ? (
                <Textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  className="min-h-[150px] bg-slate-800 border-slate-600 text-white"
                  placeholder="Write a summary that an 8th grader can understand..."
                />
              ) : (
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 whitespace-pre-wrap">
                  {editedNotes || "No summary yet. Click Edit to add one."}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">
                This is what the player will see on their phone. Keep it simple and encouraging.
              </p>
            </div>

            {/* Publish Button */}
            <Button
              className="w-full py-6 text-lg font-bold bg-[#DC2626] hover:bg-[#DC2626]/90"
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Send className="h-5 w-5 mr-2" />
              )}
              Publish to App
            </Button>
          </div>

          {/* Right Side - iPhone Simulator */}
          <div className="w-1/2 bg-slate-900 flex items-center justify-center p-8">
            <div className="relative">
              {/* iPhone Frame */}
              <div
                className="relative rounded-[3rem] p-3 shadow-2xl"
                style={{
                  backgroundColor: "#1C1C1E",
                  width: "320px",
                  height: "650px",
                }}
              >
                {/* Notch */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 rounded-b-2xl z-10"
                  style={{ backgroundColor: "#1C1C1E" }}
                >
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full bg-black" />
                </div>

                {/* Screen */}
                <div
                  className="w-full h-full rounded-[2.5rem] overflow-hidden relative"
                  style={{ backgroundColor: "#0A0A0B" }}
                >
                  {/* Status Bar */}
                  <div className="flex items-center justify-between px-6 pt-3 pb-1 text-xs text-white">
                    <span className="font-medium">9:41</span>
                    <div className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Report Content */}
                  <div className="px-4 pb-4 overflow-y-auto h-[calc(100%-40px)]">
                    <PhoneReportPreview report={report} summary={editedNotes} />
                  </div>
                </div>
              </div>

              {/* Device Label */}
              <div className="text-center mt-4">
                <Badge variant="outline" className="border-slate-600 text-slate-400">
                  <Smartphone className="h-3 w-3 mr-1" />
                  Player View
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Score Chip Component
function ScoreChip({
  label,
  score,
  icon: Icon,
}: {
  label: string;
  score: number | null;
  icon: typeof Brain;
}) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
      <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: "#DC2626" }} />
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-bold text-white">{score?.toFixed(0) || "—"}</p>
    </div>
  );
}

// Phone Report Preview Component
function PhoneReportPreview({
  report,
  summary,
}: {
  report: ReportData;
  summary: string;
}) {
  return (
    <div className="space-y-4 pt-2">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-lg font-bold text-white">Swing Report</h1>
        <p className="text-xs text-slate-400">
          {format(new Date(report.session_date), "MMMM d, yyyy")}
        </p>
      </div>

      {/* Composite Score Card */}
      <div
        className="rounded-2xl p-4 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(220,38,38,0.2) 0%, rgba(0,0,0,0.3) 100%)",
          border: "1px solid rgba(220,38,38,0.4)",
        }}
      >
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">4B Composite</p>
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl font-black"
          style={{
            backgroundColor: "rgba(220, 38, 38, 0.2)",
            color: "#DC2626",
            border: "3px solid rgba(220, 38, 38, 0.5)",
          }}
        >
          {report.composite_score?.toFixed(0) || "—"}
        </div>
        <div className="flex justify-center gap-4 mt-4">
          <MiniScore label="Brain" value={report.brain_score} />
          <MiniScore label="Body" value={report.body_score} />
          <MiniScore label="Bat" value={report.bat_score} />
        </div>
      </div>

      {/* Coach Summary */}
      <div className="rounded-xl p-4 bg-slate-800/60 border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400 uppercase">Coach Notes</span>
        </div>
        <p className="text-sm text-white leading-relaxed">{summary}</p>
      </div>

      {/* Leak Card */}
      {report.leak_detected && (
        <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase">
              Power Leak Found
            </span>
          </div>
          <p className="text-sm text-white">{report.leak_detected}</p>
        </div>
      )}

      {/* Priority Drill */}
      {report.priority_drill && (
        <div className="rounded-xl p-4 bg-[#DC2626]/10 border border-[#DC2626]/30">
          <div className="flex items-center gap-2 mb-2">
            <Dumbbell className="h-4 w-4 text-[#DC2626]" />
            <span className="text-xs font-semibold text-[#DC2626] uppercase">Your Drill</span>
          </div>
          <p className="text-sm text-white mb-3">{report.priority_drill}</p>
          <Button
            size="sm"
            className="w-full bg-[#DC2626]/20 hover:bg-[#DC2626]/30 text-[#DC2626] border border-[#DC2626]/50"
          >
            <Play className="h-4 w-4 mr-2" />
            Watch Demo
          </Button>
        </div>
      )}

      {/* Motor Profile Badge */}
      {report.motor_profile && (
        <div className="text-center py-3">
          <Badge
            className="text-sm px-4 py-1 capitalize"
            style={{
              backgroundColor: "rgba(220, 38, 38, 0.2)",
              color: "#DC2626",
              border: "1px solid rgba(220, 38, 38, 0.4)",
            }}
          >
            {report.motor_profile} Profile
          </Badge>
        </div>
      )}
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className="text-lg font-bold text-white">{value?.toFixed(0) || "—"}</p>
    </div>
  );
}
