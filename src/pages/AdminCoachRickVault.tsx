/**
 * Coach Rick Admin Vault - Bulk video upload with AI transcription & intelligence cards
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Upload, 
  Film,
  Loader2, 
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Search,
  Brain,
  Dumbbell,
  Target,
  Zap,
  RefreshCw,
  Copy,
  Mic,
  FileVideo,
  Tags,
  Pill
} from "lucide-react";
import { format } from "date-fns";

// Types
interface UploadingVideo {
  id: string;
  file: File;
  fileName: string;
  status: 'hashing' | 'checking' | 'uploading' | 'transcribing' | 'analyzing' | 'complete' | 'duplicate' | 'error';
  progress: number;
  error?: string;
  duplicateTitle?: string;
  videoId?: string;
}

interface ProcessedVideo {
  id: string;
  title: string;
  description: string | null;
  four_b_category: string | null;
  problems_addressed: string[] | null;
  tags: string[] | null;
  status: string;
  transcript: string | null;
  duration_seconds: number | null;
  video_url: string;
  storage_path: string | null;
  created_at: string;
  access_level: string | null;
}

// Hash function for deduplication
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// 4B Category icons and colors
const fourBConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  brain: { icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  body: { icon: Dumbbell, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  bat: { icon: Target, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  ball: { icon: Zap, color: 'text-green-400', bg: 'bg-green-500/20' },
};

export default function AdminCoachRickVault() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadingVideo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const pollingRef = useRef<Set<string>>(new Set());

  // Fetch processed videos
  const { data: videos, isLoading } = useQuery({
    queryKey: ['coach-rick-vault-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drill_videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as ProcessedVideo[];
    },
    refetchInterval: 10000, // Refetch every 10s to catch status updates
  });

  // Handle prescription toggle
  const togglePrescription = async (videoId: string, currentLevel: string | null) => {
    const newLevel = currentLevel === 'prescription' ? 'free' : 'prescription';
    
    const { error } = await supabase
      .from('drill_videos')
      .update({ access_level: newLevel })
      .eq('id', videoId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ['coach-rick-vault-videos'] });
      toast({ 
        title: newLevel === 'prescription' ? "Prescription Enabled" : "Prescription Disabled",
        description: newLevel === 'prescription' 
          ? "This video can now be auto-prescribed to players"
          : "Video removed from auto-prescription pool"
      });
    }
  };

  // Poll for video status updates
  const pollVideoStatus = useCallback(async (videoId: string) => {
    if (pollingRef.current.has(videoId)) return;
    pollingRef.current.add(videoId);

    const maxAttempts = 60; // 5 minutes
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

      const { data } = await supabase
        .from('drill_videos')
        .select('status')
        .eq('id', videoId)
        .single();

      if (!data) break;

      // Update local queue status
      setUploadQueue(prev => prev.map(v => {
        if (v.videoId === videoId) {
          if (data.status === 'transcribing') {
            return { ...v, status: 'transcribing', progress: 60 };
          } else if (data.status === 'analyzing') {
            return { ...v, status: 'analyzing', progress: 80 };
          } else if (data.status === 'published' || data.status === 'ready_for_review') {
            return { ...v, status: 'complete', progress: 100 };
          } else if (data.status === 'failed') {
            return { ...v, status: 'error', error: 'Processing failed' };
          }
        }
        return v;
      }));

      // Stop polling when complete or failed
      if (['published', 'ready_for_review', 'failed'].includes(data.status)) {
        queryClient.invalidateQueries({ queryKey: ['coach-rick-vault-videos'] });
        break;
      }
    }

    pollingRef.current.delete(videoId);
  }, [queryClient]);

  // Process a single file upload
  const processFile = useCallback(async (file: File, uploadId: string) => {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId 
          ? { ...v, status: 'error' as const, error: 'Invalid file type' }
          : v
      ));
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId 
          ? { ...v, status: 'error' as const, error: 'File too large (500MB max)' }
          : v
      ));
      return;
    }

    try {
      // Step 1: Hash
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId ? { ...v, status: 'hashing' as const, progress: 10 } : v
      ));
      const fileHash = await hashFile(file);

      // Step 2: Check duplicates
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId ? { ...v, status: 'checking' as const, progress: 20 } : v
      ));

      const { data: duplicate } = await supabase.rpc('check_academy_video_duplicate', {
        p_file_hash: fileHash
      });

      if (duplicate && duplicate.length > 0) {
        setUploadQueue(prev => prev.map(v => 
          v.id === uploadId 
            ? { ...v, status: 'duplicate' as const, duplicateTitle: duplicate[0].title }
            : v
        ));
        return;
      }

      // Step 3: Upload to storage
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId ? { ...v, status: 'uploading' as const, progress: 40 } : v
      ));

      const storagePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('academy_videos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('academy_videos')
        .getPublicUrl(storagePath);

      // Step 4: Create database record
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId ? { ...v, progress: 50 } : v
      ));

      const { data: videoRecord, error: dbError } = await supabase
        .from('drill_videos')
        .insert({
          title: file.name.replace(/\.[^/.]+$/, ''),
          video_url: urlData.publicUrl,
          storage_path: storagePath,
          file_hash: fileHash,
          status: 'pending',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update queue with video ID and start transcription status
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId 
          ? { ...v, status: 'transcribing' as const, progress: 55, videoId: videoRecord.id }
          : v
      ));

      // Step 5: Trigger transcription pipeline
      await supabase.functions.invoke('transcribe-video', {
        body: { 
          video_id: videoRecord.id,
          auto_publish: true
        }
      });

      // Start polling for status updates
      pollVideoStatus(videoRecord.id);

    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId 
          ? { ...v, status: 'error' as const, error: err.message }
          : v
      ));
    }
  }, [pollVideoStatus]);

  // Handle file selection (drag-drop or click)
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newUploads: UploadingVideo[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      fileName: file.name,
      status: 'hashing' as const,
      progress: 0,
    }));

    setUploadQueue(prev => [...newUploads, ...prev]);

    // Process files with slight stagger to avoid overwhelming
    newUploads.forEach((upload, index) => {
      setTimeout(() => {
        processFile(upload.file, upload.id);
      }, index * 500);
    });
  }, [processFile]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // Get status display
  const getStatusDisplay = (status: UploadingVideo['status']) => {
    switch (status) {
      case 'hashing':
        return { icon: Sparkles, text: 'Fingerprinting...', color: 'text-purple-400' };
      case 'checking':
        return { icon: Search, text: 'Checking duplicates...', color: 'text-blue-400' };
      case 'uploading':
        return { icon: Upload, text: 'Uploading...', color: 'text-yellow-400' };
      case 'transcribing':
        return { icon: Mic, text: 'AI Transcription...', color: 'text-orange-400' };
      case 'analyzing':
        return { icon: Brain, text: 'Processing Intelligence...', color: 'text-primary' };
      case 'complete':
        return { icon: CheckCircle2, text: 'Complete', color: 'text-green-400' };
      case 'duplicate':
        return { icon: Copy, text: 'Duplicate', color: 'text-red-400' };
      case 'error':
        return { icon: XCircle, text: 'Error', color: 'text-red-400' };
    }
  };

  // Clear completed/failed uploads
  const clearCompleted = () => {
    setUploadQueue(prev => prev.filter(v => 
      !['complete', 'duplicate', 'error'].includes(v.status)
    ));
  };

  const activeUploads = uploadQueue.filter(v => 
    !['complete', 'duplicate', 'error'].includes(v.status)
  );

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Film className="w-8 h-8 text-primary" />
            Coach Rick Vault
          </h1>
          <p className="text-muted-foreground mt-2">
            Bulk upload coaching videos with AI-powered transcription and 4B auto-tagging
          </p>
        </div>

        {/* Drop Zone */}
        <Card className="mb-8">
          <CardContent className="p-0">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                min-h-[200px] flex flex-col items-center justify-center cursor-pointer
                border-2 border-dashed rounded-xl transition-all p-8
                ${isDragging 
                  ? 'border-primary bg-primary/10 scale-[1.02]' 
                  : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
                }
              `}
            >
              <div className={`
                w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all
                ${isDragging ? 'bg-primary/20 scale-110' : 'bg-muted'}
              `}>
                <Upload className={`w-8 h-8 ${isDragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} />
              </div>
              
              <h3 className="text-lg font-semibold mb-2">
                {isDragging ? 'Drop videos here!' : 'Drag & Drop Videos'}
              </h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Drop multiple MP4 or MOV files to upload in bulk. Each video will be automatically 
                transcribed and tagged with 4B categories.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-2">
                Max 500MB per file • Duplicates auto-blocked
              </p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="video/mp4,video/quicktime,video/webm"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
            />
          </CardContent>
        </Card>

        {/* Upload Queue */}
        {uploadQueue.length > 0 && (
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileVideo className="w-5 h-5" />
                  Upload Queue
                  {activeUploads.length > 0 && (
                    <Badge variant="secondary">{activeUploads.length} processing</Badge>
                  )}
                </CardTitle>
                {uploadQueue.some(v => ['complete', 'duplicate', 'error'].includes(v.status)) && (
                  <Button variant="ghost" size="sm" onClick={clearCompleted}>
                    Clear Completed
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadQueue.map((upload) => {
                  const statusInfo = getStatusDisplay(upload.status);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div 
                      key={upload.id}
                      className={`
                        flex items-center gap-4 p-3 rounded-lg border
                        ${upload.status === 'complete' ? 'bg-green-500/5 border-green-500/30' :
                          upload.status === 'error' || upload.status === 'duplicate' ? 'bg-red-500/5 border-red-500/30' :
                          'bg-muted/30 border-border/50'}
                      `}
                    >
                      <StatusIcon className={`w-5 h-5 shrink-0 ${statusInfo.color} ${
                        !['complete', 'error', 'duplicate'].includes(upload.status) ? 'animate-pulse' : ''
                      }`} />
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{upload.fileName}</p>
                        <p className={`text-sm ${statusInfo.color}`}>
                          {statusInfo.text}
                          {upload.duplicateTitle && ` - Already exists as "${upload.duplicateTitle}"`}
                          {upload.error && ` - ${upload.error}`}
                        </p>
                      </div>
                      
                      {!['complete', 'error', 'duplicate'].includes(upload.status) && (
                        <div className="w-24">
                          <Progress value={upload.progress} className="h-2" />
                          <p className="text-xs text-muted-foreground text-right mt-1">{upload.progress}%</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Intelligence Cards */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Video Intelligence
          </h2>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['coach-rick-vault-videos'] })}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !videos || videos.length === 0 ? (
          <Card className="p-12 text-center">
            <Film className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No videos yet. Upload your first coaching video above!</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => {
              const category = video.four_b_category?.toLowerCase() || 'brain';
              const config = fourBConfig[category] || fourBConfig.brain;
              const CategoryIcon = config.icon;
              const isProcessing = ['pending', 'transcribing', 'analyzing'].includes(video.status);
              const isPrescribable = video.access_level === 'prescription';

              return (
                <Card key={video.id} className="overflow-hidden">
                  {/* Status Bar */}
                  {isProcessing && (
                    <div className="bg-primary/20 px-4 py-2 flex items-center gap-2 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-primary font-medium">
                        {video.status === 'transcribing' ? 'AI Transcription in progress...' :
                         video.status === 'analyzing' ? 'Processing Intelligence...' :
                         'Processing...'}
                      </span>
                    </div>
                  )}
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                        <CategoryIcon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base line-clamp-2">{video.title}</CardTitle>
                        {video.description && (
                          <CardDescription className="mt-1 line-clamp-2">
                            {video.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* 4B Category Badge */}
                    {video.four_b_category && (
                      <div className="flex items-center gap-2">
                        <Badge className={`${config.bg} ${config.color} border-0`}>
                          {video.four_b_category.toUpperCase()}
                        </Badge>
                        {video.duration_seconds && (
                          <Badge variant="outline" className="text-xs">
                            {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {video.tags && video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <Tags className="w-4 h-4 text-muted-foreground mr-1" />
                        {video.tags.slice(0, 4).map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                        {video.tags.length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{video.tags.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Problems Addressed */}
                    {video.problems_addressed && video.problems_addressed.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Fixes: </span>
                        {video.problems_addressed.slice(0, 3).map(p => p.replace(/_/g, ' ')).join(', ')}
                        {video.problems_addressed.length > 3 && ` +${video.problems_addressed.length - 3} more`}
                      </div>
                    )}

                    {/* Prescription Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Pill className={`w-4 h-4 ${isPrescribable ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">Auto-Prescription</span>
                      </div>
                      <Switch
                        checked={isPrescribable}
                        onCheckedChange={() => togglePrescription(video.id, video.access_level)}
                        disabled={isProcessing}
                      />
                    </div>

                    {/* Transcript Preview */}
                    {video.transcript && (
                      <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground line-clamp-3">
                        <Mic className="w-3 h-3 inline mr-1" />
                        {video.transcript.substring(0, 200)}...
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(new Date(video.created_at), 'MMM d, yyyy')}</span>
                      {video.status === 'published' && (
                        <Badge className="bg-green-500/20 text-green-400 text-xs">Published</Badge>
                      )}
                      {video.status === 'ready_for_review' && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">Ready for Review</Badge>
                      )}
                      {video.status === 'failed' && (
                        <Badge className="bg-red-500/20 text-red-400 text-xs">Failed</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}