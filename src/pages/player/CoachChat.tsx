import { useRef, useEffect } from 'react';
import { Bot, MoreVertical, Trash2, History, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { useCoachChat } from '@/hooks/useCoachChat';
import { Skeleton } from '@/components/ui/skeleton';

export default function CoachChat() {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    rateMessage,
    playerContext,
    isInitializing,
  } = useCoachChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (isInitializing) {
    return (
      <div className="flex flex-col h-[calc(100vh-60px)] md:ml-56">
        <div className="border-b border-border p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="h-12 w-1/2 ml-auto" />
          <Skeleton className="h-20 w-3/4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-60px)] md:ml-56 p-4">
        <Bot className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">Unable to Start Chat</h2>
        <p className="text-muted-foreground text-center mb-4">{error}</p>
        <Button asChild>
          <Link to="/player">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] md:ml-56 bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/player" className="md:hidden">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-bold text-base">Coach Rick AI</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {playerContext?.motorProfile && (
                <Badge variant="outline" className="text-[10px] h-5 capitalize">
                  {playerContext.motorProfile}
                </Badge>
              )}
              {playerContext?.compositeScore && (
                <span>4B: {Math.round(playerContext.compositeScore)}</span>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={clearChat}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Chat
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <History className="h-4 w-4 mr-2" />
              View History
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Welcome message if no messages */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Bot className="h-8 w-8 text-accent" />
              </div>
              <h2 className="font-bold text-lg mb-2">Hey! Ready to hunt some barrels?</h2>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                I'm Coach Rick, your personal hitting coach. Ask me about your swing, drills, or the 4B System.
              </p>
              
              {/* Quick action buttons */}
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "What should I work on?",
                  "Explain my 4B scores",
                  "Recommend a drill",
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => sendMessage(suggestion)}
                    disabled={isLoading}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              id={message.id}
              role={message.role}
              content={message.content}
              timestamp={new Date(message.created_at)}
              onRate={(rating) => rateMessage(message.id, rating)}
              showAdminControls={false}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <ChatMessage
              id="loading"
              role="assistant"
              content=""
              timestamp={new Date()}
              isLoading
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading}
        placeholder="Ask Coach Rick anything..."
      />
    </div>
  );
}
