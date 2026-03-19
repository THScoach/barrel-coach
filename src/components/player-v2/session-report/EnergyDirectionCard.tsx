import { RawMetrics, STATUS_COLORS, getArmsKEPct, isSequenceReversed } from './types';
import { BeforeAfterBar } from './BeforeAfterBar';

interface Props {
  metrics: RawMetrics;
  baselineArmsKEPct: number | null;
}

const TARGET_ARMS_PCT = 40;

export function EnergyDirectionCard({ metrics, baselineArmsKEPct }: Props) {
  const { value: armsKEPct, estimated } = getArmsKEPct(metrics);

  if (armsKEPct == null) {
    return (
      <div className="rounded-xl p-4" style={{ background: '#111', border: '1px solid #222' }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
          Where Is Your Energy Going?
        </p>
        <p className="text-sm mt-2" style={{ color: '#555' }}>Awaiting KE data</p>
      </div>
    );
  }

  // Status color
  let statusColor: string;
  if (armsKEPct <= 40) statusColor = '#4ecdc4';
  else if (armsKEPct <= 55) statusColor = '#ffa500';
  else statusColor = '#ff6b6b';

  const reversed = isSequenceReversed(metrics);

  let text = '';
  if (armsKEPct > TARGET_ARMS_PCT) {
    text = `Your arms are doing ${Math.round(armsKEPct)}% of the work (target: under ${TARGET_ARMS_PCT}%). `;
    if (reversed) {
      text += `Because your hips fire late, the energy pushes your body toward the pull side instead of staying through the middle of the field. `;
    }
    const trunkTilt = metrics.trunk_tilt_contact;
    if (trunkTilt != null && trunkTilt < 25) {
      text += `Your trunk tilt at contact is ${trunkTilt.toFixed(1)}° (target: 25-30°). Without enough tilt, your swing plane doesn't match the pitch plane. `;
    }
    text += `The goal is for the body to deliver energy so your arms just steer — not generate.`;
  } else {
    text = `Your arms are carrying ${Math.round(armsKEPct)}% of the energy — under the ${TARGET_ARMS_PCT}% target. That means your body is doing the heavy lifting and your arms are steering, not swinging. This is efficient energy delivery.`;
  }

  const trunkTilt = metrics.trunk_tilt_contact;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #222' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
          Arms Energy Share
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${statusColor}20`, color: statusColor }}
        >
          {Math.round(armsKEPct)}%
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: '#ccc' }}>{text}</p>
      {estimated && (
        <p className="text-[10px]" style={{ color: '#666' }}>Estimated from qualitative data</p>
      )}
      <BeforeAfterBar
        before={baselineArmsKEPct}
        now={armsKEPct}
        target={TARGET_ARMS_PCT}
        unit="%"
        targetLabel="Target"
      />
      <p className="text-xs text-center" style={{ color: '#777' }}>
        Your arms: {Math.round(armsKEPct)}% | Target: under {TARGET_ARMS_PCT}%
      </p>

      {/* Trunk Tilt bonus metric */}
      {trunkTilt != null && typeof trunkTilt === 'number' && (
        <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid #222' }}>
          <p className="text-xs" style={{ color: '#777' }}>Trunk Tilt at Contact</p>
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-bold"
              style={{ color: trunkTilt >= 20 ? '#4ecdc4' : trunkTilt >= 10 ? '#ffa500' : '#ff6b6b' }}
            >
              {trunkTilt.toFixed(1)}°
            </span>
            <span className="text-[10px]" style={{ color: '#555' }}>Target: 25‒30°</span>
          </div>
        </div>
      )}
    </div>
  );
}
