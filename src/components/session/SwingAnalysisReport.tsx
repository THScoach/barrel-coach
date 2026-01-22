import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Zap, 
  Target, 
  Timer, 
  TrendingUp, 
  Activity,
  Gauge,
  Star,
  ChevronRight
} from "lucide-react";
import { SwingMetrics } from "@/services/CatchingBarrelsService";

interface SwingAnalysisReportProps {
  swingNumber: number;
  metrics: SwingMetrics;
  videoUrl?: string | null;
  showRecommendations?: boolean;
}

// Motor profile descriptions
const MOTOR_PROFILES = {
  SPINNER: {
    label: 'Spinner',
    description: 'Rotational power hitter with quick hip rotation',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
  },
  WHIPPER: {
    label: 'Whipper',
    description: 'Fast-twitch athlete with explosive barrel speed',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
  },
  SLINGSHOTTER: {
    label: 'Slingshotter',
    description: 'Efficient energy transfer from ground up',
    color: 'text-green-400',
    bg: 'bg-green-500/20',
  },
  TITAN: {
    label: 'Titan',
    description: 'Raw power hitter with elite strength metrics',
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
  },
  UNKNOWN: {
    label: 'Developing',
    description: 'Motor pattern still developing',
    color: 'text-gray-400',
    bg: 'bg-gray-500/20',
  },
};

// Recommendations based on metrics
function getRecommendations(metrics: SwingMetrics): string[] {
  const recommendations: string[] = [];
  
  if (metrics.tempo_score < 60) {
    recommendations.push('Focus on timing drills to improve swing tempo');
  }
  if (metrics.attack_angle_deg < 5) {
    recommendations.push('Work on launch angle to optimize ball flight');
  }
  if (metrics.efficiency_rating < 6) {
    recommendations.push('Practice connection drills for better energy transfer');
  }
  if (metrics.time_to_contact_ms > 180) {
    recommendations.push('Quicken trigger mechanics to reduce time to contact');
  }
  if (metrics.hand_speed_mph < 25) {
    recommendations.push('Strengthen forearms for improved hand speed');
  }
  
  // If no issues, give positive feedback
  if (recommendations.length === 0) {
    recommendations.push('Great swing mechanics! Continue current training regimen');
  }
  
  return recommendations.slice(0, 3);
}

// Calculate ceiling projection
function getCeilingProjection(metrics: SwingMetrics): { 
  current: number; 
  ceiling: number;
  grade: string;
} {
  const current = Math.round(
    (metrics.bat_speed_mph / 100 * 0.3 +
    metrics.tempo_score / 100 * 0.25 +
    metrics.efficiency_rating / 10 * 0.25 +
    Math.max(0, 100 - metrics.time_to_contact_ms) / 100 * 0.2) * 100
  );
  
  // Ceiling based on motor profile
  const profileBonus = {
    TITAN: 15,
    SLINGSHOTTER: 12,
    WHIPPER: 10,
    SPINNER: 8,
    UNKNOWN: 5,
  };
  
  const ceiling = Math.min(99, current + profileBonus[metrics.motor_profile_prediction] + 
    Math.round(metrics.efficiency_rating * 2));
  
  let grade = 'C';
  if (current >= 80) grade = 'A+';
  else if (current >= 70) grade = 'A';
  else if (current >= 60) grade = 'B+';
  else if (current >= 50) grade = 'B';
  else if (current >= 40) grade = 'C+';
  
  return { current, ceiling, grade };
}

export function SwingAnalysisReport({ 
  swingNumber, 
  metrics, 
  videoUrl,
  showRecommendations = true 
}: SwingAnalysisReportProps) {
  const profile = MOTOR_PROFILES[metrics.motor_profile_prediction];
  const projection = getCeilingProjection(metrics);
  const recommendations = getRecommendations(metrics);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Swing #{swingNumber}
          </CardTitle>
          <Badge className={profile.bg + ' ' + profile.color + ' border-0'}>
            {profile.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{profile.description}</p>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-4">
        {/* Video Preview */}
        {videoUrl && (
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={videoUrl}
              controls
              preload="metadata"
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
        )}
        
        {/* Traditional Metrics */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            Performance Metrics
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={Zap}
              label="Bat Speed"
              value={`${metrics.bat_speed_mph}`}
              unit="mph"
              color="text-orange-400"
            />
            <MetricCard
              icon={Target}
              label="Attack Angle"
              value={`${metrics.attack_angle_deg > 0 ? '+' : ''}${metrics.attack_angle_deg}`}
              unit="°"
              color="text-blue-400"
            />
            <MetricCard
              icon={Activity}
              label="Hand Speed"
              value={`${metrics.hand_speed_mph}`}
              unit="mph"
              color="text-green-400"
            />
            <MetricCard
              icon={Timer}
              label="Time to Contact"
              value={`${metrics.time_to_contact_ms}`}
              unit="ms"
              color="text-purple-400"
            />
          </div>
        </div>
        
        {/* Catching Barrels Enhanced Metrics */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Catching Barrels Analysis
          </h4>
          
          {/* Tempo Score */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Tempo Score</span>
                <span className="text-sm font-bold text-primary">{metrics.tempo_score}/100</span>
              </div>
              <Progress value={metrics.tempo_score} className="h-2" />
            </div>
            
            {/* Efficiency Rating */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Efficiency Rating</span>
                <span className="text-sm font-bold text-primary">{metrics.efficiency_rating}/10</span>
              </div>
              <Progress value={metrics.efficiency_rating * 10} className="h-2" />
            </div>
            
            {/* Peak Acceleration */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm">Peak Acceleration</span>
              </div>
              <span className="font-bold">{metrics.peak_acceleration_g}g</span>
            </div>
          </div>
        </div>
        
        {/* Ceiling Projection */}
        <div className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Development Projection
            </h4>
            <Badge variant="outline" className="text-lg font-bold">
              Grade: {projection.grade}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">{projection.current}</p>
              <p className="text-xs text-muted-foreground">Current Score</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-accent">{projection.ceiling}</p>
              <p className="text-xs text-muted-foreground">Ceiling Projection</p>
            </div>
          </div>
        </div>
        
        {/* Recommendations */}
        {showRecommendations && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Development Focus
            </h4>
            <div className="space-y-2">
              {recommendations.map((rec, idx) => (
                <div 
                  key={idx}
                  className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg text-sm"
                >
                  <ChevronRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Metric Card Component
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  unit,
  color 
}: { 
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
