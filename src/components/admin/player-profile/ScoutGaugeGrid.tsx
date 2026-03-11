/**
 * Scout Gauge Grid - 4B Circular Score Gauges
 * ============================================
 * High-end scouting-style circular gauges with 4-tier grading
 * Dark #0A0A0B background with #DC2626 red accents
 */

import { useState } from "react";
import { Brain, Activity, Zap, Target, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface ScoutGaugeGridProps {
  brainScore: number | null;
  bodyScore: number | null;
  batScore: number | null;
  ballScore: number | null;
  weakestLink?: string | null;
  onCategoryClick?: (category: 'brain' | 'body' | 'bat' | 'ball') => void;
  leakType?: string | null;
  leakCaption?: string | null;
  leakTraining?: string | null;
  rawMetrics?: Record<string, any> | null;
}

interface GaugeProps {
  score: number | null;
  label: string;
  icon: LucideIcon;
  isWeakest?: boolean;
  onClick?: () => void;
}

function getScoreGrade(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Good";
  if (score >= 60) return "Working";
  return "Priority";
}

function getScoreColor(score: number): string {
  if (score >= 90) return "#14b8a6";
  if (score >= 80) return "#2dd4bf";
  if (score >= 60) return "#3b82f6";
  return "#DC2626";
}

function getPlainExplanation(pillar: string, score: number): string {
  const explanations: Record<string, string[]> = {
    body: [
      "Your body isn't getting energy to the ball. This is the priority fix.",
      "Your body is generating power but losing some along the way.",
      "Your body is working well — small leaks to clean up.",
      "Your body is generating and transferring energy like a pro.",
    ],
    brain: [
      "Timing is the issue. Your body can't fire if you're early or late.",
      "Your timing is inconsistent — costing you at-bats.",
      "Your timing is sharp. Minor rhythm issues to dial in.",
      "Your timing is elite — you're in sync with every pitch.",
    ],
    bat: [
      "Bat delivery is breaking down. Drills needed here.",
      "The barrel is getting there but the path needs work.",
      "Good bat path. Small delivery issues to clean up.",
      "The barrel is exactly where it needs to be.",
    ],
    ball: [
      "Results aren't there yet. Process work comes first.",
      "Outcomes are inconsistent — mechanics aren't translating yet.",
      "Solid outcomes. Mechanics are holding up in games.",
      "Elite contact quality. The data matches the eye test.",
    ],
  };
  const tier = score >= 90 ? 3 : score >= 80 ? 2 : score >= 60 ? 1 : 0;
  return explanations[pillar]?.[tier] ?? "";
}

const defaultFixes: Record<string, string> = {
  body: "Focus on getting your hips and core to work together before the hands go.",
  brain: "Work on rhythm drills — sync your load timing with the pitcher's arm slot.",
  bat: "Barrel path drills — get the bat on plane earlier and stay through the zone.",
  ball: "Apply your mechanics in live at-bats. The process will show up in results.",
};

function ScoutGauge({ score, label, icon: Icon, isWeakest, onClick }: GaugeProps) {
  const size = 130;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2 - 4;
  const circumference = radius * 2 * Math.PI;
  
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
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, transparent 50%, rgba(220, 38, 38, 0.1) 100%)`,
          }}
        />
        
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#1e1e1e" strokeWidth={strokeWidth}
            className="opacity-80"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius + strokeWidth / 2 + 2}
            fill="none" stroke="#DC2626" strokeWidth={1.5}
            strokeOpacity={isWeakest ? 0.8 : 0.4}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white">
            {score !== null ? Math.round(score) : "—"}
          </span>
          <span className="text-xs text-slate-400 font-medium">{grade}</span>
        </div>
      </div>
      
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

function PillarDetailSheet({ 
  open, onOpenChange, pillar, score, icon: Icon, 
  leakType, leakCaption, leakTraining, rawMetrics 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  pillar: string; 
  score: number; 
  icon: LucideIcon;
  leakType?: string | null;
  leakCaption?: string | null;
  leakTraining?: string | null;
  rawMetrics?: Record<string, any> | null;
}) {
  const grade = getScoreGrade(score);
  const explanation = getPlainExplanation(pillar, score);
  const color = getScoreColor(score);
  const pillarLabel = pillar.charAt(0).toUpperCase() + pillar.slice(1);

  const subScores: { label: string; value: string }[] = [];
  if (rawMetrics) {
    if (pillar === 'body') {
      if (rawMetrics.avgLegsKE != null) subScores.push({ label: "Legs Energy", value: `${Math.round(rawMetrics.avgLegsKE)}` });
      if (rawMetrics.avgTorsoKE != null) subScores.push({ label: "Torso Energy", value: `${Math.round(rawMetrics.avgTorsoKE)}` });
      if (rawMetrics.avgTorsoToArmsTransfer != null) subScores.push({ label: "Transfer", value: `${Math.round(rawMetrics.avgTorsoToArmsTransfer)}` });
      if (rawMetrics.avgPelvisVelocity != null) subScores.push({ label: "Hip Speed", value: `${Math.round(rawMetrics.avgPelvisVelocity)}` });
    } else if (pillar === 'brain') {
      if (rawMetrics.cvTotalKE != null) subScores.push({ label: "Consistency", value: `${rawMetrics.cvTotalKE}%` });
      if (rawMetrics.avgXFactor != null) subScores.push({ label: "X-Factor", value: `${Math.round(rawMetrics.avgXFactor)}` });
    } else if (pillar === 'bat') {
      if (rawMetrics.avgArmsKE != null) subScores.push({ label: "Arm Energy", value: `${Math.round(rawMetrics.avgArmsKE)}` });
      if (rawMetrics.avgBatEfficiency != null) subScores.push({ label: "Efficiency", value: `${Math.round(rawMetrics.avgBatEfficiency * 100)}%` });
    } else if (pillar === 'ball') {
      if (rawMetrics.avgTotalKE != null) subScores.push({ label: "Total Energy", value: `${Math.round(rawMetrics.avgTotalKE)}` });
    }
  }

  const isRelevantLeak = leakType && leakType !== 'clean_transfer' && leakType !== 'unknown';
  const primaryFix = isRelevantLeak 
    ? (leakTraining || leakCaption || defaultFixes[pillar]) 
    : defaultFixes[pillar];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#0A0A0B] border-t border-[#1a1a1c] rounded-t-2xl max-h-[70vh]">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-3 text-white">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            {pillarLabel} Score
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pb-6">
          <div className="flex items-center gap-4">
            <span
              className="text-4xl font-black rounded-xl px-5 py-3 inline-block"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {Math.round(score)}
            </span>
            <div>
              <p className="text-lg font-bold text-white">{grade}</p>
              <p className="text-sm text-slate-400 leading-relaxed mt-0.5">{explanation}</p>
            </div>
          </div>

          {subScores.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Breakdown</h4>
              <div className="grid grid-cols-2 gap-2">
                {subScores.map((sub) => (
                  <div key={sub.label} className="bg-[#111113] border border-[#1a1a1c] rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">{sub.label}</p>
                    <p className="text-lg font-bold text-white mt-0.5">{sub.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#DC2626] mb-2">What to Fix</h4>
            <div className="bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-lg p-4">
              <p className="text-sm text-slate-300 leading-relaxed">{primaryFix}</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ScoutGaugeGrid({ 
  brainScore, bodyScore, batScore, ballScore,
  weakestLink, onCategoryClick,
  leakType, leakCaption, leakTraining, rawMetrics 
}: ScoutGaugeGridProps) {
  const [selectedPillar, setSelectedPillar] = useState<string | null>(null);

  const categories = [
    { key: 'brain' as const, score: brainScore, label: 'BRAIN', icon: Brain },
    { key: 'body' as const, score: bodyScore, label: 'BODY', icon: Activity },
    { key: 'bat' as const, score: batScore, label: 'BAT', icon: Zap },
    { key: 'ball' as const, score: ballScore, label: 'BALL', icon: Target },
  ];

  const selected = categories.find(c => c.key === selectedPillar);

  return (
    <>
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
              onClick={() => {
                setSelectedPillar(cat.key);
                onCategoryClick?.(cat.key);
              }}
            />
          ))}
        </div>
      </div>

      {selected && selected.score !== null && (
        <PillarDetailSheet
          open={!!selectedPillar}
          onOpenChange={(open) => { if (!open) setSelectedPillar(null); }}
          pillar={selected.key}
          score={selected.score}
          icon={selected.icon}
          leakType={leakType}
          leakCaption={leakCaption}
          leakTraining={leakTraining}
          rawMetrics={rawMetrics}
        />
      )}
    </>
  );
}
