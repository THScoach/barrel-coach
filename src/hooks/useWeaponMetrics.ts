import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WeaponMetrics, calculateWeaponMetrics } from '@/lib/weapon-metrics';

interface UseWeaponMetricsOptions {
  playerId?: string | null;
  sessionId?: string | null;
  limit?: number;
}

interface UseWeaponMetricsResult {
  metrics: WeaponMetrics;
  isLoading: boolean;
  error: string | null;
  swingCount: number;
  refetch: () => Promise<void>;
}

export function useWeaponMetrics({
  playerId,
  sessionId,
  limit = 50,
}: UseWeaponMetricsOptions): UseWeaponMetricsResult {
  const [metrics, setMetrics] = useState<WeaponMetrics>({
    wipIndex: null,
    planeIntegrity: null,
    squareUpConsistency: null,
    impactMomentum: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swingCount, setSwingCount] = useState(0);

  const fetchMetrics = async () => {
    if (!playerId && !sessionId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
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
        .eq('is_valid', true)
        .order('occurred_at', { ascending: false })
        .limit(limit);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      } else if (playerId) {
        query = query.eq('player_id', playerId);
      }

      const { data: swings, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (swings && swings.length > 0) {
        const calculatedMetrics = calculateWeaponMetrics(swings);
        setMetrics(calculatedMetrics);
        setSwingCount(swings.length);
      } else {
        setMetrics({
          wipIndex: null,
          planeIntegrity: null,
          squareUpConsistency: null,
          impactMomentum: null,
        });
        setSwingCount(0);
      }
    } catch (err: any) {
      console.error('Error fetching weapon metrics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [playerId, sessionId, limit]);

  return {
    metrics,
    isLoading,
    error,
    swingCount,
    refetch: fetchMetrics,
  };
}
