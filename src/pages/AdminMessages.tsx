import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/AdminHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle, User, Phone, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface Player {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  team: string | null;
  level: string | null;
  sms_opt_in: boolean;
}

interface Message {
  id: string;
  session_id: string | null;
  player_id: string | null;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  body: string;
  created_at: string;
  read_at: string | null;
  trigger_type: string | null;
  ai_generated: boolean;
}

interface UnreadCount {
  phone_number: string;
  count: number;
}

export default function AdminMessages() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch all players with phone numbers
  const { data: players, isLoading: playersLoading } = useQuery({
    queryKey: ['admin-players-messages'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-messages', {
        body: { action: 'getPlayers' }
      });
      
      if (error) throw error;
      return (data?.players || []) as Player[];
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
                  const player = players?.find(p => p.phone === newMsg.phone_number);
                  if (player) {
                    handleSelectPlayer(player);
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
  }, [selectedPhone, players]);

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

  const handleSelectPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setSelectedPhone(player.phone);
  };

  const handleSend = () => {
    if (!newMessage.trim() || !selectedPhone) return;
    
    sendMutation.mutate({
      to: selectedPhone,
      body: newMessage,
    });
  };

  // Total unread count
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      
      <main className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Messages</h1>
                <p className="text-sm text-slate-400">
                  SMS conversations with players
                </p>
              </div>
            </div>
            {totalUnread > 0 && (
              <Badge className="bg-red-500 text-white text-sm">
                {totalUnread} unread
              </Badge>
            )}
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
          {/* Player List */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 overflow-hidden">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-white">
              <User className="w-4 h-4 text-slate-400" />
              Players
            </h2>
            <ScrollArea className="h-[calc(100%-2rem)]">
              {playersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                </div>
              ) : players?.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No players with phone numbers yet
                </p>
              ) : (
                <div className="space-y-2">
                  {players?.map((player) => {
                    const unread = unreadCounts[player.phone || ''] || 0;
                    return (
                      <button
                        key={player.id}
                        onClick={() => handleSelectPlayer(player)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl transition-colors relative",
                          selectedPhone === player.phone
                            ? "bg-slate-800 border border-slate-700"
                            : "hover:bg-slate-800/50 border border-transparent"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium truncate text-white">{player.name}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {player.phone}
                            </p>
                          </div>
                          {unread > 0 && (
                            <Badge className="ml-2 bg-red-500 text-white">
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
          </div>

          {/* Chat Area */}
          <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
            {!selectedPhone ? (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a player to view conversation</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-4 border-b border-slate-800">
                  <h3 className="font-semibold text-white">{selectedPlayer?.name}</h3>
                  <p className="text-sm text-slate-400">{selectedPhone}</p>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                    </div>
                  ) : messages?.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
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
                              ? "ml-auto bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-br-md"
                              : "bg-slate-800 text-slate-100 rounded-bl-md"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            msg.direction === 'outbound' ? "opacity-70" : "text-slate-400"
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
                <div className="p-4 border-t border-slate-800 flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    disabled={sendMutation.isPending}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <Button 
                    onClick={handleSend} 
                    disabled={!newMessage.trim() || sendMutation.isPending}
                    size="icon"
                    className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
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
          </div>
        </div>
      </main>
    </div>
  );
}
