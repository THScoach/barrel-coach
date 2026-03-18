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
  // V4 nested fields
  analysis_json?: {
    primary_leak?: {
      flag?: string;
      title?: string;
      explanation?: string;
      pillar?: string;
    };
    drill_prescription?: {
      primary?: { name?: string; sets?: number; reps?: string; why?: string };
      secondary?: { name?: string; sets?: number; reps?: string; why?: string };
    };
    motor_profile?: {
      estimated?: string;
      confidence?: string;
      note?: string;
    };
    frame_analysis?: {
      load?: string;
      foot_plant?: string;
      delivery_window?: string;
      contact?: string;
    };
    coach_barrels_take?: string;
    ratings?: Record<string, string>;
  };
}

interface Video2DAnalysisCardProps {
  analysis: Video2DAnalysis;
  isPaidUser: boolean;
  pendingReboot: boolean;
  onUpgrade?: () => void;
  isAdminView?: boolean;
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

const getLeakPillarStyle = (pillar?: string) => {
  switch (pillar) {
    case "BODY": return "bg-red-500/15 text-red-500 border-red-500/30";
    case "BRAIN": return "bg-blue-500/15 text-blue-500 border-blue-500/30";
    case "BAT": return "bg-orange-500/15 text-orange-500 border-orange-500/30";
    default: return "bg-red-500/15 text-red-500 border-red-500/30";
  }
};

const inferPillar = (flag: string): string => {
  const bodyFlags = ["NO_HIP_LEAD", "FRONT_SIDE_COLLAPSE", "NO_LOAD", "TRUNK_DRIFT", "EARLY_WEIGHT_SHIFT", "COLLAPSE", "LUNGE", "SPIN_OUT"];
  const brainFlags = ["SIMULTANEOUS_FIRING", "DISCONNECTED_SEQUENCE", "RUSHED_TEMPO", "POOR_SEPARATION"];
  const batFlags = ["CASTING", "BARREL_DUMP", "ARM_DOMINANT", "CAST", "EARLY_ARMS"];
  if (bodyFlags.includes(flag)) return "BODY";
  if (brainFlags.includes(flag)) return "BRAIN";
  if (batFlags.includes(flag)) return "BAT";
  return "BODY";
};

export function Video2DAnalysisCard({ 
  analysis, 
  isPaidUser, 
  pendingReboot,
  onUpgrade,
  isAdminView = false,
}: Video2DAnalysisCardProps) {
  const json = analysis.analysis_json;
  const pillar = json?.primary_leak?.pillar || inferPillar(analysis.leak_detected);
  const leakTitle = json?.primary_leak?.title || analysis.leak_detected?.replace(/_/g, " ");
  const leakExplanation = json?.primary_leak?.explanation || analysis.leak_evidence;
  const coachTake = json?.coach_barrels_take || analysis.coach_rick_take;
  const motorProfile = json?.motor_profile?.estimated || analysis.motor_profile;
  const drillPrimary = json?.drill_prescription?.primary;
  const drillSecondary = json?.drill_prescription?.secondary;
  const frameAnalysis = json?.frame_analysis;

  const getGradeColor = (grade: string) => {
    if (grade.includes("Elite") || grade.includes("Excellent")) return "text-green-500";
    if (grade.includes("Above") || grade.includes("Good")) return "text-blue-500";
    if (grade.includes("Average") || grade.includes("Working")) return "text-yellow-500";
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

      {/* The Leak */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">The Leak</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Leak Badge with pillar color */}
          <div className="flex items-start gap-3">
            <Badge className={`${getLeakPillarStyle(pillar)} border`}>
              {pillar} LEAK: {leakTitle}
            </Badge>
          </div>
          
          {leakExplanation && (
            <p className="text-sm text-muted-foreground">{leakExplanation}</p>
          )}

          {/* Motor Profile */}
          {motorProfile && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground">Motor Profile:</span>
              <Badge variant="outline">{motorProfile}</Badge>
              {json?.motor_profile?.confidence && (
                <span className="text-xs text-muted-foreground">({json.motor_profile.confidence})</span>
              )}
            </div>
          )}
          {json?.motor_profile?.note && (
            <p className="text-xs text-muted-foreground">{json.motor_profile.note}</p>
          )}
        </CardContent>
      </Card>

      {/* Coach Barrels */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Coach Barrels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{coachTake}</p>
          
          {/* Drill Prescriptions */}
          {drillPrimary && (
            <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
              <div className="text-xs font-medium text-primary mb-1">FOCUS DRILL</div>
              <p className="text-sm font-medium">{drillPrimary.name}</p>
              {(drillPrimary.sets || drillPrimary.reps) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {drillPrimary.sets && `${drillPrimary.sets} sets`}{drillPrimary.sets && drillPrimary.reps && " × "}{drillPrimary.reps}
                </p>
              )}
              {drillPrimary.why && (
                <p className="text-xs text-muted-foreground mt-1">{drillPrimary.why}</p>
              )}
            </div>
          )}
          {drillSecondary && (
            <div className="p-3 bg-muted/50 border border-border rounded-lg">
              <div className="text-xs font-medium text-muted-foreground mb-1">SECONDARY DRILL</div>
              <p className="text-sm font-medium">{drillSecondary.name}</p>
              {(drillSecondary.sets || drillSecondary.reps) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {drillSecondary.sets && `${drillSecondary.sets} sets`}{drillSecondary.sets && drillSecondary.reps && " × "}{drillSecondary.reps}
                </p>
              )}
              {drillSecondary.why && (
                <p className="text-xs text-muted-foreground mt-1">{drillSecondary.why}</p>
              )}
            </div>
          )}
          {/* Fallback for old format without structured drills */}
          {!drillPrimary && analysis.priority_drill && (
            <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
              <div className="text-xs font-medium text-primary mb-1">FOCUS DRILL</div>
              <p className="text-sm">{analysis.priority_drill}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Frame-by-Frame Analysis */}
      {frameAnalysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Frame Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {frameAnalysis.load && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">LOAD</div>
                <p className="text-sm">{frameAnalysis.load}</p>
              </div>
            )}
            {frameAnalysis.foot_plant && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">FOOT PLANT</div>
                <p className="text-sm">{frameAnalysis.foot_plant}</p>
              </div>
            )}
            {frameAnalysis.delivery_window && (
              <div>
                <div className="text-xs font-medium text-primary mb-1">DELIVERY WINDOW</div>
                <p className="text-sm">{frameAnalysis.delivery_window}</p>
              </div>
            )}
            {frameAnalysis.contact && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">CONTACT</div>
                <p className="text-sm">{frameAnalysis.contact}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confidence & Limitations — admin only */}
      {isAdminView && (
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
      )}
    </div>
  );
}
