import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Video, Square, Circle, RotateCcw, Check } from "lucide-react";

interface VideoRecorderProps {
  onVideoRecorded: (blob: Blob) => void;
  onCancel?: () => void;
}

export function VideoRecorder({ onVideoRecorded, onCancel }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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
    
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
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
      
      // Set video to recorded blob for preview
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(blob);
        videoRef.current.play();
      }
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100); // Collect data every 100ms
    setIsRecording(true);
    setRecordingTime(0);
    
    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  }, [stopCamera]);

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
    setRecordingTime(0);
    
    if (videoRef.current) {
      videoRef.current.src = '';
    }
    
    startCamera();
  }, [startCamera]);

  const confirmRecording = useCallback(() => {
    if (recordedBlob) {
      onVideoRecorded(recordedBlob);
    }
  }, [recordedBlob, onVideoRecorded]);

  const toggleFacingMode = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

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
  }, [startCamera, stopCamera]);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (cameraActive && !isRecording && !isPreviewing) {
      stopCamera();
      startCamera();
    }
  }, [facingMode]);

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
    <div className="flex flex-col items-center">
      {/* Video Preview */}
      <div className="relative w-full max-w-md aspect-[9/16] bg-black rounded-lg overflow-hidden mb-4">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted={!isPreviewing}
          loop={isPreviewing}
          autoPlay
        />
        
        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
            <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
            <span className="text-white text-sm font-mono">{formatTime(recordingTime)}</span>
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
          className="mt-4"
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
