/**
 * Hot Zone Map - Shows where the player is hunting pitches
 * Based on Vertical Bat Angle (VBA) patterns
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HotZoneMapProps {
  avgVBA: number | null;
  swings: {
    vba: number;
    result?: 'hit' | 'out' | 'miss';
  }[];
}

// Classify zone based on VBA
function getZoneFromVBA(vba: number): 'high' | 'middle' | 'low' {
  if (vba > 5) return 'high';
  if (vba < -5) return 'low';
  return 'middle';
}

// Count zone distribution
function calculateZoneDistribution(swings: { vba: number }[]): {
  high: number;
  middle: number;
  low: number;
} {
  const counts = { high: 0, middle: 0, low: 0 };
  swings.forEach(s => {
    counts[getZoneFromVBA(s.vba)]++;
  });
  const total = swings.length || 1;
  return {
    high: Math.round((counts.high / total) * 100),
    middle: Math.round((counts.middle / total) * 100),
    low: Math.round((counts.low / total) * 100),
  };
}

// Get hunting description
function getHuntingDescription(avgVBA: number): string {
  if (avgVBA > 10) return "Hunting HIGH pitches 🔥";
  if (avgVBA > 5) return "Slight uppercut - middle-up";
  if (avgVBA < -10) return "Chopping down - hunting LOW";
  if (avgVBA < -5) return "Flat path - middle-down";
  return "Level swing - middle zone";
}

export function HotZoneMap({ avgVBA, swings }: HotZoneMapProps) {
  const hasData = avgVBA !== null && swings.length > 0;
  const distribution = hasData ? calculateZoneDistribution(swings) : null;
  const huntingZone = avgVBA !== null ? getZoneFromVBA(avgVBA) : null;

  // Get heat intensity for each zone (0-100)
  const getHeatIntensity = (zone: 'high' | 'middle' | 'low') => {
    if (!distribution) return 0;
    return distribution[zone];
  };

  // Get color based on intensity
  const getZoneColor = (zone: 'high' | 'middle' | 'low') => {
    const intensity = getHeatIntensity(zone);
    const isHunting = huntingZone === zone;
    
    if (intensity >= 50) return 'bg-primary/80 border-primary';
    if (intensity >= 30) return 'bg-orange-500/60 border-orange-500';
    if (intensity >= 15) return 'bg-yellow-500/40 border-yellow-500/50';
    return isHunting ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-800/30 border-slate-700/30';
  };

  return (
    <TooltipProvider>
      <Card className="border-primary/30 bg-gradient-to-br from-slate-900 to-slate-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <Target className="h-4 w-4" />
              Hot Zone Map
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] border-primary/50 text-primary cursor-help">
                  <Info className="h-3 w-3 mr-1" />
                  VBA-BASED
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Your <strong>Hot Zone</strong> shows where you're hunting pitches based on 
                  your Vertical Bat Angle (VBA). Red = attacking that zone most often.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="space-y-4">
              {/* Zone Visual */}
              <div className="relative">
                {/* Strike Zone Grid - 3 horizontal zones */}
                <div className="grid grid-rows-3 gap-1.5 h-48 w-full max-w-xs mx-auto">
                  {/* High Zone */}
                  <div 
                    className={cn(
                      "rounded-t-lg border-2 flex items-center justify-center transition-all duration-300",
                      getZoneColor('high'),
                      huntingZone === 'high' && "ring-2 ring-primary ring-offset-2 ring-offset-slate-900"
                    )}
                  >
                    <div className="text-center">
                      <span className="text-2xl font-black text-white">
                        {distribution?.high ?? 0}%
                      </span>
                      <p className="text-xs text-slate-300 font-medium">HIGH</p>
                    </div>
                  </div>

                  {/* Middle Zone */}
                  <div 
                    className={cn(
                      "border-2 flex items-center justify-center transition-all duration-300",
                      getZoneColor('middle'),
                      huntingZone === 'middle' && "ring-2 ring-primary ring-offset-2 ring-offset-slate-900"
                    )}
                  >
                    <div className="text-center">
                      <span className="text-2xl font-black text-white">
                        {distribution?.middle ?? 0}%
                      </span>
                      <p className="text-xs text-slate-300 font-medium">MIDDLE</p>
                    </div>
                  </div>

                  {/* Low Zone */}
                  <div 
                    className={cn(
                      "rounded-b-lg border-2 flex items-center justify-center transition-all duration-300",
                      getZoneColor('low'),
                      huntingZone === 'low' && "ring-2 ring-primary ring-offset-2 ring-offset-slate-900"
                    )}
                  >
                    <div className="text-center">
                      <span className="text-2xl font-black text-white">
                        {distribution?.low ?? 0}%
                      </span>
                      <p className="text-xs text-slate-300 font-medium">LOW</p>
                    </div>
                  </div>
                </div>

                {/* VBA indicator arrow */}
                <div 
                  className="absolute -right-2 w-6 h-6 flex items-center justify-center bg-primary text-white text-xs font-bold rounded-full shadow-lg shadow-primary/50 transition-all duration-500"
                  style={{
                    top: avgVBA !== null 
                      ? `${Math.max(5, Math.min(90, 50 - avgVBA * 2))}%` 
                      : '50%',
                  }}
                >
                  ◀
                </div>
              </div>

              {/* Hunting Description */}
              {avgVBA !== null && (
                <div className="text-center">
                  <Badge className="bg-slate-800 text-white border-slate-700 text-sm">
                    {getHuntingDescription(avgVBA)}
                  </Badge>
                  <p className="text-xs text-slate-500 mt-2">
                    Avg VBA: <span className="text-white font-semibold">{avgVBA.toFixed(1)}°</span>
                  </p>
                </div>
              )}

              {/* Swing Count */}
              <div className="flex justify-center">
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                  Based on {swings.length} swings
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Target className="h-12 w-12 mx-auto text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">No zone data yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Upload swing data to see your hot zones
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
