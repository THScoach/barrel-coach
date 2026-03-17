/**
 * Coach Barrels — AI Chat + Insights tabs (4B brand)
 * Calls coach-rick-ai-chat edge function for live AI responses
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, MessageSquare, Lightbulb, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isDiagnostic?: boolean;
}

interface InsightMessage {
  id: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
}

export default function PlayerMessagesPage() {
  const { player, loading } = usePlayerData();
  const [activeTab, setActiveTab] = useState<'chat' | 'insights'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [insights, setInsights] = useState<InsightMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [chatLogId, setChatLogId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!player?.id) return;
    const fetchData = async () => {
      setLoadingMessages(true);

      const { data: chatLogs } = await supabase
        .from("chat_logs")
        .select("id, messages")
        .eq("player_id", player.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (chatLogs?.messages && Array.isArray(chatLogs.messages)) {
        setChatLogId(chatLogs.id);
        const restored: ChatMessage[] = (chatLogs.messages as any[]).map((m, i) => ({
          id: `restored-${i}`,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content || '',
          timestamp: new Date(),
        }));
        setMessages(restored);
      }

      const { data: lockerMessages } = await supabase
        .from("locker_room_messages")
        .select("id, content, message_type, is_read, created_at")
        .eq("player_id", player.id)
        .neq("message_type", "player_reply")
        .order("created_at", { ascending: false })
        .limit(50);

      if (lockerMessages) setInsights(lockerMessages);
      setLoadingMessages(false);
    };
    fetchData();
  }, [player?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getWeakestCategory = () => {
    if (!player) return undefined;
    const entries = [
      { key: 'brain', val: player.latest_brain_score },
      { key: 'body', val: player.latest_body_score },
      { key: 'bat', val: player.latest_bat_score },
      { key: 'ball', val: player.latest_ball_score },
    ].filter(e => e.val !== null);
    if (entries.length === 0) return undefined;
    entries.sort((a, b) => (a.val ?? 100) - (b.val ?? 100));
    return entries[0].key;
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !player?.id || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data, error } = await supabase.functions.invoke('coach-rick-ai-chat', {
        body: {
          message: content,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          chatMode: 'player',
          playerId: player.id,
          scores: { brain: player.latest_brain_score, body: player.latest_body_score, bat: player.latest_bat_score, ball: player.latest_ball_score },
          weakestCategory: getWeakestCategory(),
          chatLogId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || "I'm having trouble responding right now. Try again in a moment.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (data?.chatLogId) setChatLogId(data.chatLogId);
    } catch (err) {
      console.error('Coach Barrels AI error:', err);
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: "Sorry, I couldn't process that right now. Try again in a moment.", timestamp: new Date() }]);
    } finally {
      setSending(false);
    }
  };

  const markRead = async (id: string) => {
    await supabase.from("locker_room_messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    setInsights(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
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

  return (
    <div className="flex flex-col" style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: '#0a0a0a', borderBottom: '1px solid #222' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(230,57,70,0.12)' }}>
          <span className="text-lg">🧢</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: '#fff' }}>Coach Barrels</p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />
            <span className="text-[11px]" style={{ color: '#22C55E' }}>Online</span>
          </div>
        </div>
        <div className="flex gap-4">
          {(['chat', 'insights'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="pb-1 text-xs font-semibold capitalize transition-colors"
              style={{
                color: activeTab === tab ? '#ffffff' : '#555',
                borderBottom: activeTab === tab ? '2px solid #E63946' : '2px solid transparent',
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
          ) : messages.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-12 w-12" />}
              title="Chat with Coach Barrels"
              description="Ask about your swing, drills, or game plan — Coach Barrels knows your data"
            />
          ) : (
            <div className="space-y-3">
              {messages.map(m => {
                const isPlayer = m.role === 'user';
                const isDiagnostic = m.isDiagnostic;
                return (
                  <div key={m.id} className={isPlayer ? 'ml-12' : 'mr-12'}>
                    {isDiagnostic && (
                      <p className="text-[11px] font-bold mb-1" style={{ color: '#4ecdc4' }}>DIAGNOSTIC UPDATE</p>
                    )}
                    <div
                      className="p-3 text-sm leading-relaxed whitespace-pre-wrap"
                      style={{
                        background: isDiagnostic ? 'rgba(78,205,196,0.05)' : isPlayer ? 'rgba(230,57,70,0.12)' : '#1a1a1a',
                        border: `1px solid ${isDiagnostic ? 'rgba(78,205,196,0.2)' : isPlayer ? 'rgba(230,57,70,0.2)' : '#222'}`,
                        borderRadius: isPlayer ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        color: '#fff',
                        padding: '12px 14px',
                        marginRight: isPlayer ? undefined : '48px',
                        marginLeft: isPlayer ? '48px' : undefined,
                      }}
                    >
                      {m.content}
                    </div>
                    <p className="text-[10px] mt-1 px-1" style={{ color: '#555' }}>
                      {format(m.timestamp, 'h:mm a')}
                    </p>
                  </div>
                );
              })}
              {sending && (
                <div className="mr-12">
                  <div className="p-3 flex items-center gap-2" style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '16px 16px 16px 4px' }}>
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#555' }} />
                    <span className="text-sm" style={{ color: '#555' }}>Coach Barrels is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )
        )}

        {activeTab === 'insights' && (
          insights.length === 0 ? (
            <EmptyState icon={<Lightbulb className="h-12 w-12" />} title="No insights yet" description="Insights appear after sessions are analyzed" />
          ) : (
            <div className="space-y-3">
              {insights.map(m => (
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
                    {!m.is_read && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(230,57,70,0.15)', color: '#E63946' }}>New</span>}
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: '#a0a0a0' }}>{m.content}</p>
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Input — Chat tab only */}
      {activeTab === 'chat' && (
        <div className="fixed bottom-16 left-0 right-0 px-4 py-3" style={{ background: '#000', borderTop: '1px solid #222' }}>
          <div className="flex gap-2">
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Message Coach Barrels..."
              disabled={sending}
              className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none"
              style={{ background: '#111', border: '1px solid #222', color: '#fff' }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity"
              style={{ background: '#E63946', opacity: (!newMessage.trim() || sending) ? 0.5 : 1 }}
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
