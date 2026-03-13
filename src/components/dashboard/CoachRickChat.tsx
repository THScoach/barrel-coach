import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Loader2, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface CoachRickChatProps {
  playerId: string;
  playerName?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ContextSummary {
  name: string;
  score: number | null;
  weakest: string | null;
  scoringVersion: string | null;
}

export function CoachRickChat({ playerId, playerName }: CoachRickChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextSummary, setContextSummary] = useState<ContextSummary | null>(null);
  const [contextError, setContextError] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Stable conversationId per playerId
  const conversationId = useMemo(() => {
    // Create a deterministic ID so we can reload history
    return crypto.randomUUID();
  }, [playerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load conversation history for this player on open
  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      // Find the most recent conversation for this player
      const { data: conversations } = await supabase
        .from('web_conversations')
        .select('id')
        .eq('player_id', playerId)
        .order('last_message_at', { ascending: false })
        .limit(1);

      if (conversations && conversations.length > 0) {
        const { data: history } = await supabase
          .from('web_messages')
          .select('role, content')
          .eq('conversation_id', conversations[0].id)
          .order('created_at', { ascending: true })
          .limit(20);

        if (history && history.length > 0) {
          setMessages(history.map(m => ({
            role: m.role === 'player' || m.role === 'user' ? 'user' as const : 'assistant' as const,
            content: m.content,
          })));
        }
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setHistoryLoaded(true);
    }
  }, [playerId, historyLoaded]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('coach-rick-ai-chat', {
        body: {
          message: text,
          conversationId,
          playerId,
        },
      });

      if (error) throw error;

      // Update context summary from response
      if (data?.contextSummary) {
        setContextSummary(data.contextSummary);
        setContextError(false);
      } else if (playerId) {
        setContextError(true);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data?.response || "Sorry, I couldn't process that. Try again!",
      }]);
    } catch (err) {
      console.error('Coach Rick chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Something went wrong. Please try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-5 py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold rounded-xl transition-colors"
      >
        <span className="text-lg">🧢</span>
        Ask Coach Rick
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1c] border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧢</span>
          <span className="font-bold text-white">Coach Rick</span>
          <span className="flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
            Online
          </span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-white transition-colors">
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Context Status Bar */}
      <div className="px-4 py-2 bg-[#151517] border-b border-border">
        {contextSummary ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
            <span className="truncate">
              Context loaded: <span className="text-white font-medium">{contextSummary.name}</span>
              {contextSummary.score !== null && (
                <> — KRS {contextSummary.score}</>
              )}
              {contextSummary.weakest && (
                <> — {contextSummary.weakest}</>
              )}
            </span>
          </div>
        ) : contextError ? (
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <AlertCircle className="h-3 w-3 shrink-0" />
            No scored session found — chat will be general until a v2 rescore runs.
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
            Loading {playerName || 'player'} context...
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="h-[300px] overflow-y-auto p-4 space-y-3 bg-[#1a1a1c]">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Ask Coach Rick anything about {playerName || 'this player'}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-[#252528] text-gray-200'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#252528] text-muted-foreground px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Coach Rick is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 bg-[#1a1a1c] border-t border-border">
        <Input
          placeholder="Ask Coach Rick..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={isLoading}
          className="bg-[#252528] border-border text-white placeholder:text-muted-foreground"
        />
        <Button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="bg-[#DC2626] hover:bg-[#B91C1C] shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
