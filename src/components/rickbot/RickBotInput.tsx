import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface RickBotInputProps {
  onSend: (message: string) => void;
  onToggleVoice: () => void;
  isLoading: boolean;
  isListening: boolean;
  isTranscribing: boolean;
}

export function RickBotInput({ 
  onSend, 
  onToggleVoice, 
  isLoading, 
  isListening,
  isTranscribing 
}: RickBotInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isListening && !isTranscribing) {
      textareaRef.current?.focus();
    }
  }, [isListening, isTranscribing]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-4 border-t border-border bg-card">
      {/* Voice button */}
      <Button
        onClick={onToggleVoice}
        disabled={isLoading || isTranscribing}
        variant={isListening ? "default" : "outline"}
        size="icon"
        className={cn(
          "shrink-0 h-11 w-11 transition-all",
          isListening && "bg-green-500 hover:bg-green-600 animate-pulse"
        )}
        title={isListening ? "Stop listening" : "Start voice input"}
      >
        {isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isListening ? "Listening... speak now" : "Type a command or tap the mic..."}
        disabled={isLoading || isListening}
        className="min-h-[44px] max-h-32 resize-none"
        rows={1}
      />
      
      <Button
        onClick={handleSend}
        disabled={!input.trim() || isLoading}
        size="icon"
        className="shrink-0 h-11 w-11"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
