/**
 * Diagnostic Lab Header - High-End Scouting Report Header
 * ========================================================
 * Dark mode #0A0A0B background with #DC2626 red accents
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  LineChart, 
  TrendingUp, 
  TrendingDown,
  Loader2,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DiagnosticLabHeaderProps {
  compositeScore: number | null;
  prevCompositeScore: number | null;
  grade: string | null;
  weakestLink: string | null;
  playerLevel?: string;
  playerBats?: string;
  playerThrows?: string;
  isLoading?: boolean;
  onViewReport?: () => void;
  onOpenProgression?: () => void;
}

export function DiagnosticLabHeader({
  compositeScore,
  prevCompositeScore,
  grade,
  weakestLink,
  playerLevel,
  playerBats,
  playerThrows,
  isLoading = false,
  onViewReport,
  onOpenProgression,
}: DiagnosticLabHeaderProps) {
  const getTrend = () => {
    if (compositeScore === null || prevCompositeScore === null) return 'flat';
    if (compositeScore > prevCompositeScore) return 'up';
    if (compositeScore < prevCompositeScore) return 'down';
    return 'flat';
  };

  const trend = getTrend();
  const delta = compositeScore !== null && prevCompositeScore !== null 
    ? compositeScore - prevCompositeScore 
    : null;

  return (
    <Card className="bg-[#0A0A0B] border-[#1a1a1c] overflow-hidden relative">
      {/* Glowing red accent line */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent, #DC2626, transparent)',
          boxShadow: '0 0 20px 2px rgba(220, 38, 38, 0.4)',
        }}
      />
      
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Left: Catch Barrel Score with Lab styling */}
          <div className="flex items-center gap-8">
            {/* Main Score Display */}
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center mb-2">
                <Activity className="h-4 w-4 text-[#DC2626]" />
                <p className="text-xs font-bold uppercase tracking-widest text-[#DC2626]">
                  KINETIC SCORE
                </p>
              </div>
              
              {isLoading ? (
                <Loader2 className="h-12 w-12 animate-spin text-slate-600 mx-auto" />
              ) : (
                <div className="relative">
                  {/* Score with glow effect */}
                  <span 
                    className="text-6xl font-black text-white"
                    style={{
                      textShadow: compositeScore !== null 
                        ? '0 0 30px rgba(220, 38, 38, 0.3)' 
                        : 'none',
                    }}
                  >
                    {compositeScore ?? '—'}
                  </span>
                  
                  {/* Trend indicator */}
                  {delta !== null && delta !== 0 && (
                    <div className="absolute -right-8 top-2 flex items-center gap-1">
                      {trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                      {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                      <span className={cn(
                        "text-sm font-bold",
                        trend === 'up' ? 'text-emerald-500' : 'text-red-500'
                      )}>
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {grade && (
                <Badge 
                  className="mt-2 bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/30"
                >
                  {grade}
                </Badge>
              )}
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-20 bg-gradient-to-b from-transparent via-[#DC2626]/30 to-transparent" />

            {/* Player Quick Info */}
            <div className="hidden md:flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {playerLevel && (
                  <Badge 
                    variant="outline" 
                    className="text-xs border-slate-700 text-slate-400 bg-slate-900/50"
                  >
                    {playerLevel}
                  </Badge>
                )}
                {playerBats && (
                  <span className="text-xs text-slate-500">
                    Bats: <span className="text-slate-400">{playerBats}</span>
                  </span>
                )}
                {playerThrows && (
                  <span className="text-xs text-slate-500">
                    Throws: <span className="text-slate-400">{playerThrows}</span>
                  </span>
                )}
              </div>
              
              {weakestLink && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">Primary Weakness:</span>
                  <Badge 
                    className="text-xs bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/40"
                  >
                    {weakestLink.toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Right: Primary Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold shadow-lg shadow-[#DC2626]/20"
              onClick={onViewReport}
              style={{
                boxShadow: '0 4px 20px rgba(220, 38, 38, 0.3)',
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              View KRS Report
            </Button>
            
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600"
              onClick={onOpenProgression}
            >
              <LineChart className="h-4 w-4 mr-2" />
              Progression
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
