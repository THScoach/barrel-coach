import { Button } from '@/components/ui/button';
import { Drill } from '@/lib/report-types';
import { Play, ExternalLink } from 'lucide-react';

interface DrillCardProps {
  drill: Drill;
}

export function DrillCard({ drill }: DrillCardProps) {
  const { name, coachingCue, reps, loopUrl, demoUrl } = drill;

  return (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
      {/* Video placeholder */}
      <div className="relative aspect-video bg-slate-800">
        {loopUrl ? (
          <img 
            src={loopUrl} 
            alt={`${name} drill demo`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-12 w-12 text-slate-600" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Play className="h-5 w-5 text-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <h4 className="font-semibold text-white">{name}</h4>
        <p className="text-sm text-slate-400 italic">"{coachingCue}"</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded">
            {reps}
          </span>
          {demoUrl && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-primary hover:text-primary/80 p-0 h-auto"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Watch demo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
