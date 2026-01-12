/**
 * 4B Navigation Strip - Persistent Brain/Body/Bat/Ball tiles
 */
import { cn } from "@/lib/utils";
import { Brain, Activity, Zap, Target } from "lucide-react";

export type FourBCategory = 'brain' | 'body' | 'bat' | 'ball';

interface BScoreData {
  score: number | null;
  previousScore?: number | null;
  trend: number[]; // Last N session scores for sparkline
}

interface FourBNavStripProps {
  activeB: FourBCategory;
  onSelectB: (b: FourBCategory) => void;
  scores: {
    brain: BScoreData;
    body: BScoreData;
    bat: BScoreData;
    ball: BScoreData;
  };
}

const B_CONFIG: Record<FourBCategory, { 
  label: string; 
  icon: typeof Brain; 
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  brain: { 
    label: 'Brain', 
    icon: Brain, 
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/50'
  },
  body: { 
    label: 'Body', 
    icon: Activity, 
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/50'
  },
  bat: { 
    label: 'Bat', 
    icon: Zap, 
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/50'
  },
  ball: { 
    label: 'Ball', 
    icon: Target, 
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/50'
  },
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 40;
    const y = 16 - ((val - min) / range) * 14;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="40" height="18" className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={color}
      />
    </svg>
  );
}

function BTile({ 
  b, 
  data, 
  isActive, 
  onClick 
}: { 
  b: FourBCategory; 
  data: BScoreData; 
  isActive: boolean; 
  onClick: () => void;
}) {
  const config = B_CONFIG[b];
  const Icon = config.icon;
  const delta = data.previousScore !== null && data.previousScore !== undefined && data.score !== null
    ? data.score - data.previousScore
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 min-w-[80px] p-3 rounded-xl border-2 transition-all duration-200",
        "hover:scale-[1.02] active:scale-[0.98]",
        isActive 
          ? cn(config.bgColor, config.borderColor, "shadow-lg")
          : "bg-card/50 border-border hover:border-muted-foreground/30"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", config.color)} />
        <span className={cn("text-xs font-semibold uppercase tracking-wide", isActive ? config.color : "text-muted-foreground")}>
          {config.label}
        </span>
      </div>
      
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className={cn("text-2xl font-black", isActive ? "text-foreground" : "text-muted-foreground")}>
            {data.score ?? '--'}
          </div>
          {delta !== null && (
            <div className={cn(
              "text-xs font-medium",
              delta > 0 ? "text-emerald-500" : delta < 0 ? "text-red-500" : "text-muted-foreground"
            )}>
              {delta > 0 ? '+' : ''}{delta}
            </div>
          )}
        </div>
        
        {data.trend.length >= 2 && (
          <MiniSparkline data={data.trend} color={config.color} />
        )}
      </div>
    </button>
  );
}

export function FourBNavStrip({ activeB, onSelectB, scores }: FourBNavStripProps) {
  const categories: FourBCategory[] = ['brain', 'body', 'bat', 'ball'];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {categories.map(b => (
        <BTile
          key={b}
          b={b}
          data={scores[b]}
          isActive={activeB === b}
          onClick={() => onSelectB(b)}
        />
      ))}
    </div>
  );
}
