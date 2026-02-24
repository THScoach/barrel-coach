import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface CoachRickChatProps {
  playerId: string;
  priorityPillar: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function CoachRickChat({ playerId, priorityPillar }: CoachRickChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasShownIntro, setHasShownIntro] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationId = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-show intro message on first open
  useEffect(() => {
    if (isOpen && !hasShownIntro) {
      setHasShownIntro(true);
      const pillar = priorityPillar || 'weakest';
      setMessages([{
        role: 'assistant',
        content: `Your ${pillar.toUpperCase()} score is your priority right now. What questions do you have?`,
      }]);
    }
  }, [isOpen, hasShownIntro, priorityPillar]);

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
          history: messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
        },
      });

      if (error) throw error;

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
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1c] border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧢</span>
          <span className="font-bold text-white">Coach Rick</span>
          <span className="flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
            Online
          </span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white transition-colors">
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="h-[300px] overflow-y-auto p-4 space-y-3 bg-[#1a1a1c]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-[#252528] text-gray-200'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#252528] text-gray-400 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Coach Rick is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 bg-[#1a1a1c] border-t border-gray-800">
        <Input
          placeholder="Ask Coach Rick..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={isLoading}
          className="bg-[#252528] border-gray-700 text-white placeholder:text-gray-500"
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
