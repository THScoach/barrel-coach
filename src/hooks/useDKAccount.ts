import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DKAccount {
  id: string;
  player_id: string;
  dk_user_id: string;
  dk_email: string | null;
  last_sync_at: string | null;
  sync_enabled: boolean;
  created_at: string;
}

interface UseDKAccountResult {
  account: DKAccount | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleSync: (enabled: boolean) => Promise<void>;
}

export function useDKAccount(playerId: string | null): UseDKAccountResult {
  const [account, setAccount] = useState<DKAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = async () => {
    if (!playerId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('dk_accounts')
        .select('id, player_id, dk_user_id, dk_email, last_sync_at, sync_enabled, created_at')
        .eq('player_id', playerId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      setAccount(data);
    } catch (err: any) {
      console.error('Error fetching DK account:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    if (!playerId) return;

    try {
      const { error: deleteError } = await supabase
        .from('dk_accounts')
        .delete()
        .eq('player_id', playerId);

      if (deleteError) throw deleteError;

      setAccount(null);
    } catch (err: any) {
      console.error('Error disconnecting DK account:', err);
      setError(err.message);
      throw err;
    }
  };

  const toggleSync = async (enabled: boolean) => {
    if (!playerId || !account) return;

    try {
      const { error: updateError } = await supabase
        .from('dk_accounts')
        .update({ sync_enabled: enabled })
        .eq('player_id', playerId);

      if (updateError) throw updateError;

      setAccount(prev => prev ? { ...prev, sync_enabled: enabled } : null);
    } catch (err: any) {
      console.error('Error toggling DK sync:', err);
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchAccount();
  }, [playerId]);

  return {
    account,
    isLoading,
    isConnected: !!account,
    error,
    refetch: fetchAccount,
    disconnect,
    toggleSync,
  };
}
