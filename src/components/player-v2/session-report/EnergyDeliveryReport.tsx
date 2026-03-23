import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EnergyProductionCard } from './EnergyProductionCard';
import { EnergySequenceCard } from './EnergySequenceCard';
import { EnergyDirectionCard } from './EnergyDirectionCard';
import { CoachBarrelsTake } from './CoachBarrelsTake';
import { NextStepCard } from './NextStepCard';
import { PredictedContactCard } from './PredictedContactCard';
import { EnergyShapeVisual } from './EnergyShapeVisual';
import { RawMetrics, KRSData, BaselineMetrics, getPelvisKE, getArmsKEPct } from './types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  sessionId: string;
  playerId: string;
  rawMetrics: RawMetrics;
  /** Existing 3D metrics JSX to collapse into Full Metrics */
  existingMetricsContent?: React.ReactNode;
  isAdmin?: boolean;
}

export function EnergyDeliveryReport({ sessionId, playerId, rawMetrics, existingMetricsContent, isAdmin = false }: Props) {
  const [krsData, setKrsData] = useState<KRSData | null>(null);
  const [baseline, setBaseline] = useState<BaselineMetrics>({ pelvisKE: null, armsKEPct: null, totalKE: null });
  const [metricsOpen, setMetricsOpen] = useState(isAdmin);

  useEffect(() => {
    // Fetch KRS data
    supabase
      .from('hitting_4b_krs_sessions')
      .select('coach_barrels_voice_sample, summary_player_text, summary_coach_text, main_constraint, weakest_b, focus_next_bp, recommended_drills, coach_barrels_prescription')
      .eq('player_session_id', sessionId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setKrsData(data as KRSData);
      });

    // Fetch baseline (earliest scored session for this player)
    supabase
      .from('player_sessions')
      .select('raw_metrics')
      .eq('player_id', playerId)
      .eq('scoreable', true)
      .not('body_score', 'is', null)
      .order('session_date', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.raw_metrics && typeof data.raw_metrics === 'object') {
          const m = data.raw_metrics as RawMetrics;
          setBaseline({
            pelvisKE: getPelvisKE(m).value,
            armsKEPct: getArmsKEPct(m).value,
            totalKE: m.avgTotalKE ?? null,
          });
        }
      });
  }, [sessionId, playerId]);

  // Detect TKE shape from raw_metrics or story
  const tkeShape = rawMetrics.tke_shape;

  return (
    <div className="space-y-4">
      {/* Energy Delivery Cards */}
      <EnergyProductionCard metrics={rawMetrics} baselinePelvisKE={baseline.pelvisKE} />
      <EnergySequenceCard metrics={rawMetrics} />
      <EnergyDirectionCard metrics={rawMetrics} baselineArmsKEPct={baseline.armsKEPct} />

      {/* Coach Barrels Take */}
      <CoachBarrelsTake metrics={rawMetrics} krsData={krsData} />

      {/* Next Step */}
      <NextStepCard metrics={rawMetrics} krsData={krsData} />

      {/* Energy Shape */}
      <EnergyShapeVisual tkeShape={tkeShape} />

      {/* Full Metrics (collapsible) */}
      {existingMetricsContent && (
        <div>
          <button
            onClick={() => setMetricsOpen(!metricsOpen)}
            className="w-full flex items-center justify-between rounded-lg px-4 py-3"
            style={{ background: '#111', border: '1px solid #222' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#555' }}>
              Full Metrics
            </span>
            {metricsOpen ? (
              <ChevronUp className="h-4 w-4" style={{ color: '#555' }} />
            ) : (
              <ChevronDown className="h-4 w-4" style={{ color: '#555' }} />
            )}
          </button>
          {metricsOpen && (
            <div className="mt-2">{existingMetricsContent}</div>
          )}
        </div>
      )}
    </div>
  );
}
