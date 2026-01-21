import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Dumbbell, 
  Zap, 
  Target,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
} from "lucide-react";

interface SessionSummaryCardProps {
  compositeScore: number;
  brainScore: number;
  bodyScore: number;
  batScore: number;
  ballScore: number | null;
  primaryLeak: string | null;
  weakestLink: string | null;
  swingCount: number;
  leakFrequency?: number;
  accuracyTier?: string | null;
  delta?: number | null;
  source: "2d" | "3d";
}

const getGrade = (score: number): string => {
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 45) return "Average";
  if (score >= 40) return "Below Avg";
  if (score >= 30) return "Fringe";
  return "Poor";
};

const getScoreColor = (score: number | null): string => {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-green-400";
  if (score >= 60) return "text-green-500";
  if (score >= 55) return "text-blue-400";
  if (score >= 45) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
};

const getScoreBg = (score: number | null): string => {
  if (score === null) return "bg-muted";
  if (score >= 70) return "bg-green-500/20";
  if (score >= 60) return "bg-green-500/15";
  if (score >= 55) return "bg-blue-500/20";
  if (score >= 45) return "bg-yellow-500/20";
  if (score >= 40) return "bg-orange-500/20";
  return "bg-red-500/20";
};

const LEAK_LABELS: Record<string, string> = {
  early_torso: "Early Torso Rotation",
  late_legs: "Late Lower Body",
  arms_before_torso: "Arms Before Torso",
  bat_drag: "Bat Drag",
  no_sequence: "No Clear Sequence",
  casting: "Casting",
  lunging: "Lunging",
  spinning: "Spinning Off",
  no_separation: "No Hip-Shoulder Separation",
  late_brace: "Late Lead Leg Brace",
  early_extension: "Early Extension",
};

export function SessionSummaryCard({
  compositeScore,
  brainScore,
  bodyScore,
  batScore,
  ballScore,
  primaryLeak,
  weakestLink,
  swingCount,
  leakFrequency,
  accuracyTier,
  delta,
  source,
}: SessionSummaryCardProps) {
  const grade = getGrade(compositeScore);
  const sourceColor = source === "2d" ? "amber" : "teal";
  const sourceLabel = source === "2d" ? "2D Video Analysis" : "3D Reboot Analysis";

  return (
    <Card className={`bg-slate-900/80 border-slate-700 border-l-4 ${
      source === "2d" ? "border-l-amber-500" : "border-l-teal-500"
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Target className={`h-5 w-5 ${source === "2d" ? "text-amber-400" : "text-teal-400"}`} />
            Session Summary
          </CardTitle>
          <Badge className={`${source === "2d" ? "bg-amber-500/20 text-amber-400" : "bg-teal-500/20 text-teal-400"}`}>
            {sourceLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Composite Score Header */}
        <div className={`rounded-xl p-6 text-center ${getScoreBg(compositeScore)}`}>
          <p className="text-sm text-slate-400 uppercase mb-1">4B Composite Score</p>
          <div className="flex items-center justify-center gap-4">
            <span className={`text-5xl font-bold ${getScoreColor(compositeScore)}`}>
              {compositeScore}
            </span>
            <div className="text-left">
              <p className={`text-xl font-medium ${getScoreColor(compositeScore)}`}>{grade}</p>
              <p className="text-sm text-slate-500">{swingCount} swings analyzed</p>
            </div>
          </div>
          
          {/* Accuracy Badge */}
          {accuracyTier && (
            <div className="mt-3 flex items-center justify-center gap-2">
              {accuracyTier === "high" ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              )}
              <span className={`text-sm ${
                accuracyTier === "high" ? "text-green-400" : 
                accuracyTier === "medium" ? "text-yellow-400" : "text-red-400"
              }`}>
                {accuracyTier === "high" ? "High" : accuracyTier === "medium" ? "Medium" : "Low"} Accuracy
                {delta !== null && ` (Δ ${delta > 0 ? "+" : ""}${delta.toFixed(1)})`}
              </span>
            </div>
          )}
        </div>

        {/* 4B Score Grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: "brain", label: "Brain", score: brainScore, icon: Brain, desc: "Consistency" },
            { key: "body", label: "Body", score: bodyScore, icon: Dumbbell, desc: "Ground Force" },
            { key: "bat", label: "Bat", score: batScore, icon: Zap, desc: "Delivery" },
            { key: "ball", label: "Ball", score: ballScore, icon: Target, desc: "Output" },
          ].map((item) => (
            <div 
              key={item.key}
              className={`rounded-lg p-3 text-center ${getScoreBg(item.score)} ${
                weakestLink === item.key ? "ring-2 ring-red-500/50" : ""
              }`}
            >
              <item.icon className={`h-5 w-5 mx-auto mb-1 ${getScoreColor(item.score)}`} />
              <p className="text-xs text-slate-500 uppercase">{item.label}</p>
              <p className={`text-2xl font-bold ${getScoreColor(item.score)}`}>
                {item.score ?? "—"}
              </p>
              <p className="text-xs text-slate-500">{item.desc}</p>
              {weakestLink === item.key && (
                <Badge variant="outline" className="mt-1 text-xs border-red-500/50 text-red-400">
                  Weakest
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Primary Leak */}
        {primaryLeak && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">Primary Energy Leak</p>
                <p className="text-lg text-white">
                  {LEAK_LABELS[primaryLeak] || primaryLeak.replace(/_/g, " ")}
                </p>
                {leakFrequency && leakFrequency > 0 && (
                  <p className="text-sm text-slate-400 mt-1">
                    Detected in {leakFrequency} of {swingCount} swings ({Math.round((leakFrequency / swingCount) * 100)}%)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Training Recommendation */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-teal-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-teal-400">Focus Area</p>
              <p className="text-white">
                {weakestLink === "brain" && "Work on swing consistency and timing repeatability"}
                {weakestLink === "body" && "Focus on ground force production and lower body sequencing"}
                {weakestLink === "bat" && "Improve barrel delivery and energy transfer mechanics"}
                {weakestLink === "ball" && "Optimize contact quality and launch conditions"}
                {!weakestLink && "Continue balanced training across all 4B categories"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
