import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, MessageSquare, Mail, Bell, Send, Inbox } from "lucide-react";
import { toast } from "sonner";

interface PlayerCommunicationTabProps {
  playerId: string;
  playerName: string;
}

type MessageFilter = 'all' | 'scheduled' | 'sent' | 'drafts';
type MessageChannel = 'app' | 'sms' | 'email';

export function PlayerCommunicationTab({ playerId, playerName }: PlayerCommunicationTabProps) {
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [messages] = useState<any[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [newMessage, setNewMessage] = useState({
    channel: 'app' as MessageChannel,
    subject: '',
    content: '',
    sendNow: true,
  });

  const getCounts = () => ({
    all: messages.length,
    scheduled: messages.filter(m => m.status === 'scheduled').length,
    sent: messages.filter(m => m.status === 'sent').length,
    drafts: messages.filter(m => m.status === 'draft').length,
  });

  const counts = getCounts();

  const filterButtons: { value: MessageFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'sent', label: 'Sent' },
    { value: 'drafts', label: 'Drafts' },
  ];

  const handleSend = async () => {
    if (!newMessage.content.trim()) {
      toast.error("Please enter a message");
      return;
    }
    
    // TODO: Implement actual message sending
    toast.success("Message sent!");
    setComposeOpen(false);
    setNewMessage({ channel: 'app', subject: '', content: '', sendNow: true });
  };

  return (
    <div className="flex gap-6">
      {/* Left Sidebar: Filters */}
      <div className="w-48 space-y-1">
        {filterButtons.map(btn => (
          <Button
            key={btn.value}
            variant={filter === btn.value ? 'secondary' : 'ghost'}
            className={`w-full justify-between ${
              filter === btn.value 
                ? 'bg-slate-800 text-white' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
            onClick={() => setFilter(btn.value)}
          >
            {btn.label}
            <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
              {counts[btn.value]}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Right: Messages */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">
            {filterButtons.find(b => b.value === filter)?.label} Messages
          </h3>
          <Button 
            onClick={() => setComposeOpen(true)}
            className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
          >
            <Plus className="h-4 w-4 mr-2" /> New Message
          </Button>
        </div>

        {messages.length === 0 ? (
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="py-12 text-center">
              <Inbox className="h-12 w-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No messages yet.</p>
              <p className="text-slate-500 text-sm mt-1">Start a conversation with {playerName}.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900/80 border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Channel</TableHead>
                  <TableHead className="text-slate-400">Subject</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map(message => (
                  <TableRow key={message.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      {message.channel === 'sms' ? (
                        <MessageSquare className="h-4 w-4 text-emerald-500" />
                      ) : message.channel === 'email' ? (
                        <Mail className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Bell className="h-4 w-4 text-amber-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-white">{message.subject || '(No subject)'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">
                        {message.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400">{message.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Compose Modal */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">New Message to {playerName}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Channel Selection */}
            <div className="flex gap-2">
              <Button
                variant={newMessage.channel === 'app' ? 'secondary' : 'outline'}
                className={newMessage.channel === 'app' ? 'bg-slate-800 text-white' : 'border-slate-700 text-slate-400'}
                onClick={() => setNewMessage({ ...newMessage, channel: 'app' })}
              >
                <Bell className="h-4 w-4 mr-1" /> In-App
              </Button>
              <Button
                variant={newMessage.channel === 'sms' ? 'secondary' : 'outline'}
                className={newMessage.channel === 'sms' ? 'bg-slate-800 text-white' : 'border-slate-700 text-slate-400'}
                onClick={() => setNewMessage({ ...newMessage, channel: 'sms' })}
              >
                <MessageSquare className="h-4 w-4 mr-1" /> SMS
              </Button>
              <Button
                variant={newMessage.channel === 'email' ? 'secondary' : 'outline'}
                className={newMessage.channel === 'email' ? 'bg-slate-800 text-white' : 'border-slate-700 text-slate-400'}
                onClick={() => setNewMessage({ ...newMessage, channel: 'email' })}
              >
                <Mail className="h-4 w-4 mr-1" /> Email
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Subject</Label>
              <Input
                value={newMessage.subject}
                onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                placeholder="Message subject..."
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Message</Label>
              <Textarea
                value={newMessage.content}
                onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                placeholder="Type your message..."
                rows={4}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setComposeOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Save as Draft
            </Button>
            <Button 
              onClick={handleSend}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
            >
              <Send className="h-4 w-4 mr-2" /> Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
