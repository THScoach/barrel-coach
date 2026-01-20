import { cn } from "@/lib/utils";

interface ScoreCardProps {
  label: string;
  description: string;
  score: number | null;
  grade: string | null;
  isMain?: boolean;
}

function getGradeColor(score: number | null): string {
  if (score === null) return "text-gray-500";
  if (score >= 70) return "text-emerald-400";
  if (score >= 60) return "text-teal-400";
  if (score >= 55) return "text-amber-400";
  if (score >= 45) return "text-gray-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getScoreBorderColor(score: number | null): string {
  if (score === null) return "border-gray-700";
  if (score >= 70) return "border-emerald-500";
  if (score >= 60) return "border-teal-500";
  if (score >= 55) return "border-amber-500";
  if (score >= 45) return "border-gray-500";
  if (score >= 40) return "border-orange-500";
  return "border-red-500";
}

export function ScoreCard({ label, description, score, grade, isMain = false }: ScoreCardProps) {
  const gradeColor = getGradeColor(score);
  const borderColor = getScoreBorderColor(score);

  return (
    <div
      className={cn(
        "bg-[#111113] rounded-xl border-l-4 transition-all duration-300",
        "hover:scale-[1.02] hover:shadow-xl hover:shadow-red-900/10",
        borderColor,
        isMain ? "col-span-full p-8" : "p-5"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Label Badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className={cn(
            "text-xs font-black uppercase tracking-[0.2em]",
            "text-[#DC2626]"
          )}>
            {label}
          </span>
        </div>
        
        {/* Description */}
        <span className="text-xs text-gray-500 mb-4 leading-relaxed">
          {description}
        </span>
        
        {/* Score Display */}
        <div className={cn(
          "flex items-baseline gap-3",
          isMain && "justify-center my-6"
        )}>
          <span className={cn(
            "font-black text-white tracking-tight",
            isMain ? "text-7xl" : "text-5xl"
          )}>
            {score ?? "—"}
          </span>
          {score !== null && (
            <span className="text-lg font-medium text-gray-600">/80</span>
          )}
        </div>
        
        {/* Grade */}
        <div className="mt-auto pt-3 border-t border-gray-800">
          <span className={cn("text-sm font-semibold tracking-wide", gradeColor)}>
            {grade ?? "No Data"}
          </span>
        </div>
      </div>
    </div>
  );
}