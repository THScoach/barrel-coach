import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WeaponMetrics, calculateWeaponMetrics } from '@/lib/weapon-metrics';
import { SessionMetrics } from '@/components/sensor/WeaponPanelTrend';

interface UseWeaponMetricsTrendOptions {
  playerId?: string | null;
  sessionLimit?: number;
}

interface UseWeaponMetricsTrendResult {
  sessions: SessionMetrics[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWeaponMetricsTrend({
  playerId,
  sessionLimit = 10,
}: UseWeaponMetricsTrendOptions): UseWeaponMetricsTrendResult {
  const [sessions, setSessions] = useState<SessionMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async () => {
    if (!playerId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get distinct sessions with their swings
      const { data: sessionData, error: sessionError } = await supabase
        .from('sensor_sessions')
        .select('id, created_at')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(sessionLimit);

      if (sessionError) throw sessionError;

      if (!sessionData || sessionData.length === 0) {
        setSessions([]);
        setIsLoading(false);
        return;
      }

      // For each session, get swings and calculate metrics
      const sessionMetrics: SessionMetrics[] = [];

      for (const session of sessionData) {
        const { data: swings, error: swingError } = await supabase
          .from('sensor_swings')
          .select(`
            bat_speed_mph,
            hand_speed_mph,
            attack_angle_deg,
            swing_plane_tilt_deg,
            impact_location_x,
            impact_location_y,
            applied_power,
            hand_to_bat_ratio
          `)
          .eq('session_id', session.id)
          .eq('is_valid', true);

        if (swingError) {
          console.warn(`Error fetching swings for session ${session.id}:`, swingError);
          continue;
        }

        if (swings && swings.length > 0) {
          const metrics = calculateWeaponMetrics(swings);
          sessionMetrics.push({
            date: session.created_at,
            sessionId: session.id,
            metrics,
          });
        }
      }

      setSessions(sessionMetrics);
    } catch (err: any) {
      console.error('Error fetching weapon metrics trend:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [playerId, sessionLimit]);

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchTrends,
  };
}
