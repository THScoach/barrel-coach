import { useState, useEffect, useCallback } from 'react';
import { 
  getPlayerScorecard, 
  PlayerScorecardData, 
  TimeWindow 
} from '@/lib/players/getPlayerScorecard';

interface UsePlayerScorecardReturn {
  data: PlayerScorecardData | null;
  loading: boolean;
  error: string | null;
  timeWindow: TimeWindow;
  setTimeWindow: (window: TimeWindow) => void;
  refresh: () => Promise<void>;
}

export function usePlayerScorecard(playerId: string | null): UsePlayerScorecardReturn {
  const [data, setData] = useState<PlayerScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('30');

  const loadData = useCallback(async () => {
    if (!playerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getPlayerScorecard(playerId, timeWindow);
      setData(result);
    } catch (err: any) {
      console.error('Error loading scorecard:', err);
      setError(err.message || 'Failed to load scorecard');
    } finally {
      setLoading(false);
    }
  }, [playerId, timeWindow]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTimeWindowChange = useCallback((window: TimeWindow) => {
    setTimeWindow(window);
  }, []);

  return {
    data,
    loading,
    error,
    timeWindow,
    setTimeWindow: handleTimeWindowChange,
    refresh: loadData,
  };
}
