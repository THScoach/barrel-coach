import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Bluetooth } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface DKConnectionBadgeProps {
  playersTableId: string | null | undefined;
  playerPhone?: string | null;
}

export function DKConnectionBadge({ playersTableId, playerPhone }: DKConnectionBadgeProps) {
  const [isSending, setIsSending] = useState(false);

  // Check dk_accounts for OAuth connection
  const { data: dkAccount, isLoading: loadingAccount } = useQuery({
    queryKey: ['dk-account', playersTableId],
    queryFn: async () => {
      if (!playersTableId) return null;
      const { data } = await supabase
        .from('dk_accounts')
        .select('id, access_token')
        .eq('player_id', playersTableId)
        .maybeSingle();
      return data;
    },
    enabled: !!playersTableId,
  });

  // Check sensor_sessions for CSV uploads
  const { data: csvSessionCount, isLoading: loadingSessions } = useQuery({
    queryKey: ['dk-csv-sessions', playersTableId],
    queryFn: async () => {
      if (!playersTableId) return 0;
      const { count } = await supabase
        .from('sensor_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('player_id', playersTableId)
        .eq('environment', 'manual_upload');
      return count || 0;
    },
    enabled: !!playersTableId,
  });

  const handleSendSetupLink = async () => {
    if (!playerPhone) {
      toast.error('No phone number on file for this player');
      return;
    }
    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-dk-setup-link', {
        body: { phone: playerPhone },
      });
      if (error) throw error;
      toast.success('DK setup link sent via SMS');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send setup link');
    } finally {
      setIsSending(false);
    }
  };

  if (loadingAccount || loadingSessions) {
    return <Loader2 className="h-4 w-4 animate-spin text-slate-500" />;
  }

  // OAuth connected
  if (dkAccount?.access_token) {
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/20">
        <Bluetooth className="h-3 w-3 mr-1" />
        DK Connected (OAuth)
      </Badge>
    );
  }

  // CSV uploads exist
  if (csvSessionCount && csvSessionCount > 0) {
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/20">
        <Bluetooth className="h-3 w-3 mr-1" />
        DK Connected (CSV — {csvSessionCount} session{csvSessionCount !== 1 ? 's' : ''})
      </Badge>
    );
  }

  // Not connected
  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700/50">
        DK Not Connected
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-slate-400 hover:text-white"
        onClick={handleSendSetupLink}
        disabled={isSending}
      >
        {isSending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Send className="h-3 w-3 mr-1" />
            Send DK Setup Link
          </>
        )}
      </Button>
    </div>
  );
}
