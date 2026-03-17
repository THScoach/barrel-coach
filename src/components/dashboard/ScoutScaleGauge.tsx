/**
 * Scout Scale Gauge - 20-80 circular gauge
 * Used for displaying 4B scores (Brain, Body, Bat, Ball)
 * Uses shared scoreColor utility for brand consistency
 */
import { cn } from "@/lib/utils";
import { Brain, Activity, Zap, Target, LucideIcon } from "lucide-react";
import { scoreColor } from "@/lib/player-utils";

interface ScoutScaleGaugeProps {
  score: number | null;
  label: string;
  icon?: LucideIcon;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeConfig = {
  sm: { size: 80, strokeWidth: 6, textSize: "text-xl", labelSize: "text-xs", iconSize: "h-4 w-4" },
  md: { size: 110, strokeWidth: 8, textSize: "text-3xl", labelSize: "text-sm", iconSize: "h-5 w-5" },
  lg: { size: 140, strokeWidth: 10, textSize: "text-4xl", labelSize: "text-base", iconSize: "h-6 w-6" },
};

function getScoreGrade(score: number): string {
  if (score >= 85) return "Elite";
  if (score >= 70) return "Good";
  if (score >= 50) return "Developing";
  return "Needs Work";
}

export function ScoutScaleGauge({ 
  score, 
  label, 
  icon: Icon,
  size = "md", 
  className 
}: ScoutScaleGaugeProps) {
  const config = sizeConfig[size];
  const radius = (config.size - config.strokeWidth) / 2 - 4;
  const circumference = radius * 2 * Math.PI;
  
  const displayScore = score ?? 50;
  const percentage = Math.max(0, Math.min(100, ((displayScore - 20) / 60) * 100));
  const offset = circumference - (percentage / 100) * circumference;
  
  const strokeColorValue = scoreColor(score);
  const grade = score !== null ? getScoreGrade(displayScore) : "—";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div 
        className="relative"
        style={{ 
          width: config.size, 
          height: config.size,
          filter: `drop-shadow(0 0 12px ${strokeColorValue}40)`,
        }}
      >
        <svg
          width={config.size}
          height={config.size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="#1E2535"
            strokeWidth={config.strokeWidth}
          />
          {/* Outer border ring */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius + config.strokeWidth / 2 + 2}
            fill="none"
            stroke={strokeColorValue}
            strokeWidth={1.5}
            strokeOpacity={0.4}
          />
          {/* Progress circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke={strokeColorValue}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-black text-white", config.textSize)}>
            {score !== null ? Math.round(score) : "—"}
          </span>
          <span className={cn("font-medium", config.labelSize)} style={{ color: strokeColorValue }}>
            {grade}
          </span>
        </div>
      </div>
      
      {/* Label with icon */}
      <div className="flex items-center gap-1.5 mt-3">
        {Icon && <Icon className={cn(config.iconSize)} style={{ color: strokeColorValue }} />}
        <span className={cn("font-bold uppercase tracking-wider text-white", config.labelSize)}>
          {label}
        </span>
      </div>
    </div>
  );
}

// Pre-configured gauges for each 4B category
export function BrainScoreGauge({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  return <ScoutScaleGauge score={score} label="Brain" icon={Brain} size={size} />;
}

export function BodyScoreGauge({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  return <ScoutScaleGauge score={score} label="Body" icon={Activity} size={size} />;
}

export function BatScoreGauge({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  return <ScoutScaleGauge score={score} label="Bat" icon={Zap} size={size} />;
}

export function BallScoreGauge({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  return <ScoutScaleGauge score={score} label="Ball" icon={Target} size={size} />;
}
