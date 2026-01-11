import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AdminHeader } from "@/components/AdminHeader";
import { MessageSquare, Clock, Send, Edit2, Save, X, RefreshCw } from "lucide-react";

interface SMSTemplate {
  id: string;
  trigger_name: string;
  message_body: string;
  delay_minutes: number;
  is_active: boolean;
  created_at: string;
}

interface SMSLog {
  id: string;
  session_id: string | null;
  phone_number: string;
  trigger_name: string;
  message_sent: string;
  status: string;
  twilio_sid: string | null;
  created_at: string;
}

interface SMSScheduled {
  id: string;
  session_id: string;
  trigger_name: string;
  scheduled_for: string;
  status: string;
  created_at: string;
}

interface Session {
  id: string;
  player_name: string;
  player_phone: string | null;
}

const AdminSMS = () => {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [scheduled, setScheduled] = useState<SMSScheduled[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SMSTemplate>>({});
  
  // Manual send state
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch templates using edge function since RLS restricts to service_role
      const { data: templatesData } = await supabase.functions.invoke('admin-sms', {
        body: { action: 'getTemplates' }
      });
      
      const { data: logsData } = await supabase.functions.invoke('admin-sms', {
        body: { action: 'getLogs' }
      });
      
      const { data: scheduledData } = await supabase.functions.invoke('admin-sms', {
        body: { action: 'getScheduled' }
      });
      
      const { data: sessionsData } = await supabase
        .from("sessions")
        .select("id, player_name, player_phone")
        .not("player_phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (templatesData?.templates) setTemplates(templatesData.templates);
      if (logsData?.logs) setLogs(logsData.logs);
      if (scheduledData?.scheduled) setScheduled(scheduledData.scheduled);
      if (sessionsData) setSessions(sessionsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load SMS data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleActive = async (template: SMSTemplate) => {
    try {
      const { error } = await supabase.functions.invoke('admin-sms', {
        body: { 
          action: 'updateTemplate',
          id: template.id,
          updates: { is_active: !template.is_active }
        }
      });

      if (error) throw error;

      setTemplates(templates.map(t => 
        t.id === template.id ? { ...t, is_active: !t.is_active } : t
      ));
      toast.success(`Template ${!template.is_active ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error("Error toggling template:", error);
      toast.error("Failed to update template");
    }
  };

  const handleEdit = (template: SMSTemplate) => {
    setEditingId(template.id);
    setEditForm({
      message_body: template.message_body,
      delay_minutes: template.delay_minutes,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase.functions.invoke('admin-sms', {
        body: {
          action: 'updateTemplate',
          id: editingId,
          updates: editForm
        }
      });

      if (error) throw error;

      setTemplates(templates.map(t =>
        t.id === editingId ? { ...t, ...editForm } : t
      ));
      setEditingId(null);
      toast.success("Template updated");
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    }
  };

  const handleManualSend = async () => {
    if (!selectedSessionId || (!selectedTrigger && !customMessage)) {
      toast.error("Please select a session and a template or enter a custom message");
      return;
    }

    setSending(true);
    try {
      const session = sessions.find(s => s.id === selectedSessionId);
      
      const { error } = await supabase.functions.invoke('send-sms', {
        body: selectedTrigger ? {
          sessionId: selectedSessionId,
          triggerName: selectedTrigger,
          useTemplate: true,
        } : {
          to: session?.player_phone,
          body: customMessage,
          sessionId: selectedSessionId,
        }
      });

      if (error) throw error;

      toast.success("SMS sent successfully");
      setSelectedSessionId("");
      setSelectedTrigger("");
      setCustomMessage("");
      fetchData(); // Refresh logs
    } catch (error) {
      console.error("Error sending SMS:", error);
      toast.error("Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const handleProcessScheduled = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-sms-triggers');
      
      if (error) throw error;
      
      toast.success(`Processed ${data?.processed || 0} scheduled messages`);
      fetchData();
    } catch (error) {
      console.error("Error processing scheduled:", error);
      toast.error("Failed to process scheduled messages");
    }
  };

  const formatDelay = (minutes: number) => {
    if (minutes === 0) return "Immediate";
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} hours`;
    return `${Math.round(minutes / 1440)} days`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">SMS Management</h1>
            <p className="text-slate-400">Manage automated SMS workflows</p>
          </div>
          <Button 
            onClick={fetchData} 
            variant="outline" 
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList className="bg-slate-900/80 border border-slate-800">
            <TabsTrigger value="templates" className="data-[state=active]:bg-slate-800">Templates</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-slate-800">Logs ({logs.length})</TabsTrigger>
            <TabsTrigger value="scheduled" className="data-[state=active]:bg-slate-800">Scheduled ({scheduled.filter(s => s.status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="send" className="data-[state=active]:bg-slate-800">Manual Send</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <div className="space-y-4">
              {templates.map(template => (
                <Card key={template.id} className="bg-slate-900/80 border-slate-800">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant={template.is_active ? "default" : "secondary"} className={template.is_active ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-400"}>
                            {template.trigger_name}
                          </Badge>
                          <Badge variant="outline" className="border-slate-700 text-slate-400">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDelay(template.delay_minutes)}
                          </Badge>
                        </div>
                        
                        {editingId === template.id ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editForm.message_body}
                              onChange={(e) => setEditForm({ ...editForm, message_body: e.target.value })}
                              rows={4}
                              className="bg-slate-800/50 border-slate-700 text-white"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-400">Delay (minutes):</span>
                              <Input
                                type="number"
                                value={editForm.delay_minutes}
                                onChange={(e) => setEditForm({ ...editForm, delay_minutes: parseInt(e.target.value) || 0 })}
                                className="w-24 bg-slate-800/50 border-slate-700 text-white"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveEdit} className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600">
                                <Save className="w-4 h-4 mr-1" /> Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                                <X className="w-4 h-4 mr-1" /> Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 whitespace-pre-wrap">
                            {template.message_body}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {editingId !== template.id && (
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(template)} className="text-slate-400 hover:text-white hover:bg-slate-800">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={() => handleToggleActive(template)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {logs.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">No SMS logs yet</p>
                  ) : (
                    logs.map(log => (
                      <div key={log.id} className="border-b border-slate-700 pb-3 last:border-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-white">{log.phone_number}</span>
                          <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                            {log.trigger_name}
                          </Badge>
                          <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className={`text-xs ${log.status === 'sent' ? 'bg-green-500/20 text-green-400' : ''}`}>
                            {log.status}
                          </Badge>
                          <span className="text-xs text-slate-500 ml-auto">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-2 ml-6">
                          {log.message_sent}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled">
            <div className="flex justify-end mb-4">
              <Button onClick={handleProcessScheduled} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                <RefreshCw className="w-4 h-4 mr-2" />
                Process Now
              </Button>
            </div>
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {scheduled.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">No scheduled messages</p>
                  ) : (
                    scheduled.map(item => (
                      <div key={item.id} className="border-b border-slate-700 pb-3 last:border-0">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <Badge variant="outline" className="border-slate-700 text-slate-400">{item.trigger_name}</Badge>
                          <Badge 
                            variant={
                              item.status === 'pending' ? 'default' : 
                              item.status === 'sent' ? 'secondary' : 
                              item.status === 'cancelled' ? 'outline' : 'destructive'
                            }
                            className={item.status === 'pending' ? 'bg-blue-500/20 text-blue-400' : item.status === 'sent' ? 'bg-green-500/20 text-green-400' : ''}
                          >
                            {item.status}
                          </Badge>
                          <span className="text-sm text-slate-400 ml-auto">
                            Scheduled: {formatDate(item.scheduled_for)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 ml-6 mt-1">
                          Session: {item.session_id.slice(0, 8)}...
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="send">
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Send Manual SMS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block text-slate-300">Select Session</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full p-2 border border-slate-700 rounded-md bg-slate-800/50 text-white"
                  >
                    <option value="">Choose a session...</option>
                    {sessions.map(session => (
                      <option key={session.id} value={session.id}>
                        {session.player_name} - {session.player_phone}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block text-slate-300">Use Template</label>
                  <select
                    value={selectedTrigger}
                    onChange={(e) => {
                      setSelectedTrigger(e.target.value);
                      if (e.target.value) setCustomMessage("");
                    }}
                    className="w-full p-2 border border-slate-700 rounded-md bg-slate-800/50 text-white"
                  >
                    <option value="">Choose a template (or enter custom below)...</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.trigger_name}>
                        {template.trigger_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block text-slate-300">Or Custom Message</label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => {
                      setCustomMessage(e.target.value);
                      if (e.target.value) setSelectedTrigger("");
                    }}
                    placeholder="Enter a custom message..."
                    rows={3}
                    disabled={!!selectedTrigger}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>

                <Button 
                  onClick={handleManualSend} 
                  disabled={sending || !selectedSessionId || (!selectedTrigger && !customMessage)}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? "Sending..." : "Send SMS"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminSMS;
