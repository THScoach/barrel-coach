import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReportSession } from '@/lib/report-types';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

interface ReportHeaderProps {
  session: ReportSession;
}

export function ReportHeader({ session }: ReportHeaderProps) {
  const { player, date } = session;
  
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Link copied!',
        description: 'Share this report with your coach or parent.',
      });
    } catch {
      toast({
        title: 'Could not copy link',
        variant: 'destructive',
      });
    }
  };

  const formattedDate = format(parseISO(date), 'MMM d, yyyy');
  const handednessLabel = player.handedness === 'L' ? 'Left-handed' : player.handedness === 'S' ? 'Switch' : 'Right-handed';

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white">{player.name}</h1>
            <div className="flex flex-wrap gap-2 text-sm text-slate-400">
              {player.age && <span>Age {player.age}</span>}
              {player.level && (
                <>
                  <span className="text-slate-600">•</span>
                  <span>{player.level}</span>
                </>
              )}
              {player.handedness && (
                <>
                  <span className="text-slate-600">•</span>
                  <span>{handednessLabel}</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">{formattedDate}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
