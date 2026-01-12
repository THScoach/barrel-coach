import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, X, Check, AlertCircle, Loader2, 
  Video, FileVideo 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VideoUploadWithGumletProps {
  onUploadComplete?: (videoData: {
    id: string;
    videoUrl: string;
    gumletUrl?: string;
    hlsUrl?: string;
    thumbnailUrl?: string;
  }) => void;
  onError?: (error: Error) => void;
  maxSizeMB?: number;
  allowedFormats?: string[];
  autoPublish?: boolean;
  className?: string;
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

interface UploadState {
  status: UploadStatus;
  progress: number;
  file: File | null;
  previewUrl: string | null;
  errorMessage: string | null;
  videoId: string | null;
}

export function VideoUploadWithGumlet({
  onUploadComplete,
  onError,
  maxSizeMB = 500,
  allowedFormats = ['video/mp4', 'video/quicktime', 'video/webm'],
  autoPublish = false,
  className,
}: VideoUploadWithGumletProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    file: null,
    previewUrl: null,
    errorMessage: null,
    videoId: null,
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!allowedFormats.includes(file.type)) {
      return `Invalid format. Allowed: ${allowedFormats.map(f => f.split('/')[1]).join(', ')}`;
    }
    
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return `File too large. Maximum size: ${maxSizeMB}MB`;
    }
    
    return null;
  }, [allowedFormats, maxSizeMB]);

  const handleFileSelect = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: validationError,
      }));
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    
    setUploadState({
      status: 'uploading',
      progress: 0,
      file,
      previewUrl,
      errorMessage: null,
      videoId: null,
    });

    try {
      abortControllerRef.current = new AbortController();
      
      // Step 1: Upload to Supabase Storage
      const fileExt = file.name.split('.').pop() || 'mp4';
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const storagePath = `uploads/${fileName}`;

      // Use XHR for progress tracking
      const { data: storageData, error: storageError } = await supabase.storage
        .from('videos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (storageError) throw storageError;

      setUploadState(prev => ({ ...prev, progress: 50 }));

      // Step 2: Call edge function to process with Gumlet
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
        'upload-to-gumlet',
        {
          body: {
            storage_path: storagePath,
            original_title: file.name.replace(/\.[^/.]+$/, ''),
            auto_publish: autoPublish,
          },
        }
      );

      if (uploadError) throw uploadError;

      setUploadState(prev => ({ ...prev, progress: 75, status: 'processing' }));

      // Step 3: Poll for Gumlet processing status
      if (uploadData?.video_id) {
        // Wait briefly for initial processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setUploadState(prev => ({
          ...prev,
          status: 'complete',
          progress: 100,
          videoId: uploadData.video_id,
        }));

        onUploadComplete?.({
          id: uploadData.video_id,
          videoUrl: uploadData.video_url,
          gumletUrl: uploadData.gumlet_url,
          hlsUrl: uploadData.hls_url,
          thumbnailUrl: uploadData.thumbnail_url,
        });

        toast.success('Video uploaded successfully!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      const message = error instanceof Error ? error.message : 'Upload failed';
      
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: message,
      }));
      
      onError?.(error instanceof Error ? error : new Error(message));
      toast.error(message);
    }
  }, [validateFile, autoPublish, onUploadComplete, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (uploadState.previewUrl) {
      URL.revokeObjectURL(uploadState.previewUrl);
    }
    
    setUploadState({
      status: 'idle',
      progress: 0,
      file: null,
      previewUrl: null,
      errorMessage: null,
      videoId: null,
    });
  }, [uploadState.previewUrl]);

  const handleReset = useCallback(() => {
    handleCancel();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [handleCancel]);

  const { status, progress, file, previewUrl, errorMessage } = uploadState;

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={allowedFormats.join(',')}
        onChange={handleInputChange}
        className="hidden"
      />

      {status === 'idle' && (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-slate-600 hover:bg-slate-900/50 transition-all"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
              <Upload className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <p className="text-white font-medium">Drop video here or click to upload</p>
              <p className="text-sm text-slate-400 mt-1">
                MP4, MOV, WebM up to {maxSizeMB}MB
              </p>
            </div>
          </div>
        </div>
      )}

      {(status === 'uploading' || status === 'processing') && (
        <div className="border border-slate-700 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-4">
            {previewUrl ? (
              <video
                src={previewUrl}
                className="w-24 h-16 object-cover rounded-lg bg-black"
                muted
              />
            ) : (
              <div className="w-24 h-16 bg-slate-800 rounded-lg flex items-center justify-center">
                <FileVideo className="w-6 h-6 text-slate-500" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{file?.name}</p>
              <p className="text-sm text-slate-400">
                {status === 'uploading' ? 'Uploading...' : 'Processing with Gumlet...'}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{progress}%</span>
              {status === 'processing' && (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Processing
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {status === 'complete' && (
        <div className="border border-green-700/50 bg-green-900/10 rounded-xl p-6">
          <div className="flex items-center gap-4">
            {previewUrl ? (
              <video
                src={previewUrl}
                className="w-24 h-16 object-cover rounded-lg bg-black"
                muted
              />
            ) : (
              <div className="w-24 h-16 bg-slate-800 rounded-lg flex items-center justify-center">
                <Video className="w-6 h-6 text-green-500" />
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <p className="text-white font-medium">Upload complete!</p>
              </div>
              <p className="text-sm text-slate-400">{file?.name}</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-slate-700"
            >
              Upload Another
            </Button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="border border-red-700/50 bg-red-900/10 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            
            <div className="flex-1">
              <p className="text-white font-medium">Upload failed</p>
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-slate-700"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoUploadWithGumlet;
