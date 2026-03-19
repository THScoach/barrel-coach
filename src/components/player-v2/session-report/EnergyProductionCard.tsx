import { RawMetrics, STATUS_COLORS, getPelvisKE } from './types';
import { BeforeAfterBar } from './BeforeAfterBar';

interface Props {
  metrics: RawMetrics;
  baselinePelvisKE: number | null;
}

export function EnergyProductionCard({ metrics, baselinePelvisKE }: Props) {
  const { value: pelvisVal, unit } = getPelvisKE(metrics);

  if (pelvisVal == null) {
    return (
      <div className="rounded-xl p-4" style={{ background: '#111', border: '1px solid #222' }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
          How Much Power Your Body Makes
        </p>
        <p className="text-sm mt-2" style={{ color: '#555' }}>Awaiting KE data</p>
      </div>
    );
  }

  // Determine status color based on unit
  let statusColor: string;
  if (unit === 'J') {
    statusColor = pelvisVal >= 100 ? '#4ecdc4' : pelvisVal >= 60 ? '#ffa500' : '#ff6b6b';
  } else {
    statusColor = pelvisVal >= 700 ? '#4ecdc4' : pelvisVal >= 500 ? '#ffa500' : '#ff6b6b';
  }

  const label = unit === 'J' ? 'Pelvis Energy' : 'Pelvis Velocity';

  let text: string;
  if (unit === 'J' && baselinePelvisKE != null && baselinePelvisKE > 0) {
    if (pelvisVal > baselinePelvisKE * 1.1) {
      text = `Your body is producing more energy than before. Session average: ${pelvisVal}${unit} (baseline: ${Math.round(baselinePelvisKE)}${unit}). The fuel is there.`;
    } else if (pelvisVal < baselinePelvisKE) {
      text = `Your body is producing less energy than your baseline (${pelvisVal}${unit} vs ${Math.round(baselinePelvisKE)}${unit}). Your body should be generating more force from the ground.`;
    } else {
      text = `Energy production is steady at ${pelvisVal}${unit}. Maintaining your baseline output.`;
    }
  } else {
    text = `${label}: ${pelvisVal}${unit} this session. ${unit === 'J' ? "We'll track this over time." : 'Velocity data — KE will appear after re-scoring.'}`;
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #222' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
          {label}
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${statusColor}20`, color: statusColor }}
        >
          {pelvisVal}{unit}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: '#ccc' }}>{text}</p>
      {unit === 'J' && (
        <BeforeAfterBar before={baselinePelvisKE} now={pelvisVal} unit={unit} />
      )}
    </div>
  );
}
