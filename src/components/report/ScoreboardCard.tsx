import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FourBScoreData } from '@/lib/report-types';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, Link2, Upload } from 'lucide-react';

interface ScoreboardCardProps {
  scores: FourBScoreData;
  // Optional detailed metrics for expansion
  bodyMetrics?: {
    loadSequence?: { raw: string; score: number };
    separation?: { raw: string; score: number };
    leadLegBraking?: { raw: string; score: number };
  };
  brainMetrics?: {
    tempo?: { raw: string; score: number };
    syncScore?: { raw: string; score: number };
  };
  batMetrics?: {
    connected: boolean;
    batSpeed?: { raw: string; score: number };
    attackAngle?: { raw: string; score: number };
    handSpeed?: { raw: string; score: number };
  };
  ballMetrics?: {
    hasData: boolean;
    exitVelo?: { raw: string; score: number };
    launchAngle?: { raw: string; score: number };
    distance?: { raw: string; score: number };
  };
}

const scoreCategories = [
  { key: 'body', label: 'BODY', color: 'bg-blue-500', textColor: 'text-blue-400' },
  { key: 'brain', label: 'BRAIN', color: 'bg-purple-500', textColor: 'text-purple-400' },
  { key: 'bat', label: 'BAT', color: 'bg-orange-500', textColor: 'text-orange-400' },
  { key: 'ball', label: 'BALL', color: 'bg-green-500', textColor: 'text-green-400' },
] as const;

function DeltaBadge({ delta }: { delta?: number }) {
  if (delta === undefined) return null;
  
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium ml-2',
        isPositive && 'text-green-400',
        delta < 0 && 'text-red-400',
        isNeutral && 'text-slate-500'
      )}
    >
      {isPositive && <TrendingUp className="h-3 w-3" />}
      {delta < 0 && <TrendingDown className="h-3 w-3" />}
      {isNeutral && <Minus className="h-3 w-3" />}
      {isPositive ? '+' : ''}{delta}
    </span>
  );
}

function MetricRow({ label, raw, score }: { label: string; raw: string; score: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 bg-slate-800/50 rounded">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">{raw}</span>
        <span className={cn(
          "text-xs font-semibold tabular-nums",
          score >= 70 ? 'text-emerald-400' :
          score >= 55 ? 'text-yellow-400' :
          score >= 45 ? 'text-orange-400' : 'text-red-400'
        )}>
          {score}
        </span>
      </div>
    </div>
  );
}

function LockedMessage({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-slate-800/30 rounded border border-dashed border-slate-700">
      <Icon className="h-4 w-4 text-slate-500" />
      <span className="text-xs text-slate-500">{message}</span>
    </div>
  );
}

function getScoreGrade(score: number): string {
  if (score >= 80) return 'Elite';
  if (score >= 70) return 'Plus';
  if (score >= 60) return 'Above Avg';
  if (score >= 50) return 'Average';
  if (score >= 40) return 'Below Avg';
  return 'Developing';
}

