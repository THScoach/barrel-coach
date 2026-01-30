import { User2, TrendingUp, TrendingDown, Activity, Brain, Target, Zap, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

interface StatcastData {
  avg_exit_velocity?: number;
  max_exit_velocity?: number;
  barrel_pct?: number;
  hard_hit_pct?: number;
  xba?: number;
  xslg?: number;
  xwoba?: number;
  k_pct?: number;
  bb_pct?: number;
  sprint_speed?: number;
}

interface FangraphsData {
  woba?: number;
  wrc_plus?: number;
  war?: number;
  o_swing_pct?: number;
  z_contact_pct?: number;
  chase_rate?: number;
  hard_pct?: number;
  pull_pct?: number;
  gb_pct?: number;
  fb_pct?: number;
}

interface PlayerData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  motorProfile?: string;
  level?: string;
  team?: string;
  scores?: {
    brain?: number;
    body?: number;
    bat?: number;
    ball?: number;
    composite?: number;
  };
  weakestCategory?: string;
  lastSessionDate?: string;
  swingCount?: number;
  trend?: 'up' | 'down' | 'stable';
  source?: 'internal' | 'baseball_savant' | 'fangraphs' | 'combined';
  statcast?: StatcastData;
  fangraphs?: FangraphsData;
}

interface PlayerDataCardProps {
  player: PlayerData;
}

const motorProfileColors: Record<string, string> = {
  spinner: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  whipper: 'bg-green-500/20 text-green-500 border-green-500/30',
  slingshotter: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  titan: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
};

const sourceColors: Record<string, string> = {
  internal: 'bg-primary/20 text-primary border-primary/30',
  baseball_savant: 'bg-red-500/20 text-red-500 border-red-500/30',
  fangraphs: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  combined: 'bg-gradient-to-r from-red-500/20 to-blue-500/20 text-foreground border-muted-foreground/30',
};

const sourceLabels: Record<string, string> = {
  internal: 'Catching Barrels',
  baseball_savant: 'Baseball Savant',
  fangraphs: 'FanGraphs',
  combined: 'MLB Data',
};

const categoryIcons: Record<string, typeof Brain> = {
  brain: Brain,
  body: Activity,
  bat: Target,
  ball: Zap,
};

function StatBlock({ label, value, format = 'number' }: { label: string; value?: number; format?: 'number' | 'percent' | 'decimal' }) {
  if (value === undefined || value === null) return null;
  
  let displayValue: string;
  if (format === 'percent') {
    displayValue = `${(value * 100).toFixed(1)}%`;
  } else if (format === 'decimal') {
    displayValue = value.toFixed(3);
  } else {
    displayValue = value.toFixed(1);
  }
  
  return (
    <div className="text-center p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{displayValue}</p>
    </div>
  );
}

