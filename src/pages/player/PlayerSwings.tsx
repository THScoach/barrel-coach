import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface SessionRow {
  id: string;
  session_date: string;
  total_swings: number | null;
  bat_speed_avg: number | null;
  attack_angle_avg: number | null;
  environment: string | null;
}

export default function PlayerSwings() {
  const navigate = useNavigate();
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data } = await supabase
        .from('players')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      if (data) setPlayerId(data.id);
    })();
  }, []);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['player-dk-sessions', playerId],
    queryFn: async () => {
      if (!playerId) return [];
      // Get sessions
      const { data: sessionsData, error } = await supabase
        .from('sensor_sessions')
        .select('id, session_date, total_swings, bat_speed_avg, attack_angle_avg, environment')
        .eq('player_id', playerId)
        .order('session_date', { ascending: false });
      if (error) throw error;

      // For each session, get on_plane_pct avg from swings
      const enriched = await Promise.all(
        (sessionsData || []).map(async (s) => {
          const { data: swings } = await supabase
            .from('sensor_swings')
            .select('on_plane_pct')
            .eq('session_id', s.id)
            .eq('is_valid', true);
          const vals = (swings || []).map(sw => sw.on_plane_pct).filter(v => v != null) as number[];
          const onPlaneAvg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          return { ...s, on_plane_avg: onPlaneAvg };
        })
      );
      return enriched;
    },
    enabled: !!playerId,
  });

  if (isLoading || !playerId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 md:ml-56">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-bold text-white">Swing Data</h1>
        </div>

        {(!sessions || sessions.length === 0) ? (
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="py-12 text-center">
              <Activity className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No swing sessions yet.</p>
              <p className="text-xs text-slate-500 mt-1">
                Your coach will sync your Diamond Kinetics data automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => navigate(`/player/swings/${session.id}`)}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-all text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-white">
                      {format(new Date(session.session_date), 'MMM d, yyyy')}
                    </span>
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
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>{session.total_swings ?? 0} swings</span>
                    {session.bat_speed_avg != null && (
                      <span className="text-red-400">{session.bat_speed_avg.toFixed(1)} mph</span>
                    )}
                    {session.attack_angle_avg != null && (
                      <span className="text-amber-400">
                        {session.attack_angle_avg > 0 ? '+' : ''}{session.attack_angle_avg.toFixed(1)}°
                      </span>
                    )}
                    {session.on_plane_avg != null && (
                      <span className="text-blue-400">{Math.round(session.on_plane_avg)}%</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
