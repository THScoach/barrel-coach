import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showGrade?: boolean;
  className?: string;
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "bg-teal-500 text-white"; // Plus-Plus
  if (score >= 60) return "bg-teal-400 text-slate-900"; // Plus
  if (score >= 55) return "bg-blue-500 text-white"; // Above Avg
  if (score >= 50) return "bg-slate-500 text-white"; // Average
  if (score >= 45) return "bg-orange-500 text-white"; // Below Avg
  if (score >= 30) return "bg-red-400 text-white"; // Fringe
  return "bg-red-600 text-white"; // Poor
}

export function getScoreGrade(score: number): string {
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 50) return "Average";
  if (score >= 45) return "Below Avg";
  if (score >= 40) return "Fringe Avg";
  if (score >= 30) return "Fringe";
  return "Poor";
}

export function ScoreBadge({ score, size = "md", showGrade = false, className }: ScoreBadgeProps) {
  const colorClass = getScoreColor(score);
  const grade = getScoreGrade(score);
  
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-medium min-w-[32px]",
    md: "px-3 py-1 text-sm font-semibold min-w-[40px]",
    lg: "px-4 py-2 text-lg font-bold min-w-[56px]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      {score}
      {showGrade && <span className="ml-1.5 opacity-90">{grade}</span>}
    </span>
  );
}
