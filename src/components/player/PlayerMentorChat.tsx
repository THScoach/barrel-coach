import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, X, Loader2, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface DrillVideo {
  id: string;
  title: string;
  description: string | null;
  four_b_category: string | null;
  duration_seconds: number | null;
  video_url: string;
  thumbnail_url?: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  drills?: DrillVideo[];
}

interface PlayerMentorChatProps {
  playerId: string;
  playerName?: string;
  latestScores?: {
    brain?: number | null;
    body?: number | null;
    bat?: number | null;
    ball?: number | null;
    composite?: number;
  };
  weakestCategory?: string;
  isOpen: boolean;
  onClose: () => void;
}

const PLAYER_QUICK_QUESTIONS = [
  { label: "Why is my score low?", message: "Why is my weakest score so low? What's causing it?" },
  { label: "Did I get better?", message: "Did I get better compared to my last session?" },
  { label: "What should I work on?", message: "What's the ONE thing I should focus on this week?" },
  { label: "How do I fix this?", message: "How do I fix my main issue? Give me a simple drill." },
];

export function PlayerMentorChat({
  playerId,
  playerName,
  latestScores,
  weakestCategory,
  isOpen,
  onClose,
}: PlayerMentorChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatLogId, setChatLogId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      const { data, error } = await supabase.functions.invoke('coach-rick-chat', {
        body: {
          message: messageText,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          chatMode: 'player',
          playerId,
          scores: latestScores ? {
            brain: latestScores.brain,
            body: latestScores.body,
            bat: latestScores.bat,
            ball: latestScores.ball,
          } : undefined,
          weakestCategory,
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
        drills: data.drills,
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg h-[80vh] max-h-[600px] flex flex-col bg-background border animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                Coach Rick
                <Badge variant="secondary" className="text-[10px]">AI Mentor</Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                {playerName ? `Hey ${playerName.split(' ')[0]}!` : 'Your personal hitting coach'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Current Scores Banner */}
        {latestScores && (
          <div className="px-4 py-2 bg-primary/5 border-b">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Your current scores:</span>
              <div className="flex gap-2">
                <span className={cn(weakestCategory === 'brain' && "text-red-500 font-bold")}>
                  Brain: {latestScores.brain || '--'}
                </span>
                <span className={cn(weakestCategory === 'body' && "text-red-500 font-bold")}>
                  Body: {latestScores.body || '--'}
                </span>
                <span className={cn(weakestCategory === 'bat' && "text-red-500 font-bold")}>
                  Bat: {latestScores.bat || '--'}
                </span>
                <span className={cn(weakestCategory === 'ball' && "text-red-500 font-bold")}>
                  Ball: {latestScores.ball || '--'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              {/* Welcome Message */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm">
                      Hey{playerName ? ` ${playerName.split(' ')[0]}` : ''}! I'm Coach Rick.
                    </p>
                    <p className="text-sm mt-2">
                      {latestScores?.composite ? (
                        <>
                          Your composite score is <span className="font-bold text-primary">{latestScores.composite}</span>.
                          {weakestCategory && (
                            <> Your <span className="font-bold capitalize">{weakestCategory}</span> needs the most work right now.</>
                          )}
                        </>
                      ) : (
                        "I don't have any scores for you yet. Upload a swing and let's see what you've got!"
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      What do you want to know?
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Questions */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium px-1">Quick questions:</p>
                <div className="flex flex-wrap gap-2">
                  {PLAYER_QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q.message)}
                      disabled={isLoading}
                      className="text-xs px-3 py-2 rounded-full border hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  <div className={cn(
                    "p-3 rounded-xl",
                    msg.role === 'user'
                      ? "bg-primary/10 ml-8"
                      : "bg-muted mr-4"
                  )}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-3 h-3 text-primary" />
                        <span className="text-xs font-semibold text-primary">COACH RICK</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>

                  {/* Drill Recommendations */}
                  {msg.drills && msg.drills.length > 0 && (
                    <div className="mr-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground px-1">
                        YOUR DRILL
                      </p>
                      {msg.drills.slice(0, 1).map((drill) => (
                        <Link
                          key={drill.id}
                          to={`/player/drills?video=${drill.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="w-14 h-10 bg-muted rounded overflow-hidden flex items-center justify-center shrink-0 relative">
                            {drill.thumbnail_url ? (
                              <img
                                src={drill.thumbnail_url}
                                alt={drill.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Play className="w-4 h-4 text-primary" />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="w-3 h-3 text-white drop-shadow" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{drill.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {drill.four_b_category && (
                                <Badge variant="outline" className="text-[10px] capitalize h-5">
                                  {drill.four_b_category}
                                </Badge>
                              )}
                              {drill.duration_seconds && (
                                <span className="text-[10px] text-muted-foreground">
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
                <div className="p-3 rounded-xl bg-muted mr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="w-3 h-3 text-primary" />
                    <span className="text-xs font-semibold text-primary">COACH RICK</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t bg-muted/30">
          <div className="flex gap-2">
            <Input
              placeholder="Ask Coach Rick anything..."
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
      </Card>
    </div>
  );
}

// Floating button component for player pages
export function PlayerMentorChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="font-semibold text-sm">Ask Coach Rick</span>
    </button>
  );
}
