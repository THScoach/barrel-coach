import { useState, useRef, useCallback } from 'react';
import { Upload, X, Play, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UploadedVideo } from '@/types/analysis';
import { cn } from '@/lib/utils';

interface VideoUploaderProps {
  swingsRequired: number;
  onComplete: (videos: UploadedVideo[]) => void;
}

export function VideoUploader({ swingsRequired, onComplete }: VideoUploaderProps) {
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isComplete = videos.filter(v => v.status === 'uploaded').length >= swingsRequired;

  const validateVideo = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    // Check file type
    if (!['video/mp4', 'video/quicktime'].includes(file.type)) {
      return { valid: false, error: 'Please upload a .mp4 or .mov file' };
    }

    // Check file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      return { valid: false, error: 'Video is too large (max 100MB)' };
    }

    return { valid: true };
  };

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const remainingSlots = swingsRequired - videos.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToProcess) {
      const validation = await validateVideo(file);
      
      if (!validation.valid) {
        // Show error toast or modal
        console.error(validation.error);
        continue;
      }

      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      
      const newVideo: UploadedVideo = {
        id,
        index: videos.length,
        file,
        previewUrl,
        duration: 0,
        status: 'uploaded', // Simulating immediate upload for now
      };

      setVideos(prev => [...prev, newVideo]);
    }
  }, [videos, swingsRequired]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const removeVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    if (isComplete) {
      onComplete(videos);
    }
  };

  const uploadedCount = videos.filter(v => v.status === 'uploaded').length;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          {swingsRequired === 1 ? 'UPLOAD YOUR SWING' : `UPLOAD ${swingsRequired} SWINGS`}
        </h1>
        {swingsRequired > 1 && (
          <p className="text-muted-foreground">
            All swings should be from the same session
          </p>
        )}
      </div>

      {/* Multi-swing progress grid */}
      {swingsRequired > 1 && (
        <div className="mb-6">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: swingsRequired }).map((_, i) => {
              const video = videos[i];
              return (
                <VideoThumbnail
                  key={i}
                  index={i}
                  video={video}
                  onRemove={() => removeVideo(i)}
                  onClick={() => !video && fileInputRef.current?.click()}
                />
              );
            })}
          </div>
          
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {uploadedCount} of {swingsRequired} uploaded
              </span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${(uploadedCount / swingsRequired) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Upload zone (show if not complete) */}
      {uploadedCount < swingsRequired && (
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
            multiple={swingsRequired > 1}
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-accent" />
            </div>
            <div>
              <p className="font-medium mb-1">
                Drop video{swingsRequired > 1 ? 's' : ''} here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to select
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              .mp4 or .mov • Max 30 seconds
            </p>
          </div>
        </div>
      )}

      {/* Single video preview */}
      {swingsRequired === 1 && videos[0] && (
        <div className="relative rounded-lg overflow-hidden bg-primary/5 aspect-video">
          <video 
            src={videos[0].previewUrl} 
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => removeVideo(0)}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-background/80 text-xs font-medium">
            <CheckCircle className="w-3 h-3 text-success inline mr-1" />
            Ready
          </div>
        </div>
      )}

      {/* Tip box */}
      {swingsRequired > 1 && (
        <div className="mt-6 p-4 rounded-lg bg-accent/5 border border-accent/20">
          <p className="text-sm">
            <span className="font-medium">💡 TIP:</span>{' '}
            Upload your 5 best swings from today's practice. Don't include warm-up swings.
          </p>
        </div>
      )}

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
        <RecordingGuidelinesModal />
      </Dialog>

      <Button 
        variant="accent" 
        size="lg" 
        className="w-full mt-6"
        disabled={!isComplete}
        onClick={handleContinue}
      >
        {swingsRequired === 1 ? 'CONTINUE →' : `ANALYZE ALL ${swingsRequired} SWINGS →`}
      </Button>
    </div>
  );
}

interface VideoThumbnailProps {
  index: number;
  video?: UploadedVideo;
  onRemove: () => void;
  onClick: () => void;
}

function VideoThumbnail({ index, video, onRemove, onClick }: VideoThumbnailProps) {
  if (!video) {
    return (
      <button
        onClick={onClick}
        className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent/50 flex flex-col items-center justify-center gap-1 transition-colors"
      >
        <span className="text-2xl text-muted-foreground">+</span>
        <span className="text-xs text-muted-foreground">Swing {index + 1}</span>
      </button>
    );
  }

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-primary/10">
      <video 
        src={video.previewUrl} 
        className="w-full h-full object-cover"
      />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <div className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-success" />
          <span className="text-xs text-white font-medium">Swing {index + 1}</span>
        </div>
      </div>
    </div>
  );
}

function RecordingGuidelinesModal() {
  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          📹 HOW TO RECORD YOUR SWING
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        {/* Camera diagram */}
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

        {/* Do this */}
        <div>
          <p className="font-medium text-success mb-2">✅ DO THIS:</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Side angle (perpendicular to batter)</li>
            <li>• Camera at hip/waist height</li>
            <li>• 10-15 feet away</li>
            <li>• Full body visible (head to feet)</li>
            <li>• Landscape mode (horizontal)</li>
            <li>• 60fps if your phone supports it</li>
          </ul>
        </div>

        {/* Don't do this */}
        <div>
          <p className="font-medium text-destructive mb-2">❌ DON'T DO THIS:</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Behind home plate angle</li>
            <li>• Portrait mode (vertical)</li>
            <li>• Too far away or too close</li>
            <li>• Multiple swings in one video</li>
          </ul>
        </div>

        <Button variant="accent" className="w-full" onClick={() => {}}>
          GOT IT
        </Button>
      </div>
    </DialogContent>
  );
}
