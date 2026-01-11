import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, Pause, SkipBack, SkipForward, Maximize, 
  ChevronLeft, ChevronRight, Volume2, VolumeX,
  Wand2
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SAM3OverlayCanvas, type SAM3Mode } from "./SAM3OverlayCanvas";

// Marker definition for swing analysis points
export interface VideoMarker {
  id: string;
  label: string;
  time: number; // in seconds
  color?: string;
}

// Mask annotation from SAM3
export interface MaskAnnotation {
  id: string;
  maskUrl: string;
  frameTimeMs: number;
  prompts: {
    points?: Array<{ x: number; y: number; label: 0 | 1 }>;
    box?: { x1: number; y1: number; x2: number; y2: number };
  };
  createdAt: number;
}

interface VideoPlayerProps {
  src: string;
  markers?: VideoMarker[];
  onTimeUpdate?: (time: number) => void;
  onMarkerSeek?: (marker: VideoMarker) => void;
  enableSAM3?: boolean;
  onAnnotationSave?: (annotation: MaskAnnotation) => void;
  savedAnnotations?: MaskAnnotation[];
}

const PLAYBACK_SPEEDS = [0.1, 0.25, 0.5, 1];
const FPS_OPTIONS = [30, 60, 120, 240, 300];

// Default swing analysis markers
const DEFAULT_MARKER_COLORS: Record<string, string> = {
  load: "bg-blue-500",
  trigger: "bg-yellow-500", 
  contact: "bg-red-500",
  finish: "bg-green-500",
};

