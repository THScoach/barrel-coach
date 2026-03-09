import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function PlayerSwingDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['swing-detail', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;

      const [sessionRes, swingsRes] = await Promise.all([
        supabase
          .from('sensor_sessions')
          .select('id, session_date, total_swings, environment')
          .eq('id', sessionId)
          .single(),
        supabase
          .from('sensor_swings')
          .select('swing_number, bat_speed_mph, attack_angle_deg, on_plane_pct, hand_speed_mph, trigger_to_impact_ms, vertical_bat_angle')
          .eq('session_id', sessionId)
          .eq('is_valid', true)
          .order('swing_number', { ascending: true }),
      ]);

      if (sessionRes.error) throw sessionRes.error;
      return {
        session: sessionRes.data,
        swings: swingsRes.data || [],
      };
    },
    enabled: !!sessionId,
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  const { session, swings } = data;
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const batSpeeds = swings.map(s => s.bat_speed_mph).filter(Boolean) as number[];
  const attackAngles = swings.map(s => s.attack_angle_deg).filter(v => v != null) as number[];
  const onPlanes = swings.map(s => s.on_plane_pct).filter(v => v != null) as number[];
  const handSpeeds = swings.map(s => s.hand_speed_mph).filter(Boolean) as number[];
  const triggers = swings.map(s => s.trigger_to_impact_ms).filter(v => v != null) as number[];

  const avgBatSpeed = avg(batSpeeds);
  const avgAttackAngle = avg(attackAngles);
  const avgOnPlane = avg(onPlanes);
  const avgHandSpeed = avg(handSpeeds);
  const avgTrigger = avg(triggers);

  // Bat speed distribution
  const buckets = [
    { range: '<60', min: 0, max: 60 },
    { range: '60-65', min: 60, max: 65 },
    { range: '65-70', min: 65, max: 70 },
    { range: '70-75', min: 70, max: 75 },
    { range: '75-80', min: 75, max: 80 },
    { range: '80+', min: 80, max: 999 },
  ];

  const distribution = buckets.map(b => ({
    range: b.range,
    count: batSpeeds.filter(v => v >= b.min && v < b.max).length,
  })).filter(b => b.count > 0 || batSpeeds.length > 0);

  const summaryMetrics = [
    { label: 'Bat Speed', value: avgBatSpeed != null ? `${avgBatSpeed.toFixed(1)} mph` : '—', color: 'text-red-400' },
    { label: 'Attack Angle', value: avgAttackAngle != null ? `${avgAttackAngle > 0 ? '+' : ''}${avgAttackAngle.toFixed(1)}°` : '—', color: 'text-amber-400' },
    { label: 'On Plane %', value: avgOnPlane != null ? `${Math.round(avgOnPlane)}%` : '—', color: 'text-blue-400' },
    { label: 'Hand Speed', value: avgHandSpeed != null ? `${avgHandSpeed.toFixed(1)} mph` : '—', color: 'text-slate-300' },
    { label: 'Trigger→Impact', value: avgTrigger != null ? `${Math.round(avgTrigger)} ms` : '—', color: 'text-purple-400' },
  ];

  const barColors = ['#64748b', '#64748b', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

  return (
    <div className="min-h-screen bg-slate-950 md:ml-56">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/player/swings')} className="text-slate-400">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-white">
              {format(new Date(session.session_date), 'MMMM d, yyyy')}
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{session.total_swings ?? swings.length} swings</span>
              <Badge
                className={`text-[10px] px-1.5 py-0 ${
                  session.environment === 'auto_sync'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}
              >
                {session.environment === 'auto_sync' ? 'Auto-Sync' : 'CSV'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Summary Row */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="py-4 px-4">
            <div className="flex flex-wrap gap-4 justify-between">
              {summaryMetrics.map(m => (
                <div key={m.label} className="text-center min-w-[60px]">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</p>
                  <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bat Speed Distribution */}
        {batSpeeds.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="py-4 px-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Bat Speed Distribution
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={distribution} barCategoryGap="20%">
                  <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distribution.map((_, i) => (
                      <Cell key={i} fill={barColors[Math.min(i, barColors.length - 1)]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Swings Table */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="py-4 px-0">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 px-4">
              All Swings
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    {['#', 'Bat Spd', 'Angle', 'On Plane', 'Hand Spd', 'Trigger', 'VBA'].map(h => (
                      <th key={h} className="text-left font-medium text-slate-500 pb-2 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {swings.map((swing, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                      <td className="py-2 px-3 text-slate-400">{swing.swing_number ?? i + 1}</td>
                      <td className="py-2 px-3 text-red-400 font-mono">
                        {swing.bat_speed_mph != null ? `${swing.bat_speed_mph.toFixed(1)}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-amber-400 font-mono">
                        {swing.attack_angle_deg != null ? `${swing.attack_angle_deg > 0 ? '+' : ''}${swing.attack_angle_deg.toFixed(1)}°` : '—'}
                      </td>
                      <td className="py-2 px-3 text-blue-400 font-mono">
                        {swing.on_plane_pct != null ? `${Math.round(swing.on_plane_pct)}%` : '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-300 font-mono">
                        {swing.hand_speed_mph != null ? `${swing.hand_speed_mph.toFixed(1)}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-purple-400 font-mono">
                        {swing.trigger_to_impact_ms != null ? `${Math.round(swing.trigger_to_impact_ms)}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono">
                        {swing.vertical_bat_angle != null ? `${swing.vertical_bat_angle.toFixed(1)}°` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
