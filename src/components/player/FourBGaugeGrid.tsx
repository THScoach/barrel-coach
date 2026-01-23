/**
 * 4B Gauge Grid - Stack-style circular progress cards for Brain, Body, Bat, Ball
 * Mobile-first 2x2 grid with scout-scale gauges and "Why?" action button
 */
import { Brain, Activity, Zap, Target, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FourBGaugeGridProps {
  brain: number | null;
  body: number | null;
  bat: number | null;
  ball: number | null;
  weakestLink?: string | null;
  onWhyClick?: (category: 'brain' | 'body' | 'bat' | 'ball') => void;
}

const CATEGORIES = [
  { key: 'brain' as const, label: 'Brain', icon: Brain, description: 'Timing & decisions' },
  { key: 'body' as const, label: 'Body', icon: Activity, description: 'Ground-up energy' },
  { key: 'bat' as const, label: 'Bat', icon: Zap, description: 'Barrel delivery' },
  { key: 'ball' as const, label: 'Ball', icon: Target, description: 'Exit velocity' },
];

function getScoreColor(score: number | null): string {
  if (score === null) return "#64748b"; // slate-500
  if (score >= 70) return "#14b8a6"; // teal-500
  if (score >= 60) return "#2dd4bf"; // teal-400
  if (score >= 50) return "#64748b"; // slate-500
  if (score >= 40) return "#f97316"; // orange-500
  return "#DC2626"; // red-600
}

function getScoreGrade(score: number | null): string {
  if (score === null) return "—";
  if (score >= 70) return "Plus+";
  if (score >= 60) return "Plus";
  if (score >= 50) return "Avg";
  if (score >= 40) return "Below";
  return "Poor";
}

interface GaugeCardProps {
  score: number | null;
  label: string;
  description: string;
  icon: typeof Brain;
  isWeakest: boolean;
  onWhyClick?: () => void;
}

function GaugeCard({ score, label, description, icon: Icon, isWeakest, onWhyClick }: GaugeCardProps) {
  const displayScore = score ?? 50;
  const percentage = Math.max(0, Math.min(100, ((displayScore - 20) / 60) * 100));
  const strokeColor = getScoreColor(score);
  const grade = getScoreGrade(score);
  
  // SVG circle math
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2 - 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div 
      className={cn(
        "relative bg-slate-800/80 rounded-xl p-4 flex flex-col items-center transition-all",
        isWeakest && "ring-2 ring-red-500/50 bg-red-500/5"
      )}
    >
      {/* Weakest indicator */}
      {isWeakest && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2">
          <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold uppercase rounded-full">
            Focus
          </span>
        </div>
      )}

      {/* Circular gauge */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
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
        
        {/* Center score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white">
            {score !== null ? Math.round(score) : "—"}
          </span>
        </div>
      </div>

      {/* Label and icon */}
      <div className="flex items-center gap-1.5 mt-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="font-bold text-sm text-white uppercase tracking-wide">
          {label}
        </span>
      </div>
      
      {/* Grade */}
      <span className="text-xs text-slate-400 mt-0.5">{grade}</span>

      {/* Why button for weak areas */}
      {isWeakest && onWhyClick && (
        <button 
          onClick={onWhyClick}
          className="mt-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          <HelpCircle className="h-3 w-3" />
          Why?
        </button>
      )}
    </div>
  );
}

export function FourBGaugeGrid({ brain, body, bat, ball, weakestLink, onWhyClick }: FourBGaugeGridProps) {
  const scores = { brain, body, bat, ball };

  return (
    <div className="grid grid-cols-2 gap-3">
      {CATEGORIES.map(({ key, label, icon, description }) => (
        <GaugeCard
          key={key}
          score={scores[key]}
          label={label}
          description={description}
          icon={icon}
          isWeakest={weakestLink === key}
          onWhyClick={onWhyClick ? () => onWhyClick(key) : undefined}
        />
      ))}
    </div>
  );
}
