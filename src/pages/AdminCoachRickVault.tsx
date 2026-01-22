/**
 * Coach Rick Admin Vault - Bulk video upload with TUS resumable uploads,
 * AI transcription & intelligence cards
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as tus from "tus-js-client";
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
  Pill,
  Pause,
  Play,
  X,
  Trash2
} from "lucide-react";
import { format } from "date-fns";

// Types
interface UploadingVideo {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  status: 'queued' | 'hashing' | 'checking' | 'uploading' | 'transcribing' | 'analyzing' | 'complete' | 'duplicate' | 'error' | 'paused';
  progress: number;
  error?: string;
  duplicateTitle?: string;
  videoId?: string;
  tusUpload?: tus.Upload;
  bytesUploaded?: number;
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

// Constants
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const MAX_CONCURRENT_UPLOADS = 3;
const BUCKET_NAME = 'academy_videos';

// Hash function for deduplication
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const pollingRef = useRef<Set<string>>(new Set());
  const activeUploadsRef = useRef<number>(0);

  // Fetch processed videos
  const { data: videos, isLoading } = useQuery({
    queryKey: ['coach-rick-vault-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drill_videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as ProcessedVideo[];
    },
    refetchInterval: 10000,
  });

  // Delete a single video (from storage + database)
  const deleteVideo = async (video: ProcessedVideo) => {
    try {
      // Delete from storage if storage_path exists
      if (video.storage_path) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([video.storage_path]);
        
        if (storageError) {
          console.warn('Storage delete warning:', storageError);
          // Continue even if storage delete fails (file may not exist)
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('drill_videos')
        .delete()
        .eq('id', video.id);

      if (dbError) throw dbError;

      return { success: true };
    } catch (err: any) {
      console.error('Delete error:', err);
      return { success: false, error: err.message };
    }
  };

  // Bulk delete selected videos
  const bulkDeleteVideos = async (videoIds: string[]) => {
    setIsDeleting(true);
    let successCount = 0;
    let failCount = 0;

    const videosToDelete = videos?.filter(v => videoIds.includes(v.id)) || [];

    for (const video of videosToDelete) {
      const result = await deleteVideo(video);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsDeleting(false);
    setSelectedVideos(new Set());
    queryClient.invalidateQueries({ queryKey: ['coach-rick-vault-videos'] });

    toast({
      title: failCount === 0 ? 'Deleted Successfully' : 'Deletion Complete',
      description: `Deleted ${successCount} video${successCount !== 1 ? 's' : ''}${failCount > 0 ? `, ${failCount} failed` : ''}`,
      variant: failCount > 0 ? 'destructive' : 'default',
    });
  };

  // Select all failed videos
  const selectAllFailed = () => {
    const failedVideos = videos?.filter(v => v.status === 'failed' || v.status === 'pending') || [];
    setSelectedVideos(new Set(failedVideos.map(v => v.id)));
  };

  // Toggle video selection
  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideos(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedVideos(new Set());
  };

  // Process next queued items
  const processNextInQueue = useCallback(() => {
    setUploadQueue(prev => {
      const queued = prev.filter(v => v.status === 'queued');
      const processing = prev.filter(v => 
        ['hashing', 'checking', 'uploading'].includes(v.status)
      ).length;
      
      const slotsAvailable = MAX_CONCURRENT_UPLOADS - processing;
      
      if (slotsAvailable > 0 && queued.length > 0) {
        const toProcess = queued.slice(0, slotsAvailable);
        toProcess.forEach(item => {
          processFile(item.file, item.id);
        });
      }
      
      return prev;
    });
  }, []);

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

    const maxAttempts = 120; // 10 minutes
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

      setUploadQueue(prev => prev.map(v => {
        if (v.videoId === videoId) {
          if (data.status === 'transcribing') {
            return { ...v, status: 'transcribing', progress: 60 };
          } else if (data.status === 'analyzing') {
            return { ...v, status: 'analyzing', progress: 80 };
          } else if (data.status === 'published' || data.status === 'ready_for_review') {
            activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
            processNextInQueue();
            return { ...v, status: 'complete', progress: 100 };
          } else if (data.status === 'failed') {
            activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
            processNextInQueue();
            return { ...v, status: 'error', error: 'Processing failed' };
          }
        }
        return v;
      }));

      if (['published', 'ready_for_review', 'failed'].includes(data.status)) {
        queryClient.invalidateQueries({ queryKey: ['coach-rick-vault-videos'] });
        break;
      }
    }

    pollingRef.current.delete(videoId);
  }, [queryClient, processNextInQueue]);

  // TUS Upload with resumable capability
  const createTusUpload = useCallback((
    file: File, 
    uploadId: string, 
    storagePath: string,
    onComplete: (url: string) => void
  ): tus.Upload => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET_NAME,
        objectName: storagePath,
        contentType: file.type,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // 6MB chunks
      onError: (error) => {
        console.error('TUS upload error:', error);
        setUploadQueue(prev => prev.map(v => 
          v.id === uploadId 
            ? { ...v, status: 'error' as const, error: error.message }
            : v
        ));
        activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
        processNextInQueue();
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
        // Map upload progress to 20-50% of total progress
        const mappedProgress = 20 + (percentage * 0.3);
        setUploadQueue(prev => prev.map(v => 
          v.id === uploadId 
            ? { ...v, progress: mappedProgress, bytesUploaded }
            : v
        ));
      },
      onSuccess: () => {
        const { data } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(storagePath);
        onComplete(data.publicUrl);
      },
    });

    return upload;
  }, [processNextInQueue]);

  // Process a single file upload
  const processFile = useCallback(async (file: File, uploadId: string) => {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId 
          ? { ...v, status: 'error' as const, error: 'Invalid file type (MP4, MOV, WebM only)' }
          : v
      ));
      processNextInQueue();
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId 
          ? { ...v, status: 'error' as const, error: 'File too large (500MB max)' }
          : v
      ));
      processNextInQueue();
      return;
    }

    try {
      // Step 1: Hash
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId ? { ...v, status: 'hashing' as const, progress: 5 } : v
      ));
      const fileHash = await hashFile(file);

      // Step 2: Check duplicates
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId ? { ...v, status: 'checking' as const, progress: 10 } : v
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
        activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
        processNextInQueue();
        return;
      }

      // Step 3: TUS Upload
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId ? { ...v, status: 'uploading' as const, progress: 20 } : v
      ));

      const storagePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const tusUpload = createTusUpload(file, uploadId, storagePath, async (publicUrl) => {
        try {
          // Step 4: Create database record
          setUploadQueue(prev => prev.map(v => 
            v.id === uploadId ? { ...v, progress: 55 } : v
          ));

          const { data: videoRecord, error: dbError } = await supabase
            .from('drill_videos')
            .insert({
              title: file.name.replace(/\.[^/.]+$/, ''),
              video_url: publicUrl,
              storage_path: storagePath,
              file_hash: fileHash,
              status: 'pending',
            })
            .select()
            .single();

          if (dbError) throw dbError;

          // Update queue with video ID
          setUploadQueue(prev => prev.map(v => 
            v.id === uploadId 
              ? { ...v, status: 'transcribing' as const, progress: 60, videoId: videoRecord.id }
              : v
          ));

          // Step 5: Trigger transcription pipeline (Deepgram via Kommodo + Gemini auto-tag)
          console.log(`Triggering intelligence pipeline for video ${videoRecord.id}`);
          await supabase.functions.invoke('transcribe-video', {
            body: { 
              video_id: videoRecord.id,
              auto_publish: true
            }
          });

          // Start polling for status updates
          pollVideoStatus(videoRecord.id);
        } catch (err: any) {
          console.error('Post-upload error:', err);
          setUploadQueue(prev => prev.map(v => 
            v.id === uploadId 
              ? { ...v, status: 'error' as const, error: err.message }
              : v
          ));
          activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
          processNextInQueue();
        }
      });

      // Store TUS upload reference for pause/resume
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId ? { ...v, tusUpload } : v
      ));

      // Start the upload
      tusUpload.start();

    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadQueue(prev => prev.map(v => 
        v.id === uploadId 
          ? { ...v, status: 'error' as const, error: err.message }
          : v
      ));
      activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
      processNextInQueue();
    }
  }, [createTusUpload, pollVideoStatus, processNextInQueue]);

  // Handle file selection (drag-drop or click)
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newUploads: UploadingVideo[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      fileName: file.name,
      fileSize: file.size,
      status: 'queued' as const,
      progress: 0,
    }));

    setUploadQueue(prev => [...newUploads, ...prev]);

    toast({
      title: `${files.length} video${files.length > 1 ? 's' : ''} queued`,
      description: `Processing up to ${MAX_CONCURRENT_UPLOADS} videos at a time`,
    });

    // Start processing
    setTimeout(() => processNextInQueue(), 100);
  }, [processNextInQueue, toast]);

  // Pause upload
  const pauseUpload = useCallback((uploadId: string) => {
    setUploadQueue(prev => prev.map(v => {
      if (v.id === uploadId && v.tusUpload && v.status === 'uploading') {
        v.tusUpload.abort();
        return { ...v, status: 'paused' as const };
      }
      return v;
    }));
  }, []);

  // Resume upload
  const resumeUpload = useCallback((uploadId: string) => {
    setUploadQueue(prev => prev.map(v => {
      if (v.id === uploadId && v.tusUpload && v.status === 'paused') {
        v.tusUpload.start();
        return { ...v, status: 'uploading' as const };
      }
      return v;
    }));
  }, []);

  // Cancel upload
  const cancelUpload = useCallback((uploadId: string) => {
    setUploadQueue(prev => {
      const upload = prev.find(v => v.id === uploadId);
      if (upload?.tusUpload) {
        upload.tusUpload.abort();
      }
      return prev.filter(v => v.id !== uploadId);
    });
    processNextInQueue();
  }, [processNextInQueue]);

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
      case 'queued':
        return { icon: Loader2, text: 'Queued...', color: 'text-muted-foreground' };
      case 'hashing':
        return { icon: Sparkles, text: 'Fingerprinting...', color: 'text-purple-400' };
      case 'checking':
        return { icon: Search, text: 'Checking duplicates...', color: 'text-blue-400' };
      case 'uploading':
        return { icon: Upload, text: 'Uploading (resumable)...', color: 'text-yellow-400' };
      case 'paused':
        return { icon: Pause, text: 'Paused', color: 'text-orange-400' };
      case 'transcribing':
        return { icon: Mic, text: 'AI Transcription...', color: 'text-orange-400' };
      case 'analyzing':
        return { icon: Brain, text: '4B Intelligence...', color: 'text-primary' };
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

  // Cancel all queued
  const cancelAllQueued = () => {
    setUploadQueue(prev => {
      prev.filter(v => v.tusUpload).forEach(v => v.tusUpload?.abort());
      return prev.filter(v => !['queued', 'hashing', 'checking', 'uploading', 'paused'].includes(v.status));
    });
  };

  const activeUploads = uploadQueue.filter(v => 
    ['hashing', 'checking', 'uploading', 'transcribing', 'analyzing'].includes(v.status)
  );
  const queuedUploads = uploadQueue.filter(v => v.status === 'queued');

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
            Bulk upload coaching videos with resumable uploads, AI transcription & 4B auto-tagging
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
                {isDragging ? 'Drop videos here!' : 'Drag & Drop Multiple Videos'}
              </h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Drop 10, 20, or even 50 videos at once! Each will be queued with resumable uploads
                and automatically sent through AI transcription and 4B tagging.
              </p>
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground/70">
                <span>• Max 500MB per file</span>
                <span>• Resumable uploads</span>
                <span>• Auto duplicate detection</span>
              </div>
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
                  {queuedUploads.length > 0 && (
                    <Badge variant="outline">{queuedUploads.length} queued</Badge>
                  )}
                </CardTitle>
                <div className="flex gap-2">
                  {(queuedUploads.length > 0 || activeUploads.length > 0) && (
                    <Button variant="outline" size="sm" onClick={cancelAllQueued}>
                      Cancel All
                    </Button>
                  )}
                  {uploadQueue.some(v => ['complete', 'duplicate', 'error'].includes(v.status)) && (
                    <Button variant="ghost" size="sm" onClick={clearCompleted}>
                      Clear Completed
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {uploadQueue.map((upload) => {
                    const statusInfo = getStatusDisplay(upload.status);
                    const StatusIcon = statusInfo.icon;
                    const isActive = ['hashing', 'checking', 'uploading', 'transcribing', 'analyzing'].includes(upload.status);
                    
                    return (
                      <div 
                        key={upload.id}
                        className={`
                          flex items-center gap-4 p-3 rounded-lg border
                          ${upload.status === 'complete' ? 'bg-green-500/5 border-green-500/30' :
                            upload.status === 'error' || upload.status === 'duplicate' ? 'bg-red-500/5 border-red-500/30' :
                            upload.status === 'paused' ? 'bg-orange-500/5 border-orange-500/30' :
                            upload.status === 'queued' ? 'bg-muted/20 border-border/30' :
                            'bg-muted/30 border-border/50'}
                        `}
                      >
                        <StatusIcon className={`w-5 h-5 shrink-0 ${statusInfo.color} ${
                          isActive ? 'animate-pulse' : ''
                        }`} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{upload.fileName}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(upload.fileSize)}
                            </span>
                          </div>
                          <p className={`text-sm ${statusInfo.color}`}>
                            {statusInfo.text}
                            {upload.duplicateTitle && ` - Already exists as "${upload.duplicateTitle}"`}
                            {upload.error && ` - ${upload.error}`}
                            {upload.status === 'uploading' && upload.bytesUploaded && (
                              <span className="ml-2 text-muted-foreground">
                                ({formatFileSize(upload.bytesUploaded)} uploaded)
                              </span>
                            )}
                          </p>
                        </div>
                        
                        {/* Progress bar for active uploads */}
                        {isActive && (
                          <div className="w-28">
                            <Progress value={upload.progress} className="h-2" />
                            <p className="text-xs text-muted-foreground text-right mt-1">{Math.round(upload.progress)}%</p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-1">
                          {upload.status === 'uploading' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); pauseUpload(upload.id); }}
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          )}
                          {upload.status === 'paused' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); resumeUpload(upload.id); }}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          {['queued', 'uploading', 'paused', 'hashing', 'checking'].includes(upload.status) && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); cancelUpload(upload.id); }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Intelligence Cards */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Video Intelligence
              {videos && videos.length > 0 && (
                <Badge variant="outline" className="ml-2">{videos.length} videos</Badge>
              )}
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

          {/* Bulk Actions Bar */}
          {videos && videos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg border">
              <span className="text-sm text-muted-foreground">Bulk Actions:</span>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={selectAllFailed}
                disabled={isDeleting}
              >
                <AlertTriangle className="w-4 h-4 mr-1 text-orange-400" />
                Select All Failed/Pending
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedVideos(new Set(videos.map(v => v.id)))}
                disabled={isDeleting}
              >
                Select All
              </Button>
              
              {selectedVideos.size > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={clearSelection}
                    disabled={isDeleting}
                  >
                    Clear ({selectedVideos.size})
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => bulkDeleteVideos(Array.from(selectedVideos))}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-1" />
                    )}
                    Delete Selected ({selectedVideos.size})
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : videos && videos.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => {
              const category = video.four_b_category?.toLowerCase() || 'brain';
              const config = fourBConfig[category] || fourBConfig.brain;
              const CategoryIcon = config.icon;
              const isSelected = selectedVideos.has(video.id);
              const isFailed = video.status === 'failed' || video.status === 'pending';
              const isProcessing = video.status === 'processing' || video.status === 'transcribing' || video.status === 'analyzing';
              
              // Build playable video URL - prefer storage_path for immediate access
              const getVideoUrl = () => {
                if (video.storage_path) {
                  // Use public URL from storage bucket
                  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${video.storage_path}`;
                }
                return video.video_url;
              };
              const videoSrc = getVideoUrl();
              
              return (
                <Card 
                  key={video.id} 
                  className={`overflow-hidden transition-all ${
                    isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                  } ${isFailed ? 'border-destructive/50' : ''}`}
                >
                  {/* Video Preview with Processing Overlay */}
                  <div className="relative aspect-video bg-black">
                    <video
                      src={videoSrc}
                      className="w-full h-full object-contain"
                      controls
                      preload="metadata"
                      playsInline
                    />
                    {/* Processing overlay - doesn't block controls */}
                    {isProcessing && (
                      <div className="absolute top-2 left-2 right-2 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1 pointer-events-none">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-xs text-white font-medium">
                          {video.status === 'transcribing' ? 'Transcribing...' : 
                           video.status === 'analyzing' ? 'Analyzing...' : 'Processing...'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className={`h-1.5 ${isFailed ? 'bg-destructive/50' : isProcessing ? 'bg-primary/50 animate-pulse' : config.bg}`} />
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleVideoSelection(video.id)}
                          className="shrink-0"
                        />
                        <div className={`p-1.5 rounded-lg ${config.bg}`}>
                          <CategoryIcon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <CardTitle className="text-sm truncate">{video.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge 
                          variant={video.status === 'published' ? 'default' : video.status === 'failed' ? 'destructive' : 'secondary'}
                          className="shrink-0 text-xs"
                        >
                          {video.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete "${video.title}"?`)) {
                              deleteVideo(video).then((result) => {
                                if (result.success) {
                                  queryClient.invalidateQueries({ queryKey: ['coach-rick-vault-videos'] });
                                  toast({ title: 'Deleted', description: `"${video.title}" removed` });
                                } else {
                                  toast({ title: 'Error', description: result.error, variant: 'destructive' });
                                }
                              });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {video.duration_seconds && (
                      <CardDescription className="text-xs ml-7">
                        {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}
                      </CardDescription>
                    )}
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    {/* Tags */}
                    {video.tags && video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {video.tags.slice(0, 4).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {video.tags.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{video.tags.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Problems addressed */}
                    {video.problems_addressed && video.problems_addressed.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Fixes:</span> {video.problems_addressed.slice(0, 2).join(', ')}
                        {video.problems_addressed.length > 2 && ` +${video.problems_addressed.length - 2} more`}
                      </div>
                    )}
                    
                    {/* Prescription toggle */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Pill className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Auto-Prescribe</span>
                      </div>
                      <Switch 
                        checked={video.access_level === 'prescription'}
                        onCheckedChange={() => togglePrescription(video.id, video.access_level)}
                      />
                    </div>
                    
                    {/* Transcript preview */}
                    {video.transcript && (
                      <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 max-h-16 overflow-hidden">
                        {video.transcript.substring(0, 150)}...
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="py-12">
            <CardContent className="text-center">
              <Film className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No videos uploaded yet</p>
              <p className="text-sm text-muted-foreground/70">Drop some videos above to get started</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
