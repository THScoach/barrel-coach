import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Activity, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface SwingSnapshotCardProps {
  playerId: string;
}

interface SessionSnapshot {
  id: string;
  session_date: string;
  total_swings: number | null;
  bat_speed_avg: number | null;
  attack_angle_avg: number | null;
  environment: string | null;
}

interface SwingAverages {
  bat_speed: number | null;
  attack_angle: number | null;
  on_plane: number | null;
  hand_speed: number | null;
}

function computeAverages(swings: any[]): SwingAverages {
  if (!swings.length) return { bat_speed: null, attack_angle: null, on_plane: null, hand_speed: null };
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return {
    bat_speed: avg(swings.map(s => s.bat_speed_mph).filter(Boolean)),
    attack_angle: avg(swings.map(s => s.attack_angle_deg).filter(v => v != null)),
    on_plane: avg(swings.map(s => s.on_plane_pct).filter(v => v != null)),
    hand_speed: avg(swings.map(s => s.hand_speed_mph).filter(Boolean)),
  };
}

function TrendArrow({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 1) return <Minus className="h-3 w-3 text-slate-500" />;
  if (diff > 0) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  return <TrendingDown className="h-3 w-3 text-red-400" />;
}

export function SwingSnapshotCard({ playerId }: SwingSnapshotCardProps) {
  // Fetch latest 2 sessions for trends
  const { data } = useQuery({
    queryKey: ['swing-snapshot', playerId],
    queryFn: async () => {
      const { data: sessions } = await supabase
        .from('sensor_sessions')
        .select('id, session_date, total_swings, bat_speed_avg, attack_angle_avg, environment')
        .eq('player_id', playerId)
        .order('session_date', { ascending: false })
        .limit(2);

      if (!sessions?.length) return null;

      const latest = sessions[0];
      const previous = sessions[1] || null;

      // Get swing-level averages for latest session
      const { data: latestSwings } = await supabase
        .from('sensor_swings')
        .select('bat_speed_mph, attack_angle_deg, on_plane_pct, hand_speed_mph')
        .eq('session_id', latest.id)
        .eq('is_valid', true);

      let prevAvgs: SwingAverages = { bat_speed: null, attack_angle: null, on_plane: null, hand_speed: null };
      if (previous) {
        const { data: prevSwings } = await supabase
          .from('sensor_swings')
          .select('bat_speed_mph, attack_angle_deg, on_plane_pct, hand_speed_mph')
          .eq('session_id', previous.id)
          .eq('is_valid', true);
        prevAvgs = computeAverages(prevSwings || []);
      }

      return {
        session: latest as SessionSnapshot,
        averages: computeAverages(latestSwings || []),
        previousAverages: prevAvgs,
      };
    },
    enabled: !!playerId,
  });

  if (!data) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="py-6 text-center">
          <Activity className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No swing data yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            Your coach will sync your Diamond Kinetics sessions automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { session, averages, previousAverages } = data;
  const metrics = [
    {
      label: 'Bat Speed',
      value: averages.bat_speed != null ? `${averages.bat_speed.toFixed(1)} mph` : '—',
      color: 'text-red-400',
      dot: 'bg-red-400',
      current: averages.bat_speed,
      prev: previousAverages.bat_speed,
    },
    {
      label: 'Attack Angle',
      value: averages.attack_angle != null ? `${averages.attack_angle > 0 ? '+' : ''}${averages.attack_angle.toFixed(1)}°` : '—',
      color: 'text-amber-400',
      dot: 'bg-amber-400',
      current: averages.attack_angle,
      prev: previousAverages.attack_angle,
    },
    {
      label: 'On Plane %',
      value: averages.on_plane != null ? `${Math.round(averages.on_plane)}%` : '—',
      color: 'text-blue-400',
      dot: 'bg-blue-400',
      current: averages.on_plane,
      prev: previousAverages.on_plane,
    },
    {
      label: 'Hand Speed',
      value: averages.hand_speed != null ? `${averages.hand_speed.toFixed(1)} mph` : '—',
      color: 'text-slate-300',
      dot: 'bg-slate-400',
      current: averages.hand_speed,
      prev: previousAverages.hand_speed,
    },
  ];

  return (
    <Link to="/player/swings" className="block">
      <Card className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 transition-all">
        <CardContent className="py-4 px-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Swing Data</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {format(new Date(session.session_date), 'MMM d')} · {session.total_swings ?? 0} swings
              </span>
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {metrics.map(m => (
              <div key={m.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                  <span className="text-xs text-slate-400">{m.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-sm font-semibold ${m.color}`}>{m.value}</span>
                  <TrendArrow current={m.current} previous={m.prev} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
