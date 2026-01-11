import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  fromCoach: boolean;
  timestamp: Date;
}

export default function PlayerMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load messages - placeholder data
    setMessages([
      {
        id: '1',
        content: "Hey! I watched your latest swing video. Great improvement on staying connected through the zone. Let's work on getting a bit more hip rotation next session.",
        fromCoach: true,
        timestamp: new Date(Date.now() - 86400000), // 1 day ago
      },
      {
        id: '2',
        content: "Thanks Coach! I've been focusing on the drills you assigned. Should I upload another video today?",
        fromCoach: false,
        timestamp: new Date(Date.now() - 82800000),
      },
      {
        id: '3',
        content: "Yes, please do! Try to get one from the side angle this time so I can see your hip turn better. Keep up the great work! 💪",
        fromCoach: true,
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      },
    ]);
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      content: newMessage,
      fromCoach: false,
      timestamp: new Date(),
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:ml-56 flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-bold mb-4">Messages</h1>

      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Coach Header */}
        <CardHeader className="border-b py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary text-primary-foreground">CR</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">Coach Rick</p>
              <p className="text-xs text-muted-foreground">Your Coach</p>
            </div>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.fromCoach ? "justify-start" : "justify-end"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] p-3 rounded-lg",
                    message.fromCoach
                      ? "bg-muted"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  <p className="text-sm">{message.content}</p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      message.fromCoach
                        ? "text-muted-foreground"
                        : "text-primary-foreground/70"
                    )}
                  >
                    {format(message.timestamp, 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button onClick={handleSend} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
