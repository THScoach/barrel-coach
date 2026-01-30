import { User2, TrendingUp, TrendingDown, Activity, Brain, Target, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

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

const categoryIcons: Record<string, typeof Brain> = {
  brain: Brain,
  body: Activity,
  bat: Target,
  ball: Zap,
};

export function PlayerDataCard({ player }: PlayerDataCardProps) {
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
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 4B Scores Grid */}
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

        {/* Additional Info */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2 border-t border-border">
          {player.team && (
            <span>Team: <strong className="text-foreground">{player.team}</strong></span>
          )}
          {player.lastSessionDate && (
            <span>Last Session: <strong className="text-foreground">{player.lastSessionDate}</strong></span>
          )}
          {player.swingCount !== undefined && (
            <span>Total Swings: <strong className="text-foreground">{player.swingCount.toLocaleString()}</strong></span>
          )}
        </div>

        {/* Priority Alert if weakest category */}
        {player.weakestCategory && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <WeakestIcon className="h-4 w-4 text-red-500" />
            <span className="text-sm">
              <strong className="text-red-500 capitalize">{player.weakestCategory}</strong> is the priority focus area
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
