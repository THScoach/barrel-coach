import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bluetooth, Calendar, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface PlayerDKSessionsTabProps {
  playersTableId: string | null | undefined;
}

export function PlayerDKSessionsTab({ playersTableId }: PlayerDKSessionsTabProps) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['dk-sessions', playersTableId],
    queryFn: async () => {
      if (!playersTableId) return [];
      const { data, error } = await supabase
        .from('sensor_sessions')
        .select('id, session_date, total_swings, bat_speed_avg, attack_angle_avg, four_b_bat, environment, created_at')
        .eq('player_id', playersTableId)
        .order('session_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!playersTableId,
  });

  // Fetch all-time swing averages
  const { data: allTimeStats } = useQuery({
    queryKey: ['dk-all-time', playersTableId],
    queryFn: async () => {
      if (!playersTableId) return null;
      const { data: swings } = await supabase
        .from('sensor_swings')
        .select('bat_speed_mph, attack_angle_deg, on_plane_pct')
        .eq('player_id', playersTableId)
        .eq('is_valid', true);

      if (!swings?.length) return null;
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      return {
        batSpeed: avg(swings.map(s => s.bat_speed_mph).filter(Boolean) as number[]),
        attackAngle: avg(swings.map(s => s.attack_angle_deg).filter(v => v != null) as number[]),
        onPlane: avg(swings.map(s => s.on_plane_pct).filter(v => v != null) as number[]),
        totalSwings: swings.length,
      };
    },
    enabled: !!playersTableId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card className="bg-slate-900/80 border-slate-800">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Bluetooth className="h-12 w-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-1">No DK Sessions</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            This player hasn't uploaded any Diamond Kinetics data yet. Send them a setup link from the header badge.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sparkline data (last 5 sessions, ascending for chart)
  const sparklineSessions = sessions.slice(0, 5).reverse();
  const batSpeedSpark = sparklineSessions.map(s => ({ v: s.bat_speed_avg ?? 0 }));
  const attackAngleSpark = sparklineSessions.map(s => ({ v: s.attack_angle_avg ?? 0 }));

  return (
    <div className="space-y-4">
      {/* All-time Summary */}
      {allTimeStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Avg Bat Speed', value: allTimeStats.batSpeed != null ? `${allTimeStats.batSpeed.toFixed(1)} mph` : '—', color: 'text-red-400' },
            { label: 'Avg Attack Angle', value: allTimeStats.attackAngle != null ? `${allTimeStats.attackAngle > 0 ? '+' : ''}${allTimeStats.attackAngle.toFixed(1)}°` : '—', color: 'text-amber-400' },
            { label: 'Avg On Plane %', value: allTimeStats.onPlane != null ? `${Math.round(allTimeStats.onPlane)}%` : '—', color: 'text-blue-400' },
            { label: 'Total Sessions', value: `${sessions.length}`, color: 'text-slate-300' },
            { label: 'Total Swings', value: `${allTimeStats.totalSwings}`, color: 'text-slate-300' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sparklines */}
      {sessions.length >= 2 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Bat Speed (last 5)</p>
            <ResponsiveContainer width="100%" height={40}>
              <LineChart data={batSpeedSpark}>
                <Line type="monotone" dataKey="v" stroke="#f87171" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Attack Angle (last 5)</p>
            <ResponsiveContainer width="100%" height={40}>
              <LineChart data={attackAngleSpark}>
                <Line type="monotone" dataKey="v" stroke="#fbbf24" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          DK Sessions ({sessions.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider pb-3 pr-4">Date</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider pb-3 pr-4">Source</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider pb-3 pr-4">Swings</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider pb-3 pr-4">Avg Bat Speed</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider pb-3 pr-4">Avg Attack Angle</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider pb-3">BAT Score</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-sm text-slate-300">
                      {format(new Date(session.session_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <Badge
                    variant="secondary"
                    className={
                      session.environment === 'manual_upload'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs'
                        : session.environment === 'auto_sync'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30 text-xs'
                          : 'bg-green-500/20 text-green-400 border-green-500/30 text-xs'
                    }
                  >
                    {session.environment === 'manual_upload' ? 'CSV' : session.environment === 'auto_sync' ? 'Auto-Sync' : 'OAuth'}
                  </Badge>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="text-sm text-slate-300 font-mono">{session.total_swings ?? '—'}</span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="text-sm text-slate-300 font-mono">
                    {session.bat_speed_avg != null ? `${session.bat_speed_avg.toFixed(1)} mph` : '—'}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="text-sm text-slate-300 font-mono">
                    {session.attack_angle_avg != null ? `${session.attack_angle_avg.toFixed(1)}°` : '—'}
                  </span>
                </td>
                <td className="py-3 text-right">
                  {session.four_b_bat != null ? (
                    <Badge className={`font-mono text-xs ${
                      session.four_b_bat >= 70 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      session.four_b_bat >= 50 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {session.four_b_bat.toFixed(0)}
                    </Badge>
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
