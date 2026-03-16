/**
 * Coach Rick - Chat + Insights tabs
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, MessageSquare, Lightbulb } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  content: string;
  message_type: string;
  trigger_reason: string | null;
  is_read: boolean;
  created_at: string;
}

export default function PlayerMessagesPage() {
  const { player, loading } = usePlayerData();
  const [activeTab, setActiveTab] = useState<'chat' | 'insights'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!player?.id) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      const { data } = await supabase
        .from("locker_room_messages")
        .select("id, content, message_type, trigger_reason, is_read, created_at")
        .eq("player_id", player.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (data) setMessages(data);
      setLoadingMessages(false);
    };
    fetchMessages();
  }, [player?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !player?.id) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    // Optimistic add
    const optimistic: Message = {
      id: crypto.randomUUID(),
      content,
      message_type: 'player_reply',
      trigger_reason: null,
      is_read: true,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    await supabase.from("locker_room_messages").insert({
      player_id: player.id,
      content,
      message_type: 'player_reply',
      trigger_reason: 'player_chat',
      is_read: true,
    });
    setSending(false);
  };

  const markRead = async (id: string) => {
    await supabase.from("locker_room_messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
  };

  if (loading) {
    return (
      <div style={{ background: '#000', minHeight: '100vh' }}>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" style={{ background: '#111' }} />)}
        </div>
      </div>
    );
  }

  const chatMessages = messages.filter(m => m.message_type === 'player_reply' || m.message_type === 'coach_message' || m.message_type === 'diagnostic');
  const insightMessages = messages.filter(m => m.message_type !== 'player_reply' && m.message_type !== 'coach_message');

  return (
    <div className="flex flex-col" style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: '#0a0a0a', borderBottom: '1px solid #222' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(230,57,70,0.15)' }}>
          <span className="text-lg">🧢</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: '#fff' }}>Coach Rick</p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#4ecdc4' }} />
            <span className="text-[11px]" style={{ color: '#4ecdc4' }}>Online</span>
          </div>
        </div>
        <div className="flex gap-1">
          {(['chat', 'insights'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold capitalize"
              style={{
                background: activeTab === tab ? 'rgba(230,57,70,0.15)' : 'transparent',
                color: activeTab === tab ? '#E63946' : '#777',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-40">
        {activeTab === 'chat' && (
          loadingMessages ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-3/4 rounded-xl" style={{ background: '#111' }} />)}
            </div>
          ) : chatMessages.length === 0 ? (
            <EmptyState icon={<MessageSquare className="h-12 w-12" />} title="No messages yet" description="Send Coach Rick a message to get started" />
          ) : (
            <div className="space-y-3">
              {chatMessages.map(m => {
                const isPlayer = m.message_type === 'player_reply';
                const isDiagnostic = m.message_type === 'diagnostic';
                return (
                  <div key={m.id} className={isPlayer ? 'ml-12' : 'mr-12'}>
                    {isDiagnostic && (
                      <p className="text-[11px] font-bold mb-1" style={{ color: '#4ecdc4' }}>DIAGNOSTIC UPDATE</p>
                    )}
                    <div
                      className="p-3 text-sm leading-relaxed"
                      style={{
                        background: isDiagnostic ? 'rgba(78,205,196,0.05)' : isPlayer ? 'rgba(230,57,70,0.12)' : '#1a1a1a',
                        border: `1px solid ${isDiagnostic ? 'rgba(78,205,196,0.2)' : isPlayer ? 'rgba(230,57,70,0.2)' : '#222'}`,
                        borderRadius: isPlayer ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        color: '#fff',
                      }}
                    >
                      {m.content}
                    </div>
                    <p className="text-[10px] mt-1 px-1" style={{ color: '#555' }}>
                      {format(new Date(m.created_at), 'h:mm a')}
                    </p>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )
        )}

        {activeTab === 'insights' && (
          insightMessages.length === 0 ? (
            <EmptyState icon={<Lightbulb className="h-12 w-12" />} title="No insights yet" description="Insights appear after sessions are analyzed" />
          ) : (
            <div className="space-y-3">
              {insightMessages.map(m => (
                <button
                  key={m.id}
                  onClick={() => markRead(m.id)}
                  className="block w-full text-left rounded-xl p-4 transition-opacity"
                  style={{
                    background: '#111',
                    border: '1px solid #222',
                    opacity: m.is_read ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: '#555' }}>{format(new Date(m.created_at), 'MMM d')}</span>
                    {!m.is_read && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(230,57,70,0.2)', color: '#E63946' }}>New</span>}
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: '#a0a0a0' }}>{m.content}</p>
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Input - Chat tab only */}
      {activeTab === 'chat' && (
        <div className="fixed bottom-16 left-0 right-0 px-4 py-3" style={{ background: '#0a0a0a', borderTop: '1px solid #222' }}>
          <div className="flex gap-2">
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Message Coach Rick..."
              className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none"
              style={{ background: '#111', border: '1px solid #333', color: '#fff' }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: '#E63946', opacity: !newMessage.trim() ? 0.5 : 1 }}
            >
              <Send className="h-4 w-4" style={{ color: '#fff' }} />
            </button>
          </div>
        </div>
      )}

      <PlayerBottomNav />
    </div>
  );
}
