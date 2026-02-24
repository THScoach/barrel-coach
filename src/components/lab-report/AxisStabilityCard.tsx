import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield } from 'lucide-react';

export interface AxisStabilityData {
  present: boolean;
  type?: string;
  score?: number;
  note?: string;
  cue?: string;
  cog_velo_y?: number;
}

const typeConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  STABLE: { label: 'Stable', color: '#4ecdc4', bg: 'rgba(78,205,196,0.15)', border: 'rgba(78,205,196,0.4)' },
  BACKWARD_DRIFT: { label: 'Backward Drift', color: '#E63946', bg: 'rgba(230,57,70,0.15)', border: 'rgba(230,57,70,0.4)' },
  FORWARD_SPIN: { label: 'Forward Spin', color: '#ffa500', bg: 'rgba(255,165,0,0.15)', border: 'rgba(255,165,0,0.4)' },
  DEVELOPING: { label: 'Developing', color: '#4488ff', bg: 'rgba(68,136,255,0.15)', border: 'rgba(68,136,255,0.4)' },
};

export function AxisStabilityCard({ data }: { data: AxisStabilityData }) {
  if (!data.present) return null;

  const config = typeConfig[data.type || 'DEVELOPING'] || typeConfig.DEVELOPING;
  const score = data.score ?? 50;

  return (
    <Card className="border-[#222222] bg-[#111111] overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: config.color }} />
            <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
              Axis Stability
            </h3>
          </div>
          <Badge
            className="text-xs font-bold border px-2.5 py-0.5"
            style={{
              color: config.color,
              backgroundColor: config.bg,
              borderColor: config.border,
            }}
          >
            {config.label}
          </Badge>
        </div>

        {/* Score bar */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{score}</span>
            <span className="text-xs text-slate-400">/100</span>
          </div>
          <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{ width: `${score}%`, backgroundColor: config.color }}
            />
          </div>
        </div>

        {/* Note */}
        {data.note && (
          <p className="text-sm text-slate-300 leading-relaxed">{data.note}</p>
        )}

        {/* Cue highlight box */}
        {data.cue && (
          <div
            className="rounded-md px-3 py-2.5 border"
            style={{
              backgroundColor: config.bg,
              borderColor: config.border,
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: config.color }}>
              Coaching Cue
            </p>
            <p className="text-sm text-white font-medium leading-snug">{data.cue}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}