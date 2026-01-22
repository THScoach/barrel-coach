/**
 * Player Communication Tab
 * ========================
 * Unified feed showing:
 * - Direct messages (SMS/Email)
 * - System logs (leak detected, analysis complete)
 * - Drill completion notifications
 * 
 * Branding: Catching Barrels Laboratory
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, MessageSquare, Mail, Bell, Send, Inbox, Bot, 
  AlertTriangle, Dumbbell, CheckCircle2, Activity, Clock,
  ArrowUpRight, ArrowDownLeft, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

interface PlayerCommunicationTabProps {
  playerId: string;
  playerName: string;
}

type MessageChannel = 'sms' | 'email' | 'app';
type FeedItemType = 'message' | 'system' | 'drill';

interface FeedItem {
  id: string;
  type: FeedItemType;
  channel?: MessageChannel;
  direction?: 'inbound' | 'outbound';
  title: string;
  body: string;
  timestamp: string;
  metadata?: Record<string, any>;
  isAiGenerated?: boolean;
  status?: string;
}

export function PlayerCommunicationTab({ playerId, playerName }: PlayerCommunicationTabProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'system' | 'drills'>('all');
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingTestSms, setSendingTestSms] = useState(false);
  const [newMessage, setNewMessage] = useState({
    channel: 'sms' as MessageChannel,
    content: '',
  });

  const handleSendTestSms = async () => {
    setSendingTestSms(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-coach-rick-sms", {
        body: {
          type: "custom",
          player_id: playerId,
          skip_ai: true,
          custom_message: `🧪 Test SMS from Catching Barrels Lab at ${new Date().toLocaleTimeString()}`,
        },
      });

      if (error) {
        console.error("Test SMS function error:", error);
        throw error;
      }

      if (data && !data.success) {
        if (data.reason === "no_phone") {
          toast.error("Player has no phone number on file");
        } else if (data.reason === "opted_out") {
          toast.error("Player has opted out of SMS");
        } else {
          toast.error(data.error || "Failed to send test SMS");
        }
        return;
      }

      toast.success("Test SMS sent successfully!", {
        description: `SID: ${data?.sid?.slice(-8) || 'N/A'}`,
      });
    } catch (error) {
      console.error("Test SMS error:", error);
      toast.error("Failed to send test SMS");
    } finally {
      setSendingTestSms(false);
    }
  };

  // Fetch messages
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["player-messages", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch activity log (system events)
  const { data: activityLog, isLoading: loadingActivity } = useQuery({
    queryKey: ["player-activity", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch drill completions
  const { data: drillCompletions, isLoading: loadingDrills } = useQuery({
    queryKey: ["player-drill-completions", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drill_completions")
        .select(`
          id,
          completed_at,
          sets_completed,
          reps_completed,
          notes,
          rating,
          drills (
            id,
            name,
            four_b_category
          )
        `)
        .eq("player_id", playerId)
        .order("completed_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
  });

  // Transform data into unified feed
  const feedItems: FeedItem[] = [
    // Messages
    ...(messages || []).map((msg): FeedItem => ({
      id: msg.id,
      type: 'message',
      channel: msg.trigger_type?.includes('email') ? 'email' : 'sms',
      direction: msg.direction as 'inbound' | 'outbound',
      title: msg.direction === 'inbound' ? `Message from ${playerName}` : 'Message sent',
      body: msg.body,
      timestamp: msg.created_at,
      isAiGenerated: msg.ai_generated,
      status: msg.status,
    })),
    // System events
    ...(activityLog || []).map((log): FeedItem => {
      const metadata = log.metadata as Record<string, any> || {};
      let title = log.action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'System Event';
      
      // Custom titles for specific actions
      if (log.action === 'leak_detected') {
        title = `⚠️ New Leak Detected: ${metadata.leak_type || 'Unknown'}`;
      } else if (log.action === 'analysis_complete') {
        title = `📊 Analysis Complete - Score: ${metadata.composite_score || '--'}`;
      } else if (log.action === 'sms_sent') {
        title = `📱 SMS Sent`;
      } else if (log.action === 'email_sent') {
        title = `📧 Email Sent`;
      }

      return {
        id: log.id,
        type: 'system',
        title,
        body: log.description || '',
        timestamp: log.created_at || '',
        metadata,
      };
    }),
    // Drill completions
    ...(drillCompletions || []).map((dc): FeedItem => {
      const drill = dc.drills as any;
      return {
        id: dc.id,
        type: 'drill',
        title: `✅ Drill Completed: ${drill?.name || 'Unknown Drill'}`,
        body: `${dc.sets_completed || 0} sets × ${dc.reps_completed || 0} reps${dc.notes ? ` • ${dc.notes}` : ''}`,
        timestamp: dc.completed_at || '',
        metadata: {
          category: drill?.four_b_category,
          rating: dc.rating,
        },
      };
    }),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter based on active tab
  const filteredItems = feedItems.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'messages') return item.type === 'message';
    if (activeTab === 'system') return item.type === 'system';
    if (activeTab === 'drills') return item.type === 'drill';
    return true;
  });

  const handleSend = async () => {
    if (!newMessage.content.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setSending(true);
    try {
      // Get player contact info
      const { data: player, error: playerFetchError } = await supabase
        .from("players")
        .select("phone, email")
        .eq("id", playerId)
        .single();

      if (playerFetchError) {
        console.error("Failed to fetch player:", playerFetchError);
        toast.error("Failed to fetch player info");
        return;
      }

      if (newMessage.channel === 'sms') {
        if (!player?.phone) {
          toast.error("Player has no phone number on file");
          setSending(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke("send-coach-rick-sms", {
          body: {
            type: "custom",
            player_id: playerId,
            skip_ai: true,
            custom_message: newMessage.content,
          },
        });

        if (error) {
          console.error("SMS function error:", error);
          throw error;
        }
        
        if (data && !data.success) {
          if (data.reason === "no_phone") {
            toast.error("Player has no phone number on file");
          } else if (data.reason === "opted_out") {
            toast.error("Player has opted out of SMS");
          } else {
            toast.error(data.error || "Failed to send SMS");
          }
          setSending(false);
          return;
        }
        
        toast.success("SMS sent successfully!");
      } else if (newMessage.channel === 'email') {
        if (!player?.email) {
          toast.error("Player has no email address on file");
          setSending(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke("send-player-email", {
          body: {
            player_id: playerId,
            message: newMessage.content,
            subject: `Message from Coach Rick`,
          },
        });

        if (error) {
          console.error("Email function error:", error);
          throw error;
        }
        
        if (data && !data.success) {
          if (data.reason === "no_email") {
            toast.error("Player has no email on file");
          } else {
            toast.error(data.error || "Failed to send email");
          }
          setSending(false);
          return;
        }
        
        toast.success("Email sent successfully!");
      }

      setComposeOpen(false);
      setNewMessage({ channel: 'sms', content: '' });
    } catch (error) {
      console.error("Send error:", error);
      toast.error("Failed to send message. Check the console for details.");
    } finally {
      setSending(false);
    }
  };

  const isLoading = loadingMessages || loadingActivity || loadingDrills;

  const getItemIcon = (item: FeedItem) => {
    if (item.type === 'message') {
      if (item.channel === 'email') return <Mail className="h-4 w-4 text-blue-400" />;
      if (item.direction === 'inbound') return <ArrowDownLeft className="h-4 w-4 text-emerald-400" />;
      return <ArrowUpRight className="h-4 w-4 text-[#DC2626]" />;
    }
    if (item.type === 'drill') return <Dumbbell className="h-4 w-4 text-orange-400" />;
    if (item.title.includes('Leak')) return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    if (item.title.includes('Analysis')) return <Activity className="h-4 w-4 text-blue-400" />;
    return <Bell className="h-4 w-4 text-slate-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-white">Communication Feed</h3>
          <p className="text-sm text-slate-400">Messages, system logs, and drill completions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleSendTestSms}
            disabled={sendingTestSms}
            className="border-amber-600 text-amber-500 hover:bg-amber-950/50"
          >
            {sendingTestSms ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Test SMS
          </Button>
          <Button 
            onClick={() => setComposeOpen(true)}
            className="bg-[#DC2626] hover:bg-[#b91c1c]"
          >
            <Plus className="h-4 w-4 mr-2" /> Send Message
          </Button>
        </div>
      </div>

      {/* Tab Filters */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="all" className="data-[state=active]:bg-[#DC2626]">
            All ({feedItems.length})
          </TabsTrigger>
          <TabsTrigger value="messages" className="data-[state=active]:bg-[#DC2626]">
            <MessageSquare className="h-4 w-4 mr-1" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-[#DC2626]">
            <Bell className="h-4 w-4 mr-1" />
            System
          </TabsTrigger>
          <TabsTrigger value="drills" className="data-[state=active]:bg-[#DC2626]">
            <Dumbbell className="h-4 w-4 mr-1" />
            Drills
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-12 text-center">
                <Inbox className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No activity yet.</p>
                <p className="text-slate-500 text-sm mt-1">
                  {activeTab === 'messages' ? 'Start a conversation with ' + playerName : 'Activity will appear here'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {filteredItems.map((item) => (
                  <Card 
                    key={item.id} 
                    className={`bg-slate-900/80 border-slate-800 transition-all hover:border-slate-700 ${
                      item.type === 'message' && item.direction === 'inbound' 
                        ? 'border-l-4 border-l-emerald-500' 
                        : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-slate-800">
                          {getItemIcon(item)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white text-sm truncate">
                              {item.title}
                            </span>
                            {item.isAiGenerated && (
                              <Badge variant="outline" className="text-xs border-blue-500 text-blue-400">
                                <Bot className="h-3 w-3 mr-1" /> AI
                              </Badge>
                            )}
                            {item.type === 'drill' && item.metadata?.category && (
                              <Badge variant="outline" className="text-xs border-orange-500 text-orange-400">
                                {item.metadata.category}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 line-clamp-2">{item.body}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="h-3 w-3 text-slate-500" />
                            <span className="text-xs text-slate-500">
                              {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                            </span>
                            {item.status && (
                              <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-400">
                                {item.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Compose Modal */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#DC2626]" />
              Message {playerName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Channel Selection */}
            <div className="flex gap-2">
              <Button
                variant={newMessage.channel === 'sms' ? 'default' : 'outline'}
                className={newMessage.channel === 'sms' 
                  ? 'bg-[#DC2626] hover:bg-[#b91c1c]' 
                  : 'border-slate-700 text-slate-400 hover:bg-slate-800'}
                onClick={() => setNewMessage({ ...newMessage, channel: 'sms' })}
              >
                <MessageSquare className="h-4 w-4 mr-1" /> SMS
              </Button>
              <Button
                variant={newMessage.channel === 'email' ? 'default' : 'outline'}
                className={newMessage.channel === 'email' 
                  ? 'bg-[#DC2626] hover:bg-[#b91c1c]' 
                  : 'border-slate-700 text-slate-400 hover:bg-slate-800'}
                onClick={() => setNewMessage({ ...newMessage, channel: 'email' })}
              >
                <Mail className="h-4 w-4 mr-1" /> Email
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Message</Label>
              <Textarea
                value={newMessage.content}
                onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                placeholder="Type your message from Coach Rick..."
                rows={4}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">
                Messages will be sent from the Catching Barrels Laboratory
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setComposeOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSend}
              disabled={sending || !newMessage.content.trim()}
              className="bg-[#DC2626] hover:bg-[#b91c1c]"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
