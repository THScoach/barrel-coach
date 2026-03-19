import { RawMetrics, EnergyStatus, STATUS_COLORS, statusLabel, getArmsKEPct, isSequenceReversed } from './types';
import { BeforeAfterBar } from './BeforeAfterBar';

interface Props {
  metrics: RawMetrics;
  baselineArmsKEPct: number | null;
}

const TARGET_ARMS_PCT = 35;

export function EnergyDirectionCard({ metrics, baselineArmsKEPct }: Props) {
  const armsKEPct = getArmsKEPct(metrics);
  if (armsKEPct == null) return null;

  const trunkTilt = metrics.trunk_tilt_contact;
  const TARGET_TILT_MIN = 25;

  let status: EnergyStatus;
  if (armsKEPct <= TARGET_ARMS_PCT && (trunkTilt == null || trunkTilt >= TARGET_TILT_MIN)) status = 'ON_TARGET';
  else if (armsKEPct <= 50) status = 'WORKING';
  else status = 'PRIORITY';

  const reversed = isSequenceReversed(metrics);

  let text = '';
  if (armsKEPct > TARGET_ARMS_PCT) {
    text = `Your arms are doing ${Math.round(armsKEPct)}% of the work (target: under ${TARGET_ARMS_PCT}%). `;
    if (reversed) {
      text += `Because your hips fire late, the energy pushes your body toward the pull side instead of staying through the middle of the field. `;
    }
    if (trunkTilt != null && trunkTilt < TARGET_TILT_MIN) {
      text += `Your trunk tilt at contact is ${trunkTilt.toFixed(1)}° (target: ${TARGET_TILT_MIN}-30°). Without enough tilt, your swing plane doesn't match the pitch plane. `;
    }
    text += `The goal is for the body to deliver energy so your arms just steer — not generate.`;
  } else {
    text = `Your arms are carrying ${Math.round(armsKEPct)}% of the energy — under the ${TARGET_ARMS_PCT}% target. That means your body is doing the heavy lifting and your arms are steering, not swinging. This is efficient energy delivery.`;
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #222' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
          Where Is Your Energy Going?
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${STATUS_COLORS[status]}20`, color: STATUS_COLORS[status] }}
        >
          {statusLabel(status)}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: '#ccc' }}>{text}</p>
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
    </div>
  );
}
