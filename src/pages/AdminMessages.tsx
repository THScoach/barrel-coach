import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle, User, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Session {
  id: string;
  player_name: string;
  player_email: string;
  player_phone: string | null;
  product_type: string;
  created_at: string;
  status: string;
}

interface Message {
  id: string;
  session_id: string | null;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  body: string;
  created_at: string;
}

export default function AdminMessages() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch all sessions with phone numbers
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, player_name, player_email, player_phone, product_type, created_at, status')
        .not('player_phone', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Session[];
    },
  });

  // Fetch messages for selected phone
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['admin-messages', selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return [];
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('phone_number', selectedPhone)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedPhone,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({ to, body, sessionId }: { to: string; body: string; sessionId?: string }) => {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { to, body, sessionId },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['admin-messages', selectedPhone] });
      toast.success('Message sent!');
    },
    onError: (error) => {
      console.error('Send error:', error);
      toast.error('Failed to send message');
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectSession = (session: Session) => {
    setSelectedSession(session);
    setSelectedPhone(session.player_phone);
  };

  const handleSend = () => {
    if (!newMessage.trim() || !selectedPhone) return;
    
    sendMutation.mutate({
      to: selectedPhone,
      body: newMessage,
      sessionId: selectedSession?.id,
    });
  };

  // Group sessions by phone number to avoid duplicates
  const uniquePhones = sessions?.reduce((acc, session) => {
    if (session.player_phone && !acc.find(s => s.player_phone === session.player_phone)) {
      acc.push(session);
    }
    return acc;
  }, [] as Session[]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container py-8">
        <h1 className="text-3xl font-bold mb-8">Messages</h1>
        
        <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
          {/* Player List */}
          <Card className="p-4 overflow-hidden">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Players
            </h2>
            <ScrollArea className="h-[calc(100%-2rem)]">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : uniquePhones?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No players with phone numbers yet
                </p>
              ) : (
                <div className="space-y-2">
                  {uniquePhones?.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg transition-colors",
                        selectedPhone === session.player_phone
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <p className="font-medium truncate">{session.player_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {session.player_phone}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* Chat Area */}
          <Card className="md:col-span-2 flex flex-col overflow-hidden">
            {!selectedPhone ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a player to view conversation</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-4 border-b">
                  <h3 className="font-semibold">{selectedSession?.player_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedPhone}</p>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No messages yet. Send the first one!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "max-w-[75%] p-3 rounded-2xl",
                            msg.direction === 'outbound'
                              ? "ml-auto bg-accent text-accent-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                          )}
                        >
                          <p className="text-sm">{msg.body}</p>
                          <p className="text-xs opacity-60 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    disabled={sendMutation.isPending}
                  />
                  <Button 
                    onClick={handleSend} 
                    disabled={!newMessage.trim() || sendMutation.isPending}
                    size="icon"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
