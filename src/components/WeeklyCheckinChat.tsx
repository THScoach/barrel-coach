import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, CheckCircle2, Calendar, TrendingUp, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface CheckinState {
  currentQuestion: number;
  extractedData: Record<string, unknown>;
  isComplete: boolean;
  reportId?: string;
}

interface ExtractedData {
  games?: number;
  pa?: number;
  ab?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  home_runs?: number;
  bb?: number;
  k?: number;
  best_moment?: string;
  biggest_struggle?: string;
  training_tags?: string[];
  body_fatigue?: number;
  next_week_goal?: string;
}

interface WeeklyCheckinChatProps {
  playerId: string;
  playerName?: string;
  onComplete?: () => void;
}

export function WeeklyCheckinChat({ playerId, playerName, onComplete }: WeeklyCheckinChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(true);
  const [state, setState] = useState<CheckinState | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start the check-in on mount
  useEffect(() => {
    startCheckin();
  }, [playerId]);

  const startCheckin = async () => {
    setIsStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('weekly-checkin', {
        body: { playerId }
      });

      if (error) throw error;

      if (data?.response) {
        setMessages([{
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString()
        }]);
        setState(data.state);
      }
    } catch (error) {
      console.error('Failed to start check-in:', error);
      toast.error('Failed to start check-in. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || isComplete) return;

    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('weekly-checkin', {
        body: {
          playerId,
          message: messageText,
          messages: newMessages,
          state
        }
      });

      if (error) throw error;

      if (data?.response) {
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString()
        }]);
        setState(data.state);
        
        if (data.extractedData) {
          setExtractedData(data.extractedData);
        }

        if (data.isComplete) {
          setIsComplete(true);
          onComplete?.();
        }
      }
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Failed to send message. Please try again.');
      setMessages(messages); // Revert
    } finally {
      setIsLoading(false);
    }
  };

  const getProgress = () => {
    if (!state) return 0;
    return Math.min(100, (state.currentQuestion / 9) * 100);
  };

  // Calculate batting average for display
  const battingAvg = extractedData.ab && extractedData.ab > 0 
    ? ((extractedData.hits || 0) / extractedData.ab).toFixed(3).slice(1)
    : null;

  if (isStarting) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-muted-foreground">Starting check-in...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-bold">Weekly Check-In</h3>
            <p className="text-sm text-muted-foreground">
              {isComplete ? 'Complete!' : `Question ${Math.min(state?.currentQuestion || 1, 9)} of 9`}
            </p>
          </div>
        </div>
        
        {!isComplete && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${getProgress()}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{Math.round(getProgress())}%</span>
          </div>
        )}

        {isComplete && (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Complete
          </Badge>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl ${
              msg.role === 'user'
                ? 'bg-accent/10 ml-8 rounded-br-md'
                : 'bg-muted mr-8 rounded-bl-md'
            }`}
          >
            {msg.role === 'assistant' && (
              <p className="text-xs font-bold text-accent mb-2 uppercase tracking-wide">Coach Rick</p>
            )}
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className="p-4 rounded-xl bg-muted mr-8 rounded-bl-md">
            <p className="text-xs font-bold text-accent mb-2 uppercase tracking-wide">Coach Rick</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Typing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Live Data Preview (shows as data is collected) */}
      {Object.keys(extractedData).length > 0 && !isComplete && (
        <div className="px-4 py-2 bg-muted/50 border-t border-border">
          <div className="flex items-center gap-4 text-xs">
            {extractedData.games !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Games:</span>
                <span className="font-medium">{extractedData.games}</span>
              </div>
            )}
            {battingAvg && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">AVG:</span>
                <span className="font-medium">{battingAvg}</span>
              </div>
            )}
            {extractedData.body_fatigue !== undefined && (
              <div className="flex items-center gap-1">
                <Activity className={`w-3 h-3 ${extractedData.body_fatigue >= 7 ? 'text-destructive' : 'text-accent'}`} />
                <span className="font-medium">{extractedData.body_fatigue}/10</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Complete Summary Card */}
      {isComplete && Object.keys(extractedData).length > 0 && (
        <div className="p-4 border-t border-border bg-accent/5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">Week Summary</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 bg-background rounded-lg">
              <p className="text-lg font-bold">{extractedData.games || 0}</p>
              <p className="text-xs text-muted-foreground">Games</p>
            </div>
            <div className="text-center p-2 bg-background rounded-lg">
              <p className="text-lg font-bold">{battingAvg || '.000'}</p>
              <p className="text-xs text-muted-foreground">AVG</p>
            </div>
            <div className="text-center p-2 bg-background rounded-lg">
              <p className="text-lg font-bold">
                {(extractedData.doubles || 0) + (extractedData.triples || 0) + (extractedData.home_runs || 0)}
              </p>
              <p className="text-xs text-muted-foreground">XBH</p>
            </div>
            <div className="text-center p-2 bg-background rounded-lg">
              <p className={`text-lg font-bold ${(extractedData.body_fatigue || 0) >= 7 ? 'text-destructive' : ''}`}>
                {extractedData.body_fatigue || 0}
              </p>
              <p className="text-xs text-muted-foreground">Fatigue</p>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      {!isComplete && (
        <div className="p-4 border-t border-border bg-background">
          <div className="flex gap-2">
            <Input
              placeholder="Type your answer..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              disabled={isLoading}
              className="text-sm"
              autoFocus
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
      )}

      {isComplete && (
        <div className="p-4 border-t border-border bg-background">
          <p className="text-center text-sm text-muted-foreground">
            Check-in complete! Your data has been saved.
          </p>
        </div>
      )}
    </div>
  );
}