export function PlayerDataCard({ player }: PlayerDataCardProps) {
  const isExternalPlayer = player.source && player.source !== 'internal';
  const hasStatcast = player.statcast && Object.keys(player.statcast).length > 0;
  const hasFangraphs = player.fangraphs && Object.keys(player.fangraphs).length > 0;
  
  const profileColor = player.motorProfile 
    ? motorProfileColors[player.motorProfile.toLowerCase()] || 'bg-muted text-muted-foreground'
    : 'bg-muted text-muted-foreground';

  const WeakestIcon = player.weakestCategory 
    ? categoryIcons[player.weakestCategory.toLowerCase()] || Activity
    : Activity;

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-2 border-orange-500/20 bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User2 className="h-4 w-4 text-primary" />
            </div>
            {player.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {player.source && (
              <Badge variant="outline" className={sourceColors[player.source]}>
                {sourceLabels[player.source]}
              </Badge>
            )}
            {player.motorProfile && (
              <Badge variant="outline" className={`capitalize ${profileColor}`}>
                {player.motorProfile}
              </Badge>
            )}
            {player.level && (
              <Badge variant="secondary" className="capitalize">
                {player.level}
              </Badge>
            )}
          </div>
        </div>
        {player.team && (
          <p className="text-sm text-muted-foreground mt-1">{player.team}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 4B Scores Grid (for internal players) */}
        {player.scores && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Composite Score - Featured */}
            <div className="col-span-2 md:col-span-1 bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Composite</p>
              <p className="text-2xl font-bold text-primary">
                {player.scores.composite?.toFixed(0) || '--'}
              </p>
              {player.trend && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  {player.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                  {player.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                  <span className={`text-xs ${
                    player.trend === 'up' ? 'text-green-500' : 
                    player.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                    {player.trend === 'up' ? 'Improving' : player.trend === 'down' ? 'Declining' : 'Stable'}
                  </span>
                </div>
              )}
            </div>

            {/* Individual 4B Scores */}
            {[
              { key: 'brain', label: 'Brain', icon: Brain },
              { key: 'body', label: 'Body', icon: Activity },
              { key: 'bat', label: 'Bat', icon: Target },
              { key: 'ball', label: 'Ball', icon: Zap },
            ].map(({ key, label, icon: Icon }) => {
              const score = player.scores?.[key as keyof typeof player.scores];
              const isWeakest = player.weakestCategory?.toLowerCase() === key;
              
              return (
                <div 
                  key={key} 
                  className={`rounded-lg p-3 ${isWeakest ? 'bg-red-500/10 border border-red-500/20' : 'bg-muted/30'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`h-4 w-4 ${isWeakest ? 'text-red-500' : 'text-muted-foreground'}`} />
                    <span className={`text-lg font-semibold ${isWeakest ? 'text-red-500' : ''}`}>
                      {score?.toFixed(0) || '--'}
                    </span>
                  </div>
                  <Progress 
                    value={score || 0} 
                    className={`h-1 ${isWeakest ? '[&>div]:bg-red-500' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Statcast Data (for external players) */}
        {hasStatcast && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-red-500">⚡ STATCAST</span>
              <Separator className="flex-1" />
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-1 bg-muted/30 rounded-lg p-2">
              <StatBlock label="Exit Velo" value={player.statcast?.avg_exit_velocity} />
              <StatBlock label="Max EV" value={player.statcast?.max_exit_velocity} />
              <StatBlock label="Barrel %" value={player.statcast?.barrel_pct} format="percent" />
              <StatBlock label="Hard Hit %" value={player.statcast?.hard_hit_pct} format="percent" />
              <StatBlock label="xBA" value={player.statcast?.xba} format="decimal" />
              <StatBlock label="xSLG" value={player.statcast?.xslg} format="decimal" />
              <StatBlock label="xwOBA" value={player.statcast?.xwoba} format="decimal" />
              <StatBlock label="K %" value={player.statcast?.k_pct} format="percent" />
              <StatBlock label="BB %" value={player.statcast?.bb_pct} format="percent" />
              {player.statcast?.sprint_speed && (
                <StatBlock label="Sprint Speed" value={player.statcast.sprint_speed} />
              )}
            </div>
          </>
        )}

        {/* FanGraphs Data (for external players) */}
        {hasFangraphs && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-500">📊 FANGRAPHS</span>
              <Separator className="flex-1" />
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-1 bg-muted/30 rounded-lg p-2">
              <StatBlock label="wOBA" value={player.fangraphs?.woba} format="decimal" />
              <StatBlock label="wRC+" value={player.fangraphs?.wrc_plus} />
              <StatBlock label="WAR" value={player.fangraphs?.war} />
              <StatBlock label="O-Swing %" value={player.fangraphs?.o_swing_pct} format="percent" />
              <StatBlock label="Z-Contact %" value={player.fangraphs?.z_contact_pct} format="percent" />
              <StatBlock label="Hard %" value={player.fangraphs?.hard_pct} format="percent" />
              <StatBlock label="Pull %" value={player.fangraphs?.pull_pct} format="percent" />
              <StatBlock label="GB %" value={player.fangraphs?.gb_pct} format="percent" />
              <StatBlock label="FB %" value={player.fangraphs?.fb_pct} format="percent" />
            </div>
          </>
        )}

        {/* Additional Info */}
        {(player.lastSessionDate || player.swingCount !== undefined) && (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2 border-t border-border">
            {player.lastSessionDate && (
              <span>Last Session: <strong className="text-foreground">{player.lastSessionDate}</strong></span>
            )}
            {player.swingCount !== undefined && (
              <span>Total Swings: <strong className="text-foreground">{player.swingCount.toLocaleString()}</strong></span>
            )}
          </div>
        )}

        {/* Priority Alert if weakest category */}
        {player.weakestCategory && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <WeakestIcon className="h-4 w-4 text-red-500" />
            <span className="text-sm">
              <strong className="text-red-500 capitalize">{player.weakestCategory}</strong> is the priority focus area
            </span>
          </div>
        )}

        {/* External links for MLB players */}
        {isExternalPlayer && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <a 
              href={`https://baseballsavant.mlb.com/savant-player/${player.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> Savant
            </a>
            <a 
              href={`https://www.fangraphs.com/players/${player.name.toLowerCase().replace(/\s+/g, '-')}/${player.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-blue-500 flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> FanGraphs
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
