/**
 * Academy Video Uploader - Internal hosting with deduplication
 * Uploads videos to videos bucket with hash-based duplicate detection
 * Includes client-side thumbnail extraction for immediate preview
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Film,
  Sparkles,
  Search
} from "lucide-react";

interface AcademyUploaderProps {
  onUploadComplete?: (videoId: string, storageUrl: string) => void;
  autoPublish?: boolean;
}

// Hash function for deduplication
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Extract a thumbnail frame from video at 1 second mark
async function extractVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    video.onloadedmetadata = () => {
      // Seek to 1 second or 10% of video, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1);
    };
    
    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(video.src);
        resolve(blob);
      }, 'image/jpeg', 0.85);
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };
    
    // Set timeout in case video doesn't load
    setTimeout(() => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    }, 10000);
    
    video.src = URL.createObjectURL(file);
  });
}

type UploadStatus = 'idle' | 'hashing' | 'checking' | 'uploading' | 'processing' | 'complete' | 'duplicate' | 'error';

export function AcademyUploader({ onUploadComplete, autoPublish = false }: AcademyUploaderProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState<string | null>(null);

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload MP4, MOV, or WebM files only",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (500MB max)
    if (file.size > 500 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 500MB",
        variant: "destructive"
      });
      return;
    }

    setFileName(file.name);
    setError(null);
    setDuplicateTitle(null);

    try {
      // Step 1: Hash the file
      setStatus('hashing');
      setProgress(10);
      const fileHash = await hashFile(file);

      // Step 2: Check for duplicates
      setStatus('checking');
      setProgress(20);
      
      const { data: duplicate } = await supabase.rpc('check_academy_video_duplicate', {
        p_file_hash: fileHash
      });

      if (duplicate && duplicate.length > 0) {
        setStatus('duplicate');
        setDuplicateTitle(duplicate[0].title);
        toast({
          title: "Duplicate Video",
          description: `This video already exists as "${duplicate[0].title}"`,
          variant: "destructive"
        });
        return;
      }

      // Step 3: Extract thumbnail client-side for immediate preview
      setStatus('uploading');
      setProgress(35);
      
      let thumbnailUrl: string | null = null;
      try {
        const thumbnailBlob = await extractVideoThumbnail(file);
        if (thumbnailBlob) {
          const thumbnailPath = `thumbnails/${Date.now()}-${file.name.replace(/\.[^/.]+$/, '')}.jpg`;
          const { error: thumbError } = await supabase.storage
            .from('videos')
            .upload(thumbnailPath, thumbnailBlob, {
              cacheControl: '31536000',
              contentType: 'image/jpeg'
            });
          
          if (!thumbError) {
            const { data: thumbUrlData } = await supabase.storage
              .from('videos')
              .createSignedUrl(thumbnailPath, 60 * 60 * 24 * 365);
            thumbnailUrl = thumbUrlData?.signedUrl || null;
          }
        }
      } catch (thumbErr) {
        console.warn('Thumbnail extraction failed, will rely on Gumlet:', thumbErr);
      }

      setProgress(45);

      // Step 4: Upload video to storage (videos bucket for Gumlet pipeline)
      const storagePath = `drills/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      setProgress(70);

      // Step 5: Trigger Gumlet processing pipeline
      // This creates the drill_videos record, generates HLS/DASH streams,
      // thumbnails, and triggers transcription automatically
      setStatus('processing');
      setProgress(85);

      const { data: gumletResponse, error: gumletError } = await supabase.functions.invoke('upload-to-gumlet', {
        body: { 
          storage_path: storagePath,
          original_title: file.name.replace(/\.[^/.]+$/, ''),
          auto_publish: autoPublish,
          file_hash: fileHash,
          preview_thumbnail_url: thumbnailUrl
        }
      });

      if (gumletError) throw gumletError;
      if (!gumletResponse?.success) throw new Error(gumletResponse?.error || 'Gumlet processing failed');

      setStatus('complete');
      setProgress(100);

      toast({
        title: "Upload Complete",
        description: "Video is being processed for streaming, transcription & auto-tagging"
      });

      onUploadComplete?.(gumletResponse.video_id, gumletResponse.video_url);

    } catch (err: any) {
      console.error('Upload error:', err);
      setStatus('error');
      setError(err.message || 'Upload failed');
      toast({
        title: "Upload Failed",
        description: err.message,
        variant: "destructive"
      });
    }

    // Reset input
    event.target.value = '';
  }, [toast, autoPublish, onUploadComplete]);

  const getStatusIcon = () => {
    switch (status) {
      case 'hashing':
        return <Sparkles className="h-6 w-6 animate-pulse text-purple-400" />;
      case 'checking':
        return <Search className="h-6 w-6 animate-pulse text-blue-400" />;
      case 'uploading':
        return <Upload className="h-6 w-6 animate-bounce text-yellow-400" />;
      case 'processing':
        return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle2 className="h-6 w-6 text-green-400" />;
      case 'duplicate':
      case 'error':
        return <AlertTriangle className="h-6 w-6 text-red-400" />;
      default:
        return <Film className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'hashing':
        return 'Generating file hash...';
      case 'checking':
        return 'Checking for duplicates...';
      case 'uploading':
        return 'Uploading to Academy...';
      case 'processing':
        return 'Starting transcription...';
      case 'complete':
        return 'Upload complete!';
      case 'duplicate':
        return `Already exists as "${duplicateTitle}"`;
      case 'error':
        return error || 'Upload failed';
      default:
        return 'Drag & drop or click to upload';
    }
  };

  const isProcessing = ['hashing', 'checking', 'uploading', 'processing'].includes(status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          Academy Video Upload
        </CardTitle>
        <CardDescription>
          Upload videos to your Internal Academy. Duplicates are automatically blocked.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className={`
          flex flex-col items-center justify-center w-full min-h-[160px] 
          border-2 border-dashed rounded-xl cursor-pointer transition-all
          ${isProcessing 
            ? 'border-primary/50 bg-primary/5' 
            : status === 'complete'
              ? 'border-green-500/50 bg-green-500/5'
              : status === 'error' || status === 'duplicate'
                ? 'border-red-500/50 bg-red-500/5'
                : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
          }
        `}>
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            {getStatusIcon()}
            
            <p className="mt-3 text-sm font-medium">
              {getStatusText()}
            </p>
            
            {fileName && isProcessing && (
              <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                {fileName}
              </p>
            )}

            {isProcessing && (
              <div className="w-full max-w-[200px] mt-4">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
              </div>
            )}

            {status === 'idle' && (
              <p className="text-xs text-muted-foreground mt-2">
                MP4, MOV, WebM • Max 500MB
              </p>
            )}

            {(status === 'complete' || status === 'error' || status === 'duplicate') && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={(e) => {
                  e.preventDefault();
                  setStatus('idle');
                  setProgress(0);
                  setFileName('');
                  setError(null);
                  setDuplicateTitle(null);
                }}
              >
                Upload Another
              </Button>
            )}
          </div>
          
          <input
            type="file"
            className="hidden"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={handleUpload}
            disabled={isProcessing}
          />
        </label>
      </CardContent>
    </Card>
  );
}
