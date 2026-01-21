import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, MessageCircle, ChevronRight, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  type: string;
  summary: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  playerId: string;
}

export function NotificationBell({ playerId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();

    // Realtime subscription
    const channel = supabase
      .channel('notification-bell')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'locker_room_messages',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          const newNotif = {
            id: payload.new.id as string,
            type: payload.new.message_type as string,
            summary: payload.new.summary as string | null,
            content: payload.new.content as string,
            is_read: false,
            created_at: payload.new.created_at as string,
          };
          setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId]);

  const loadNotifications = async () => {
    const { data, error } = await supabase
      .from("locker_room_messages")
      .select("id, message_type, summary, content, is_read, created_at")
      .eq("player_id", playerId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!error && data) {
      setNotifications(data.map(d => ({
        id: d.id,
        type: d.message_type,
        summary: d.summary,
        content: d.content,
        is_read: d.is_read,
        created_at: d.created_at,
      })));
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  };

  const markAsRead = async (notifId: string) => {
    await supabase
      .from("locker_room_messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notifId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    setOpen(false);
    navigate("/player/messages");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "p-3 cursor-pointer transition-colors hover:bg-muted/50",
                    !notif.is_read && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Coach Rick</span>
                        {!notif.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {notif.summary || notif.content.slice(0, 50)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notif.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              navigate("/player/messages");
            }}
          >
            View All Messages
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
