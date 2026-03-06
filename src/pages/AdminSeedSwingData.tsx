import { useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Check, Zap } from 'lucide-react';
import { generateFullReport, type SessionMetrics } from '@/lib/swing/scoring-engine';

const TEST_PLAYERS = [
  {
    name: 'Beckett Walters',
    height_inches: 69,
    weight_lbs: 135,
    metrics: {
      com_drift_inches: 10.5,
      com_velocity_mps: 2.17,
      pelvis_peak_deg_s: 453,
      trunk_variability_cv: 26.9,
      trunk_frontal_change_deg: 9.8,
      trunk_lateral_change_deg: 7.7,
      pelvis_torso_gap_ms: -2.4,
      pelvis_torso_gain: 1.38,
      torso_arm_gain: 1.26,
      arm_bat_gain: 0.85,
      arm_variability_cv: 4.9,
      exit_velocity_max: 87,
      exit_velocity_min: 73,
    },
    expected: {
      archetype: 'Glider-Spinner',
      platformScore: 46,
      swingWindow: 53,
      rootIssue: 'Glide',
    },
  },
  {
    name: 'Weston Wilson',
    height_inches: 75,
    weight_lbs: 217,
    metrics: {
      com_drift_inches: 12.4,
      com_velocity_mps: 4.73,
      pelvis_peak_deg_s: 788,
      trunk_variability_cv: 15.0,
      trunk_frontal_change_deg: 2.4,
      trunk_lateral_change_deg: 3.7,
      pelvis_torso_gap_ms: 8.3,
      pelvis_torso_gain: 1.15,
      torso_arm_gain: 1.31,
      arm_bat_gain: 1.41,
      arm_variability_cv: 12.0,
      exit_velocity_max: 109,
      exit_velocity_min: 89.6,
    },
    expected: {
      archetype: 'Trapped Tilt Whipper',
      platformScore: 40,
      swingWindow: 68,
      rootIssue: 'Glide',
    },
  },
];

type LogEntry = { text: string; status: 'info' | 'success' | 'error' | 'verify' };

export default function AdminSeedSwingData() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const log = (text: string, status: LogEntry['status'] = 'info') => {
    setLogs((prev) => [...prev, { text, status }]);
  };

  const handleSeed = async () => {
    setRunning(true);
    setLogs([]);

    for (const player of TEST_PLAYERS) {
      log(`── ${player.name} ──`);

      // 1. Find or create player
      log(`Looking up player "${player.name}"…`);
      let { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('name', player.name)
        .limit(1)
        .maybeSingle();

      let playerId: string;

      if (existing) {
        playerId = existing.id;
        log(`Found existing player: ${playerId}`, 'success');
        // Update height/weight
        await supabase
          .from('players')
          .update({ height_inches: player.height_inches, weight_lbs: player.weight_lbs })
          .eq('id', playerId);
      } else {
        log(`Creating player…`);
        const { data: created, error: createErr } = await supabase
          .from('players')
          .insert({
            name: player.name,
            height_inches: player.height_inches,
            weight_lbs: player.weight_lbs,
            account_status: 'active',
          })
          .select('id')
          .single();

        if (createErr) {
          log(`Failed to create player: ${createErr.message}`, 'error');
          continue;
        }
        playerId = created.id;
        log(`Created player: ${playerId}`, 'success');
      }

      // 2. Insert session into reboot_swing_sessions
      log(`Inserting session data…`);
      const { data: session, error: sessErr } = await supabase
        .from('reboot_swing_sessions' as any)
        .insert({
          player_id: playerId,
          session_date: new Date().toISOString().split('T')[0],
          swing_count: 10,
          height_inches: player.height_inches,
          weight_lbs: player.weight_lbs,
          ...player.metrics,
        })
        .select('id')
        .single();

      if (sessErr) {
        log(`Failed to insert session: ${sessErr.message}`, 'error');
        continue;
      }
      log(`Session created: ${(session as any).id}`, 'success');

      // 3. Verify scoring engine locally
      const fullMetrics: SessionMetrics = {
        ...player.metrics,
        height_inches: player.height_inches,
        weight_lbs: player.weight_lbs,
      };
      const localReport = generateFullReport(fullMetrics);
      log(`Local engine → Archetype: ${localReport.archetype}, Platform: ${localReport.scores.platformScore}, Window: ${localReport.scores.swingWindowScore}, Root: ${localReport.rootIssue}`, 'verify');

      const checks = [
        { label: 'Archetype', got: localReport.archetype, expected: player.expected.archetype },
        { label: 'Platform Score', got: localReport.scores.platformScore, expected: player.expected.platformScore },
        { label: 'Root Issue', got: localReport.rootIssue, expected: player.expected.rootIssue },
      ];

      for (const c of checks) {
        const match = String(c.got) === String(c.expected);
        log(`  ${c.label}: ${c.got} ${match ? '✓' : `✗ (expected ${c.expected})`}`, match ? 'success' : 'error');
      }

      // 4. Call edge function to generate and persist report
      log(`Calling generate-swing-report…`);
      const { data: reportData, error: fnErr } = await supabase.functions.invoke('generate-swing-report', {
        body: { session_id: (session as any).id },
      });

      if (fnErr) {
        log(`Edge function error: ${fnErr.message}`, 'error');
        continue;
      }

      log(`Report generated and saved! Score ID: ${reportData?.scoreId}`, 'success');
      log(`View at: /athletes/${playerId}`, 'success');
    }

    log('');
    log('🏁 Seed complete!', 'success');
    setRunning(false);
    toast.success('Test data seeded and reports generated');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header />
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-black text-white mb-2">Seed Test Data</h1>
        <p className="text-sm text-slate-400 mb-6">
          Creates two test players with session data, generates reports via the scoring engine, and verifies output.
        </p>

        <Card className="bg-slate-900/80 border-slate-800 mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              {TEST_PLAYERS.map((p) => (
                <div key={p.name} className="rounded-lg bg-slate-800/80 border border-slate-700/50 p-4">
                  <p className="text-sm font-bold text-white">{p.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {Math.floor(p.height_inches / 12)}'{p.height_inches % 12}" · {p.weight_lbs} lbs
                  </p>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[10px] text-slate-500">
                      Expected: <span className="text-white">{p.expected.archetype}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Platform: <span className="text-white">~{p.expected.platformScore}</span> · Window: <span className="text-white">~{p.expected.swingWindow}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Root: <span className="text-[#E63946]">{p.expected.rootIssue}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleSeed}
              disabled={running}
              className="w-full bg-[#E63946] hover:bg-[#E63946]/90 text-white font-bold"
            >
              {running ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {running ? 'Seeding…' : 'Seed Data & Generate Reports'}
            </Button>
          </CardContent>
        </Card>

        {/* Log Output */}
        {logs.length > 0 && (
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-4">
              <div className="font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
                {logs.map((entry, i) => (
                  <div
                    key={i}
                    className={
                      entry.status === 'success'
                        ? 'text-green-400'
                        : entry.status === 'error'
                        ? 'text-red-400'
                        : entry.status === 'verify'
                        ? 'text-blue-400'
                        : 'text-slate-400'
                    }
                  >
                    {entry.status === 'success' && <Check className="w-3 h-3 inline mr-1" />}
                    {entry.text}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
