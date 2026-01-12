/**
 * Rick Lab Player Communication Tab - Unified Messages + Activity
 * ================================================================
 * Consolidated communication: SMS/Email threads + Internal notes + Activity feed
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Plus, 
  MessageSquare, 
  Mail, 
  Bell, 
  Send, 
  Inbox,
  FileText,
  StickyNote,
  Tag,
  Activity,
  BarChart3,
  Target,
  Video,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface PlayerCommunicationTabNewProps {
  playerId: string; // player_profiles.id
  playersTableId?: string;
  playerName: string;
}

type MessageChannel = 'app' | 'sms' | 'email';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
  scores?: {
    brain?: number;
    body?: number;
    bat?: number;
    ball?: number;
  };
}

interface Note {
  id: string;
  note: string;
  created_at: string;
  is_private: boolean;
}

export function PlayerCommunicationTabNew({ playerId, playersTableId, playerName }: PlayerCommunicationTabNewProps) {
  const [activeSubTab, setActiveSubTab] = useState('messages');
  const [messages] = useState<any[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);
  
  const [composeOpen, setComposeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  
  const [newMessage, setNewMessage] = useState({
    channel: 'sms' as MessageChannel,
    subject: '',
    content: '',
  });
  
  const [newNote, setNewNote] = useState({
    content: '',
    isPrivate: false,
  });
  
  const [newTag, setNewTag] = useState('');

  // Load activities
  useEffect(() => {
    loadActivities();
    loadNotes();
  }, [playerId, playersTableId]);

  const loadActivities = async () => {
    setLoadingActivities(true);
    
    const dataPlayerId = playersTableId || playerId;
    
    const [sessionsRes, launchRes, rebootRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('player_id', playerId).order('created_at', { ascending: false }).limit(20),
      supabase.from('launch_monitor_sessions').select('*').eq('player_id', dataPlayerId).order('session_date', { ascending: false }).limit(20),
      supabase.from('reboot_uploads').select('*').eq('player_id', dataPlayerId).order('created_at', { ascending: false }).limit(20),
    ]);

    const allActivities: ActivityItem[] = [
      ...(sessionsRes.data || []).map(s => ({
        id: s.id,
        type: 'analyzer',
        title: 'Swing Analysis',
        description: s.product_type || 'Video analysis completed',
        date: new Date(s.created_at || new Date()),
        scores: { brain: s.four_b_brain, body: s.four_b_body, bat: s.four_b_bat },
      })),
      ...(launchRes.data || []).map(s => ({
        id: s.id,
        type: 'hittrax',
        title: `${s.source || 'HitTrax'} Session`,
        description: `${s.total_swings || 0} swings`,
        date: new Date(s.session_date),
        scores: { ball: s.ball_score },
      })),
      ...(rebootRes.data || []).map(s => ({
        id: s.id,
        type: 'reboot',
        title: 'Reboot Session',
        description: s.ik_file_uploaded && s.me_file_uploaded ? 'IK & ME Data' : s.ik_file_uploaded ? 'IK Data' : 'ME Data',
        date: new Date(s.created_at || new Date()),
        scores: { brain: s.brain_score, body: s.body_score, bat: s.bat_score },
      })),
    ];

    allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
    setActivities(allActivities);
    setLoadingActivities(false);
  };

  const loadNotes = async () => {
    setLoadingNotes(true);
    
    const { data, error } = await supabase
      .from('player_notes')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setNotes(data);
    }
    
    setLoadingNotes(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.content.trim()) {
      toast.error("Please enter a message");
      return;
    }
    
    // TODO: Integrate with actual SMS/Email sending
    toast.success("Message sent!");
    setComposeOpen(false);
    setNewMessage({ channel: 'sms', subject: '', content: '' });
  };

  const handleAddNote = async () => {
    if (!newNote.content.trim()) {
      toast.error("Please enter a note");
      return;
    }
    
    const { error } = await supabase
      .from('player_notes')
      .insert({
        player_id: playerId,
        note: newNote.content,
        is_private: newNote.isPrivate,
      });
    
    if (error) {
      toast.error("Failed to add note");
      return;
    }
    
    toast.success("Note added!");
    setNoteOpen(false);
    setNewNote({ content: '', isPrivate: false });
    loadNotes();
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) {
      toast.error("Please enter a tag");
      return;
    }
    
    // TODO: Implement event tagging (e.g., in-person assessment, started membership)
    toast.success(`Tagged: ${newTag}`);
    setTagOpen(false);
    setNewTag('');
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'analyzer': return <BarChart3 className="h-4 w-4 text-primary" />;
      case 'hittrax': return <Target className="h-4 w-4 text-emerald-500" />;
      case 'reboot': return <Activity className="h-4 w-4 text-blue-500" />;
      case 'video': return <Video className="h-4 w-4 text-purple-500" />;
      case 'message': return <MessageSquare className="h-4 w-4 text-amber-500" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* ===== ACTION BUTTONS ===== */}
      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={() => setComposeOpen(true)}
          className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
        >
          <Send className="h-4 w-4 mr-2" /> Send Message
        </Button>
        <Button 
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
          onClick={() => setNoteOpen(true)}
        >
          <StickyNote className="h-4 w-4 mr-2" /> Add Note
        </Button>
        <Button 
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
          onClick={() => setTagOpen(true)}
        >
          <Tag className="h-4 w-4 mr-2" /> Tag Event
        </Button>
      </div>

      {/* ===== SUB-TABS ===== */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="bg-slate-800/50">
          <TabsTrigger 
            value="messages" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </TabsTrigger>
          <TabsTrigger 
            value="notes" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <StickyNote className="h-4 w-4 mr-2" />
            Notes ({notes.length})
          </TabsTrigger>
          <TabsTrigger 
            value="activity" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <Activity className="h-4 w-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* ===== MESSAGES TAB ===== */}
        <TabsContent value="messages" className="mt-6">
          {messages.length === 0 ? (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-12 text-center">
                <Inbox className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No messages yet</p>
                <p className="text-slate-500 text-sm mt-1">Start a conversation with {playerName}</p>
                <Button
                  className="mt-4 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
                  onClick={() => setComposeOpen(true)}
                >
                  <Send className="h-4 w-4 mr-2" /> Send First Message
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Message thread would go here */}
            </div>
          )}
        </TabsContent>

        {/* ===== NOTES TAB ===== */}
        <TabsContent value="notes" className="mt-6">
          {loadingNotes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : notes.length === 0 ? (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-12 text-center">
                <StickyNote className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No notes yet</p>
                <p className="text-slate-500 text-sm mt-1">Add coaching notes for {playerName}</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => setNoteOpen(true)}
                >
                  <StickyNote className="h-4 w-4 mr-2" /> Add First Note
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <Card key={note.id} className="bg-slate-900/80 border-slate-800">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-slate-300 whitespace-pre-wrap">{note.note}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {note.is_private && (
                          <Badge variant="outline" className="border-red-500/50 text-red-400 text-xs">
                            Private
                          </Badge>
                        )}
                        <span className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== ACTIVITY TAB ===== */}
        <TabsContent value="activity" className="mt-6">
          {loadingActivities ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : activities.length === 0 ? (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No activity yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <Card key={activity.id} className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getActivityIcon(activity.type)}
                        <div>
                          <p className="font-medium text-white">{activity.title}</p>
                          <p className="text-sm text-slate-400">{activity.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {activity.scores && (
                          <div className="flex gap-2 text-xs">
                            {activity.scores.brain !== undefined && activity.scores.brain !== null && (
                              <Badge variant="outline" className="border-slate-700 text-slate-300">Br:{activity.scores.brain}</Badge>
                            )}
                            {activity.scores.body !== undefined && activity.scores.body !== null && (
                              <Badge variant="outline" className="border-slate-700 text-slate-300">Bo:{activity.scores.body}</Badge>
                            )}
                            {activity.scores.bat !== undefined && activity.scores.bat !== null && (
                              <Badge variant="outline" className="border-slate-700 text-slate-300">Ba:{activity.scores.bat}</Badge>
                            )}
                            {activity.scores.ball !== undefined && activity.scores.ball !== null && (
                              <Badge variant="outline" className="border-slate-700 text-slate-300">Bl:{activity.scores.ball}</Badge>
                            )}
                          </div>
                        )}
                        <span className="text-xs text-slate-500">
                          {formatDistanceToNow(activity.date, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== COMPOSE MESSAGE MODAL ===== */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Send Message to {playerName}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
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
              <Button
                variant={newMessage.channel === 'app' ? 'secondary' : 'outline'}
                className={newMessage.channel === 'app' ? 'bg-slate-800 text-white' : 'border-slate-700 text-slate-400'}
                onClick={() => setNewMessage({ ...newMessage, channel: 'app' })}
              >
                <Bell className="h-4 w-4 mr-1" /> In-App
              </Button>
            </div>

            {newMessage.channel === 'email' && (
              <div className="space-y-2">
                <Label className="text-slate-300">Subject</Label>
                <Input
                  value={newMessage.subject}
                  onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                  placeholder="Message subject..."
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            )}

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
              Cancel
            </Button>
            <Button 
              onClick={handleSendMessage}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
            >
              <Send className="h-4 w-4 mr-2" /> Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ADD NOTE MODAL ===== */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Add Note for {playerName}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Note</Label>
              <Textarea
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                placeholder="Enter your coaching notes..."
                rows={4}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="private-note"
                checked={newNote.isPrivate}
                onChange={(e) => setNewNote({ ...newNote, isPrivate: e.target.checked })}
                className="rounded border-slate-600"
              />
              <Label htmlFor="private-note" className="text-slate-400 text-sm cursor-pointer">
                Private note (only visible to coaches)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setNoteOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddNote}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
            >
              <StickyNote className="h-4 w-4 mr-2" /> Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== TAG EVENT MODAL ===== */}
      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Tag Key Event</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Event Type</Label>
              <Select value={newTag} onValueChange={setNewTag}>
                <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue placeholder="Select event type..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="in-person-assessment">In-Person Assessment</SelectItem>
                  <SelectItem value="started-membership">Started Membership</SelectItem>
                  <SelectItem value="new-drill-block">New Drill Block</SelectItem>
                  <SelectItem value="injury-recovery">Injury Recovery</SelectItem>
                  <SelectItem value="competition-season">Competition Season</SelectItem>
                  <SelectItem value="off-season">Off-Season</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setTagOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddTag}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
            >
              <Tag className="h-4 w-4 mr-2" /> Add Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
