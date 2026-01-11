import { useState, useRef, useCallback } from 'react';
import { Upload, X, CheckCircle, HelpCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VideoUploaderProps {
  swingsRequired: number;
  swingsMaxAllowed?: number; // Default to swingsRequired if not provided
  sessionId: string;
  onComplete: () => void;
  isCheckoutLoading?: boolean;
}

interface VideoSlot {
  id: string;
  file: File;
  previewUrl: string;
  status: 'uploading' | 'uploaded' | 'error';
}

export function VideoUploader({ 
  swingsRequired, 
  swingsMaxAllowed,
  sessionId, 
  onComplete, 
  isCheckoutLoading 
}: VideoUploaderProps) {
  // Use fixed slots - max allowed or required (for backwards compatibility)
  const maxSlots = swingsMaxAllowed ?? Math.max(swingsRequired, 15);
  const minRequired = swingsRequired;
  
  // Fixed slots array: null = empty slot, VideoSlot = has video
  const [videoSlots, setVideoSlots] = useState<(VideoSlot | null)[]>(
    Array(maxSlots).fill(null)
  );
  const [dragOver, setDragOver] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [uploadingSlots, setUploadingSlots] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadedCount = videoSlots.filter(v => v?.status === 'uploaded').length;
  const filledCount = videoSlots.filter(v => v !== null).length;
  const isMinReached = uploadedCount >= minRequired;

  const validateVideo = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    if (!['video/mp4', 'video/quicktime'].includes(file.type)) {
      return { valid: false, error: 'Please upload a .mp4 or .mov file' };
    }
    if (file.size > 100 * 1024 * 1024) {
      return { valid: false, error: 'Video is too large (max 100MB)' };
    }
    return { valid: true };
  };

  const uploadVideoToBackend = async (file: File, swingIndex: number): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      formData.append('swingIndex', swingIndex.toString());

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-swing`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      return true;
    } catch (error) {
      console.error('Upload error:', error);
      return false;
    }
  };

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const filesToProcess = Array.from(files);
    
    for (const file of filesToProcess) {
      const validation = await validateVideo(file);
      
      if (!validation.valid) {
        toast.error(validation.error);
        continue;
      }

      // Find first empty slot
      const emptySlotIndex = videoSlots.findIndex(v => v === null);
      if (emptySlotIndex === -1) {
        toast.error('All swing slots are full');
        break;
      }

      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      
      // Add video in uploading state to the specific slot
      const newVideo: VideoSlot = {
        id,
        file,
        previewUrl,
        status: 'uploading',
      };

      // Update slot immediately
      setVideoSlots(prev => {
        const next = [...prev];
        next[emptySlotIndex] = newVideo;
        return next;
      });
      setUploadingSlots(prev => new Set(prev).add(emptySlotIndex));

      // Upload to backend using the SLOT INDEX as swingIndex
      const success = await uploadVideoToBackend(file, emptySlotIndex);

      // Update video status in the same slot
      setVideoSlots(prev => {
        const next = [...prev];
        const current = next[emptySlotIndex];
        if (current && current.id === id) {
          next[emptySlotIndex] = { ...current, status: success ? 'uploaded' : 'error' };
        }
        return next;
      });
      setUploadingSlots(prev => {
        const next = new Set(prev);
        next.delete(emptySlotIndex);
        return next;
      });

      if (!success) {
        toast.error(`Failed to upload swing ${emptySlotIndex + 1}`);
      }
    }
  }, [videoSlots, sessionId, maxSlots]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Remove video: set slot back to null (NO splice/reindexing!)
  const removeVideo = (slotIndex: number) => {
    setVideoSlots(prev => {
      const next = [...prev];
      // Revoke the object URL to prevent memory leaks
      const video = next[slotIndex];
      if (video?.previewUrl) {
        URL.revokeObjectURL(video.previewUrl);
      }
      next[slotIndex] = null;
      return next;
    });
  };

  // Retry failed upload
  const retryUpload = async (slotIndex: number) => {
    const video = videoSlots[slotIndex];
    if (!video || video.status !== 'error') return;

    setVideoSlots(prev => {
      const next = [...prev];
      if (next[slotIndex]) {
        next[slotIndex] = { ...next[slotIndex]!, status: 'uploading' };
      }
      return next;
    });
    setUploadingSlots(prev => new Set(prev).add(slotIndex));

    const success = await uploadVideoToBackend(video.file, slotIndex);

    setVideoSlots(prev => {
      const next = [...prev];
      const current = next[slotIndex];
      if (current) {
        next[slotIndex] = { ...current, status: success ? 'uploaded' : 'error' };
      }
      return next;
    });
    setUploadingSlots(prev => {
      const next = new Set(prev);
      next.delete(slotIndex);
      return next;
    });

    if (!success) {
      toast.error(`Failed to upload swing ${slotIndex + 1}`);
    }
  };

  const handleContinue = () => {
    if (isMinReached) {
      onComplete();
    }
  };

  // Calculate visible slots: show at least minRequired, or up to filledCount + 3 (max maxSlots)
  const visibleSlotCount = Math.min(maxSlots, Math.max(minRequired, filledCount + 3));

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          UPLOAD YOUR SWINGS
        </h1>
        <p className="text-muted-foreground">
          Upload at least {minRequired} swings (up to {maxSlots} allowed)
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          💡 More swings = more accurate analysis
        </p>
      </div>

      {/* Multi-swing progress grid */}
      <div className="mb-6">
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: visibleSlotCount }).map((_, i) => {
            const video = videoSlots[i];
            const isUploading = uploadingSlots.has(i);
            return (
              <VideoThumbnail
                key={i}
                index={i}
                video={video}
                isUploading={isUploading}
                isRequired={i < minRequired}
                onRemove={() => removeVideo(i)}
                onRetry={() => retryUpload(i)}
                onClick={() => !video && fileInputRef.current?.click()}
              />
            );
          })}
        </div>
        
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              {uploadedCount} of {minRequired}+ uploaded
              {uploadedCount >= minRequired && (
                <span className="text-success ml-2">✓ Ready for analysis</span>
              )}
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${Math.min(100, (uploadedCount / minRequired) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Upload zone */}
      {filledCount < maxSlots && (
        <div
          className={cn(
            'upload-zone p-8 md:p-12 text-center cursor-pointer',
            dragOver && 'drag-over'
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-accent" />
            </div>
            <div>
              <p className="font-medium mb-1">
                Drop videos here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to select
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              .mp4 or .mov • Max 100MB each
            </p>
          </div>
        </div>
      )}

      {/* Tip box */}
      <div className="mt-6 p-4 rounded-lg bg-accent/5 border border-accent/20">
        <p className="text-sm">
          <span className="font-medium">🎯 COACH RICK SAYS:</span>{' '}
          "Give me 5-10 of your best game-speed swings. No warm-ups, no flips. I want to see your real engine."
        </p>
      </div>

      {/* Guidelines button */}
      <Dialog open={showGuidelines} onOpenChange={setShowGuidelines}>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            className="mt-4 w-full gap-2 text-muted-foreground"
          >
            <HelpCircle className="w-4 h-4" />
            HOW TO RECORD YOUR SWING
          </Button>
        </DialogTrigger>
        <RecordingGuidelinesModal onClose={() => setShowGuidelines(false)} />
      </Dialog>

      <Button 
        variant="accent" 
        size="lg" 
        className="w-full mt-6"
        disabled={!isMinReached || isCheckoutLoading}
        onClick={handleContinue}
      >
        {isCheckoutLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating checkout...
          </>
        ) : (
          <>CHECKOUT & ANALYZE {uploadedCount} SWING{uploadedCount !== 1 ? 'S' : ''} →</>
        )}
      </Button>
    </div>
  );
}

interface VideoThumbnailProps {
  index: number;
  video: VideoSlot | null;
  isUploading?: boolean;
  isRequired?: boolean;
  onRemove: () => void;
  onRetry: () => void;
  onClick: () => void;
}

function VideoThumbnail({ index, video, isUploading, isRequired, onRemove, onRetry, onClick }: VideoThumbnailProps) {
  if (!video) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
          isRequired 
            ? "border-accent/50 hover:border-accent bg-accent/5" 
            : "border-border hover:border-accent/50"
        )}
      >
        <span className="text-2xl text-muted-foreground">+</span>
        <span className="text-xs text-muted-foreground">
          {isRequired ? `Swing ${index + 1}` : 'Optional'}
        </span>
      </button>
    );
  }

  const isError = video.status === 'error';

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-primary/10">
      <video 
        src={video.previewUrl} 
        className="w-full h-full object-cover"
      />
      {!isUploading && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {/* Retry button for errors */}
      {isError && !isUploading && (
        <button
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive/80 flex items-center justify-center hover:bg-destructive transition-colors"
          title="Retry upload"
        >
          <RefreshCw className="w-3 h-3 text-white" />
        </button>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <div className="flex items-center gap-1">
          {isUploading || video.status === 'uploading' ? (
            <Loader2 className="w-3 h-3 text-accent animate-spin" />
          ) : video.status === 'uploaded' ? (
            <CheckCircle className="w-3 h-3 text-success" />
          ) : (
            <X className="w-3 h-3 text-destructive" />
          )}
          <span className="text-xs text-white font-medium">Swing {index + 1}</span>
        </div>
      </div>
    </div>
  );
}

function RecordingGuidelinesModal({ onClose }: { onClose: () => void }) {
  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          📹 HOW TO RECORD YOUR SWING
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-surface border border-border">
          <p className="text-sm font-medium mb-3">CAMERA POSITION</p>
          <div className="text-center py-4 font-mono text-sm">
            <div className="space-y-2">
              <p>⚾ ←── Pitcher</p>
              <p className="text-2xl">│</p>
              <p>🧍 ←── Hitter</p>
              <p className="text-2xl">│</p>
              <p>📱 ←── Camera (10-15 ft away, hip height)</p>
            </div>
          </div>
        </div>

        <div>
          <p className="font-medium text-success mb-2">✅ DO THIS:</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Side angle (perpendicular to batter)</li>
            <li>• Camera at hip/waist height</li>
            <li>• 10-15 feet away</li>
            <li>• Full body visible (head to feet)</li>
            <li>• Landscape mode (horizontal)</li>
            <li>• 120fps or higher for best analysis</li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-destructive mb-2">❌ DON'T DO THIS:</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Behind home plate angle</li>
            <li>• Portrait mode (vertical)</li>
            <li>• Too far away or too close</li>
            <li>• Multiple swings in one video</li>
            <li>• Warm-up or soft swings</li>
          </ul>
        </div>

        <Button variant="accent" className="w-full" onClick={onClose}>
          GOT IT
        </Button>
      </div>
    </DialogContent>
  );
}
