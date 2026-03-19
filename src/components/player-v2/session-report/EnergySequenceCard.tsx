import { RawMetrics, STATUS_COLORS, statusLabel, isSequenceReversed } from './types';
import type { EnergyStatus } from './types';
import { SequenceDots } from './SequenceDots';

interface Props {
  metrics: RawMetrics;
}

export function EnergySequenceCard({ metrics }: Props) {
  const reversed = isSequenceReversed(metrics);

  const sequenceCount = metrics.correct_sequence_count;
  const swingCount = metrics.swing_count ?? metrics.swingCount;
  const showCounts = sequenceCount != null && swingCount != null && swingCount > 0;

  const totalSwings = showCounts ? swingCount! : 1;
  const correctCount = showCounts ? sequenceCount! : (reversed ? 0 : 1);

  let status: EnergyStatus;
  if (showCounts) {
    if (correctCount === totalSwings) status = 'ON_TARGET';
    else if (correctCount > totalSwings * 0.5) status = 'WORKING';
    else status = 'PRIORITY';
  } else {
    status = reversed ? 'PRIORITY' : 'ON_TARGET';
  }

  let text: string;
  if (reversed) {
    text = `Your chest started turning before your hips. When your chest goes first, your hips have to play catch-up. The energy you created gets stuck and can't travel up to your bat. We call this a "late pelvis" — the energy exists, but it shows up after the barrel is already on its way.`;
  } else {
    text = `Your hips fired first this session. The energy chain is in the right order — hips lead, chest follows, arms deliver. This is how energy travels efficiently from the ground to the barrel.`;
  }

  const gapMs = metrics.pelvis_torso_gap_ms;
  if (gapMs != null) {
    if (!reversed && (gapMs < 14 || gapMs > 18)) {
      text += ` Your hip-to-chest timing gap was ${gapMs}ms (target: 14-18ms).`;
      if (gapMs < 14) text += ` That's tight — your segments are firing almost simultaneously, reducing the whip effect.`;
      else text += ` That's wide — the energy wave loses momentum in the gap between segments.`;
      if (status === 'ON_TARGET') status = 'WORKING';
    } else if (!reversed) {
      text += ` Hip-to-chest gap: ${gapMs}ms — right in the target window.`;
    }
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #222' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
          Did Your Hips Fire First?
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${STATUS_COLORS[status]}20`, color: STATUS_COLORS[status] }}
        >
          {statusLabel(status)}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: '#ccc' }}>{text}</p>
      {showCounts && (
        <SequenceDots totalSwings={totalSwings} correctCount={correctCount} isReversed={reversed} />
      )}
    </div>
  );
}