export function ScoreboardCard({ 
  scores, 
  bodyMetrics,
  brainMetrics,
  batMetrics,
  ballMetrics 
}: ScoreboardCardProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { composite, deltas } = scores;
  const grade = getScoreGrade(composite);

  const toggleExpand = (key: string) => {
    setExpanded(expanded === key ? null : key);
  };

  // Default metrics if not provided (for demo)
  const defaultBodyMetrics = bodyMetrics || {
    loadSequence: { raw: '+67ms', score: 62 },
    separation: { raw: '14°', score: 48 },
    leadLegBraking: { raw: '+15ms', score: 60 },
  };

  const defaultBrainMetrics = brainMetrics || {
    tempo: { raw: '2.3:1', score: 58 },
    syncScore: { raw: '55', score: 55 },
  };

  const defaultBatMetrics = batMetrics || { connected: false };
  const defaultBallMetrics = ballMetrics || { hasData: false };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide">
          Your Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hero Composite Score */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <div className={cn(
              "w-28 h-28 rounded-full border-4 flex items-center justify-center",
              composite >= 70 ? 'border-emerald-500 bg-emerald-500/10' :
              composite >= 55 ? 'border-yellow-500 bg-yellow-500/10' :
              composite >= 45 ? 'border-orange-500 bg-orange-500/10' :
              'border-red-500 bg-red-500/10'
            )}>
              <div className="text-center">
                <span className={cn(
                  "text-4xl font-bold tabular-nums",
                  composite >= 70 ? 'text-emerald-400' :
                  composite >= 55 ? 'text-yellow-400' :
                  composite >= 45 ? 'text-orange-400' : 'text-red-400'
                )}>
                  {composite}
                </span>
                <DeltaBadge delta={deltas?.composite} />
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-2 font-medium">{grade}</p>
        </div>

        {/* Sub-scores - Expandable */}
        <div className="space-y-2">
          {scoreCategories.map(({ key, label, color, textColor }) => {
            const score = scores[key];
            const delta = deltas?.[key];
            const isExpanded = expanded === key;
            
            return (
              <Collapsible 
                key={key} 
                open={isExpanded} 
                onOpenChange={() => toggleExpand(key)}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left group">
                    <div className="space-y-1.5 py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-semibold", textColor)}>{label}</span>
                          <ChevronDown className={cn(
                            "h-4 w-4 text-slate-500 transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )} />
                        </div>
                        <div className="flex items-center">
                          <span className="text-white font-bold tabular-nums">{score}</span>
                          <DeltaBadge delta={delta} />
                        </div>
                      </div>
                      <Progress 
                        value={((score - 20) / 60) * 100} 
                        className="h-1.5 bg-slate-700"
                        // @ts-ignore - custom indicator color
                        indicatorClassName={color}
                      />
                    </div>
                  </button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                  <div className="mt-2 ml-3 space-y-1.5">
                    {/* BODY Metrics */}
                    {key === 'body' && (
                      <>
                        <MetricRow 
                          label="Load Sequence" 
                          raw={defaultBodyMetrics.loadSequence?.raw || '--'} 
                          score={defaultBodyMetrics.loadSequence?.score || 0} 
                        />
                        <MetricRow 
                          label="Separation" 
                          raw={defaultBodyMetrics.separation?.raw || '--'} 
                          score={defaultBodyMetrics.separation?.score || 0} 
                        />
                        <MetricRow 
                          label="Lead Leg Braking" 
                          raw={defaultBodyMetrics.leadLegBraking?.raw || '--'} 
                          score={defaultBodyMetrics.leadLegBraking?.score || 0} 
                        />
                        <p className="text-[10px] text-slate-600 px-2 pt-1 italic">
                          BODY = Load×30% + Sep×30% + Brace×40%
                        </p>
                      </>
                    )}

                    {/* BRAIN Metrics */}
                    {key === 'brain' && (
                      <>
                        <MetricRow 
                          label="Tempo" 
                          raw={defaultBrainMetrics.tempo?.raw || '--'} 
                          score={defaultBrainMetrics.tempo?.score || 0} 
                        />
                        <MetricRow 
                          label="Sync Score" 
                          raw={defaultBrainMetrics.syncScore?.raw || '--'} 
                          score={defaultBrainMetrics.syncScore?.score || 0} 
                        />
                        <p className="text-[10px] text-slate-600 px-2 pt-1 italic">
                          BRAIN = Tempo×50% + Sync×50%
                        </p>
                      </>
                    )}

                    {/* BAT Metrics */}
                    {key === 'bat' && (
                      <>
                        {defaultBatMetrics.connected ? (
                          <>
                            <MetricRow 
                              label="Bat Speed" 
                              raw={defaultBatMetrics.batSpeed?.raw || '--'} 
                              score={defaultBatMetrics.batSpeed?.score || 0} 
                            />
                            <MetricRow 
                              label="Attack Angle" 
                              raw={defaultBatMetrics.attackAngle?.raw || '--'} 
                              score={defaultBatMetrics.attackAngle?.score || 0} 
                            />
                            <MetricRow 
                              label="Hand Speed" 
                              raw={defaultBatMetrics.handSpeed?.raw || '--'} 
                              score={defaultBatMetrics.handSpeed?.score || 0} 
                            />
                          </>
                        ) : (
                          <LockedMessage 
                            icon={Link2} 
                            message="Link your Diamond Kinetics account to unlock BAT details" 
                          />
                        )}
                      </>
                    )}

                    {/* BALL Metrics */}
                    {key === 'ball' && (
                      <>
                        {defaultBallMetrics.hasData ? (
                          <>
                            <MetricRow 
                              label="Exit Velo" 
                              raw={defaultBallMetrics.exitVelo?.raw || '--'} 
                              score={defaultBallMetrics.exitVelo?.score || 0} 
                            />
                            <MetricRow 
                              label="Launch Angle" 
                              raw={defaultBallMetrics.launchAngle?.raw || '--'} 
                              score={defaultBallMetrics.launchAngle?.score || 0} 
                            />
                            <MetricRow 
                              label="Distance" 
                              raw={defaultBallMetrics.distance?.raw || '--'} 
                              score={defaultBallMetrics.distance?.score || 0} 
                            />
                          </>
                        ) : (
                          <LockedMessage 
                            icon={Upload} 
                            message="Upload batted ball data to unlock BALL details" 
                          />
                        )}
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Caption */}
        <p className="text-xs text-slate-500 text-center italic">
          Scores go up by fixing leaks — not by swinging harder.
        </p>
      </CardContent>
    </Card>
  );
}
