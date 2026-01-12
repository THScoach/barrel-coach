import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, Pause, Maximize, Volume2, VolumeX,
  Settings, Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { 
  VIDEO_QUALITY_PRESETS, 
  VideoQuality, 
  formatVideoDuration,
  isHlsSupported 
} from "@/lib/gumlet";

interface GumletVideoPlayerProps {
  src: string;
  hlsSrc?: string;
  dashSrc?: string;
  poster?: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onTimeUpdate?: (time: number) => void;
  showControls?: boolean;
}

export function GumletVideoPlayer({
  src,
  hlsSrc,
  dashSrc,
  poster,
  title,
  className,
  autoPlay = false,
  muted: initialMuted = true,
  onEnded,
  onError,
  onTimeUpdate,
  showControls = true,
}: GumletVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isLoading, setIsLoading] = useState(true);
  const [quality, setQuality] = useState<VideoQuality>('auto');
  const [showControlsOverlay, setShowControlsOverlay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Initialize HLS.js for adaptive streaming
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const effectiveSrc = hlsSrc || src;
    
    // Check if it's an HLS stream
    const isHlsStream = effectiveSrc?.includes('.m3u8') || hlsSrc;
    
    if (isHlsStream && !video.canPlayType('application/vnd.apple.mpegurl')) {
      // Need HLS.js for non-Safari browsers
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            startLevel: -1, // Auto quality
          });
          
          hls.loadSource(effectiveSrc);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            if (autoPlay) {
              video.play().catch(() => {});
            }
          });
          
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              console.error('HLS error:', data);
              setError('Failed to load video');
              onError?.(new Error(data.details));
            }
          });
          
          hlsRef.current = hls;
        } else {
          setError('HLS not supported');
        }
      }).catch((err) => {
        console.error('Failed to load HLS.js:', err);
        // Fallback to direct source
        video.src = src;
      });
    } else {
      // Native HLS support (Safari) or regular MP4
      video.src = effectiveSrc || src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, hlsSrc, autoPlay, onError]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };
    
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const handleError = () => {
      setError('Video playback error');
      onError?.(new Error('Video playback error'));
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [onTimeUpdate, onEnded, onError]);

  // Auto-hide controls
  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    setShowControlsOverlay(true);
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControlsOverlay(false);
      }
    }, 3000);
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
    scheduleHideControls();
  }, [isPlaying, scheduleHideControls]);

  const handleSeek = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value[0];
    setCurrentTime(value[0]);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  const handleQualityChange = useCallback((newQuality: VideoQuality) => {
    setQuality(newQuality);
    
    if (hlsRef.current) {
      const hls = hlsRef.current;
      const preset = VIDEO_QUALITY_PRESETS[newQuality];
      
      if (newQuality === 'auto') {
        hls.currentLevel = -1; // Auto
      } else if (preset.resolution) {
        // Find matching level
        const levels = hls.levels;
        const matchingLevel = levels.findIndex((l: any) => l.height === preset.resolution);
        if (matchingLevel !== -1) {
          hls.currentLevel = matchingLevel;
        }
      }
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    scheduleHideControls();
  }, [scheduleHideControls]);

  if (error) {
    return (
      <div className={cn("relative aspect-video bg-black rounded-lg flex items-center justify-center", className)}>
        <div className="text-center text-white">
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-slate-400 mt-1">Try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative aspect-video bg-black rounded-lg overflow-hidden group", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControlsOverlay(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={poster}
        muted={isMuted}
        playsInline
        onClick={togglePlay}
        title={title}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      )}

      {/* Play Button Overlay */}
      {!isPlaying && !isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 rounded-full bg-red-500/90 flex items-center justify-center hover:bg-red-500 transition-colors">
            <Play className="w-7 h-7 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      {showControls && (
        <div 
          className={cn(
            "absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300",
            showControlsOverlay ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Progress Bar */}
          <div className="mb-3">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 1}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={togglePlay}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              {/* Mute */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleMute}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>

              {/* Time */}
              <span className="text-white text-xs font-mono">
                {formatVideoDuration(currentTime)} / {formatVideoDuration(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Quality Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-white hover:bg-white/20 h-8 text-xs gap-1"
                  >
                    <Settings className="h-3 w-3" />
                    {VIDEO_QUALITY_PRESETS[quality].label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                  {(Object.keys(VIDEO_QUALITY_PRESETS) as VideoQuality[]).map((q) => (
                    <DropdownMenuItem
                      key={q}
                      onClick={() => handleQualityChange(q)}
                      className={cn(
                        "text-sm",
                        quality === q ? "bg-slate-800 text-white" : "text-slate-300"
                      )}
                    >
                      {VIDEO_QUALITY_PRESETS[q].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Fullscreen */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GumletVideoPlayer;
