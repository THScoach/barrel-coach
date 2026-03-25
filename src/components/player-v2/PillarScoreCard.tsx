/**
 * Individual 4B pillar score card with pillar-specific icon & color
 */
import { Link } from "react-router-dom";
import { Brain, Activity, Zap, Target } from "lucide-react";
import { scoreColor } from "@/lib/player-utils";

type Pillar = 'body' | 'brain' | 'bat' | 'ball';

const PILLAR_CONFIG: Record<Pillar, { icon: typeof Brain; accent: string; label: string }> = {
  brain: { icon: Brain, accent: '#a855f7', label: 'Brain' },
  body:  { icon: Activity, accent: '#3b82f6', label: 'Body' },
  bat:   { icon: Zap, accent: '#f97316', label: 'Bat' },
  ball:  { icon: Target, accent: '#10b981', label: 'Ball' },
};

interface PillarScoreCardProps {
  pillar: Pillar;
  value: number | null;
}

export function PillarScoreCard({ pillar, value }: PillarScoreCardProps) {
  const config = PILLAR_CONFIG[pillar];
  const Icon = config.icon;

  return (
    <Link
      to="/player/data?tab=4b"
      className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
      style={{
        background: `linear-gradient(145deg, ${config.accent}0d, ${config.accent}05)`,
        border: `1px solid ${config.accent}20`,
      }}
    >
      <Icon className="h-3.5 w-3.5 mb-0.5" style={{ color: config.accent, opacity: 0.7 }} />
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: config.accent, opacity: 0.8 }}>
        {config.label}
      </span>
      <span className="text-xl font-black" style={{ color: value != null ? scoreColor(value) : '#333' }}>
        {value ?? '—'}
      </span>
    </Link>
  );
}
