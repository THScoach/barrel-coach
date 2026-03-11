/**
 * Drill Session Banner — amber banner for drill sessions in score displays
 */

interface DrillSessionBannerProps {
  sessionType: string | null | undefined;
  drillName?: string | null;
}

export function DrillSessionBanner({ sessionType, drillName }: DrillSessionBannerProps) {
  if (sessionType !== 'drill') return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-2.5 flex items-center gap-2">
      <span className="text-base">⚡</span>
      <p className="text-sm text-amber-300 font-medium">
        Drill Session{drillName ? `: ${drillName}` : ''}.{' '}
        <span className="font-normal text-amber-400/80">
          Scores reflect constraint training, not free-swing baseline.
        </span>
      </p>
    </div>
  );
}
