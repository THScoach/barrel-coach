/**
 * PredictedContactCard — Shows PCE batted ball tendency predictions.
 * Rendered in the Session Report when predicted_contact is present.
 */

interface PredictedContact {
  confidence: string;
  energy_archetype: string | null;
  energy_archetype_label: string | null;
  primary_compensation: string;
  severity: number;
  barrel_path: {
    plane_type: string;
    entry_timing: string;
    contact_depth: string;
  };
  tendencies: {
    ground_ball: string;
    line_drive: string;
    fly_ball: string;
    pop_up_risk: string;
    direction: string;
    hard_hit_potential: string;
    sweet_spot_proxy: string;
  };
  plane_length_pct: number;
  predicted_ball_score: number;
}

interface Props {
  predictedContact: any;
}

const TENDENCY_COLOR: Record<string, string> = {
  VERY_HIGH: '#ff6b6b',
  HIGH: '#ffa500',
  MEDIUM: '#f0e68c',
  LOW: '#4ecdc4',
  VERY_LOW: '#4ecdc4',
};

const SCORE_COLOR = (s: number) =>
  s >= 80 ? '#4ecdc4' : s >= 60 ? '#ffa500' : '#ff6b6b';

const COMP_LABELS: Record<string, string> = {
  ARMS_DOMINANT: 'Arms Compensating',
  STABILITY: 'Stability Leak',
  TRANSLATIONAL: 'Forward Drift',
  SEQUENCE: 'Inverted Sequence',
  HEALTHY: 'Clean Chain',
};

const DIR_LABELS: Record<string, string> = {
  HEAVY_PULL: 'Heavy Pull',
  PULL: 'Pull',
  SLIGHT_PULL: 'Slight Pull',
  ALL_FIELDS: 'All Fields',
  SLIGHT_OPPO: 'Slight Oppo',
  OPPO: 'Oppo',
  HEAVY_OPPO: 'Heavy Oppo',
};

export function PredictedContactCard({ predictedContact }: Props) {
  if (!predictedContact) return null;

  const pc = predictedContact;
  const ballScore = pc.predicted_ball_score;
  const scoreColor = SCORE_COLOR(ballScore);

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #222' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
          Predicted Contact
        </p>
        <div className="flex items-center gap-2">
          {pc.energy_archetype_label && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#222', color: '#aaa', border: '1px solid #333' }}>
              {pc.energy_archetype_label}
            </span>
          )}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${scoreColor}20`, color: scoreColor }}>
            {ballScore}/100
          </span>
        </div>
      </div>

      {/* Compensation badge */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
          style={{
            background: pc.primary_compensation === 'HEALTHY' ? '#4ecdc420' : '#ff6b6b20',
            color: pc.primary_compensation === 'HEALTHY' ? '#4ecdc4' : '#ff6b6b',
          }}>
          {COMP_LABELS[pc.primary_compensation] ?? pc.primary_compensation}
        </span>
        <span className="text-[10px]" style={{ color: '#555' }}>
          {pc.confidence} confidence
        </span>
      </div>

      {/* Tendency bars */}
      <div className="space-y-1.5">
        {[
          { label: 'Line Drive', value: pc.tendencies.line_drive },
          { label: 'Ground Ball', value: pc.tendencies.ground_ball },
          { label: 'Fly Ball', value: pc.tendencies.fly_ball },
          { label: 'Pop-up Risk', value: pc.tendencies.pop_up_risk },
          { label: 'Hard Hit', value: pc.tendencies.hard_hit_potential },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: '#888' }}>{row.label}</span>
            <span className="text-[11px] font-semibold"
              style={{ color: TENDENCY_COLOR[row.value] ?? '#888' }}>
              {row.value.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* Direction + sweet spot */}
      <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid #222' }}>
        <span className="text-[11px]" style={{ color: '#888' }}>Direction</span>
        <span className="text-[11px] font-semibold" style={{ color: '#ccc' }}>
          {DIR_LABELS[pc.tendencies.direction] ?? pc.tendencies.direction}
        </span>
      </div>

      {/* Plane length */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full" style={{ background: '#222' }}>
          <div className="h-1.5 rounded-full" style={{
            width: `${pc.plane_length_pct}%`,
            background: pc.plane_length_pct >= 70 ? '#4ecdc4' : pc.plane_length_pct >= 40 ? '#ffa500' : '#ff6b6b',
          }} />
        </div>
        <span className="text-[10px]" style={{ color: '#555' }}>
          {pc.plane_length_pct}% zone coverage
        </span>
      </div>

      {/* Calibration anchors */}
      {pc.calibration?.is_calibrated && (
        <div className="space-y-1 pt-1" style={{ borderTop: '1px solid #222' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#3b82f6' }}>
            Calibrated
          </p>
          {pc.calibration.anchors?.bat_speed && (
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: '#888' }}>Bat Speed</span>
              <span className="text-[11px] font-semibold" style={{ color: '#ccc' }}>
                {pc.calibration.anchors.bat_speed.known_value} mph
                {pc.calibration.anchors.bat_speed.known_percentile && (
                  <span className="text-[10px] ml-1" style={{ color: '#555' }}>
                    ({pc.calibration.anchors.bat_speed.known_percentile}th pctl)
                  </span>
                )}
              </span>
            </div>
          )}
          {pc.calibration.anchors?.exit_velo && (
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: '#888' }}>Exit Velo</span>
              <span className="text-[11px] font-semibold" style={{ color: '#ccc' }}>
                {pc.calibration.anchors.exit_velo.known_value} mph
                {pc.calibration.anchors.exit_velo.known_percentile && (
                  <span className="text-[10px] ml-1" style={{ color: '#555' }}>
                    ({pc.calibration.anchors.exit_velo.known_percentile}th pctl)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Player message */}
      {pc.player_message && (
        <p className="text-[11px] leading-relaxed" style={{ color: '#888' }}>
          {pc.player_message}
        </p>
      )}

      {/* Footer label */}
      <p className="text-[10px] italic" style={{ color: '#444' }}>
        {pc.calibration?.is_calibrated
          ? 'Calibrated — anchored to your known metrics.'
          : 'Predicted — not measured. Based on how your energy chain delivers.'}
      </p>
    </div>
  );
}
