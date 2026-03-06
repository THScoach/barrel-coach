import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';

interface NewSessionFormProps {
  playerId: string;
  heightInches?: number | null;
  weightLbs?: number | null;
  onComplete: () => void;
  onCancel: () => void;
}

const FIELDS = [
  { key: 'com_drift_inches', label: 'COM Drift (inches)', required: true },
  { key: 'pelvis_peak_deg_s', label: 'Pelvis Peak (°/s)', required: true },
  { key: 'trunk_variability_cv', label: 'Trunk CV (%)', required: true },
  { key: 'trunk_frontal_change_deg', label: 'Trunk Frontal Δ (°)', required: true },
  { key: 'trunk_lateral_change_deg', label: 'Trunk Lateral Δ (°)', required: true },
  { key: 'pelvis_torso_gap_ms', label: 'Pelvis-Torso Gap (ms)', required: true },
  { key: 'pelvis_torso_gain', label: 'Pelvis-Torso Gain', required: true },
  { key: 'torso_arm_gain', label: 'Torso-Arm Gain', required: true },
  { key: 'arm_bat_gain', label: 'Arm-Bat Gain', required: true },
  { key: 'arm_variability_cv', label: 'Arm CV (%)', required: true },
  { key: 'exit_velocity_max', label: 'EV Max (mph)', required: true },
  { key: 'exit_velocity_min', label: 'EV Min (mph)', required: true },
  { key: 'height_inches', label: 'Height (inches)', required: false },
  { key: 'weight_lbs', label: 'Weight (lbs)', required: false },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

export default function NewSessionForm({ playerId, heightInches, weightLbs, onComplete, onCancel }: NewSessionFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FIELDS) init[f.key] = '';
    if (heightInches) init.height_inches = String(heightInches);
    if (weightLbs) init.weight_lbs = String(weightLbs);
    return init;
  });
  const [submitting, setSubmitting] = useState(false);

  const setValue = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    for (const f of FIELDS) {
      if (f.required && !values[f.key]?.trim()) {
        toast.error(`${f.label} is required`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const numVal = (key: FieldKey) => {
        const v = values[key]?.trim();
        return v ? parseFloat(v) : null;
      };

      // 1. Insert into reboot_swing_sessions
      const { data: session, error: insertErr } = await supabase
        .from('reboot_swing_sessions' as any)
        .insert({
          player_id: playerId,
          session_date: new Date().toISOString().split('T')[0],
          swing_count: 1,
          com_drift_inches: numVal('com_drift_inches'),
          com_velocity_mps: 0,
          pelvis_peak_deg_s: numVal('pelvis_peak_deg_s'),
          trunk_variability_cv: numVal('trunk_variability_cv'),
          trunk_frontal_change_deg: numVal('trunk_frontal_change_deg'),
          trunk_lateral_change_deg: numVal('trunk_lateral_change_deg'),
          pelvis_torso_gap_ms: numVal('pelvis_torso_gap_ms'),
          pelvis_torso_gain: numVal('pelvis_torso_gain'),
          torso_arm_gain: numVal('torso_arm_gain'),
          arm_bat_gain: numVal('arm_bat_gain'),
          arm_variability_cv: numVal('arm_variability_cv'),
          exit_velocity_max: numVal('exit_velocity_max'),
          exit_velocity_min: numVal('exit_velocity_min'),
          height_inches: numVal('height_inches'),
          weight_lbs: numVal('weight_lbs'),
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      // 2. Call generate-swing-report edge function
      const { error: fnErr } = await supabase.functions.invoke('generate-swing-report', {
        body: { session_id: (session as any).id },
      });

      if (fnErr) throw fnErr;

      toast.success('Report generated!');
      onComplete();
    } catch (err: any) {
      console.error('[NewSessionForm] Error:', err);
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">New Session (Manual Entry)</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Temporary form — CSV import and Reboot API integration coming soon.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="text-xs text-slate-400">
                {f.label}
                {!f.required && <span className="text-slate-600 ml-1">(optional)</span>}
              </Label>
              <Input
                type="number"
                step="any"
                value={values[f.key]}
                onChange={(e) => setValue(f.key, e.target.value)}
                className="bg-slate-800 border-slate-700 text-white mt-1 h-9 text-sm"
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onCancel} className="border-slate-700 text-slate-300">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#E63946] hover:bg-[#E63946]/90 text-white font-bold"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {submitting ? 'Generating…' : 'Generate Report'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
