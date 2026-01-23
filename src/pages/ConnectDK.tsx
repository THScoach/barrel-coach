import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Bluetooth, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  Shield,
  Zap,
  BarChart3
} from 'lucide-react';

type ConnectionStatus = 'idle' | 'connecting' | 'success' | 'error';

export default function ConnectDK() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isAlreadyConnected, setIsAlreadyConnected] = useState(false);

  // Check for OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    if (error) {
      setStatus('error');
      setErrorMessage(searchParams.get('error_description') || 'OAuth authorization failed');
      return;
    }

    if (code && state) {
      handleOAuthCallback(code, state);
    }
  }, [searchParams]);

  // Check auth and existing connection
  useEffect(() => {
    const checkAuthAndConnection = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        navigate('/login?redirect=/connect-dk');
        return;
      }

      // Get player ID
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!player) {
        setErrorMessage('No player profile found. Please complete your profile first.');
        return;
      }

      setPlayerId(player.id);

      // Check if already connected
      const { data: existingAccount } = await supabase
        .from('dk_accounts')
        .select('id, dk_email, last_sync_at')
        .eq('player_id', player.id)
        .single();

      if (existingAccount) {
        setIsAlreadyConnected(true);
      }
    };

    checkAuthAndConnection();
  }, [navigate]);

  const handleOAuthCallback = async (code: string, state: string) => {
    setStatus('connecting');
    
    try {
      const { data, error } = await supabase.functions.invoke('dk-oauth-callback', {
        body: { code, state }
      });

      if (error) throw error;

      setStatus('success');
      toast({
        title: 'Diamond Kinetics Connected!',
        description: 'Your sensor data will now sync automatically.',
      });

      // Redirect after success
      setTimeout(() => {
        navigate('/player/data');
      }, 2000);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Failed to complete connection');
    }
  };

  const initiateOAuth = async () => {
    if (!playerId) return;
    
    setStatus('connecting');

    try {
      const { data, error } = await supabase.functions.invoke('dk-oauth-init', {
        body: { player_id: playerId }
      });

      if (error) throw error;

      // Redirect to DK OAuth
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Failed to initiate connection');
    }
  };

  const disconnectAccount = async () => {
    if (!playerId) return;

    try {
      const { error } = await supabase
        .from('dk_accounts')
        .delete()
        .eq('player_id', playerId);

      if (error) throw error;

      setIsAlreadyConnected(false);
      toast({
        title: 'Disconnected',
        description: 'Diamond Kinetics account has been unlinked.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Logo size="sm" />
            <div className="w-20" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-lg">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bluetooth className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Connect Diamond Kinetics</h1>
          <p className="text-muted-foreground">
            Link your DK sensor to unlock real-time BAT metrics
          </p>
        </div>

        {/* Status Cards */}
        {status === 'success' && (
          <Card className="bg-green-500/10 border-green-500/30 p-6 mb-6">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold text-green-500">Connected!</h3>
                <p className="text-sm text-muted-foreground">
                  Redirecting to your data hub...
                </p>
              </div>
            </div>
          </Card>
        )}

        {status === 'error' && (
          <Card className="bg-destructive/10 border-destructive/30 p-6 mb-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <h3 className="font-semibold text-destructive">Connection Failed</h3>
                <p className="text-sm text-muted-foreground">
                  {errorMessage || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => setStatus('idle')}
            >
              Try Again
            </Button>
          </Card>
        )}

        {/* Already Connected State */}
        {isAlreadyConnected && status === 'idle' && (
          <Card className="bg-primary/10 border-primary/30 p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Already Connected</h3>
                <p className="text-sm text-muted-foreground">
                  Your Diamond Kinetics account is linked
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate('/player/data')}
              >
                View My Data
              </Button>
              <Button 
                variant="destructive" 
                size="icon"
                onClick={disconnectAccount}
              >
                ×
              </Button>
            </div>
          </Card>
        )}

        {/* Benefits */}
        {!isAlreadyConnected && status === 'idle' && (
          <>
            <Card className="p-6 mb-6">
              <h3 className="font-semibold mb-4">What You'll Unlock</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium">Real-Time BAT Score</p>
                    <p className="text-sm text-muted-foreground">
                      Your bat speed, attack angle, and hand speed power your 4B metrics
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">Auto-Sync Sessions</p>
                    <p className="text-sm text-muted-foreground">
                      Swings automatically flow into your profile for analysis
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">Secure Connection</p>
                    <p className="text-sm text-muted-foreground">
                      OAuth 2.0 ensures your DK credentials stay private
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Button 
              className="w-full h-14 text-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
              onClick={initiateOAuth}
              disabled={!playerId}
            >
              <Bluetooth className="h-5 w-5 mr-2" />
              Connect Diamond Kinetics
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              You'll be redirected to Diamond Kinetics to authorize access.
              We only request read access to your swing data.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
