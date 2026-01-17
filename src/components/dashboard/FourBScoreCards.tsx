import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { cn } from "@/lib/utils";
import { Activity, Brain, Zap, Target } from "lucide-react";

interface FourBScoreCardsProps {
  body: number | null;
  brain: number | null;
  bat: number | null;
  ball: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const scoreConfig = {
  body: {
    label: "BODY",
    icon: Activity,
    description: "Ground-up energy",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
  },
  brain: {
    label: "BRAIN",
    icon: Brain,
    description: "Timing & consistency",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  bat: {
    label: "BAT",
    icon: Zap,
    description: "Upper body delivery",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
  },
  ball: {
    label: "BALL",
    icon: Target,
    description: "Output quality",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
};

export function FourBScoreCards({ body, brain, bat, ball, size = "md", className }: FourBScoreCardsProps) {
  const scores = { body, brain, bat, ball };

  const sizeClasses = {
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
  };

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4", sizeClasses[size], className)}>
      {(Object.keys(scoreConfig) as Array<keyof typeof scoreConfig>).map((key) => {
        const config = scoreConfig[key];
        const score = scores[key];
        const Icon = config.icon;

        return (
          <Card key={key} className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-1.5 rounded-md", config.bgColor)}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <span className="text-xs font-semibold text-slate-400 tracking-wider">
                  {config.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {score !== null ? (
                  <ScoreBadge score={score} size={size === "sm" ? "sm" : "md"} />
                ) : (
                  <span className="text-slate-500 text-sm">—</span>
                )}
              </div>
              {size !== "sm" && (
                <p className="text-xs text-slate-500 mt-1.5">{config.description}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
