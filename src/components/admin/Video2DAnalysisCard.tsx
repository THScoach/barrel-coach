import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  Activity, 
  Target, 
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Sparkles
} from "lucide-react";

interface Video2DAnalysis {
  composite: number;
  body: number;
  brain: number;
  bat: number;
  ball: number;
  grade: string;
  leak_detected: string;
  leak_evidence: string;
  motor_profile: string;
  coach_rick_take: string;
  priority_drill: string;
  limitations: string[];
  confidence: number;
  upgrade_cta: string;
}

interface Video2DAnalysisCardProps {
  analysis: Video2DAnalysis;
  isPaidUser: boolean;
  pendingReboot: boolean;
  onUpgrade?: () => void;
}

const ScoreCircle = ({ label, score, icon: Icon, isCapped }: { 
  label: string; 
  score: number; 
  icon: React.ElementType;
  isCapped?: boolean;
}) => {
  const getColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 55) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative w-16 h-16 rounded-full border-4 flex items-center justify-center ${getColor(score)} border-current/30`}>
        <span className="text-lg font-bold">{score}</span>
        {isCapped && (
          <div className="absolute -top-1 -right-1">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
    </div>
  );
};

export function Video2DAnalysisCard({ 
  analysis, 
  isPaidUser, 
  pendingReboot,
  onUpgrade 
}: Video2DAnalysisCardProps) {
  const getLeakBadgeColor = (leak: string) => {
    if (leak === "CLEAN_TRANSFER") return "bg-green-500/10 text-green-500";
    return "bg-yellow-500/10 text-yellow-500";
  };

  const getGradeColor = (grade: string) => {
    if (grade.includes("Elite") || grade.includes("Excellent")) return "text-green-500";
    if (grade.includes("Above") || grade.includes("Good")) return "text-blue-500";
    if (grade.includes("Average")) return "text-yellow-500";
    return "text-orange-500";
  };

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      {pendingReboot ? (
        <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <Clock className="h-5 w-5 text-blue-500" />
          <div>
            <p className="font-medium text-sm">Full biomechanics analysis in progress</p>
            <p className="text-xs text-muted-foreground">We'll notify you when it's ready (usually 24 hours)</p>
          </div>
        </div>
      ) : !isPaidUser && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <div className="flex-1">
            <p className="font-medium text-sm">2D Estimated Analysis</p>
            <p className="text-xs text-muted-foreground">Upgrade for full biomechanics with precise measurements</p>
          </div>
          {onUpgrade && (
            <Button size="sm" variant="default" onClick={onUpgrade}>
              Upgrade
            </Button>
          )}
        </div>
      )}

      {/* Main Scores */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Swing Analysis</CardTitle>
            <Badge variant="secondary" className="text-xs">
              2D VIDEO
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Composite Score */}
          <div className="text-center">
            <div className="text-4xl font-bold">{analysis.composite}</div>
            <div className={`text-sm font-medium ${getGradeColor(analysis.grade)}`}>
              {analysis.grade}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ⚠️ Estimated from video
            </div>
          </div>

          {/* 4B Scores */}
          <div className="flex justify-around">
            <ScoreCircle label="Body" score={analysis.body} icon={Activity} />
            <ScoreCircle label="Brain" score={analysis.brain} icon={Brain} isCapped />
            <ScoreCircle label="Bat" score={analysis.bat} icon={Target} />
            <ScoreCircle label="Ball" score={analysis.ball} icon={Zap} isCapped />
          </div>

          <div className="text-xs text-center text-muted-foreground">
            * Brain & Ball scores capped - precise timing requires 3D data
          </div>
        </CardContent>
      </Card>

      {/* What I Saw */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What I Saw</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Leak Detected */}
          <div className="flex items-start gap-3">
            <Badge className={getLeakBadgeColor(analysis.leak_detected)}>
              {analysis.leak_detected === "CLEAN_TRANSFER" ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <AlertTriangle className="h-3 w-3 mr-1" />
              )}
              {analysis.leak_detected.replace(/_/g, " ")}
            </Badge>
          </div>
          
          {analysis.leak_evidence && (
            <p className="text-sm text-muted-foreground">{analysis.leak_evidence}</p>
          )}

          {/* Motor Profile */}
          {analysis.motor_profile && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground">Motor Profile:</span>
              <Badge variant="outline">{analysis.motor_profile}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coach Rick's Take */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Coach Rick's Take</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{analysis.coach_rick_take}</p>
          
          {/* Priority Drill */}
          {analysis.priority_drill && (
            <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
              <div className="text-xs font-medium text-primary mb-1">FOCUS DRILL</div>
              <p className="text-sm">{analysis.priority_drill}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confidence & Limitations */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Analysis Confidence</span>
            <span className="text-xs font-medium">{Math.round(analysis.confidence * 100)}%</span>
          </div>
          <Progress value={analysis.confidence * 100} className="h-2" />
          
          {analysis.limitations && analysis.limitations.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs text-muted-foreground mb-2">Limitations:</div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {analysis.limitations.map((limitation, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span>•</span>
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA for Free Users */}
      {!isPaidUser && !pendingReboot && analysis.upgrade_cta && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <p className="text-sm mb-3">{analysis.upgrade_cta}</p>
            {onUpgrade && (
              <Button onClick={onUpgrade} className="w-full">
                Get Full Analysis - $47
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
