/**
 * ESPN-Style Launch Monitor Box Score Component
 * 
 * Displays ball metrics in an immediately interpretable, actionable format.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap,
  BarChart3,
  Info
} from "lucide-react";
import {
  EnhancedLaunchMonitorStats,
  PeerComparison,
  calculatePeerComparison,
  getGradeLabel,
  getGradeColor,
  getDeltaColor,
  formatDelta,
  ScoreDriver
} from "@/lib/launch-monitor-metrics";

interface LaunchMonitorBoxScoreProps {
  stats: EnhancedLaunchMonitorStats;
  showPeerComparison?: boolean;
  compact?: boolean;
}

export function LaunchMonitorBoxScore({ 
  stats, 
  showPeerComparison = true,
  compact = false 
}: LaunchMonitorBoxScoreProps) {
  const peerComparison = showPeerComparison ? calculatePeerComparison(stats) : null;
  const gradeLabel = getGradeLabel(stats.ballScore);
  const gradeColor = getGradeColor(stats.ballScore);

  return (
    <div className="space-y-4">
      {/* Main Score Card */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 overflow-hidden">
        <CardContent className="p-0">
          {/* Header Row */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-400" />
              <span className="font-semibold text-white">Ball Score</span>
            </div>
            <Badge variant="outline" className="text-xs bg-slate-700/50 text-slate-300 border-slate-600">
              {stats.thresholds.label}
            </Badge>
          </div>

          {/* Main Score */}
          <div className="flex items-center justify-center py-6 px-4 bg-gradient-to-b from-transparent to-slate-800/30">
            <div className="text-center">
              <div className={`text-6xl font-bold ${gradeColor}`}>
                {stats.ballScore}
              </div>
              <div className="text-sm text-slate-400 mt-1">{gradeLabel}</div>
            </div>
          </div>

          {/* Key Stats Row */}
          <div className="grid grid-cols-4 divide-x divide-slate-700/50 border-t border-slate-700/50 bg-slate-800/30">
            <StatCell 
              label="Swings" 
              value={stats.totalSwings.toString()} 
            />
            <StatCell 
              label="Avg EV" 
              value={`${stats.avgExitVelo}`} 
              unit="mph"
            />
            <StatCell 
              label="Max EV" 
              value={`${stats.maxExitVelo}`}
              unit="mph"
            />
            <StatCell 
              label="Contact" 
              value={`${stats.contactRate}`}
              unit="%"
            />
          </div>
        </CardContent>
      </Card>

      {!compact && (
        <>
          {/* ESPN-Style Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Barrel Rate Card */}
            <MetricCard
              title="Barrel Rate"
              value={`${stats.barrelRate}%`}
              subtitle={`${stats.barrelCount} / ${stats.ballsInPlay} BIP`}
              icon={<Zap className="h-4 w-4 text-orange-400" />}
              tooltip={`Barrel: EV ≥${stats.thresholds.barrelEvMin} mph, LA ${stats.thresholds.barrelLaMin}°-${stats.thresholds.barrelLaMax}°`}
              isHighlighted={stats.barrelRate >= 10}
            />

            {/* Hard-Hit Rate Card */}
            <MetricCard
              title="Hard-Hit Rate"
              value={`${stats.hardHitRate}%`}
              subtitle={`${stats.hardHitCount} / ${stats.ballsInPlay} BIP`}
              icon={<TrendingUp className="h-4 w-4 text-green-400" />}
              tooltip={`Hard Hit: EV ≥${stats.thresholds.hardHitEvMin} mph`}
              isHighlighted={stats.hardHitRate >= 40}
            />

            {/* Sweet Spot Card */}
            <MetricCard
              title="Sweet Spot"
              value={`${stats.sweetSpotPct}%`}
              subtitle={`LA 8°-32°`}
              icon={<Target className="h-4 w-4 text-blue-400" />}
              tooltip="Sweet Spot: Launch Angle between 8° and 32°"
              isHighlighted={stats.sweetSpotPct >= 45}
            />

            {/* Avg LA Card */}
            <MetricCard
              title="Avg Launch Angle"
              value={`${stats.avgLaunchAngle}°`}
              subtitle={stats.avgLaunchAngle >= 10 && stats.avgLaunchAngle <= 20 ? "Optimal" : "Adjust needed"}
              icon={<BarChart3 className="h-4 w-4 text-purple-400" />}
              tooltip="Optimal LA: 10°-20° for line drives"
              isHighlighted={stats.avgLaunchAngle >= 10 && stats.avgLaunchAngle <= 20}
            />
          </div>

          {/* LA Distribution */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-300">
                <BarChart3 className="h-4 w-4" />
                Launch Angle Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <LaDistributionBar 
                label="Ground Ball" 
                value={stats.laDistribution.groundBallPct} 
                count={stats.laDistribution.groundBall}
                color="bg-amber-500"
                isNegative
              />
              <LaDistributionBar 
                label="Line Drive" 
                value={stats.laDistribution.lineDrivePct} 
                count={stats.laDistribution.lineDrive}
                color="bg-green-500"
              />
              <LaDistributionBar 
                label="Fly Ball" 
                value={stats.laDistribution.flyBallPct} 
                count={stats.laDistribution.flyBall}
                color="bg-blue-500"
              />
              <LaDistributionBar 
                label="Pop Up" 
                value={stats.laDistribution.popUpPct} 
                count={stats.laDistribution.popUp}
                color="bg-red-500"
                isNegative
              />
            </CardContent>
          </Card>

          {/* Score Drivers */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-300">
                <Info className="h-4 w-4" />
                Score Drivers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.scoreComponents.drivers.slice(0, 4).map((driver, i) => (
                <ScoreDriverRow key={i} driver={driver} />
              ))}
            </CardContent>
          </Card>

          {/* Peer Comparison */}
          {peerComparison && peerComparison.hasData && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">
                  vs. {stats.thresholds.label} Peers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <ComparisonStat 
                    label="Avg EV" 
                    delta={peerComparison.avgEvDelta}
                    unit=" mph"
                  />
                  <ComparisonStat 
                    label="Barrel %" 
                    delta={peerComparison.barrelRateDelta}
                    unit="%"
                  />
                  <ComparisonStat 
                    label="Hard Hit" 
                    delta={peerComparison.hardHitDelta}
                    unit="%"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ================================
// Sub-components
// ================================

function StatCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="py-3 px-2 text-center">
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold text-white">
        {value}
        {unit && <span className="text-xs text-slate-400 ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  tooltip, 
  isHighlighted 
}: { 
  title: string; 
  value: string; 
  subtitle: string; 
  icon: React.ReactNode; 
  tooltip: string;
  isHighlighted?: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={`bg-slate-900/50 border-slate-800 cursor-help transition-all ${
            isHighlighted ? 'ring-1 ring-green-500/30' : ''
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 uppercase tracking-wider">{title}</span>
                {icon}
              </div>
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LaDistributionBar({ 
  label, 
  value, 
  count,
  color,
  isNegative
}: { 
  label: string; 
  value: number; 
  count: number;
  color: string;
  isNegative?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs text-slate-400">{label}</div>
      <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${color} ${isNegative ? 'opacity-70' : ''}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <div className={`w-16 text-right text-sm font-medium ${isNegative ? 'text-slate-400' : 'text-white'}`}>
        {value}% <span className="text-xs text-slate-500">({count})</span>
      </div>
    </div>
  );
}

function ScoreDriverRow({ driver }: { driver: ScoreDriver }) {
  const Icon = driver.isPositive ? TrendingUp : driver.impact < 0 ? TrendingDown : Minus;
  const color = driver.isPositive ? 'text-green-500' : driver.impact < 0 ? 'text-red-500' : 'text-slate-400';

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <Icon className={`h-3 w-3 ${color}`} />
        <span className="text-sm text-slate-300">{driver.label}</span>
        <span className="text-xs text-slate-500">{driver.context}</span>
      </div>
      <span className={`text-sm font-medium ${color}`}>
        {driver.impact > 0 ? '+' : ''}{driver.impact}
      </span>
    </div>
  );
}

function ComparisonStat({ label, delta, unit }: { label: string; delta: number; unit: string }) {
  const color = getDeltaColor(delta);
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        <Icon className="h-3 w-3" />
        <span className="font-semibold">{formatDelta(delta, unit)}</span>
      </div>
    </div>
  );
}
