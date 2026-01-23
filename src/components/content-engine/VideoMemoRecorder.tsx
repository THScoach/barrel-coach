import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, Square, Circle, RotateCcw, Check, Play, Pause, X } from "lucide-react";

interface VideoMemoRecorderProps {
  onRecorded: (blob: Blob, duration: number, thumbnail?: Blob) => void;
  onCancel?: () => void;
  maxDuration?: number; // in seconds
}

export function VideoMemoRecorder({ 
  onRecorded, 
  onCancel,
  maxDuration = 120 // 2 minutes default
}: VideoMemoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    
    chunksRef.current = [];
    
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';
    
    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setIsPreviewing(true);
      stopCamera();
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(blob);
        videoRef.current.muted = false;
      }
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
    setRecordingTime(0);
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= maxDuration - 1) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, [stopCamera, maxDuration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    setIsPreviewing(false);
    setIsPlaying(false);
    setRecordingTime(0);
    
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.muted = true;
    }
    
    startCamera();
  }, [startCamera]);

  // Capture thumbnail from video
  const captureThumbnail = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current) return null;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Seek to 1 second or 10% of the video, whichever is smaller
    const seekTime = Math.min(1, video.duration * 0.1);
    
    return new Promise((resolve) => {
      const handleSeeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          video.removeEventListener('seeked', handleSeeked);
          resolve(blob);
        }, 'image/jpeg', 0.85);
      };
      
      video.addEventListener('seeked', handleSeeked);
      video.currentTime = seekTime;
    });
  }, []);

  const confirmRecording = useCallback(async () => {
    if (recordedBlob) {
      const thumbnail = await captureThumbnail();
      onRecorded(recordedBlob, recordingTime, thumbnail || undefined);
    }
  }, [recordedBlob, recordingTime, onRecorded, captureThumbnail]);

  const toggleFacingMode = useCallback(() => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
  }, [facingMode]);

  const togglePlayback = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (cameraActive && !isRecording && !isPreviewing) {
      stopCamera();
      startCamera();
    }
  }, [facingMode]);

  // Handle video ended
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleEnded = () => setIsPlaying(false);
    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-muted rounded-lg">
        <Video className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-destructive text-center mb-4">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={startCamera}>
            Try Again
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Video Preview */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          autoPlay={!isPreviewing}
        />
        
        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
            <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
            <span className="text-white text-sm font-mono">{formatTime(recordingTime)}</span>
          </div>
        )}
        
        {/* Time limit indicator */}
        {isRecording && (
          <div className="absolute bottom-4 left-4 right-4">
            <Progress value={(recordingTime / maxDuration) * 100} className="h-1" />
            <p className="text-white/70 text-xs mt-1 text-center">
              {formatTime(maxDuration - recordingTime)} remaining
            </p>
          </div>
        )}
        
        {/* Camera switch button */}
        {cameraActive && !isRecording && !isPreviewing && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-4 right-4 rounded-full bg-black/50 hover:bg-black/70"
            onClick={toggleFacingMode}
          >
            <RotateCcw className="h-4 w-4 text-white" />
          </Button>
        )}
        
        {/* Preview playback controls */}
        {isPreviewing && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
            onClick={togglePlayback}
          >
            {!isPlaying && (
              <div className="bg-black/60 rounded-full p-4">
                <Play className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {!cameraActive && !isPreviewing && (
          <Button onClick={startCamera} size="lg">
            <Video className="h-5 w-5 mr-2" />
            Start Camera
          </Button>
        )}
        
        {cameraActive && !isRecording && (
          <Button
            onClick={startRecording}
            size="lg"
            variant="destructive"
            className="rounded-full h-16 w-16"
          >
            <Circle className="h-8 w-8 fill-white" />
          </Button>
        )}
        
        {isRecording && (
          <Button
            onClick={stopRecording}
            size="lg"
            variant="destructive"
            className="rounded-full h-16 w-16"
          >
            <Square className="h-6 w-6 fill-white" />
          </Button>
        )}
        
        {isPreviewing && recordedBlob && (
          <div className="flex gap-3">
            <Button onClick={resetRecording} variant="outline" size="lg">
              <RotateCcw className="h-5 w-5 mr-2" />
              Retake
            </Button>
            <Button onClick={confirmRecording} size="lg">
              <Check className="h-5 w-5 mr-2" />
              Use Video
            </Button>
          </div>
        )}
      </div>
      
      {/* Cancel button */}
      {onCancel && (
        <Button 
          variant="ghost" 
          onClick={onCancel} 
          className="text-muted-foreground"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      )}
    </div>
  );
}
