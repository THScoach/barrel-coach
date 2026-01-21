/**
 * Virtual Statcast Card - Shows projected exit velo and launch angle
 * Based on session's pitch speed and swing mechanics
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface VirtualStatcastCardProps {
  batSpeed: number | null;
  pitchSpeed: number | null;
  verticalBatAngle: number | null;
  approachAngle?: number | null;
}

// Ghost formula: EV = BatSpeed × 1.2 + PitchSpeed × 0.2
function calculateProjectedEV(batSpeed: number, pitchSpeed: number): number {
  return Math.round(batSpeed * 1.2 + pitchSpeed * 0.2);
}

// Estimate launch angle from VBA (simplified model)
function calculateProjectedLA(vba: number): number {
  // VBA typically ranges from -30 to +30
  // Launch angle correlates with VBA + swing path
  // Positive VBA = uppercut = higher LA
  // Negative VBA = chop = ground ball
  const baseLa = vba + 12; // Baseline adjustment
  return Math.round(Math.max(-10, Math.min(45, baseLa)));
}

function getEVGrade(ev: number): { label: string; color: string } {
  if (ev >= 100) return { label: 'ELITE', color: 'text-emerald-400' };
  if (ev >= 95) return { label: 'PLUS-PLUS', color: 'text-teal-400' };
  if (ev >= 90) return { label: 'PLUS', color: 'text-blue-400' };
  if (ev >= 85) return { label: 'SOLID', color: 'text-slate-300' };
  if (ev >= 80) return { label: 'AVERAGE', color: 'text-yellow-400' };
  return { label: 'DEVELOPING', color: 'text-orange-400' };
}

function getLAZone(la: number): { label: string; emoji: string } {
  if (la < 0) return { label: 'Groundball Zone', emoji: '⬇️' };
  if (la < 10) return { label: 'Line Drive Zone', emoji: '➡️' };
  if (la <= 25) return { label: 'Sweet Spot', emoji: '🎯' };
  if (la <= 35) return { label: 'Flyball Zone', emoji: '⬆️' };
  return { label: 'Pop-up Zone', emoji: '🔝' };
}

export function VirtualStatcastCard({
  batSpeed,
  pitchSpeed,
  verticalBatAngle,
  approachAngle,
}: VirtualStatcastCardProps) {
  const hasData = batSpeed !== null && pitchSpeed !== null;
  const hasVBA = verticalBatAngle !== null;

  const projectedEV = hasData ? calculateProjectedEV(batSpeed!, pitchSpeed!) : null;
  const projectedLA = hasVBA ? calculateProjectedLA(verticalBatAngle!) : null;
  const evGrade = projectedEV ? getEVGrade(projectedEV) : null;
  const laZone = projectedLA !== null ? getLAZone(projectedLA) : null;

  return (
    <TooltipProvider>
      <Card className="border-primary/30 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Virtual Statcast
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] border-primary/50 text-primary cursor-help">
                  <Info className="h-3 w-3 mr-1" />
                  GHOST STATS
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  These are <strong>projected</strong> stats based on your swing mechanics. 
                  Formula: EV = Bat Speed × 1.2 + Pitch Speed × 0.2
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasData ? (
            <>
              {/* Projected Exit Velo */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Projected Exit Velo</span>
                  {evGrade && (
                    <Badge className={cn("text-[10px]", evGrade.color, "bg-transparent border-current")}>
                      {evGrade.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{projectedEV}</span>
                  <span className="text-lg text-slate-400">mph</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>Bat: {batSpeed} mph</span>
                  <span>•</span>
                  <span>Pitch: {pitchSpeed} mph</span>
                </div>
              </div>

              {/* Projected Launch Angle */}
              {hasVBA && projectedLA !== null && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Projected Launch Angle</span>
                    {laZone && (
                      <Badge variant="outline" className="text-[10px] border-slate-600">
                        {laZone.emoji} {laZone.label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">
                      {projectedLA > 0 ? '+' : ''}{projectedLA}
                    </span>
                    <span className="text-lg text-slate-400">°</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>VBA: {verticalBatAngle}°</span>
                    {approachAngle !== null && (
                      <>
                        <span>•</span>
                        <span>Approach: {approachAngle}°</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* LA Trajectory Visual */}
              {projectedLA !== null && (
                <div className="relative h-16 bg-slate-800/30 rounded-lg overflow-hidden border border-slate-700/50">
                  <div className="absolute inset-0 flex items-end justify-center">
                    {/* Ground line */}
                    <div className="absolute bottom-4 left-4 right-4 h-px bg-slate-600" />
                    
                    {/* Trajectory line */}
                    <div 
                      className="absolute bottom-4 left-1/4 w-1/2 h-px bg-primary origin-left transition-transform duration-300"
                      style={{ 
                        transform: `rotate(${-projectedLA}deg)`,
                      }}
                    />
                    
                    {/* Ball */}
                    <div 
                      className="absolute left-1/4 w-3 h-3 rounded-full bg-white shadow-lg shadow-primary/50"
                      style={{
                        bottom: `calc(1rem + ${Math.max(0, projectedLA) * 0.4}px)`,
                        left: '25%',
                      }}
                    />
                  </div>
                  <div className="absolute bottom-1 right-2 text-[10px] text-slate-500">
                    trajectory preview
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-10 w-10 mx-auto text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">No swing data yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Upload a session to see your projected stats
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
