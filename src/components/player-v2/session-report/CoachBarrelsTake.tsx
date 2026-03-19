import { RawMetrics, KRSData, getCoachTake } from './types';

interface Props {
  metrics: RawMetrics;
  krsData: KRSData | null;
}

export function CoachBarrelsTake({ metrics, krsData }: Props) {
  let take = '';

  // Priority 1: KRS voice sample
  if (krsData?.coach_barrels_voice_sample) {
    take = krsData.coach_barrels_voice_sample;
  }
  // Priority 2: Use contradiction-safe getCoachTake
  else {
    const { issue, what } = getCoachTake(metrics);
    if (issue && issue !== 'None detected') {
      take = issue + '. ';
      if (what) take += what + ' ';
    }
    // Priority 3: Story fields
    else if (metrics.story) {
      if (metrics.story.base) take += metrics.story.base + ' ';
      if (metrics.story.rhythm) take += metrics.story.rhythm + ' ';
      if (metrics.story.barrel) take += metrics.story.barrel;
    }
    // Priority 4: KRS summary
    else if (krsData?.summary_player_text) {
      take = krsData.summary_player_text;
    }
  }

  if (!take.trim()) return null;

  return (
    <div className="rounded-xl p-4" style={{ background: '#1a1a1a', borderLeft: '4px solid #E63946' }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: 20 }}>🛢️</span>
        <p className="text-sm font-bold" style={{ color: '#fff' }}>Coach Barrels</p>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: '#ccc' }}>{take.trim()}</p>
    </div>
  );
}
