/**
 * Leak Detection Card - Visualizes Kinetic Leaks from dk-4b-inverse
 * ====================================================================
 * Shows all detected leaks with severity, category, and metrics
 * Dark #0A0A0B with color-coded leak indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  Brain, 
  Activity, 
  Zap, 
  Target,
  TrendingDown,
  Gauge,
  ArrowDown,
  ArrowUp,
  Flame
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Leak {
  type: string;
  category: "brain" | "body" | "bat" | "ball";
  severity: "low" | "medium" | "high";
  description: string;
  metric_value: number;
  threshold: number;
}

interface LeakDetectionCardProps {
  leaks: Leak[];
  weakestCategory?: string | null;
  isLoading?: boolean;
}

const categoryConfig: Record<string, {
  label: string;
  icon: typeof Brain;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  brain: {
    label: "Brain",
    icon: Brain,
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
  },
  body: {
    label: "Body",
    icon: Activity,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  bat: {
    label: "Bat",
    icon: Zap,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  ball: {
    label: "Ball",
    icon: Target,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
};

const severityConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof AlertTriangle;
}> = {
  low: {
    label: "Minor",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    icon: ArrowDown,
  },
  medium: {
    label: "Moderate",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    icon: TrendingDown,
  },
  high: {
    label: "Critical",
    color: "text-[#DC2626]",
    bgColor: "bg-[#DC2626]/20",
    icon: Flame,
  },
};

const leakTypeLabels: Record<string, string> = {
  timing_variance: "Timing Variance",
  early_release: "Early Release",
  energy_transfer: "Energy Transfer",
  flat_path: "Flat Bat Path",
  steep_path: "Steep Bat Path",
  path_variance: "Path Variance",
  late_legs: "Late Legs",
  torso_bypass: "Torso Bypass",
  arm_bar: "Arm Bar",
};

export function LeakDetectionCard({
  leaks,
  weakestCategory,
  isLoading = false,
}: LeakDetectionCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-[#0A0A0B] border-[#1a1a1c]">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-800 rounded w-1/3" />
            <div className="h-24 bg-slate-800 rounded" />
            <div className="h-24 bg-slate-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!leaks || leaks.length === 0) {
    return (
      <Card className="bg-[#0A0A0B] border-[#1a1a1c] border-l-4 border-l-emerald-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
            <Gauge className="h-4 w-4" />
            LEAK DETECTION
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-3">
            <Target className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-emerald-400 font-medium">No Kinetic Leaks Detected</p>
          <p className="text-slate-500 text-sm mt-1">Energy transfer is optimal across all categories</p>
        </CardContent>
      </Card>
    );
  }

  // Sort leaks by severity (high -> medium -> low)
  const sortedLeaks = [...leaks].sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  // Group leaks by category for summary
  const leaksByCategory = leaks.reduce((acc, leak) => {
    acc[leak.category] = (acc[leak.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const criticalLeaks = leaks.filter(l => l.severity === "high").length;

  return (
    <Card 
      className="bg-[#0A0A0B] border-[#1a1a1c] border-l-4 border-l-[#DC2626] overflow-hidden relative"
      style={{
        boxShadow: criticalLeaks > 0 
          ? '0 0 40px rgba(220, 38, 38, 0.2), inset 0 0 60px rgba(220, 38, 38, 0.03)' 
          : undefined,
      }}
    >
      {/* Subtle glow effect at top for critical leaks */}
      {criticalLeaks > 0 && (
        <div 
          className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(220, 38, 38, 0.1), transparent)',
          }}
        />
      )}

      <CardHeader className="pb-3 relative">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#DC2626]">
            <AlertTriangle className="h-4 w-4" />
            LEAK DETECTION
          </CardTitle>
          <Badge 
            className={cn(
              "text-xs font-bold",
              criticalLeaks > 0 
                ? "bg-[#DC2626]/20 text-[#DC2626]" 
                : "bg-orange-500/20 text-orange-400"
            )}
          >
            {leaks.length} LEAK{leaks.length !== 1 ? 'S' : ''} FOUND
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 relative">
        {/* Category Summary Pills */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(leaksByCategory).map(([category, count]) => {
            const config = categoryConfig[category] || categoryConfig.body;
            const Icon = config.icon;
            return (
              <div
                key={category}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                  config.bgColor,
                  config.color,
                  config.borderColor
                )}
              >
                <Icon className="h-3 w-3" />
                {config.label}: {count}
              </div>
            );
          })}
        </div>

        {/* Individual Leak Cards */}
        <div className="space-y-3">
          {sortedLeaks.map((leak, index) => {
            const catConfig = categoryConfig[leak.category] || categoryConfig.body;
            const sevConfig = severityConfig[leak.severity] || severityConfig.medium;
            const CatIcon = catConfig.icon;
            const SevIcon = sevConfig.icon;
            
            // Calculate how far over/under threshold
            const isOverThreshold = leak.metric_value > leak.threshold;
            const deviationPct = Math.abs(
              ((leak.metric_value - leak.threshold) / leak.threshold) * 100
            );

            return (
              <div
                key={`${leak.type}-${index}`}
                className={cn(
                  "p-4 rounded-lg border transition-all",
                  "bg-[#111113] border-[#1a1a1c]",
                  leak.severity === "high" && "border-[#DC2626]/40"
                )}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", catConfig.bgColor)}>
                      <CatIcon className={cn("h-4 w-4", catConfig.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {leakTypeLabels[leak.type] || leak.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className={cn("text-xs font-medium uppercase tracking-wide", catConfig.color)}>
                        {catConfig.label}
                      </p>
                    </div>
                  </div>
                  
                  <Badge className={cn("text-xs font-bold flex items-center gap-1", sevConfig.bgColor, sevConfig.color)}>
                    <SevIcon className="h-3 w-3" />
                    {sevConfig.label}
                  </Badge>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-400 mb-3 leading-relaxed">
                  {leak.description}
                </p>

                {/* Metric Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Value: <span className={sevConfig.color}>{leak.metric_value.toFixed(1)}</span>
                    </span>
                    <span className="text-slate-500">
                      Threshold: {leak.threshold}
                    </span>
                  </div>
                  <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all",
                        leak.severity === "high" ? "bg-[#DC2626]" :
                        leak.severity === "medium" ? "bg-orange-500" :
                        "bg-yellow-500"
                      )}
                      style={{ 
                        width: `${Math.min(100, (leak.metric_value / (leak.threshold * 2)) * 100)}%` 
                      }}
                    />
                    {/* Threshold marker */}
                    <div 
                      className="absolute inset-y-0 w-0.5 bg-white/60"
                      style={{ left: '50%' }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 text-right">
                    {isOverThreshold ? (
                      <span className="flex items-center gap-1 justify-end text-[#DC2626]">
                        <ArrowUp className="h-3 w-3" />
                        {deviationPct.toFixed(0)}% over threshold
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 justify-end text-yellow-500">
                        <ArrowDown className="h-3 w-3" />
                        {deviationPct.toFixed(0)}% under threshold
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Weakest Link Footer */}
        {weakestCategory && (
          <div className="flex items-center gap-3 p-3 bg-[#111113] rounded-lg border border-[#1a1a1c] mt-4">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              Weakest Link:
            </span>
            <Badge className="bg-[#DC2626]/20 text-[#DC2626] border-[#DC2626]/30 font-bold">
              {weakestCategory.toUpperCase()}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
