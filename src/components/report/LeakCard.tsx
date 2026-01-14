import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PrimaryLeak } from '@/lib/report-types';
import { AlertCircle } from 'lucide-react';

interface LeakCardProps {
  leak: PrimaryLeak;
}

export function LeakCard({ leak }: LeakCardProps) {
  const { title, description, whyItMatters, frameUrl, loopUrl } = leak;
  const imageUrl = loopUrl || frameUrl;

  return (
    <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-red-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-red-400 uppercase tracking-wide flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Primary Leak
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Frame/Loop placeholder */}
        {imageUrl && (
          <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
            <img 
              src={imageUrl} 
              alt="Swing frame showing primary leak"
              className="w-full h-full object-cover"
            />
            {/* Overlay label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-red-500/90 text-white text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                {title}
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        <h3 className="text-xl font-bold text-white">{title}</h3>

        {/* Description */}
        <p className="text-slate-300">{description}</p>

        {/* Why it matters */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">Why it matters: </span>
            {whyItMatters}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
