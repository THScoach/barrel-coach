import { RawMetrics, KRSData } from './types';

interface Props {
  metrics: RawMetrics;
  krsData: KRSData | null;
}

export function NextStepCard({ metrics, krsData }: Props) {
  // Get drill name
  let drillName = '';
  let why = '';
  let goal = '';

  // From raw_metrics root_cause (compute-4b-from-csv)
  if (metrics.root_cause?.build) {
    drillName = metrics.root_cause.build;
  }
  if (metrics.root_cause?.what) {
    why = metrics.root_cause.what;
  }
  if (metrics.root_cause?.issue && metrics.root_cause.issue !== 'None detected') {
    goal = `If we fix this, everything downstream — your arms, your bat speed, your contact — improves as a consequence.`;
  }

  // Override with KRS data if available
  if (krsData?.coach_barrels_prescription) {
    const rx = krsData.coach_barrels_prescription;
    if (typeof rx === 'object' && rx.drill_name) drillName = rx.drill_name;
    if (typeof rx === 'object' && rx.why) why = rx.why;
  }
  if (krsData?.focus_next_bp) {
    goal = krsData.focus_next_bp;
  }

  if (!drillName && !why) return null;

  return (
    <div className="rounded-xl p-4 space-y-2" style={{ background: '#111', border: '2px solid #E63946' }}>
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#E63946' }}>
        Your Next Step
      </p>
      {drillName && (
        <p className="text-base font-bold" style={{ color: '#fff' }}>{drillName}</p>
      )}
      {why && (
        <p className="text-sm" style={{ color: '#ccc' }}>
          <span style={{ color: '#777' }}>Why: </span>{why}
        </p>
      )}
      {goal && (
        <p className="text-sm" style={{ color: '#ccc' }}>
          <span style={{ color: '#777' }}>Goal: </span>{goal}
        </p>
      )}
    </div>
  );
}
