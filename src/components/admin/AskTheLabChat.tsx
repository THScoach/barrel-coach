import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, X, Database, Sparkles, FlaskConical, BarChart3, Zap } from 'lucide-react';
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
  context?: {
    playerCount?: number;
    sessionCount?: number;
    validationCount?: number;
  };
}

interface AskTheLabChatProps {
  className?: string;
  isExpanded?: boolean;
  onClose?: () => void;
}

const QUICK_QUERIES = [
  { 
    label: "Run Batch Validation", 
    message: "batch_validation",
    icon: BarChart3,
    action: true,
    description: "Compare all 2D vs Reboot sessions"
  },
  { 
    label: "AA Knoxville Avg Brain Score", 
    message: "What is the average Brain score for my AA Knoxville hitters?",
    icon: Zap,
  },
  { 
    label: "Top Improvers This Month", 
    message: "Which players have improved their composite score the most in the last 30 days?",
    icon: Sparkles,
  },
  { 
    label: "Common Leaks by Level", 
    message: "What are the most common kinetic leaks at each playing level (HS, College, Pro)?",
    icon: FlaskConical,
  },
];

export function AskTheLabChat({ className, isExpanded = false, onClose }: AskTheLabChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (messageText: string, isAction = false) => {
    if (!messageText.trim() || isLoading) return;

    const displayText = isAction ? `🔬 Running ${messageText.replace('_', ' ')}...` : messageText;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ask-the-lab', {
        body: {
          query: messageText,
          action: isAction ? messageText : undefined,
        },
      });

      if (error) throw error;
      if (data?.error && !data?.response) throw new Error(data.error);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        context: data.context,
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Lab query error:', error);
      toast.error('Failed to get response from The Lab');
      
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I encountered an error processing your query. Please try again or rephrase your question.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
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
  };

  return (
    <Card className={cn(
      "flex flex-col border-2",
      isExpanded ? "fixed inset-4 z-50" : "h-[600px]",
      className
    )}
    style={{
      backgroundColor: "#0A0A0B",
      borderColor: "rgba(220, 38, 38, 0.4)",
      boxShadow: "0 0 40px rgba(220, 38, 38, 0.15)",
    }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ 
          borderColor: "rgba(220, 38, 38, 0.3)",
          background: "linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(220, 38, 38, 0.05) 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(220, 38, 38, 0.2)" }}
          >
            <FlaskConical className="w-5 h-5" style={{ color: "#DC2626" }} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              Ask The Lab
              <Badge 
                variant="outline" 
                className="text-[10px] border"
                style={{ 
                  backgroundColor: "rgba(220, 38, 38, 0.1)", 
                  color: "#DC2626", 
                  borderColor: "rgba(220, 38, 38, 0.3)" 
                }}
              >
                AI Research
              </Badge>
            </h3>
            <p className="text-xs text-slate-400">
              Query your athlete data with natural language
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

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div 
              className="p-4 rounded-lg border"
              style={{ 
                backgroundColor: "rgba(220, 38, 38, 0.05)",
                borderColor: "rgba(220, 38, 38, 0.2)",
              }}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: "rgba(220, 38, 38, 0.2)" }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: "#DC2626" }} />
                </div>
                <div>
                  <p className="text-sm text-slate-300">
                    Welcome to <span style={{ color: "#DC2626" }} className="font-bold">The Lab</span>. 
                    I have read-access to your entire athlete database including Reboot IK sessions and kinetic fingerprints.
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Try: "What is the average Brain score for my AA hitters?" or run a batch validation below.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-medium px-1">Quick Actions:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_QUERIES.map((prompt, i) => {
                  const IconComponent = prompt.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt.message, prompt.action)}
                      disabled={isLoading}
                      className="text-left text-xs px-3 py-3 rounded-lg border transition-all disabled:opacity-50 hover:scale-[1.02]"
                      style={{
                        backgroundColor: prompt.action ? "rgba(220, 38, 38, 0.1)" : "rgba(30, 30, 35, 0.8)",
                        borderColor: prompt.action ? "rgba(220, 38, 38, 0.4)" : "rgba(100, 100, 120, 0.3)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent 
                          className="w-4 h-4" 
                          style={{ color: prompt.action ? "#DC2626" : "#94a3b8" }}
                        />
                        <span className={prompt.action ? "text-white font-medium" : "text-slate-300"}>
                          {prompt.label}
                        </span>
                      </div>
                      {prompt.description && (
                        <p className="text-[10px] text-slate-500 mt-1 ml-6">{prompt.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <div 
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  )}
                  style={{
                    backgroundColor: msg.role === 'user' ? "rgba(59, 130, 246, 0.2)" : "rgba(220, 38, 38, 0.2)",
                  }}
                >
                  {msg.role === 'user' ? (
                    <User className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-1 text-slate-500">
                    {msg.role === 'user' ? 'You' : 'The Lab'}
                  </p>
                  <div 
                    className={cn(
                      "p-3 rounded-lg text-sm border"
                    )}
                    style={{
                      backgroundColor: msg.role === 'user' 
                        ? "rgba(59, 130, 246, 0.1)" 
                        : "rgba(20, 20, 25, 0.8)",
                      borderColor: msg.role === 'user'
                        ? "rgba(59, 130, 246, 0.2)"
                        : "rgba(220, 38, 38, 0.2)",
                    }}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-300">
                      {msg.content}
                    </p>
                  </div>
                  {msg.context && (
                    <div className="flex gap-2 mt-2">
                      {msg.context.playerCount !== undefined && msg.context.playerCount > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Database className="w-3 h-3 mr-1" />
                          {msg.context.playerCount} players
                        </Badge>
                      )}
                      {msg.context.sessionCount !== undefined && msg.context.sessionCount > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {msg.context.sessionCount} sessions
                        </Badge>
                      )}
                      {msg.context.validationCount !== undefined && msg.context.validationCount > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {msg.context.validationCount} validated
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(220, 38, 38, 0.2)" }}
                >
                  <Bot className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium mb-1 text-slate-500">The Lab</p>
                  <div 
                    className="p-3 rounded-lg border"
                    style={{
                      backgroundColor: "rgba(20, 20, 25, 0.8)",
                      borderColor: "rgba(220, 38, 38, 0.2)",
                    }}
                  >
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#DC2626" }} />
                      Analyzing your data...
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
      <div 
        className="p-3 border-t"
        style={{ 
          borderColor: "rgba(220, 38, 38, 0.2)",
          backgroundColor: "rgba(15, 15, 20, 0.5)",
        }}
      >
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            placeholder="Ask anything about your athletes..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="min-h-[50px] max-h-[120px] resize-none text-sm placeholder:text-slate-500"
            style={{
              backgroundColor: "rgba(30, 30, 40, 0.8)",
              borderColor: "rgba(100, 100, 120, 0.3)",
            }}
            rows={2}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0 h-[50px] w-[50px]"
            style={{ 
              backgroundColor: "#DC2626",
            }}
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
