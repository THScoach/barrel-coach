/**
 * Session Type Badge — colored badge for session list rows
 */
import { Badge } from "@/components/ui/badge";

interface SessionTypeBadgeProps {
  sessionType: string | null | undefined;
  drillName?: string | null;
}

const badgeConfig: Record<string, { label: string; className: string }> = {
  drill: { label: 'DRILL', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  game: { label: 'GAME', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  tee: { label: 'TEE', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  live_pitching: { label: 'LIVE', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

export function SessionTypeBadge({ sessionType, drillName }: SessionTypeBadgeProps) {
  if (!sessionType || sessionType === 'bp') return null;

  const config = badgeConfig[sessionType];
  if (!config) return null;

  const label = sessionType === 'drill' && drillName ? drillName : config.label;

  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {label}
    </Badge>
  );
}
