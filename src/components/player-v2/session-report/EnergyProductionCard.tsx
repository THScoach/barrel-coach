import { RawMetrics, EnergyStatus, STATUS_COLORS, statusLabel, getPelvisKE } from './types';
import { BeforeAfterBar } from './BeforeAfterBar';

interface Props {
  metrics: RawMetrics;
  baselinePelvisKE: number | null;
}

export function EnergyProductionCard({ metrics, baselinePelvisKE }: Props) {
  const pelvisKE = getPelvisKE(metrics);
  if (pelvisKE == null) return null;

  let status: EnergyStatus = 'WORKING';
  if (baselinePelvisKE != null && pelvisKE > baselinePelvisKE * 1.1) {
    status = 'IMPROVING';
  } else if (baselinePelvisKE != null && pelvisKE >= baselinePelvisKE) {
    status = 'ON_TARGET';
  } else if (baselinePelvisKE != null && pelvisKE < baselinePelvisKE) {
    status = 'PRIORITY';
  }

  let text: string;
  if (status === 'IMPROVING') {
    text = `Your body is producing more energy than before. Session average: ${Math.round(pelvisKE)}J (baseline: ${Math.round(baselinePelvisKE!)}J). The fuel is there.`;
  } else if (status === 'PRIORITY' && baselinePelvisKE != null) {
    text = `Your body is producing less energy than your baseline (${Math.round(pelvisKE)}J vs ${Math.round(baselinePelvisKE)}J). Your body should be generating more force from the ground.`;
  } else if (baselinePelvisKE != null) {
    text = `Energy production is steady at ${Math.round(pelvisKE)}J. Maintaining your baseline output.`;
  } else {
    text = `Your body produced ${Math.round(pelvisKE)}J of kinetic energy this session. We'll track this over time to see your trend.`;
    status = 'WORKING';
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #222' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
          How Much Power Your Body Makes
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${STATUS_COLORS[status]}20`, color: STATUS_COLORS[status] }}
        >
          {statusLabel(status)}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: '#ccc' }}>{text}</p>
      <BeforeAfterBar before={baselinePelvisKE} now={pelvisKE} unit="J" />
    </div>
  );
}
