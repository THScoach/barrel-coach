import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/AdminHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Loader2, ArrowLeft, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function AdminBroadcast() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Fetch count of eligible players
  const { data: eligibleCount, isLoading: countLoading } = useQuery({
    queryKey: ['broadcast-eligible-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('email_opt_in', true)
        .not('email', 'is', null);

      if (error) throw error;
      return count || 0;
    },
  });

  // Send broadcast mutation
  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('broadcast-email', {
        body: { subject, message },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Broadcast sent to ${data.sent} players!`, {
        description: data.failed > 0 ? `${data.failed} failed to send` : undefined,
      });
      setSubject('');
      setMessage('');
    },
    onError: (error) => {
      console.error('Broadcast error:', error);
      toast.error('Failed to send broadcast', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const handleSend = () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in both subject and message');
      return;
    }

    if (!confirm(`Send this email to ${eligibleCount} players?`)) {
      return;
    }

    broadcastMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />

      <main className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/admin" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Broadcast Email</h1>
              <p className="text-sm text-slate-400">
                Send a message to all opted-in players
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Audience Card */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Audience
              </CardTitle>
              <CardDescription className="text-slate-400">
                Players with email_opt_in enabled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {countLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                ) : (
                  <>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-lg px-4 py-1">
                      {eligibleCount} players
                    </Badge>
                    <span className="text-sm text-slate-400">
                      will receive this email
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Compose Card */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Compose Message</CardTitle>
              <CardDescription className="text-slate-400">
                Email will be styled with Catching Barrels branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-slate-300">
                  Subject Line
                </label>
                <Input
                  placeholder="e.g., 🎯 New Training Videos Just Dropped!"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block text-slate-300">
                  Message Body
                </label>
                <Textarea
                  placeholder="Write your message here... 

The email will automatically include:
• Personalized greeting with player's first name
• Coach Rick signature
• Catching Barrels branding"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={10}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800">
                <Button
                  onClick={handleSend}
                  disabled={!subject.trim() || !message.trim() || broadcastMutation.isPending || eligibleCount === 0}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white"
                  size="lg"
                >
                  {broadcastMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending to {eligibleCount} players...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Broadcast to {eligibleCount} Players
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Result Card */}
          {broadcastMutation.isSuccess && (
            <Card className="bg-green-900/20 border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-green-400">
                  <CheckCircle className="w-6 h-6" />
                  <div>
                    <p className="font-semibold">Broadcast Complete!</p>
                    <p className="text-sm text-green-300/80">
                      Successfully sent to {broadcastMutation.data?.sent} players
                      {broadcastMutation.data?.failed > 0 && (
                        <span className="text-yellow-400">
                          {' '}• {broadcastMutation.data.failed} failed
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {broadcastMutation.isError && (
            <Card className="bg-red-900/20 border-red-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-red-400">
                  <AlertCircle className="w-6 h-6" />
                  <div>
                    <p className="font-semibold">Broadcast Failed</p>
                    <p className="text-sm text-red-300/80">
                      {broadcastMutation.error instanceof Error 
                        ? broadcastMutation.error.message 
                        : 'Unknown error occurred'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
