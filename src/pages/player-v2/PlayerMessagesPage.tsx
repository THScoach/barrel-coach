/**
 * Coach Barrels — AI Chat + Insights tabs (4B brand)
 * Polished with consistent styling
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { MessagesSkeleton } from "@/components/player-v2/PageSkeleton";
import { Send, MessageSquare, Lightbulb, Loader2, ImagePlus, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isDiagnostic?: boolean;
  imageUrl?: string;
}

interface InsightMessage {
  id: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Only JPG, PNG, and PDF files are supported");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be under 10MB");
      return;
    }
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setPendingImage({ file, preview });
    if (e.target) e.target.value = '';
  };

  const clearPendingImage = () => {
    if (pendingImage?.preview) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !pendingImage) || !player?.id || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;
    let imagePreviewUrl: string | undefined;

    if (pendingImage) {
      try {
        imageBase64 = await fileToBase64(pendingImage.file);
        imageMimeType = pendingImage.file.type;
        imagePreviewUrl = pendingImage.preview || undefined;
      } catch {
        toast.error("Failed to read file");
        setSending(false);
        return;
      }
      clearPendingImage();
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content || (imageMimeType?.includes('pdf') ? '📄 PDF uploaded' : '📷 Image uploaded'),
      timestamp: new Date(),
      imageUrl: imagePreviewUrl,
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data, error } = await supabase.functions.invoke('coach-rick-ai-chat', {
        body: {
          message: content || "Analyze this image in context of my data.",
          history: messages.map(m => ({ role: m.role, content: m.content })),
          chatMode: 'player',
          playerId: player.id,
          scores: { brain: player.latest_brain_score, body: player.latest_body_score, bat: player.latest_bat_score, ball: player.latest_ball_score },
          weakestCategory: getWeakestCategory(),
          chatLogId,
          imageBase64,
          imageMimeType,
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
    return <MessagesSkeleton />;
  }

  const unreadCount = insights.filter(m => !m.is_read).length;

  return (
    <div className="flex flex-col" style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(230,57,70,0.1)' }}>
          <span className="text-lg">🧢</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-black" style={{ color: '#fff' }}>Coach Barrels</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E' }} />
            <span className="text-[10px] font-semibold" style={{ color: '#22C55E' }}>Online</span>
          </div>
        </div>
        <div className="flex gap-1">
          {(['chat', 'insights'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all"
              style={{
                color: activeTab === tab ? '#fff' : '#555',
                background: activeTab === tab ? 'rgba(230,57,70,0.12)' : 'transparent',
              }}
            >
              {tab}
              {tab === 'insights' && unreadCount > 0 && (
                <span className="ml-1 text-[9px] px-1 py-0.5 rounded-full" style={{ background: '#E63946', color: '#fff' }}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-40">
        {activeTab === 'chat' && (
          loadingMessages ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton
                  key={i}
                  className="h-16 rounded-2xl"
                  style={{ background: '#111', width: i % 2 === 0 ? '75%' : '65%', marginLeft: i % 2 === 0 ? 'auto' : '0' }}
                />
              ))}
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
                  <div key={m.id} className={`animate-fade-in ${isPlayer ? 'ml-12' : 'mr-12'}`}>
                    {isDiagnostic && (
                      <p className="text-[10px] font-black tracking-wider mb-1" style={{ color: '#4ecdc4' }}>DIAGNOSTIC UPDATE</p>
                    )}
                    <div
                      className="text-[13px] leading-relaxed whitespace-pre-wrap"
                      style={{
                        background: isDiagnostic ? 'rgba(78,205,196,0.04)' : isPlayer ? 'rgba(230,57,70,0.08)' : '#111',
                        border: `1px solid ${isDiagnostic ? 'rgba(78,205,196,0.15)' : isPlayer ? 'rgba(230,57,70,0.15)' : '#1a1a1a'}`,
                        borderRadius: isPlayer ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        color: '#ddd',
                        padding: '12px 16px',
                      }}
                    >
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          alt="Uploaded"
                          className="rounded-xl mb-2 max-h-48 w-auto object-contain"
                        />
                      )}
                      {m.content}
                    </div>
                    <p className="text-[9px] mt-1 px-1 font-semibold" style={{ color: '#333' }}>
                      {format(m.timestamp, 'h:mm a')}
                    </p>
                  </div>
                );
              })}
              {sending && (
                <div className="mr-12 animate-fade-in">
                  <div className="p-3 flex items-center gap-2 rounded-2xl" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#E63946' }} />
                    <span className="text-[13px] font-semibold" style={{ color: '#555' }}>Coach Barrels is thinking...</span>
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
            <div className="space-y-2">
              {insights.map(m => (
                <button
                  key={m.id}
                  onClick={() => markRead(m.id)}
                  className="block w-full text-left rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.98]"
                  style={{
                    background: '#111',
                    border: `1px solid ${m.is_read ? '#1a1a1a' : 'rgba(230,57,70,0.15)'}`,
                    opacity: m.is_read ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold" style={{ color: '#444' }}>{format(new Date(m.created_at), 'MMM d')}</span>
                    {!m.is_read && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(230,57,70,0.1)', color: '#E63946' }}>New</span>}
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: '#888' }}>{m.content}</p>
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Input — Chat tab only */}
      {activeTab === 'chat' && (
        <div className="fixed bottom-14 left-0 right-0 px-4 py-3" style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #1a1a1a' }}>
          {pendingImage && (
            <div className="mb-2 relative inline-block">
              {pendingImage.preview ? (
                <img src={pendingImage.preview} alt="Preview" className="h-16 rounded-xl" style={{ border: '1px solid #1a1a1a' }} />
              ) : (
                <div className="h-16 px-4 rounded-xl flex items-center gap-2 text-[11px]" style={{ background: '#111', border: '1px solid #1a1a1a', color: '#888' }}>
                  📄 {pendingImage.file.name}
                </div>
              )}
              <button
                onClick={clearPendingImage}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#E63946' }}
              >
                <X className="h-3 w-3" style={{ color: '#fff' }} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
              style={{ background: '#111', border: '1px solid #1a1a1a', opacity: sending ? 0.5 : 1 }}
            >
              <ImagePlus className="h-4 w-4" style={{ color: '#666' }} />
            </button>
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Message Coach Barrels..."
              disabled={sending}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#111', border: '1px solid #1a1a1a', color: '#fff' }}
            />
            <button
              onClick={handleSend}
              disabled={sending || (!newMessage.trim() && !pendingImage)}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'linear-gradient(135deg, #E63946, #c62b38)', opacity: (!newMessage.trim() && !pendingImage || sending) ? 0.4 : 1 }}
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
