import { cn } from "@/lib/utils";

interface ScoreCardProps {
  label: string;
  description: string;
  score: number | null;
  grade: string | null;
  isMain?: boolean;
}

function getGradeColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 70) return "text-green-500";
  if (score >= 60) return "text-green-400";
  if (score >= 55) return "text-yellow-500";
  if (score >= 45) return "text-gray-400";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

export function ScoreCard({ label, description, score, grade, isMain = false }: ScoreCardProps) {
  const gradeColor = getGradeColor(score);

  return (
    <div
      className={cn(
        "bg-[#1F2937] rounded-lg border-l-4 border-[#DC2626] p-4 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-red-900/20",
        isMain && "col-span-full md:col-span-2 p-6"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Label */}
        <span className="text-xs font-bold uppercase tracking-wider text-[#DC2626] mb-1">
          {label}
        </span>
        
        {/* Description */}
        <span className="text-xs text-gray-400 mb-3">
          {description}
        </span>
        
        {/* Score */}
        <div className={cn("flex items-baseline gap-2", isMain && "justify-center my-4")}>
          <span className={cn(
            "font-black text-white",
            isMain ? "text-6xl" : "text-4xl"
          )}>
            {score ?? "—"}
          </span>
        </div>
        
        {/* Grade */}
        <span className={cn("text-sm font-medium mt-auto", gradeColor)}>
          {grade ?? "No Data"}
        </span>
      </div>
    </div>
  );
}
