import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, X, Maximize2, Minimize2, Database, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  playerContext?: {
    name?: string;
    latestScores?: {
      brain?: number;
      body?: number;
      bat?: number;
      ball?: number;
      composite?: number;
    };
  };
}

interface AdminLabChatProps {
  selectedPlayerId?: string;
  selectedPlayerName?: string;
  playerContext?: {
    name?: string;
    level?: string;
    latestScores?: {
      brain?: number;
      body?: number;
      bat?: number;
      ball?: number;
      composite?: number;
    };
    recentSessions?: any[];
    weakestCategory?: string;
    leaks?: string[];
  };
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
}

const QUICK_PROMPTS = [
  { label: "What do you see in the data?", message: "Looking at this player's recent sessions, what patterns do you see? What should I focus on?" },
  { label: "What's causing this?", message: "Based on the metrics, what's likely causing their main issue? Give me a hypothesis." },
  { label: "Compare to last month", message: "How do their recent numbers compare to a month ago? Are they trending up or down?" },
  { label: "Drill recommendation", message: "Based on their weakest area, what drill would you prioritize and why?" },
];

export function AdminLabChat({
  selectedPlayerId,
  selectedPlayerName,
  playerContext,
  className,
  isExpanded = false,
  onToggleExpand,
  onClose,
}: AdminLabChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatLogId, setChatLogId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset chat when player changes
  useEffect(() => {
    if (selectedPlayerId) {
      setMessages([]);
      setChatLogId(null);
    }
  }, [selectedPlayerId]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('coach-rick-ai-chat', {
        body: {
          message: messageText,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          chatMode: 'admin',
          playerContext: playerContext,
          playerId: selectedPlayerId,
          chatLogId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        playerContext: data.playerContext,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.chatLogId) {
        setChatLogId(data.chatLogId);
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to get response. Please try again.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setChatLogId(null);
  };

  return (
    <Card className={cn(
      "flex flex-col bg-slate-900 border-slate-700",
      isExpanded ? "fixed inset-4 z-50" : "h-[500px]",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              Lab Partner
              <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-400 border-teal-500/30">
                AI
              </Badge>
            </h3>
            <p className="text-xs text-slate-400">
              {selectedPlayerName ? `Analyzing ${selectedPlayerName}` : 'Select a player to analyze'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-xs text-slate-400 hover:text-white h-7"
            >
              Clear
            </Button>
          )}
          {onToggleExpand && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="h-7 w-7 text-slate-400 hover:text-white"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Player Context Banner */}
      {playerContext && (
        <div className="px-4 py-2 bg-slate-800/30 border-b border-slate-700/50">
          <div className="flex items-center gap-2 text-xs">
            <Database className="w-3 h-3 text-slate-500" />
            <span className="text-slate-400">Context loaded:</span>
            <span className="text-white font-medium">{playerContext.name}</span>
            {playerContext.latestScores?.composite && (
              <Badge variant="secondary" className="h-5 text-[10px]">
                Composite: {playerContext.latestScores.composite}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-300">
                    Hey Coach. I'm here to help you analyze player data. 
                    {selectedPlayerName ? (
                      <span> I've got <span className="text-teal-400 font-medium">{selectedPlayerName}'s</span> data loaded. What do you want to know?</span>
                    ) : (
                      <span> Select a player and I'll help you dig into their metrics.</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Try: "Pull up CJ Lake's last 3 sessions" or "What's causing the T/P ratio spike?"
                  </p>
                </div>
              </div>
            </div>

            {playerContext && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium px-1">Quick questions:</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt.message)}
                      disabled={isLoading}
                      className="text-xs px-3 py-1.5 rounded-full border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors disabled:opacity-50 text-slate-300"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  msg.role === 'user' ? "bg-blue-500/20" : "bg-teal-500/20"
                )}>
                  {msg.role === 'user' ? (
                    <User className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-teal-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-1 text-slate-500">
                    {msg.role === 'user' ? 'You' : 'Lab Partner'}
                  </p>
                  <div className={cn(
                    "p-3 rounded-lg text-sm",
                    msg.role === 'user' 
                      ? "bg-blue-500/10 border border-blue-500/20 text-slate-200" 
                      : "bg-slate-800/50 border border-slate-700/50 text-slate-300"
                  )}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium mb-1 text-slate-500">Lab Partner</p>
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-slate-700 bg-slate-800/30">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            placeholder={selectedPlayerName ? `Ask about ${selectedPlayerName}...` : "Select a player first..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !selectedPlayerId}
            className="min-h-[60px] max-h-[120px] resize-none bg-slate-800 border-slate-700 text-sm placeholder:text-slate-500"
            rows={2}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading || !selectedPlayerId}
            size="icon"
            className="shrink-0 h-[60px] w-[60px] bg-teal-600 hover:bg-teal-500"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 px-1">
          Shift+Enter for new line • Enter to send
        </p>
      </div>
    </Card>
  );
}
