/**
 * ESPN-Style 4B Player Scorecard
 * ===============================
 * Combines 4B engine scores, video sequence analysis, launch monitor stats,
 * and game data into a single, sports-network-style dashboard.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Activity,
  Zap,
  Brain,
  Target,
  Video,
  BarChart3,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Upload,
  Sparkles,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  PlayerScorecardData, 
  TimeWindow,
  FourBScores 
} from "@/lib/players/getPlayerScorecard";

interface Player4BScorecardProps {
  data: PlayerScorecardData;
  timeWindow: TimeWindow;
  onTimeWindowChange: (window: TimeWindow) => void;
  onUploadVideo?: () => void;
  onUploadData?: () => void;
  onViewVideoSession?: (sessionId: string) => void;
  onWeeklyCheckin?: () => void;
  isAdmin?: boolean;
}

export function Player4BScorecard({
  data,
  timeWindow,
  onTimeWindowChange,
  onUploadVideo,
  onUploadData,
  onViewVideoSession,
  onWeeklyCheckin,
  isAdmin = false,
}: Player4BScorecardProps) {
  const { fourBScores, videoSequence, launchMonitor, gameStats, weeklyCheckin } = data;

  // Trend helpers
  const getTrend = (current: number | null, prev: number | null) => {
    if (current === null || prev === null) return 'flat';
    if (current > prev) return 'up';
    if (current < prev) return 'down';
    return 'flat';
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground/50" />;
  };

  // 4B Category descriptions
  const categoryDescriptions: Record<string, string> = {
    brain: 'Decision quality',
    body: 'Movement & sequencing',
    bat: 'Impact quality',
    ball: 'Outcome quality',
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    brain: <Brain className="h-4 w-4" />,
    body: <Activity className="h-4 w-4" />,
    bat: <Zap className="h-4 w-4" />,
    ball: <Target className="h-4 w-4" />,
  };

  const categoryColors: Record<string, string> = {
    brain: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
    body: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    bat: 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
    ball: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
  };

  // Format stat value
  const formatStat = (value: number | null, suffix: string = '') => {
    if (value === null) return '—';
    return `${value}${suffix}`;
  };

  return (
    <div className="space-y-4">
      {/* ===== TOP STRIP: Hero Header ===== */}
      <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700 overflow-hidden">
        <CardContent className="p-0">
          {/* Player Info Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">{data.playerName}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {data.team && <span>{data.team}</span>}
                  {data.handedness && (
                    <>
                      {data.team && <span>•</span>}
                      <span>{data.handedness === 'right' ? 'RHH' : data.handedness === 'left' ? 'LHH' : 'Switch'}</span>
                    </>
                  )}
                  {data.level && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-600">
                        {data.level.toUpperCase()}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              {data.isInSeason && (
                <Badge className="bg-emerald-600 text-white text-xs ml-2">
                  <Activity className="w-3 h-3 mr-1" />
                  IN SEASON
                </Badge>
              )}
            </div>
            
            {/* Period Selector */}
            <Tabs value={timeWindow} onValueChange={(v) => onTimeWindowChange(v as TimeWindow)}>
              <TabsList className="h-8 bg-slate-800">
                <TabsTrigger value="30" className="text-xs h-6 px-3">30 Days</TabsTrigger>
                <TabsTrigger value="60" className="text-xs h-6 px-3">60 Days</TabsTrigger>
                <TabsTrigger value="90" className="text-xs h-6 px-3">90 Days</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Composite Score Hero */}
          <div className="flex items-center gap-6 px-6 py-4">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">
                4B COMPOSITE
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-5xl font-black text-white">
                  {fourBScores.composite ?? '—'}
                </span>
                <TrendIcon trend={getTrend(fourBScores.composite, fourBScores.prevComposite)} />
              </div>
              {fourBScores.grade && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {fourBScores.grade}
                </Badge>
              )}
            </div>

            {fourBScores.weakestLink && (
              <div className="border-l border-slate-700 pl-6">
                <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                  <Zap className="w-3 h-3 mr-1" />
                  Focus: {fourBScores.weakestLink.toUpperCase()}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== ROW 1: 4B Tiles ===== */}
      <div className="grid grid-cols-4 gap-3">
        {(['brain', 'body', 'bat', 'ball'] as const).map((category) => {
          const score = fourBScores[category];
          const prevScore = fourBScores[`prev${category.charAt(0).toUpperCase() + category.slice(1)}` as keyof FourBScores] as number | null;
          
          return (
            <Card 
              key={category}
              className={cn(
                "bg-gradient-to-br border",
                categoryColors[category]
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2 text-slate-400">
                  {categoryIcons[category]}
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {category}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-3xl font-black text-foreground">
                        {score ?? '—'}
                      </span>
                      <TrendIcon trend={getTrend(score, prevScore)} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {categoryDescriptions[category]}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Weekly Check-In Banner (Brain-linked) */}
      {onWeeklyCheckin && (
        <Card className={cn(
          "border",
          weeklyCheckin.completed 
            ? "bg-emerald-500/10 border-emerald-500/30" 
            : "bg-purple-500/10 border-purple-500/30"
        )}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className={cn(
                  "h-5 w-5",
                  weeklyCheckin.completed ? "text-emerald-500" : "text-purple-500"
                )} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Weekly Check-In
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {weeklyCheckin.completed 
                      ? "This week's check-in completed" 
                      : "Complete your weekly mindset check-in"}
                  </p>
                </div>
              </div>
              {!weeklyCheckin.completed && (
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={onWeeklyCheckin}
                  className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300"
                >
                  Open Check-In
                </Button>
              )}
              {weeklyCheckin.completed && (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== ROW 2: Practice vs Game Panel ===== */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Practice / Launch Monitor Stats */}
        <Card className="border-slate-700 bg-slate-900/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                PRACTICE DATA
              </h3>
              {onUploadData && (
                <Button variant="ghost" size="sm" onClick={onUploadData} className="text-xs">
                  <Upload className="h-3 w-3 mr-1" />
                  Upload
                </Button>
              )}
            </div>

            {launchMonitor.sessionCount > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <StatChip label="Avg EV" value={formatStat(launchMonitor.avgEV, ' mph')} />
                  <StatChip label="Max EV" value={formatStat(launchMonitor.maxEV, ' mph')} />
                  <StatChip label="Barrel%" value={formatStat(launchMonitor.barrelPct, '%')} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatChip label="Hard Hit%" value={formatStat(launchMonitor.hardHitPct, '%')} />
                  <StatChip label="Avg LA" value={formatStat(launchMonitor.avgLaunchAngle, '°')} />
                  <StatChip label="Sessions" value={String(launchMonitor.sessionCount)} />
                </div>
                
                {/* LA Distribution Bar */}
                <div className="mt-3">
                  <p className="text-[10px] text-slate-500 mb-1.5">Launch Angle Distribution</p>
                  <div className="flex h-2 rounded overflow-hidden bg-slate-800">
                    {launchMonitor.groundBallPct && (
                      <div 
                        className="bg-amber-500" 
                        style={{ width: `${launchMonitor.groundBallPct}%` }}
                        title={`GB: ${launchMonitor.groundBallPct}%`}
                      />
                    )}
                    {launchMonitor.lineDrivePct && (
                      <div 
                        className="bg-emerald-500" 
                        style={{ width: `${launchMonitor.lineDrivePct}%` }}
                        title={`LD: ${launchMonitor.lineDrivePct}%`}
                      />
                    )}
                    {launchMonitor.flyBallPct && (
                      <div 
                        className="bg-blue-500" 
                        style={{ width: `${launchMonitor.flyBallPct}%` }}
                        title={`FB: ${launchMonitor.flyBallPct}%`}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                    <span>GB</span>
                    <span>LD</span>
                    <span>FB</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <BarChart3 className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No practice data yet</p>
                {onUploadData && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="mt-3"
                    onClick={onUploadData}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Upload HitTrax/Rapsodo
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Game / Statcast Stats */}
        <Card className="border-slate-700 bg-slate-900/50">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-4">
              GAME PRODUCTION
            </h3>

            {gameStats.hasData ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <StatChip label="AVG" value={gameStats.avg?.toFixed(3) ?? '—'} />
                  <StatChip label="OBP" value={gameStats.obp?.toFixed(3) ?? '—'} />
                  <StatChip label="SLG" value={gameStats.slg?.toFixed(3) ?? '—'} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatChip label="HR" value={String(gameStats.hr ?? '—')} />
                  <StatChip label="K%" value={formatStat(gameStats.kPct, '%')} />
                  <StatChip label="BB%" value={formatStat(gameStats.bbPct, '%')} />
                </div>
                {gameStats.source && (
                  <p className="text-[10px] text-slate-500 mt-2">
                    Source: {gameStats.source}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertCircle className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">Not enough game data yet</p>
                <p className="text-xs text-slate-600 mt-1">
                  Game stats appear when available from external sources
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== ROW 3: Body→Bat Video Sequence Panel ===== */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              BODY→BAT SEQUENCE
            </h3>
            {onUploadVideo && (
              <Button variant="ghost" size="sm" onClick={onUploadVideo} className="text-xs">
                <Video className="h-3 w-3 mr-1" />
                Upload Videos
              </Button>
            )}
          </div>

          {videoSequence.latestSequenceScore !== null ? (
            <div className="space-y-4">
              {/* Latest Score Hero */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <span className="text-4xl font-black text-white">
                      {videoSequence.latestSequenceScore}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">Sequence Score</p>
                  </div>
                  <Badge 
                    className={cn(
                      "text-xs",
                      videoSequence.sequenceMatch 
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                        : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    )}
                    variant="outline"
                  >
                    {videoSequence.sequenceMatch ? 'In Sequence' : 'Out of Sequence'}
                  </Badge>
                </div>

                <div className="border-l border-slate-700 pl-6 flex gap-4">
                  <div className="text-center">
                    <span className="text-xl font-bold text-foreground">
                      {videoSequence.latestBarrelQuality ?? '—'}
                    </span>
                    <p className="text-[10px] text-slate-400">Barrel Quality</p>
                  </div>
                  <div className="text-center">
                    <span className="text-xl font-bold text-foreground">
                      {videoSequence.latestContactOptimization ?? '—'}
                    </span>
                    <p className="text-[10px] text-slate-400">Contact Opt.</p>
                  </div>
                </div>
              </div>

              {/* Recent Sessions Table */}
              {videoSequence.recentSessions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 mb-2">Recent Video Sessions</p>
                  <div className="space-y-1">
                    {videoSequence.recentSessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg transition-colors",
                          onViewVideoSession 
                            ? "hover:bg-slate-800/50 cursor-pointer" 
                            : "bg-slate-800/30"
                        )}
                        onClick={() => onViewVideoSession?.(session.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Video className="h-4 w-4 text-slate-500" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {format(new Date(session.sessionDate), 'MMM d, yyyy')}
                            </p>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-700">
                              {session.context}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">
                              {session.sequenceScore ?? '—'}
                            </p>
                            <p className="text-[10px] text-slate-500">Seq</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-400">
                              {session.barrelQualityScore ?? '—'}
                            </p>
                            <p className="text-[10px] text-slate-500">BQ</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-400">
                              {session.contactOptimizationScore ?? '—'}
                            </p>
                            <p className="text-[10px] text-slate-500">CO</p>
                          </div>
                          {onViewVideoSession && (
                            <ChevronRight className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Video className="h-10 w-10 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 mb-1">No video analysis yet</p>
              <p className="text-xs text-slate-500 mb-4">
                Upload swing videos to get Body→Bat sequence scoring
              </p>
              {onUploadVideo && (
                <Button onClick={onUploadVideo}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Upload Swing Videos
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Stat chip component
function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg px-3 py-2 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}
