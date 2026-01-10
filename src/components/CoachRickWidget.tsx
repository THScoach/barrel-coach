import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, X, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLocation, Link } from 'react-router-dom';

interface DrillVideo {
  id: string;
  title: string;
  description: string | null;
  four_b_category: string | null;
  duration_seconds: number | null;
  video_url: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  drills?: DrillVideo[];
}

const QUICK_ACTIONS = [
  { label: "What's the 4B System?", message: "What's the 4B System?" },
  { label: "How do I upload my video?", message: "How do I upload my video?" },
  { label: "What happens after I pay?", message: "What happens after I pay?" },
  { label: "I found a bug", message: "I found a bug in the app and want to report it." },
  { label: "I have a suggestion", message: "I have a suggestion for improving the app." },
];

const STORAGE_KEY = 'coach-rick-chat-state';

export function CoachRickWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatLogId, setChatLogId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Load state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        setMessages(state.messages?.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })) || []);
        setChatLogId(state.chatLogId || null);
      }
    } catch (e) {
      console.error('Failed to load chat state:', e);
    }
  }, []);

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        messages,
        chatLogId
      }));
    } catch (e) {
      console.error('Failed to save chat state:', e);
    }
  }, [messages, chatLogId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getPageContext = (pathname: string): string => {
    const contexts: Record<string, string> = {
      '/': 'User is on the homepage, viewing product options',
      '/analyze': 'User is on the analyze page, ready to submit their swing video',
      '/library': 'User is browsing the drill video library',
      '/inner-circle': 'User is viewing the Inner Circle subscription page',
      '/assessment': 'User is viewing the In-Person Assessment page',
      '/about': 'User is on the About page learning about Coach Rick',
      '/login': 'User is on the login page',
      '/signup': 'User is on the signup page',
    };
    
    if (pathname.startsWith('/results/')) {
      return 'User is viewing their swing analysis results';
    }
    if (pathname.startsWith('/admin/')) {
      return 'User is an admin using the admin dashboard';
    }
    
    return contexts[pathname] || 'User is browsing the app';
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('coach-rick-chat', {
        body: {
          message: messageText,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          pageContext: getPageContext(location.pathname),
          pageUrl: location.pathname,
          chatLogId,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        drills: data.drills
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

  const clearChat = () => {
    setMessages([]);
    setChatLogId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-accent text-accent-foreground px-4 py-3 rounded-full shadow-lg hover:bg-accent/90 transition-all hover:scale-105"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="font-semibold text-sm">Ask Rick</span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-32px)] h-[500px] max-h-[calc(100vh-100px)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden md:w-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Coach Rick AI</h3>
                <p className="text-xs text-muted-foreground">Your hitting coach</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearChat}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs font-semibold text-accent mb-1">COACH RICK</p>
                  <p className="text-sm">Hey! I'm Coach Rick. What can I help you with?</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Quick questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_ACTIONS.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(action.message)}
                        disabled={isLoading}
                        className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-2">
                    <div
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-accent/10 ml-8'
                          : 'bg-muted mr-4'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <p className="text-xs font-semibold text-accent mb-1">COACH RICK</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    
                    {/* Drill Recommendations */}
                    {msg.drills && msg.drills.length > 0 && (
                      <div className="mr-4 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground px-1">RECOMMENDED DRILLS</p>
                        {msg.drills.map((drill) => (
                          <Link
                            key={drill.id}
                            to={`/library?video=${drill.id}`}
                            className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="w-12 h-8 bg-muted rounded flex items-center justify-center shrink-0">
                              <Play className="w-3 h-3 text-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{drill.title}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {drill.four_b_category && (
                                  <Badge variant="outline" className="text-[9px] capitalize h-4 px-1">
                                    {drill.four_b_category}
                                  </Badge>
                                )}
                                {drill.duration_seconds && (
                                  <span className="text-[9px] text-muted-foreground">
                                    {Math.floor(drill.duration_seconds / 60)}:{(drill.duration_seconds % 60).toString().padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {isLoading && (
                  <div className="p-3 rounded-lg bg-muted mr-4">
                    <p className="text-xs font-semibold text-accent mb-1">COACH RICK</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-muted/30">
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                disabled={isLoading}
                className="text-sm"
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}