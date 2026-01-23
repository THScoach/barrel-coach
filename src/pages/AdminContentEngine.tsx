import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { VoiceMemoRecorder, VideoMemoRecorder, ConversationImport, ContentQueue, ContentCalendar, ContentAnalytics } from "@/components/content-engine";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Mic, MessageSquare, Video, Upload, Sparkles, BarChart3, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function AdminContentEngine() {
  const [captureMode, setCaptureMode] = useState<'voice' | 'conversation' | 'video' | null>(null);
  const queryClient = useQueryClient();

  // Upload voice memo
  const voiceMutation = useMutation({
    mutationFn: async ({ blob, duration }: { blob: Blob; duration: number }) => {
      const fileName = `voice-memo-${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('content-engine')
        .upload(fileName, blob, { contentType: 'audio/webm' });
      
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('content_items')
        .insert({
          source_type: 'voice',
          status: 'processing',
          media_url: uploadData.path,
          media_duration_seconds: duration,
        })
        .select()
        .single();
      
      if (error) throw error;

      await supabase.functions.invoke('process-content', {
        body: { content_item_id: data.id },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      toast.success('Voice memo uploaded and processing!');
      setCaptureMode(null);
    },
    onError: (error) => {
      console.error('Voice upload error:', error);
      toast.error('Failed to upload voice memo');
    },
  });

  // Upload video memo
  const videoMutation = useMutation({
    mutationFn: async ({ blob, duration, thumbnail }: { blob: Blob; duration: number; thumbnail?: Blob }) => {
      const timestamp = Date.now();
      const fileName = `video-memo-${timestamp}.webm`;
      
      // Upload video
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('content-engine')
        .upload(fileName, blob, { contentType: 'video/webm' });
      
      if (uploadError) throw uploadError;

      // Upload thumbnail if available
      let thumbnailUrl: string | null = null;
      if (thumbnail) {
        const thumbFileName = `thumbnails/video-memo-${timestamp}.jpg`;
        const { data: thumbData, error: thumbError } = await supabase.storage
          .from('content-engine')
          .upload(thumbFileName, thumbnail, { contentType: 'image/jpeg' });
        
        if (!thumbError && thumbData) {
          const { data: publicUrl } = supabase.storage
            .from('content-engine')
            .getPublicUrl(thumbData.path);
          thumbnailUrl = publicUrl.publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('content_items')
        .insert({
          source_type: 'video',
          status: 'processing',
          media_url: uploadData.path,
          media_duration_seconds: duration,
          thumbnail_url: thumbnailUrl,
        })
        .select()
        .single();
      
      if (error) throw error;

      await supabase.functions.invoke('process-content', {
        body: { content_item_id: data.id },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      toast.success('Video uploaded and processing!');
      setCaptureMode(null);
    },
    onError: (error) => {
      console.error('Video upload error:', error);
      toast.error('Failed to upload video');
    },
  });

  // Import conversation
  const conversationMutation = useMutation({
    mutationFn: async ({ content, source }: { content: string; source: string }) => {
      const { data, error } = await supabase
        .from('content_items')
        .insert({
          source_type: 'conversation',
          raw_content: content,
          status: 'processing',
          source_metadata: { ai_source: source },
        })
        .select()
        .single();
      
      if (error) throw error;

      await supabase.functions.invoke('process-content', {
        body: { content_item_id: data.id },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      toast.success('Conversation imported and processing!');
      setCaptureMode(null);
    },
    onError: (error) => {
      console.error('Conversation import error:', error);
      toast.error('Failed to import conversation');
    },
  });

  const handleVoiceRecorded = useCallback((blob: Blob, duration: number) => {
    voiceMutation.mutate({ blob, duration });
  }, [voiceMutation]);

  const handleVideoRecorded = useCallback((blob: Blob, duration: number, thumbnail?: Blob) => {
    videoMutation.mutate({ blob, duration, thumbnail });
  }, [videoMutation]);

  const handleConversationImport = useCallback(async (content: string, source: 'claude' | 'chatgpt' | 'other') => {
    conversationMutation.mutate({ content, source });
  }, [conversationMutation]);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Content Engine</h1>
          <p className="text-muted-foreground">
            Capture insights from conversations, voice memos, and videos. Turn them into ready-to-post content.
          </p>
        </div>

        <Tabs defaultValue="capture" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="capture" className="gap-2">
              <Upload className="h-4 w-4" />
              Capture
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Capture Tab */}
          <TabsContent value="capture" className="space-y-6">
            {!captureMode ? (
              <div className="grid gap-4 md:grid-cols-3">
                <Card 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setCaptureMode('voice')}
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Mic className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Voice Memo</CardTitle>
                    <CardDescription>
                      Record a quick thought or insight. Great for after lessons or random ideas.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setCaptureMode('conversation')}
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Conversation</CardTitle>
                    <CardDescription>
                      Import AI chats from Claude, ChatGPT, or other sources to extract insights.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setCaptureMode('video')}
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Video className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Video Clip</CardTitle>
                    <CardDescription>
                      Record a quick video tip. Perfect for demonstrations and explanations.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {captureMode === 'voice' && <><Mic className="h-5 w-5" /> Record Voice Memo</>}
                      {captureMode === 'conversation' && <><MessageSquare className="h-5 w-5" /> Import Conversation</>}
                      {captureMode === 'video' && <><Video className="h-5 w-5" /> Record Video Clip</>}
                    </CardTitle>
                    <Button variant="ghost" onClick={() => setCaptureMode(null)}>
                      Cancel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {captureMode === 'voice' && (
                    <VoiceMemoRecorder 
                      onRecorded={handleVoiceRecorded}
                      onCancel={() => setCaptureMode(null)}
                    />
                  )}
                  {captureMode === 'conversation' && (
                    <ConversationImport onImport={handleConversationImport} />
                  )}
                  {captureMode === 'video' && (
                    <VideoMemoRecorder 
                      onRecorded={handleVideoRecorded}
                      onCancel={() => setCaptureMode(null)}
                      maxDuration={120}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Queue Tab */}
          <TabsContent value="queue">
            <ContentQueue />
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <ContentCalendar />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <ContentAnalytics />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
