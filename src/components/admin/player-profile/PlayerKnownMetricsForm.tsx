/**
 * PlayerKnownMetricsForm — Admin form to manually enter known player metrics
 * (bat speed, exit velo, sweet spot %) with source and date.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  playerId: string;
}

interface KnownMetric {
  id: string;
  metric_type: string;
  value: number;
  source: string;
  recorded_date: string | null;
  percentile: number | null;
  created_at: string;
}

const METRIC_TYPES = [
  { value: 'bat_speed_mph', label: 'Bat Speed (mph)' },
  { value: 'exit_velo_mph', label: 'Exit Velocity (mph)' },
  { value: 'sweet_spot_pct', label: 'Sweet Spot %' },
];

const SOURCES = ['omar', 'hittrax', 'statcast', 'diamond_kinetics', 'manual'];

export function PlayerKnownMetricsForm({ playerId }: Props) {
  const [metrics, setMetrics] = useState<KnownMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [metricType, setMetricType] = useState('bat_speed_mph');
  const [value, setValue] = useState('');
  const [source, setSource] = useState('manual');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [percentile, setPercentile] = useState('');

  const fetchMetrics = async () => {
    const { data } = await supabase
      .from('player_known_metrics')
      .select('*')
      .eq('player_id', playerId)
      .order('recorded_date', { ascending: false });
    if (data) setMetrics(data as unknown as KnownMetric[]);
    setLoading(false);
  };

  useEffect(() => { fetchMetrics(); }, [playerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) {
      toast.error('Enter a value before adding');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from('player_known_metrics')
      .insert({
        player_id: playerId,
        metric_type: metricType,
        value: parseFloat(value),
        source,
        recorded_date: date || null,
        percentile: percentile ? parseInt(percentile) : null,
      } as any);

    if (error) {
      toast.error('Failed to save metric');
      console.error(error);
    } else {
      toast.success('Known metric saved');
      setValue('');
      setPercentile('');
      fetchMetrics();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('player_known_metrics')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      setMetrics(prev => prev.filter(m => m.id !== id));
    }
  };

  const inputClass = 'bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#4ecdc4]';

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #222' }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
        Known Metrics (Calibration Anchors)
      </p>

      {/* Entry form */}
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-500">Metric</label>
          <select value={metricType} onChange={e => setMetricType(e.target.value)} className={inputClass}>
            {METRIC_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-500">Value</label>
          <input
            type="number"
            step="0.1"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="68.2"
            required
            className={`${inputClass} w-20`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-500">Source</label>
          <select value={source} onChange={e => setSource(e.target.value)} className={inputClass}>
            {SOURCES.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-500">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={`${inputClass} w-32`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-500">Percentile</label>
          <input
            type="number"
            min="1"
            max="99"
            value={percentile}
            onChange={e => setPercentile(e.target.value)}
            placeholder="—"
            className={`${inputClass} w-16`}
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !value}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold text-black disabled:opacity-50"
          style={{ background: '#4ecdc4' }}
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add
        </button>
      </form>

      {/* Existing metrics list */}
      {loading ? (
        <p className="text-xs text-gray-600">Loading…</p>
      ) : metrics.length === 0 ? (
        <p className="text-xs text-gray-600 italic">No known metrics yet. Add bat speed, exit velo, or sweet spot data to calibrate predictions.</p>
      ) : (
        <div className="space-y-1">
          {metrics.map(m => (
            <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded" style={{ background: '#1a1a1a' }}>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-white">
                  {METRIC_TYPES.find(t => t.value === m.metric_type)?.label ?? m.metric_type}
                </span>
                <span className="text-[11px] font-bold" style={{ color: '#4ecdc4' }}>
                  {m.value}
                </span>
                {m.percentile && (
                  <span className="text-[10px] text-gray-500">{m.percentile}th pctl</span>
                )}
                <span className="text-[10px] text-gray-600">{m.source}</span>
                {m.recorded_date && (
                  <span className="text-[10px] text-gray-600">{m.recorded_date}</span>
                )}
              </div>
              <button onClick={() => handleDelete(m.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
