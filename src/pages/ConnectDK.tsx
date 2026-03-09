import { useEffect, useState, useRef } from 'react';
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
  BarChart3,
  Upload,
  FileText,
  Smartphone,
  Settings,
  Download,
  ArrowUpCircle
} from 'lucide-react';

type ConnectionStatus = 'idle' | 'connecting' | 'success' | 'error';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function ConnectDK() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isAlreadyConnected, setIsAlreadyConnected] = useState(false);

  // Manual upload state
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedSwingsCount, setUploadedSwingsCount] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
        navigate('/login?returnTo=%2Fconnect-dk');
        return;
      }

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
      setTimeout(() => navigate('/player/data'), 2000);
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
      toast({ title: 'Disconnected', description: 'Diamond Kinetics account has been unlinked.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // --- Manual CSV Upload ---
  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({ title: 'Wrong file type', description: 'Please upload a .csv file.', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setUploadStatus('idle');
    setUploadError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-dk-upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadStatus('success');
      setUploadedSwingsCount(result.swings_count);
      toast({
        title: 'DK Data Uploaded!',
        description: `${result.swings_count} swings imported successfully.`,
      });
    } catch (err: any) {
      setUploadStatus('error');
      setUploadError(err.message || 'Upload failed');
    }
  };

  const steps = [
    { icon: Smartphone, text: 'Open the Diamond Kinetics app on your phone' },
    { icon: Settings, text: 'Tap Profile → Settings → Export Session Data' },
    { icon: Download, text: 'Download the CSV to your phone or email it to yourself' },
    { icon: ArrowUpCircle, text: 'Upload it here' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Logo size="sm" />
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-lg space-y-6">
        <div className="text-center mb-2">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bluetooth className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Connect Diamond Kinetics</h1>
          <p className="text-muted-foreground">
            Link your DK sensor to unlock real-time BAT metrics
          </p>
        </div>

        {/* OAuth Status Cards */}
        {status === 'success' && (
          <Card className="bg-green-500/10 border-green-500/30 p-6">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold text-green-500">Connected!</h3>
                <p className="text-sm text-muted-foreground">Redirecting to your data hub...</p>
              </div>
            </div>
          </Card>
        )}

        {status === 'error' && (
          <Card className="bg-destructive/10 border-destructive/30 p-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <h3 className="font-semibold text-destructive">Connection Failed</h3>
                <p className="text-sm text-muted-foreground">{errorMessage || 'An unexpected error occurred'}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => setStatus('idle')}>
              Try Again
            </Button>
          </Card>
        )}

        {/* Already Connected */}
        {isAlreadyConnected && status === 'idle' && (
          <Card className="bg-primary/10 border-primary/30 p-6">
            <div className="flex items-center gap-4 mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Already Connected</h3>
                <p className="text-sm text-muted-foreground">Your Diamond Kinetics account is linked</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/player/data')}>
                View My Data
              </Button>
              <Button variant="destructive" size="icon" onClick={disconnectAccount}>×</Button>
            </div>
          </Card>
        )}

        {/* ===== PATH A: OAuth (Primary) ===== */}
        {status === 'idle' && (
          <Card className="p-6 border-2 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Auto-Sync via OAuth
              </h3>
              <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/40 hover:bg-amber-500/20">
                Setup Pending — OAuth coming soon
              </Badge>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BarChart3 className="h-3.5 w-3.5 text-orange-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatic syncing of every swing session — no uploads needed
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Shield className="h-3.5 w-3.5 text-green-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Secure OAuth 2.0 — your DK credentials stay private
                </p>
              </div>
            </div>

            <Button
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
              onClick={initiateOAuth}
              disabled={!playerId}
            >
              <Bluetooth className="h-5 w-5 mr-2" />
              Connect Diamond Kinetics
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-3">
              OAuth connection is being finalized. Use the manual upload below in the meantime.
            </p>
          </Card>
        )}

        {/* ===== PATH B: Manual CSV Upload ===== */}
        {status === 'idle' && (
          <Card className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-primary" />
              Upload DK Export
            </h3>

            {/* Step-by-step instructions */}
            <div className="space-y-3 mb-5">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <step.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Upload success state */}
            {uploadStatus === 'success' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4 flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-600">
                    ✅ {uploadedSwingsCount} swings uploaded
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Your BAT score will update within a minute
                  </p>
                </div>
              </div>
            )}

            {/* Upload error state */}
            {uploadStatus === 'error' && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4 flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Upload failed</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{uploadError}</p>
                </div>
              </div>
            )}

            {/* Drop zone */}
            {uploadStatus !== 'success' && (
              <>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : selectedFile
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-muted-foreground/25 hover:border-primary/40'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />

                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium text-sm">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB — Click to change
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">Accepts .csv files only</p>
                    </>
                  )}
                </div>

                <Button
                  className="w-full mt-4"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadStatus === 'uploading'}
                >
                  {uploadStatus === 'uploading' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload DK Data
                    </>
                  )}
                </Button>
              </>
            )}

            {uploadStatus === 'success' && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setUploadStatus('idle');
                  setSelectedFile(null);
                  setUploadedSwingsCount(0);
                }}
              >
                Upload Another File
              </Button>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
