import { format } from 'date-fns';
import { User2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface RickBotMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function RickBotMessage({ role, content, timestamp }: RickBotMessageProps) {
  const isAssistant = role === 'assistant';

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
          "h-8 w-8 rounded-full shrink-0 flex items-center justify-center",
          isAssistant ? "bg-orange-500/20" : "bg-primary/10"
        )}
      >
        {isAssistant ? (
          <Zap className="h-4 w-4 text-orange-500" />
        ) : (
          <User2 className="h-4 w-4 text-primary" />
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
          {isAssistant ? (
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
          )}
        </div>

        {/* Timestamp */}
        <div className={cn("flex items-center gap-2 px-1", !isAssistant && "flex-row-reverse")}>
          <span className="text-xs text-muted-foreground">
            {format(timestamp, 'h:mm a')}
          </span>
        </div>
      </div>
    </div>
  );
}
