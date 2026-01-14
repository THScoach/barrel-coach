import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionHistoryItem, Badge as BadgeType } from '@/lib/report-types';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Trophy, Award, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface ProgressBoardProps {
  history: SessionHistoryItem[];
  badges?: BadgeType[];
}

const badgeIcons: Record<string, React.ReactNode> = {
  'Foundation Fixed': <Award className="h-3 w-3" />,
  'Engine Online': <Star className="h-3 w-3" />,
  'Weapon Unlocked': <Trophy className="h-3 w-3" />,
};

export function ProgressBoard({ history, badges }: ProgressBoardProps) {
  const earnedBadges = badges?.filter(b => b.earned) || [];

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Badges */}
        {earnedBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {earnedBadges.map((badge) => (
              <Badge
                key={badge.id}
                variant="secondary"
                className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              >
                {badgeIcons[badge.name] || <Trophy className="h-3 w-3" />}
                <span className="ml-1">{badge.name}</span>
              </Badge>
            ))}
          </div>
        )}

        {/* Session history */}
        <div className="space-y-2">
          {history.slice(0, 5).map((session, index) => {
            const isLatest = index === 0;
            const formattedDate = format(parseISO(session.date), 'MMM d');

            return (
              <div
                key={session.id}
                className={cn(
                  'flex items-center justify-between py-2 px-3 rounded-lg',
                  isLatest ? 'bg-primary/10 border border-primary/30' : 'bg-slate-800/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'text-sm',
                    isLatest ? 'text-primary font-medium' : 'text-slate-400'
                  )}>
                    {formattedDate}
                  </span>
                  {isLatest && (
                    <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                      Latest
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'font-bold',
                    isLatest ? 'text-white' : 'text-slate-300'
                  )}>
                    {session.compositeScore}
                  </span>
                  {session.delta !== undefined && session.delta !== 0 && (
                    <span className={cn(
                      'flex items-center text-xs font-medium',
                      session.delta > 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {session.delta > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-0.5" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-0.5" />
                      )}
                      {session.delta > 0 ? '+' : ''}{session.delta}
                    </span>
                  )}
                  {session.delta === 0 && (
                    <Minus className="h-3 w-3 text-slate-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
