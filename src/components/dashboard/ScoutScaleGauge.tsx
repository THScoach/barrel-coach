/**
 * Scout Scale Gauge - 20-80 circular gauge with glowing red border
 * Used for displaying 4B scores (Brain, Body, Bat, Ball)
 */
import { cn } from "@/lib/utils";
import { Brain, Activity, Zap, Target, LucideIcon } from "lucide-react";

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
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 50) return "Average";
  if (score >= 45) return "Below Avg";
  if (score >= 40) return "Fringe";
  return "Well Below";
}

function getScoreColor(score: number): string {
  if (score >= 70) return "#14b8a6"; // teal-500
  if (score >= 60) return "#2dd4bf"; // teal-400
  if (score >= 55) return "#3b82f6"; // blue-500
  if (score >= 50) return "#64748b"; // slate-500
  if (score >= 45) return "#f97316"; // orange-500
  return "#DC2626"; // red-600
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
  
  // Convert 20-80 scale to percentage (0-100)
  const displayScore = score ?? 50;
  const percentage = Math.max(0, Math.min(100, ((displayScore - 20) / 60) * 100));
  const offset = circumference - (percentage / 100) * circumference;
  
  const strokeColor = score !== null ? getScoreColor(displayScore) : "#64748b";
  const grade = score !== null ? getScoreGrade(displayScore) : "—";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div 
        className="relative"
        style={{ 
          width: config.size, 
          height: config.size,
          filter: `drop-shadow(0 0 12px rgba(220, 38, 38, 0.4))`,
        }}
      >
        {/* Outer glow ring */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, transparent 50%, rgba(220, 38, 38, 0.15) 100%)`,
          }}
        />
        
        <svg
          width={config.size}
          height={config.size}
          className="transform -rotate-90"
        >
          {/* Background circle with red glow border */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="#1e1e1e"
            strokeWidth={config.strokeWidth}
            className="opacity-80"
          />
          {/* Red glow border */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius + config.strokeWidth / 2 + 2}
            fill="none"
            stroke="#DC2626"
            strokeWidth={1.5}
            strokeOpacity={0.6}
          />
          {/* Progress circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
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
          <span className={cn("text-slate-400 font-medium", config.labelSize)}>
            {grade}
          </span>
        </div>
      </div>
      
      {/* Label with icon */}
      <div className="flex items-center gap-1.5 mt-3">
        {Icon && <Icon className={cn("text-[#DC2626]", config.iconSize)} />}
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
