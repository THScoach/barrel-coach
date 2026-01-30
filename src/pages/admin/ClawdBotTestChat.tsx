import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  FlaskConical, ArrowLeft, Bot, User, Send, Trash2, ThumbsUp, ThumbsDown, 
  Pencil, ChevronDown, ChevronRight, Loader2, Video, Upload 
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Message {
  id: string;
  role: "player" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface PlayerContext {
  name: string;
  motorProfile: string | null;
  brainScore: number | null;
  bodyScore: number | null;
  batScore: number | null;
  ballScore: number | null;
}

export default function ClawdBotTestChat() {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testMode, setTestMode] = useState<"guest" | "player" | "custom">("custom");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [debugOpen, setDebugOpen] = useState(false);
  const [lastDebugInfo, setLastDebugInfo] = useState<Record<string, unknown> | null>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [correctedResponse, setCorrectedResponse] = useState("");
  const [coachNotes, setCoachNotes] = useState("");
  
  // Video upload state
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Custom context
  const [customContext, setCustomContext] = useState<PlayerContext>({
    name: "Test Player",
    motorProfile: "spinner",
    brainScore: 65,
    bodyScore: 70,
    batScore: 60,
    ballScore: 75,
  });

  // Load players for dropdown
  const { data: players = [] } = useQuery({
    queryKey: ["admin-players-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, motor_profile_sensor, latest_composite_score")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getContext = (): PlayerContext | null => {
    if (testMode === "guest") return null;
    if (testMode === "custom") return customContext;
    if (testMode === "player" && selectedPlayerId) {
      const player = players.find((p) => p.id === selectedPlayerId);
      if (player) {
        return {
          name: player.name || "Player",
          motorProfile: player.motor_profile_sensor,
          brainScore: null,
          bodyScore: null,
          batScore: null,
          ballScore: null,
        };
      }
    }
    return null;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "player",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const context = getContext();
      const pageContext = context
        ? `Testing as: ${context.name}. Motor Profile: ${context.motorProfile || "Unknown"}. Scores - Brain: ${context.brainScore || "N/A"}, Body: ${context.bodyScore || "N/A"}, Bat: ${context.batScore || "N/A"}, Ball: ${context.ballScore || "N/A"}`
        : "Guest user with no profile data.";

      const { data, error } = await supabase.functions.invoke("coach-rick-chat", {
        body: {
          message: userMessage.content,
          history: messages.map((m) => ({ role: m.role === "player" ? "user" : "assistant", content: m.content })),
          pageContext,
          playerContext: context,
          isTestMode: true,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.response || "Sorry, I couldn't process that.",
        timestamp: new Date(),
        metadata: {
          drills: data?.drills || [],
          knowledge_used: data?.knowledge_used || [],
          scenarios_matched: data?.scenarios_matched || [],
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setLastDebugInfo({
        response_time: data?.response_time,
        knowledge_used: data?.knowledge_used,
        scenarios_matched: data?.scenarios_matched,
        drills_recommended: data?.drills,
      });
    } catch (err) {
      console.error("Chat error:", err);
      toast.error("Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const rateMessage = async (messageId: string, rating: "good" | "bad") => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    if (rating === "bad") {
      // Open edit dialog for bad ratings
      setEditingMessageId(messageId);
      setCorrectedResponse(message.content);
      setCoachNotes("");
      setEditDialogOpen(true);
      return;
    }

    try {
      await supabase.from("clawdbot_ratings").insert({
        rating,
        original_response: message.content,
        knowledge_ids: (message.metadata?.knowledge_used as string[]) || [],
        scenario_ids: (message.metadata?.scenarios_matched as string[]) || [],
        reviewed_by: "admin",
      });
      toast.success("Marked as good response");
    } catch (err) {
      toast.error("Failed to save rating");
    }
  };

  const submitEdit = async () => {
    const message = messages.find((m) => m.id === editingMessageId);
    if (!message) return;

    try {
      await supabase.from("clawdbot_ratings").insert({
        rating: "edited",
        original_response: message.content,
        corrected_response: correctedResponse,
        coach_notes: coachNotes,
        knowledge_ids: (message.metadata?.knowledge_used as string[]) || [],
        scenario_ids: (message.metadata?.scenarios_matched as string[]) || [],
        reviewed_by: "admin",
      });
      toast.success("Response edited and saved");
      setEditDialogOpen(false);
      setEditingMessageId(null);
    } catch (err) {
      toast.error("Failed to save edit");
    }
  };

  const clearChat = () => {
    setMessages([]);
    setLastDebugInfo(null);
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload MP4, MOV, or WebM files.");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 500MB.");
      return;
    }

    setIsProcessingVideo(true);
    setVideoProgress(10);

    try {
      // Upload to storage
      const storagePath = `clawdbot-learning/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      setVideoProgress(30);
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      setVideoProgress(50);

      // Get public URL
      const { data: urlData } = await supabase.storage
        .from('videos')
        .createSignedUrl(storagePath, 60 * 60 * 24);

      if (!urlData?.signedUrl) throw new Error("Failed to get video URL");

      setVideoProgress(70);

      // Process video
      const { data, error } = await supabase.functions.invoke("process-clawdbot-video", {
        body: {
          videoUrl: urlData.signedUrl,
          title: file.name.replace(/\.[^/.]+$/, ''),
          contentType: "both",
        },
      });

      setVideoProgress(100);

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Processing failed");

      toast.success(
        `Added ${data.results.knowledge_added} knowledge, ${data.results.scenarios_added} scenarios, ${data.results.cues_added} cues`
      );

      // Add system message to chat
      const systemMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `📚 Video "${file.name}" processed! Added ${data.results.knowledge_added} knowledge entries, ${data.results.scenarios_added} Q&A scenarios, and ${data.results.cues_added} coaching cues to my training.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, systemMsg]);

    } catch (err) {
      console.error("Video upload error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to process video");
    } finally {
      setIsProcessingVideo(false);
      setVideoProgress(0);
      if (event.target) event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0B" }}>
      <AdminHeader />

      <main className="container py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/admin/clawdbot">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="p-3 rounded-xl bg-accent/20">
              <FlaskConical className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Test ClawdBot</h1>
              <p className="text-slate-400 text-sm">Test responses with different contexts</p>
            </div>
          </div>
          <Button variant="outline" onClick={clearChat} className="border-slate-700 text-slate-300">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Context Panel */}
          <Card style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}>
            <CardHeader>
              <CardTitle className="text-white text-lg">Test Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={testMode} onValueChange={(v: any) => setTestMode(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="guest" id="guest" />
                  <Label htmlFor="guest" className="text-slate-300">Guest (no profile)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="player" id="player" />
                  <Label htmlFor="player" className="text-slate-300">Select Player</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="text-slate-300">Custom Context</Label>
                </div>
              </RadioGroup>

              {testMode === "player" && (
                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name || "Unnamed"} {p.motor_profile_sensor && `(${p.motor_profile_sensor})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {testMode === "custom" && (
                <div className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs text-slate-400">Name</Label>
                    <Input
                      value={customContext.name}
                      onChange={(e) => setCustomContext({ ...customContext, name: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Motor Profile</Label>
                    <Select
                      value={customContext.motorProfile || ""}
                      onValueChange={(v) => setCustomContext({ ...customContext, motorProfile: v })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-8 text-sm">
                        <SelectValue placeholder="Select profile" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spinner">Spinner</SelectItem>
                        <SelectItem value="whipper">Whipper</SelectItem>
                        <SelectItem value="slingshotter">Slingshotter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-slate-400">Brain</Label>
                      <Input
                        type="number"
                        value={customContext.brainScore || ""}
                        onChange={(e) => setCustomContext({ ...customContext, brainScore: parseInt(e.target.value) || null })}
                        className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Body</Label>
                      <Input
                        type="number"
                        value={customContext.bodyScore || ""}
                        onChange={(e) => setCustomContext({ ...customContext, bodyScore: parseInt(e.target.value) || null })}
                        className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Bat</Label>
                      <Input
                        type="number"
                        value={customContext.batScore || ""}
                        onChange={(e) => setCustomContext({ ...customContext, batScore: parseInt(e.target.value) || null })}
                        className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Ball</Label>
                      <Input
                        type="number"
                        value={customContext.ballScore || ""}
                        onChange={(e) => setCustomContext({ ...customContext, ballScore: parseInt(e.target.value) || null })}
                        className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Panel */}
          <Card className="lg:col-span-2" style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}>
            <CardContent className="p-0 flex flex-col h-[600px]">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Start a test conversation</p>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === "player" ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          msg.role === "player" ? "bg-primary/10" : "bg-accent/10"
                        }`}
                      >
                        {msg.role === "player" ? (
                          <User className="h-4 w-4 text-primary" />
                        ) : (
                          <Bot className="h-4 w-4 text-accent" />
                        )}
                      </div>
                      <div className={`flex-1 ${msg.role === "player" ? "flex flex-col items-end" : ""}`}>
                        <div
                          className={`p-3 rounded-lg max-w-[85%] ${
                            msg.role === "player"
                              ? "bg-primary text-primary-foreground"
                              : "bg-slate-800 text-white"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        {/* Rating controls for assistant messages */}
                        {msg.role === "assistant" && (
                          <div className="flex items-center gap-1 mt-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-green-500"
                              onClick={() => rateMessage(msg.id, "good")}
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-red-500"
                              onClick={() => rateMessage(msg.id, "bad")}
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-white"
                              onClick={() => {
                                setEditingMessageId(msg.id);
                                setCorrectedResponse(msg.content);
                                setCoachNotes("");
                                setEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-accent" />
                      </div>
                      <div className="p-3 rounded-lg bg-slate-800">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Thinking...
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-slate-700">
                {isProcessingVideo && (
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-purple-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing video for learning...
                    </div>
                    <Progress value={videoProgress} className="h-2" />
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isLoading || isProcessingVideo}
                    className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
                    title="Upload video to learn from"
                  >
                    <Video className="h-4 w-4" />
                  </Button>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder="Type a message..."
                    className="bg-slate-800 border-slate-700 text-white"
                    disabled={isLoading || isProcessingVideo}
                  />
                  <Button onClick={sendMessage} disabled={!input.trim() || isLoading || isProcessingVideo} className="bg-accent hover:bg-accent/90">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debug Info */}
        {lastDebugInfo && (
          <Collapsible open={debugOpen} onOpenChange={setDebugOpen} className="mt-6">
            <Card style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-slate-800/50 transition-colors">
                  <CardTitle className="flex items-center justify-between text-white text-sm">
                    Debug Info
                    {debugOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <pre className="text-xs text-slate-400 overflow-auto p-3 bg-slate-800 rounded-lg">
                    {JSON.stringify(lastDebugInfo, null, 2)}
                  </pre>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Edit Response</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Corrected Response</Label>
              <Textarea
                value={correctedResponse}
                onChange={(e) => setCorrectedResponse(e.target.value)}
                rows={4}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>Coach Notes (optional)</Label>
              <Textarea
                value={coachNotes}
                onChange={(e) => setCoachNotes(e.target.value)}
                placeholder="Why was this response wrong? What should be different?"
                rows={3}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitEdit} className="bg-accent hover:bg-accent/90">
              Save Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
