import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageCircle, 
  Brain, 
  Dumbbell, 
  Crosshair, 
  Target,
  Play,
  Check,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface DrillLink {
  drill_name: string;
  video_url?: string;
  thumbnail_url?: string;
}

interface LockerMessage {
  id: string;
  message_type: string;
  trigger_reason: string | null;
  content: string;
  summary: string | null;
  drill_links: DrillLink[] | null;
  four_b_context: {
    brain?: number | null;
    body?: number | null;
    bat?: number | null;
    ball?: number | null;
  } | null;
  is_read: boolean;
  created_at: string;
}

interface LockerRoomMessagesProps {
  playerId: string;
  compact?: boolean;
  maxMessages?: number;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case "brain": return Brain;
    case "body": return Dumbbell;
    case "bat": return Crosshair;
    case "ball": return Target;
    default: return MessageCircle;
  }
};

const getMessageTypeColor = (type: string) => {
  switch (type) {
    case "score_alert": return "text-orange-500";
    case "motivation": return "text-blue-500";
    case "drill_reminder": return "text-purple-500";
    case "coaching": return "text-green-500";
    default: return "text-muted-foreground";
  }
};

export function LockerRoomMessages({ 
  playerId, 
  compact = false,
  maxMessages = 10 
}: LockerRoomMessagesProps) {
  const [messages, setMessages] = useState<LockerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('locker-room-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'locker_room_messages',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          const newMessage = payload.new as LockerMessage;
          setMessages((prev) => [newMessage, ...prev].slice(0, maxMessages));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, maxMessages]);

  const loadMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locker_room_messages")
      .select("*")
      .eq("player_id", playerId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(maxMessages);

    if (!error && data) {
      const typedMessages: LockerMessage[] = data.map((d) => ({
        id: d.id,
        message_type: d.message_type,
        trigger_reason: d.trigger_reason,
        content: d.content,
        summary: d.summary,
        drill_links: (d.drill_links as unknown) as DrillLink[] | null,
        four_b_context: (d.four_b_context as unknown) as LockerMessage["four_b_context"],
        is_read: d.is_read,
        created_at: d.created_at,
      }));
      setMessages(typedMessages);
    }
    setLoading(false);
  };

  const markAsRead = async (messageId: string) => {
    await supabase
      .from("locker_room_messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", messageId);
    
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
    );
  };

  const handleExpand = (message: LockerMessage) => {
    if (!message.is_read) {
      markAsRead(message.id);
    }
    setExpandedId(expandedId === message.id ? null : message.id);
  };

  const unreadCount = messages.filter((m) => !m.is_read).length;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Locker Room
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Locker Room
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No messages yet</p>
            <p className="text-sm">Coach Rick will drop insights here after your sessions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Locker Room
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          {!compact && (
            <Button variant="ghost" size="sm" onClick={loadMessages}>
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={compact ? "h-[300px]" : "h-[400px]"}>
          <div className="divide-y">
            {messages.map((message) => {
              const isExpanded = expandedId === message.id;
              const weakestCategory = message.four_b_context
                ? Object.entries(message.four_b_context)
                    .filter(([, v]) => v !== null)
                    .sort(([, a], [, b]) => (a as number) - (b as number))[0]?.[0]
                : null;
              const CategoryIcon = weakestCategory 
                ? getCategoryIcon(weakestCategory) 
                : MessageCircle;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                    !message.is_read && "bg-primary/5"
                  )}
                  onClick={() => handleExpand(message)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        CR
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">Coach Rick</span>
                        {!message.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(message.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>

                      {!isExpanded ? (
                        <div className="flex items-center gap-2">
                          <CategoryIcon 
                            className={cn("h-4 w-4", getMessageTypeColor(message.message_type))} 
                          />
                          <p className="text-sm text-muted-foreground truncate">
                            {message.summary || message.content.slice(0, 60)}
                          </p>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      ) : (
                        <div className="space-y-3 animate-in fade-in-50 duration-200">
                          <p className="text-sm leading-relaxed">{message.content}</p>

                          {/* 4B Context */}
                          {message.four_b_context && (
                            <div className="flex gap-2 flex-wrap">
                              {Object.entries(message.four_b_context)
                                .filter(([, v]) => v !== null)
                                .map(([key, value]) => {
                                  const Icon = getCategoryIcon(key);
                                  const score = value as number;
                                  return (
                                    <Badge
                                      key={key}
                                      variant="outline"
                                      className={cn(
                                        "text-xs",
                                        score < 45 && "border-orange-500 text-orange-600",
                                        score >= 45 && score < 55 && "border-yellow-500 text-yellow-600",
                                        score >= 55 && "border-green-500 text-green-600"
                                      )}
                                    >
                                      <Icon className="h-3 w-3 mr-1" />
                                      {key}: {score}
                                    </Badge>
                                  );
                                })}
                            </div>
                          )}

                          {/* Drill Links with Thumbnails */}
                          {message.drill_links && message.drill_links.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Recommended Drills
                              </p>
                              {message.drill_links.map((drill, idx) => (
                                <Button
                                  key={idx}
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start gap-3 h-auto py-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (drill.video_url) {
                                      window.open(drill.video_url, "_blank");
                                    }
                                  }}
                                >
                                  {drill.thumbnail_url ? (
                                    <img 
                                      src={drill.thumbnail_url} 
                                      alt={drill.drill_name}
                                      className="w-12 h-8 object-cover rounded"
                                    />
                                  ) : (
                                    <div className="w-12 h-8 bg-muted rounded flex items-center justify-center">
                                      <Play className="h-4 w-4" />
                                    </div>
                                  )}
                                  <div className="flex-1 text-left">
                                    <p className="font-medium text-sm">{drill.drill_name}</p>
                                    {drill.video_url && (
                                      <p className="text-xs text-muted-foreground">
                                        Watch in The Vault →
                                      </p>
                                    )}
                                  </div>
                                </Button>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-2">
                            {message.is_read && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Check className="h-3 w-3" /> Read
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
