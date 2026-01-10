import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, Pause, SkipBack, SkipForward, Maximize, 
  ChevronLeft, ChevronRight, Volume2, VolumeX
} from "lucide-react";

interface VideoPlayerProps {
  src: string;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 1];

export function VideoPlayer({ src }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  // Reset when source changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackSpeed(1);
    if (videoRef.current) {
      videoRef.current.playbackRate = 1;
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

  const stepFrame = (direction: 'forward' | 'backward') => {
    const video = videoRef.current;
    if (!video) return;
    
    video.pause();
    // Assuming ~30fps, each frame is ~0.033 seconds
    const frameTime = 1 / 30;
    const newTime = direction === 'forward' 
      ? Math.min(video.currentTime + frameTime, duration)
      : Math.max(video.currentTime - frameTime, 0);
    
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    const newTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    
    video.currentTime = value[0];
    setCurrentTime(value[0]);
  };

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
    const ms = Math.floor((time % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video bg-black rounded-lg"
        onClick={togglePlay}
      />

      {/* Timeline Scrubber */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-14 text-right font-mono">
          {formatTime(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 1}
          step={0.01}
          onValueChange={handleSeek}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-14 font-mono">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Playback Controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => skip(-5)} title="Back 5s">
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
          <Button variant="ghost" size="icon" onClick={() => skip(5)} title="Forward 5s">
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

        {/* Right Controls */}
        <div className="flex items-center gap-1">
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