export function VideoPlayer({ 
  src, 
  markers = [],
  onTimeUpdate,
  onMarkerSeek,
  enableSAM3 = false,
  onAnnotationSave,
  savedAnnotations = [],
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.25);
  const [isMuted, setIsMuted] = useState(true);
  const [fps, setFps] = useState(240);
  
  // SAM3 state
  const [sam3Active, setSam3Active] = useState(false);
  const [sam3Mode, setSam3Mode] = useState<SAM3Mode>("off");
  
  // Track if we're in the middle of a programmatic seek
  const isSeeking = useRef(false);
  const pendingSeekTime = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      // Don't update state during programmatic seeks to avoid conflicts
      if (isSeeking.current) return;
      
      const time = video.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    
    // Critical: handle seeked event to confirm seek completion
    const handleSeeked = () => {
      if (pendingSeekTime.current !== null) {
        setCurrentTime(pendingSeekTime.current);
        onTimeUpdate?.(pendingSeekTime.current);
        pendingSeekTime.current = null;
      }
      isSeeking.current = false;
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [src, onTimeUpdate]);

  // Reset when source changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackSpeed(0.25);
    isSeeking.current = false;
    pendingSeekTime.current = null;
    
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.25;
      videoRef.current.muted = true;
    }
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  // Precise seek function that waits for seeked event
  const seekToTime = useCallback((targetTime: number, pauseFirst = true) => {
    const video = videoRef.current;
    if (!video) return;
    
    // Clamp to valid range
    const clampedTime = Math.max(0, Math.min(targetTime, duration || video.duration || 0));
    
    // Mark that we're seeking
    isSeeking.current = true;
    pendingSeekTime.current = clampedTime;
    
    if (pauseFirst && !video.paused) {
      video.pause();
    }
    
    // Set the video time - the seeked event handler will update state
    video.currentTime = clampedTime;
  }, [duration]);

  // Frame step using selected FPS - waits for seeked confirmation
  const stepFrame = useCallback((direction: 'forward' | 'backward') => {
    const video = videoRef.current;
    if (!video || isSeeking.current) return;
    
    video.pause();
    
    // Calculate frame time based on selected FPS
    const frameTime = 1 / fps;
    const currentVideoTime = video.currentTime;
    
    let newTime: number;
    if (direction === 'forward') {
      // Use Math.round to snap to frame boundaries and avoid drift
      const currentFrame = Math.round(currentVideoTime * fps);
      newTime = (currentFrame + 1) / fps;
      newTime = Math.min(newTime, duration);
    } else {
      const currentFrame = Math.round(currentVideoTime * fps);
      newTime = Math.max((currentFrame - 1) / fps, 0);
    }
    
    seekToTime(newTime, false);
  }, [fps, duration, seekToTime]);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    const newTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
    seekToTime(newTime, false);
  }, [duration, seekToTime]);

  // Handle slider seek
  const handleSliderSeek = useCallback((value: number[]) => {
    if (!duration) return;
    seekToTime(value[0]);
  }, [duration, seekToTime]);

  // Seek to a specific marker
  const seekToMarker = useCallback((marker: VideoMarker) => {
    seekToTime(marker.time);
    onMarkerSeek?.(marker);
  }, [seekToTime, onMarkerSeek]);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Calculate current frame number
  const currentFrame = Math.round(currentTime * fps);
  const totalFrames = Math.round(duration * fps);

  // Get marker color
  const getMarkerColor = (marker: VideoMarker): string => {
    if (marker.color) return marker.color;
    const id = marker.id.toLowerCase();
    return DEFAULT_MARKER_COLORS[id] || "bg-slate-500";
  };

  // Handle SAM3 mode change - pause video when entering SAM3 mode
  const handleSam3ModeChange = useCallback((newMode: SAM3Mode) => {
    setSam3Mode(newMode);
    if (newMode !== "off" && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, []);

  // Toggle SAM3 panel
  const toggleSam3 = useCallback(() => {
    if (sam3Active) {
      setSam3Active(false);
      setSam3Mode("off");
    } else {
      setSam3Active(true);
      // Pause video when entering SAM3 mode
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [sam3Active]);

  return (
    <div className="space-y-3">
      {/* Video Element with SAM3 Overlay */}
      <div className="relative">
        <video
          ref={videoRef}
          src={src}
          className="w-full aspect-video bg-black rounded-lg"
          onClick={sam3Active ? undefined : togglePlay}
          muted={isMuted}
          playsInline
        />
        
        {/* SAM3 Segmentation Overlay */}
        {enableSAM3 && (
          <SAM3OverlayCanvas
            videoElement={videoRef.current}
            isActive={sam3Active}
            mode={sam3Mode}
            onModeChange={handleSam3ModeChange}
            onAnnotationSave={onAnnotationSave}
            savedAnnotations={savedAnnotations}
          />
        )}
      </div>

      {/* Frame Counter */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="font-mono">Frame {currentFrame} / {totalFrames}</span>
        <span className="font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>

      {/* Timeline Scrubber with Markers */}
      <div className="relative">
        <div className="flex items-center gap-3">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 1}
            step={1 / fps}
            onValueChange={handleSliderSeek}
            className="flex-1"
          />
        </div>
        
        {/* Marker indicators on timeline */}
        {duration > 0 && markers.length > 0 && (
          <div className="absolute top-0 left-0 right-0 h-full pointer-events-none">
            {markers.map((marker) => {
              const position = (marker.time / duration) * 100;
              if (position < 0 || position > 100) return null;
              
              return (
                <div
                  key={marker.id}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-1 h-4 rounded-full opacity-80",
                    getMarkerColor(marker)
                  )}
                  style={{ left: `${position}%` }}
                  title={`${marker.label}: ${formatTime(marker.time)}`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Marker Navigation Buttons */}
      {markers.length > 0 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {markers.map((marker) => {
            const isActive = Math.abs(currentTime - marker.time) < (1 / fps);
            return (
              <Button
                key={marker.id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => seekToMarker(marker)}
                className={cn(
                  "text-xs h-7 px-3",
                  isActive 
                    ? getMarkerColor(marker).replace('bg-', 'bg-') 
                    : "border-slate-700 text-slate-400 hover:text-white"
                )}
              >
                {marker.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Playback Controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => skip(-1)} title="Back 1s">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => stepFrame('backward')} title="Previous Frame">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="default" size="icon" onClick={togglePlay} className="h-10 w-10">
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => stepFrame('forward')} title="Next Frame">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => skip(1)} title="Forward 1s">
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {PLAYBACK_SPEEDS.map((speed) => (
            <Button
              key={speed}
              variant={playbackSpeed === speed ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs font-medium"
              onClick={() => handleSpeedChange(speed)}
            >
              {speed}x
            </Button>
          ))}
        </div>

        {/* FPS Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">FPS:</span>
          <Select value={fps.toString()} onValueChange={(v) => setFps(Number(v))}>
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FPS_OPTIONS.map((fpsOption) => (
                <SelectItem key={fpsOption} value={fpsOption.toString()}>
                  {fpsOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1">
          {/* SAM3 Toggle Button */}
          {enableSAM3 && (
            <Button 
              variant={sam3Active ? "secondary" : "ghost"} 
              size="icon" 
              onClick={toggleSam3} 
              title="SAM3 Segmentation"
              className={cn(sam3Active && "bg-purple-600 hover:bg-purple-700 text-white")}
            >
              <Wand2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Fullscreen">
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
