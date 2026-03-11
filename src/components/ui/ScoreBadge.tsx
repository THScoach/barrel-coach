import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showGrade?: boolean;
  className?: string;
}

export function getScoreColor(score: number): string {
  if (score >= 90) return "bg-teal-500 text-white";
  if (score >= 80) return "bg-teal-400 text-slate-900";
  if (score >= 60) return "bg-blue-500 text-white";
  return "bg-red-600 text-white";
}

export function getScoreGrade(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Good";
  if (score >= 60) return "Working";
  return "Priority";
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
