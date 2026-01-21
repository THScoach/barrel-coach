/**
 * Scout Gauge Grid - 4B Circular Score Gauges
 * ============================================
 * High-end scouting-style circular gauges with 20-80 grading scale
 * Dark #0A0A0B background with #DC2626 red accents
 */

import { Brain, Activity, Zap, Target, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoutGaugeGridProps {
  brainScore: number | null;
  bodyScore: number | null;
  batScore: number | null;
  ballScore: number | null;
  weakestLink?: string | null;
  onCategoryClick?: (category: 'brain' | 'body' | 'bat' | 'ball') => void;
}

interface GaugeProps {
  score: number | null;
  label: string;
  icon: LucideIcon;
  isWeakest?: boolean;
  onClick?: () => void;
}

// 20-80 scouting scale grades
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

function ScoutGauge({ score, label, icon: Icon, isWeakest, onClick }: GaugeProps) {
  const size = 130;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2 - 4;
  const circumference = radius * 2 * Math.PI;
  
  // Convert 0-100 scale to percentage for gauge
  const displayScore = score ?? 50;
  const percentage = Math.max(0, Math.min(100, displayScore));
  const offset = circumference - (percentage / 100) * circumference;
  
  const strokeColor = score !== null ? getScoreColor(displayScore) : "#64748b";
  const grade = score !== null ? getScoreGrade(displayScore) : "—";

  return (
    <div 
      className={cn(
        "flex flex-col items-center p-4 rounded-xl transition-all duration-200 cursor-pointer",
        "bg-[#111113] border border-[#1a1a1c]",
        "hover:bg-[#161618] hover:border-[#252528]",
        isWeakest && "ring-2 ring-[#DC2626]/50 border-[#DC2626]/30"
      )}
      onClick={onClick}
    >
      <div 
        className="relative"
        style={{ 
          width: size, 
          height: size,
          filter: isWeakest 
            ? 'drop-shadow(0 0 15px rgba(220, 38, 38, 0.5))' 
            : 'drop-shadow(0 0 10px rgba(220, 38, 38, 0.2))',
        }}
      >
        {/* Outer glow ring */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, transparent 50%, rgba(220, 38, 38, 0.1) 100%)`,
          }}
        />
        
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e1e1e"
            strokeWidth={strokeWidth}
            className="opacity-80"
          />
          {/* Red glow border */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius + strokeWidth / 2 + 2}
            fill="none"
            stroke="#DC2626"
            strokeWidth={1.5}
            strokeOpacity={isWeakest ? 0.8 : 0.4}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white">
            {score !== null ? Math.round(score) : "—"}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            {grade}
          </span>
        </div>
      </div>
      
      {/* Label with icon */}
      <div className="flex items-center gap-2 mt-3">
        <Icon className={cn("h-4 w-4", isWeakest ? "text-[#DC2626]" : "text-slate-400")} />
        <span className={cn(
          "text-xs font-bold uppercase tracking-wider",
          isWeakest ? "text-[#DC2626]" : "text-slate-400"
        )}>
          {label}
        </span>
      </div>
      
      {isWeakest && (
        <span className="text-[10px] text-[#DC2626] font-semibold mt-1 uppercase tracking-wide">
          Focus Area
        </span>
      )}
    </div>
  );
}

export function ScoutGaugeGrid({ 
  brainScore, 
  bodyScore, 
  batScore, 
  ballScore,
  weakestLink,
  onCategoryClick 
}: ScoutGaugeGridProps) {
  const categories = [
    { key: 'brain' as const, score: brainScore, label: 'BRAIN', icon: Brain },
    { key: 'body' as const, score: bodyScore, label: 'BODY', icon: Activity },
    { key: 'bat' as const, score: batScore, label: 'BAT', icon: Zap },
    { key: 'ball' as const, score: ballScore, label: 'BALL', icon: Target },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#DC2626] flex items-center gap-2">
        <span className="w-8 h-px bg-gradient-to-r from-[#DC2626] to-transparent" />
        4B BREAKDOWN
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <ScoutGauge
            key={cat.key}
            score={cat.score}
            label={cat.label}
            icon={cat.icon}
            isWeakest={weakestLink?.toLowerCase() === cat.key}
            onClick={() => onCategoryClick?.(cat.key)}
          />
        ))}
      </div>
    </div>
  );
}
