import { useRef, useEffect } from 'react';
import { Mic, MicOff, Settings, Trash2, User2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RickBotMessage } from '@/components/rickbot/RickBotMessage';
import { RickBotInput } from '@/components/rickbot/RickBotInput';
import { PlayerDataCard } from '@/components/rickbot/PlayerDataCard';
import { useRickBot } from '@/hooks/useRickBot';
import { Skeleton } from '@/components/ui/skeleton';
import rickBotAvatar from '@/assets/rickbot-avatar.png';

export default function Rick() {
  const {
    messages,
    isLoading,
    isListening,
    isTranscribing,
    playerData,
    sendMessage,
    clearChat,
    toggleVoice,
    transcript,
  } = useRickBot();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, playerData]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center overflow-hidden">
            <img 
              src={rickBotAvatar} 
              alt="RickBot" 
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.classList.add('fallback');
              }}
            />
            <Zap className="h-5 w-5 text-orange-500 hidden" />
          </div>
          <div>
            <h1 className="font-bold text-base flex items-center gap-2">
              RickBot
              <Badge variant="secondary" className="text-[10px] h-5">
                Command Center
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">Your personal operator</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Voice status indicator */}
          {isListening && (
            <Badge variant="outline" className="animate-pulse border-green-500 text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              Listening...
            </Badge>
          )}
          {isTranscribing && (
            <Badge variant="outline" className="animate-pulse border-blue-500 text-blue-500">
              Processing...
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={clearChat}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {/* Welcome message if no messages */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <div className="h-20 w-20 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-10 w-10 text-orange-500" />
              </div>
              <h2 className="font-bold text-xl mb-2">Welcome, Coach</h2>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                I'm RickBot, your command center. Talk to me or type - I'll pull data, generate reports, manage content, and keep you informed.
              </p>
              
              {/* Quick action buttons */}
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {[
                  "Pull Connor's data",
                  "Who needs attention?",
                  "How are we doing?",
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

              {/* Commands reference */}
              <div className="bg-muted/50 rounded-lg p-4 max-w-lg mx-auto text-left">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <User2 className="h-4 w-4" />
                  Sample Commands
                </h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li><code className="bg-muted px-1 rounded">"Pull Marcus's data"</code> - Fetch player 4B scores</li>
                  <li><code className="bg-muted px-1 rounded">"Who needs attention?"</code> - Flag players needing action</li>
                  <li><code className="bg-muted px-1 rounded">"Generate his report"</code> - Create Lab Report</li>
                  <li><code className="bg-muted px-1 rounded">"How are we doing?"</code> - Show business stats</li>
                </ul>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <RickBotMessage
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
            />
          ))}

          {/* Player Data Card */}
          {playerData && (
            <PlayerDataCard player={playerData} />
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2">
              <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex-1">
                <div className="p-3 rounded-lg bg-muted/50 inline-block">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live transcript while listening */}
          {transcript && isListening && (
            <div className="flex gap-3 animate-in fade-in-0">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User2 className="h-4 w-4 text-primary" />
              </div>
              <div className="p-3 rounded-lg bg-primary/10 inline-block">
                <p className="text-sm italic text-muted-foreground">{transcript}...</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <RickBotInput
        onSend={sendMessage}
        onToggleVoice={toggleVoice}
        isLoading={isLoading}
        isListening={isListening}
        isTranscribing={isTranscribing}
      />
    </div>
  );
}
