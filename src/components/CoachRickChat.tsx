import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FourBScores } from '@/types/analysis';
import coachRickAvatar from '@/assets/coach-rick-avatar.png';

interface CoachRickChatProps {
  scores: FourBScores;
  weakestCategory: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What should I work on first?",
  "What drill will help me most?",
  "Why is my weakest score low?",
];

export function CoachRickChat({ scores, weakestCategory }: CoachRickChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('coach-rick-ai-chat', {
        body: {
          message: messageText,
          scores,
          weakestCategory,
          history: messages, // Send conversation history for multi-turn support
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.response 
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to get response. Please try again.');
      // Remove the user message if we couldn't get a response
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    // Replace "weakest" with the actual category name
    const formattedQuestion = question.replace('weakest', weakestCategory);
    sendMessage(formattedQuestion);
  };

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full overflow-hidden">
          <img src={coachRickAvatar} alt="Coach Rick" className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="text-lg font-bold">ASK COACH RICK</h2>
          <p className="text-sm text-muted-foreground">Get personalized advice about your swing</p>
        </div>
      </div>

      {/* Suggested Questions */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {SUGGESTED_QUESTIONS.map((question, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => handleSuggestedQuestion(question)}
              disabled={isLoading}
              className="text-xs"
            >
              {question.replace('weakest', weakestCategory)}
            </Button>
          ))}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="space-y-4 mb-6 max-h-80 overflow-y-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-accent/10 ml-8'
                  : 'bg-muted mr-8'
              }`}
            >
              {msg.role === 'assistant' && (
                <p className="text-xs font-semibold text-accent mb-2">COACH RICK</p>
              )}
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
          {isLoading && (
            <div className="p-4 rounded-lg bg-muted mr-8">
              <p className="text-xs font-semibold text-accent mb-2">COACH RICK</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Ask Coach Rick a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          disabled={isLoading}
        />
        <Button 
          onClick={() => sendMessage(input)} 
          disabled={!input.trim() || isLoading}
          size="icon"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
