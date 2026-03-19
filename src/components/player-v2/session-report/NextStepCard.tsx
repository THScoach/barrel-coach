import { RawMetrics, KRSData, getNextStep } from './types';

interface Props {
  metrics: RawMetrics;
  krsData: KRSData | null;
}

export function NextStepCard({ metrics, krsData }: Props) {
  // Get drill name from KRS if available
  let drillName = '';
  if (krsData?.coach_barrels_prescription) {
    const rx = krsData.coach_barrels_prescription;
    if (typeof rx === 'object' && rx.drill_name) drillName = rx.drill_name;
  }

  // Get KRS goal if available
  const krsGoal = krsData?.focus_next_bp || '';

  // Get next step text from raw_metrics with fallback logic
  const nextStepText = getNextStep(metrics);

  // If KRS overrides why
  let why = '';
  if (krsData?.coach_barrels_prescription) {
    const rx = krsData.coach_barrels_prescription;
    if (typeof rx === 'object' && rx.why) why = rx.why;
  }

  // Use nextStepText as primary content if no drill name
  if (!drillName && !nextStepText) return null;

  return (
    <div className="rounded-xl p-4 space-y-2" style={{ background: '#111', border: '2px solid #E63946' }}>
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#E63946' }}>
        Your Next Step
      </p>
      {drillName && (
        <p className="text-base font-bold" style={{ color: '#fff' }}>{drillName}</p>
      )}
      <p className="text-sm" style={{ color: '#ccc' }}>
        {why || nextStepText}
      </p>
      {krsGoal && (
        <p className="text-sm" style={{ color: '#ccc' }}>
          <span style={{ color: '#777' }}>Goal: </span>{krsGoal}
        </p>
      )}
    </div>
  );
}
