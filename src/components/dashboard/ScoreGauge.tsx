import { cn } from "@/lib/utils";
import { getScoreGrade } from "@/components/ui/ScoreBadge";

interface ScoreGaugeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  showGrade?: boolean;
  className?: string;
}

export function ScoreGauge({ score, label, size = "md", showGrade = true, className }: ScoreGaugeProps) {
  // Convert score (20-80) to percentage (0-100)
  const percentage = Math.max(0, Math.min(100, ((score - 20) / 60) * 100));
  const grade = getScoreGrade(score);

  const getColor = () => {
    if (score >= 70) return { stroke: "#14b8a6", bg: "bg-teal-500" }; // teal-500
    if (score >= 60) return { stroke: "#2dd4bf", bg: "bg-teal-400" }; // teal-400
    if (score >= 55) return { stroke: "#3b82f6", bg: "bg-blue-500" }; // blue-500
    if (score >= 50) return { stroke: "#64748b", bg: "bg-slate-500" }; // slate-500
    if (score >= 45) return { stroke: "#f97316", bg: "bg-orange-500" }; // orange-500
    if (score >= 30) return { stroke: "#f87171", bg: "bg-red-400" }; // red-400
    return { stroke: "#dc2626", bg: "bg-red-600" }; // red-600
  };

  const color = getColor();

  const sizeConfig = {
    sm: { size: 64, strokeWidth: 6, textSize: "text-lg", labelSize: "text-xs" },
    md: { size: 96, strokeWidth: 8, textSize: "text-2xl", labelSize: "text-sm" },
    lg: { size: 128, strokeWidth: 10, textSize: "text-4xl", labelSize: "text-base" },
  };

  const config = sizeConfig[size];
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: config.size, height: config.size }}>
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
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-slate-700"
          />
          {/* Progress circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold text-white", config.textSize)}>{score}</span>
          {showGrade && size !== "sm" && (
            <span className={cn("text-slate-400", config.labelSize)}>{grade}</span>
          )}
        </div>
      </div>
      {label && (
        <span className={cn("mt-2 font-medium text-slate-300", config.labelSize)}>
          {label}
        </span>
      )}
    </div>
  );
}
