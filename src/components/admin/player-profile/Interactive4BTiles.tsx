/**
 * Interactive 4B Tiles for Rick Lab
 * ==================================
 * Clickable tiles that expand to show detailed metrics for each B category.
 * Updated to match clean dark dashboard aesthetic with left border accents.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Brain, 
  Activity, 
  Zap, 
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FourBScores } from "@/lib/players/getPlayerScorecard";

interface Interactive4BTilesProps {
  fourBScores: FourBScores;
  onViewDetails?: (category: 'brain' | 'body' | 'bat' | 'ball') => void;
}

const categoryConfig = {
  brain: {
    icon: Brain,
    label: "BRAIN",
    description: "Decision & timing",
    metrics: ["Pitch recognition", "Swing decisions", "Game IQ"],
  },
  body: {
    icon: Activity,
    label: "BODY",
    description: "Ground-up energy",
    metrics: ["Ground flow", "Core flow", "Upper flow", "Sequence timing"],
  },
  bat: {
    icon: Zap,
    label: "BAT",
    description: "Upper body delivery",
    metrics: ["Bat KE", "Transfer efficiency", "Barrel quality"],
  },
  ball: {
    icon: Target,
    label: "BALL",
    description: "Output quality",
    metrics: ["Exit velocity", "Launch angle", "Barrel %", "Hard hit %"],
  },
};

type Category = keyof typeof categoryConfig;

// Get border color based on score (scouting scale)
function getScoreBorderColor(score: number | null): string {
  if (score === null) return "border-l-slate-600";
  if (score >= 70) return "border-l-teal-500";      // Plus-Plus (Elite)
  if (score >= 60) return "border-l-teal-400";      // Plus
  if (score >= 50) return "border-l-slate-500";     // Average
  if (score >= 40) return "border-l-orange-500";    // Below Avg
  return "border-l-red-500";                         // Fringe/Poor
}

export function Interactive4BTiles({ fourBScores, onViewDetails }: Interactive4BTilesProps) {
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(null);

  const getTrend = (current: number | null, prev: number | null) => {
    if (current === null || prev === null) return 'flat';
    if (current > prev) return 'up';
    if (current < prev) return 'down';
    return 'flat';
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-400" />;
    return <Minus className="h-3 w-3 text-slate-500" />;
  };

  const handleTileClick = (category: Category) => {
    setExpandedCategory(category);
    onViewDetails?.(category);
  };

  const getScoreForCategory = (category: Category) => {
    return fourBScores[category];
  };

  const getPrevScoreForCategory = (category: Category) => {
    const key = `prev${category.charAt(0).toUpperCase() + category.slice(1)}` as keyof FourBScores;
    return fourBScores[key] as number | null;
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(categoryConfig) as Category[]).map((category) => {
          const config = categoryConfig[category];
          const Icon = config.icon;
          const score = getScoreForCategory(category);
          const prevScore = getPrevScoreForCategory(category);
          const trend = getTrend(score, prevScore);
          const borderColor = getScoreBorderColor(score);

          return (
            <Card
              key={category}
              className={cn(
                "bg-slate-800/50 border-slate-700 border-l-4 cursor-pointer transition-all duration-200",
                "hover:bg-slate-800 hover:shadow-lg hover:shadow-black/20",
                "active:scale-[0.98]",
                borderColor
              )}
              onClick={() => handleTileClick(category)}
            >
              <CardContent className="p-4">
                {/* Header row: Icon + Label + Trend */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      {config.label}
                    </span>
                  </div>
                  <TrendIcon trend={trend} />
                </div>
                
                {/* Large score */}
                <div className="mb-2">
                  <span className="text-4xl font-black text-white">
                    {score ?? '—'}
                  </span>
                </div>
                
                {/* Description */}
                <p className="text-xs text-slate-500">
                  {config.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Panel Modal */}
      <Dialog open={!!expandedCategory} onOpenChange={(open) => !open && setExpandedCategory(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          {expandedCategory && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-white">
                  {(() => {
                    const config = categoryConfig[expandedCategory];
                    const Icon = config.icon;
                    return (
                      <>
                        <div className="p-2 rounded-lg bg-slate-800">
                          <Icon className="h-5 w-5 text-slate-300" />
                        </div>
                        {config.label} Score Details
                      </>
                    );
                  })()}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Main Score */}
                <div className="text-center py-4 bg-slate-800/50 rounded-lg">
                  <span className="text-6xl font-black text-white">
                    {getScoreForCategory(expandedCategory) ?? '—'}
                  </span>
                  <p className="text-sm text-slate-400 mt-2">
                    {categoryConfig[expandedCategory].description}
                  </p>
                </div>

                {/* Metrics List */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Contributing Metrics
                  </p>
                  <div className="space-y-1">
                    {categoryConfig[expandedCategory].metrics.map((metric, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-md"
                      >
                        <span className="text-sm text-slate-300">{metric}</span>
                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                          —
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trend Info */}
                <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                  <span className="text-sm text-slate-400">vs Previous Period</span>
                  <div className="flex items-center gap-2">
                    <TrendIcon trend={getTrend(
                      getScoreForCategory(expandedCategory),
                      getPrevScoreForCategory(expandedCategory)
                    )} />
                    <span className="text-sm text-slate-300">
                      {(() => {
                        const current = getScoreForCategory(expandedCategory);
                        const prev = getPrevScoreForCategory(expandedCategory);
                        if (current === null || prev === null) return 'No data';
                        const diff = current - prev;
                        if (diff === 0) return 'No change';
                        return diff > 0 ? `+${diff}` : `${diff}`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
