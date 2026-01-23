import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, RotateCcw, Check, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceMemoRecorderProps {
  onRecorded: (blob: Blob, duration: number) => void;
  onCancel?: () => void;
  maxDuration?: number; // in seconds
}

export function VoiceMemoRecorder({ 
  onRecorded, 
  onCancel,
  maxDuration = 300 // 5 minutes default
}: VoiceMemoRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Animation for audio level
      const updateLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
        }
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      chunksRef.current = [];
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      setError('Unable to access microphone. Please check permissions.');
    }
  }, [maxDuration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  }, [isPaused]);

  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, []);

  const confirmRecording = useCallback(() => {
    if (recordedBlob) {
      onRecorded(recordedBlob, recordingTime);
    }
  }, [recordedBlob, recordingTime, onRecorded]);

  const togglePlayback = useCallback(() => {
    if (!recordedBlob || !audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.src = URL.createObjectURL(recordedBlob);
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [recordedBlob, isPlaying]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => setIsPlaying(false);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-muted rounded-lg">
        <Mic className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-destructive text-center mb-4">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setError(null); startRecording(); }}>
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
    <div className="flex flex-col items-center p-6">
      {/* Audio visualization */}
      <div className="relative w-32 h-32 mb-6">
        <div 
          className={cn(
            "absolute inset-0 rounded-full bg-primary/20 transition-transform",
            isRecording && !isPaused && "animate-pulse"
          )}
          style={{ transform: `scale(${1 + audioLevel * 0.5})` }}
        />
        <div 
          className={cn(
            "absolute inset-4 rounded-full bg-primary/30 transition-transform"
          )}
          style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
        />
        <div className="absolute inset-8 rounded-full bg-primary flex items-center justify-center">
          <Mic className="h-8 w-8 text-primary-foreground" />
        </div>
      </div>

      {/* Timer */}
      <div className="text-3xl font-mono font-bold mb-6 tabular-nums">
        {formatTime(recordingTime)}
        <span className="text-sm text-muted-foreground ml-2">
          / {formatTime(maxDuration)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs h-2 bg-muted rounded-full mb-6 overflow-hidden">
        <div 
          className="h-full bg-primary transition-all"
          style={{ width: `${(recordingTime / maxDuration) * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {!isRecording && !recordedBlob && (
          <Button onClick={startRecording} size="lg" className="gap-2">
            <Mic className="h-5 w-5" />
            Start Recording
          </Button>
        )}
        
        {isRecording && !isPaused && (
          <>
            <Button
              onClick={pauseRecording}
              size="lg"
              variant="outline"
              className="rounded-full h-14 w-14"
            >
              <Pause className="h-6 w-6" />
            </Button>
            <Button
              onClick={stopRecording}
              size="lg"
              variant="destructive"
              className="rounded-full h-16 w-16"
            >
              <Square className="h-6 w-6 fill-white" />
            </Button>
          </>
        )}
        
        {isRecording && isPaused && (
          <>
            <Button
              onClick={resumeRecording}
              size="lg"
              variant="outline"
              className="rounded-full h-14 w-14"
            >
              <Play className="h-6 w-6" />
            </Button>
            <Button
              onClick={stopRecording}
              size="lg"
              variant="destructive"
              className="rounded-full h-16 w-16"
            >
              <Square className="h-6 w-6 fill-white" />
            </Button>
          </>
        )}
        
        {recordedBlob && (
          <div className="flex gap-3">
            <Button onClick={togglePlayback} variant="outline" size="lg">
              {isPlaying ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button onClick={resetRecording} variant="outline" size="lg">
              <RotateCcw className="h-5 w-5 mr-2" />
              Retake
            </Button>
            <Button onClick={confirmRecording} size="lg">
              <Check className="h-5 w-5 mr-2" />
              Use Recording
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
