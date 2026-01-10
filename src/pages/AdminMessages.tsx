import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/AdminHeader';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle, User, Phone, Loader2, Bell } from 'lucide-react';
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
  read_at: string | null;
}

interface UnreadCount {
  phone_number: string;
  count: number;
}

export default function AdminMessages() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
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

  // Fetch unread counts via edge function
  const fetchUnreadCounts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-messages', {
        body: { action: 'getUnreadCounts' }
      });
      
      if (data?.counts) {
        const countsMap: Record<string, number> = {};
        data.counts.forEach((c: UnreadCount) => {
          countsMap[c.phone_number] = c.count;
        });
        setUnreadCounts(countsMap);
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  // Fetch messages for selected phone
  const { data: messages, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['admin-messages', selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return [];
      
      const { data, error } = await supabase.functions.invoke('admin-messages', {
        body: { action: 'getMessages', phoneNumber: selectedPhone }
      });
      
      if (error) throw error;
      return (data?.messages || []) as Message[];
    },
    enabled: !!selectedPhone,
  });

  // Mark messages as read
  const markAsRead = async (phoneNumber: string) => {
    try {
      await supabase.functions.invoke('admin-messages', {
        body: { action: 'markAsRead', phoneNumber }
      });
      fetchUnreadCounts();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

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
      refetchMessages();
      toast.success('Message sent!');
    },
    onError: (error) => {
      console.error('Send error:', error);
      toast.error('Failed to send message');
    },
  });

  // Initial fetch of unread counts
  useEffect(() => {
    fetchUnreadCounts();
  }, []);

  // Subscribe to realtime messages
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          // If this message is for the currently selected conversation, refresh
          if (selectedPhone && newMsg.phone_number === selectedPhone) {
            refetchMessages();
            // Mark as read if inbound
            if (newMsg.direction === 'inbound') {
              markAsRead(selectedPhone);
            }
          } else if (newMsg.direction === 'inbound') {
            // Show notification for new inbound message
            toast.info(`New message from ${newMsg.phone_number}`, {
              description: newMsg.body.slice(0, 50) + (newMsg.body.length > 50 ? '...' : ''),
              action: {
                label: 'View',
                onClick: () => {
                  const session = sessions?.find(s => s.player_phone === newMsg.phone_number);
                  if (session) {
                    handleSelectSession(session);
                  }
                }
              }
            });
          }
          
          // Update unread counts
          fetchUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPhone, sessions]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when selecting a conversation
  useEffect(() => {
    if (selectedPhone) {
      markAsRead(selectedPhone);
    }
  }, [selectedPhone]);

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

  // Total unread count
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AdminHeader />
      
      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Messages</h1>
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-sm">
                {totalUnread} unread
              </Badge>
            )}
          </div>
        </div>
        
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
                  {uniquePhones?.map((session) => {
                    const unread = unreadCounts[session.player_phone || ''] || 0;
                    return (
                      <button
                        key={session.id}
                        onClick={() => handleSelectSession(session)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-colors relative",
                          selectedPhone === session.player_phone
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium truncate">{session.player_name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {session.player_phone}
                            </p>
                          </div>
                          {unread > 0 && (
                            <Badge variant="destructive" className="ml-2">
                              {unread}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
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
                              ? "ml-auto bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            msg.direction === 'outbound' ? "opacity-70" : "opacity-60"
                          )}>
                            {new Date(msg.created_at).toLocaleString([], { 
                              month: 'short',
                              day: 'numeric',
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
