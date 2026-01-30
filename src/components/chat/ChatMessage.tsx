import { format } from 'date-fns';
import { ThumbsUp, ThumbsDown, Pencil, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThinkingIndicator } from './ThinkingIndicator';

interface ChatMessageProps {
  id: string;
  role: 'player' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  onRate?: (rating: 'good' | 'bad') => void;
  onEdit?: () => void;
  showAdminControls?: boolean;
}

export function ChatMessage({
  id,
  role,
  content,
  timestamp,
  isLoading,
  onRate,
  onEdit,
  showAdminControls,
}: ChatMessageProps) {
  const isAssistant = role === 'assistant';

  if (isLoading) {
    return (
      <div className="flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2">
        <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-accent" />
        </div>
        <div className="flex-1">
          <div className="p-3 rounded-lg bg-muted/50 inline-block max-w-[85%]">
            <ThinkingIndicator />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 group animate-in fade-in-0 slide-in-from-bottom-2",
        !isAssistant && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
          isAssistant ? "bg-accent/10" : "bg-primary/10"
        )}
      >
        {isAssistant ? (
          <Bot className="h-4 w-4 text-accent" />
        ) : (
          <User className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn("flex-1 space-y-1", !isAssistant && "flex flex-col items-end")}>
        <div
          className={cn(
            "p-3 rounded-lg inline-block max-w-[85%]",
            isAssistant
              ? "bg-muted/50 text-foreground"
              : "bg-primary text-primary-foreground"
          )}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        </div>

        {/* Timestamp and Admin Controls */}
        <div
          className={cn(
            "flex items-center gap-2 px-1",
            !isAssistant && "flex-row-reverse"
          )}
        >
          <span className="text-xs text-muted-foreground">
            {format(timestamp, 'h:mm a')}
          </span>

          {/* Admin rating controls - show on hover for assistant messages */}
          {isAssistant && showAdminControls && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onRate?.('good')}
                title="Good response"
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onRate?.('bad')}
                title="Bad response"
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onEdit}
                title="Edit response"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
