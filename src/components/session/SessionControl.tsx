import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Square, 
  Camera, 
  Wifi, 
  WifiOff,
  Activity,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { catchingBarrelsService, CaptureSession, SwingMetrics } from "@/services/CatchingBarrelsService";
import { toast } from "sonner";

interface SessionControlProps {
  onSwingCaptured?: (swing: {
    swingNumber: number;
    metrics: SwingMetrics;
    videoUrl: string | null;
  }) => void;
  onSessionEnd?: (session: CaptureSession) => void;
}

// Swing detection threshold (g-force)
const SWING_THRESHOLD_G = 8;
// Video buffer timing
const PRE_SWING_BUFFER_MS = 1000;
const POST_SWING_BUFFER_MS = 2000;

export function SessionControl({ onSwingCaptured, onSessionEnd }: SessionControlProps) {
  // Session state
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Sensor state
  const [sensorConnected, setSensorConnected] = useState(false);
  const [currentAcceleration, setCurrentAcceleration] = useState(0);
  const [swingDetected, setSwingDetected] = useState(false);
  
  // Stats
  const [swingCount, setSwingCount] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const circularBufferRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const swingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      
      // Start continuous recording for circular buffer
      startCircularBuffer(stream);
    } catch (error) {
      console.error('Camera access failed:', error);
      setCameraError('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  // Circular buffer recording (keeps last 3 seconds)
  const startCircularBuffer = (stream: MediaStream) => {
    const options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      (options as { mimeType: string }).mimeType = 'video/webm';
    }
    
    const recorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = recorder;
    
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        circularBufferRef.current.push(event.data);
        // Keep only last 3 seconds worth of chunks
        if (circularBufferRef.current.length > 6) {
          circularBufferRef.current.shift();
        }
      }
    };
    
    recorder.start(500); // Capture chunks every 500ms
    setIsRecording(true);
  };

  // Stop camera
  const stopCamera = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setIsRecording(false);
  }, []);

  // Simulate sensor connection (in real app, would use Web Bluetooth or device motion)
  useEffect(() => {
    if (!session) return;
    
    // Check for DeviceMotion API
    if ('DeviceMotionEvent' in window) {
      const handleMotion = (event: DeviceMotionEvent) => {
        const acc = event.accelerationIncludingGravity;
        if (acc) {
          const magnitude = Math.sqrt(
            (acc.x || 0) ** 2 + 
            (acc.y || 0) ** 2 + 
            (acc.z || 0) ** 2
          ) / 9.81; // Convert to g
          setCurrentAcceleration(magnitude);
          
          // Swing detection
          if (magnitude >= SWING_THRESHOLD_G && !swingDetected) {
            handleSwingDetected(magnitude);
          }
        }
      };
      
      // Request permission on iOS
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        (DeviceMotionEvent as any).requestPermission()
          .then((permission: string) => {
            if (permission === 'granted') {
              window.addEventListener('devicemotion', handleMotion);
              setSensorConnected(true);
            }
          })
          .catch(() => {
            setSensorConnected(false);
          });
      } else {
        window.addEventListener('devicemotion', handleMotion);
        setSensorConnected(true);
      }
      
      return () => {
        window.removeEventListener('devicemotion', handleMotion);
      };
    } else {
      // Simulate sensor data for demo purposes
      const interval = setInterval(() => {
        const simulated = 1 + Math.random() * 2;
        setCurrentAcceleration(simulated);
        
        // Random swing simulation (10% chance every 2 seconds)
        if (Math.random() < 0.05 && !swingDetected) {
          handleSwingDetected(SWING_THRESHOLD_G + Math.random() * 8);
        }
      }, 200);
      
      setSensorConnected(true);
      return () => clearInterval(interval);
    }
  }, [session, swingDetected]);

  // Handle swing detection
  const handleSwingDetected = async (peakAcceleration: number) => {
    if (!session || swingDetected) return;
    
    setSwingDetected(true);
    const newSwingCount = swingCount + 1;
    setSwingCount(newSwingCount);
    
    toast.success(`Swing ${newSwingCount} detected!`, {
      description: `Peak: ${peakAcceleration.toFixed(1)}g`,
      duration: 2000,
    });
    
    // Calculate metrics
    const metrics = catchingBarrelsService.calculateMetrics(peakAcceleration);
    
    // Capture video clip (pre-swing + post-swing buffer)
    let videoUrl: string | null = null;
    let videoPath: string | null = null;
    
    if (isRecording && circularBufferRef.current.length > 0) {
      // Wait for post-swing buffer
      await new Promise(resolve => setTimeout(resolve, POST_SWING_BUFFER_MS));
      
      // Combine pre-swing buffer with current recording
      const preSwingChunks = [...circularBufferRef.current];
      
      // Get additional post-swing chunks
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.requestData();
      }
      
      const videoBlob = new Blob(preSwingChunks, { type: 'video/webm' });
      
      // Upload video
      const uploadResult = await catchingBarrelsService.uploadSwingVideo(
        session.id,
        newSwingCount,
        videoBlob
      );
      
      if (uploadResult) {
        videoPath = uploadResult.path;
        videoUrl = uploadResult.url;
      }
    }
    
    // Record swing in database
    await catchingBarrelsService.recordSwing(
      session.id,
      newSwingCount,
      videoPath,
      videoUrl,
      metrics,
      { peak_acceleration_g: peakAcceleration }
    );
    
    // Notify parent
    onSwingCaptured?.({
      swingNumber: newSwingCount,
      metrics,
      videoUrl,
    });
    
    // Reset swing detection after cooldown
    swingTimeoutRef.current = setTimeout(() => {
      setSwingDetected(false);
    }, 1500);
  };

  // Start session
  const handleStartSession = async () => {
    setIsStarting(true);
    try {
      await catchingBarrelsService.initialize();
      const newSession = await catchingBarrelsService.startSession();
      
      if (newSession) {
        setSession(newSession);
        setSwingCount(0);
        setSessionDuration(0);
        
        // Start duration timer
        durationIntervalRef.current = setInterval(() => {
          setSessionDuration(prev => prev + 1);
        }, 1000);
        
        // Start camera
        await startCamera();
        
        toast.success('Session started!', {
          description: 'Camera active. Ready to capture swings.',
        });
      } else {
        toast.error('Failed to start session');
      }
    } catch (error) {
      console.error('Start session error:', error);
      toast.error('Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  // Stop session
  const handleStopSession = async () => {
    if (!session) return;
    
    setIsStopping(true);
    try {
      // Clear timers
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (swingTimeoutRef.current) {
        clearTimeout(swingTimeoutRef.current);
      }
      
      // Stop camera
      stopCamera();
      
      // End session
      const endedSession = await catchingBarrelsService.stopSession(session.id);
      
      if (endedSession) {
        toast.success('Session completed!', {
          description: `${swingCount} swings captured`,
        });
        onSessionEnd?.(endedSession);
      }
      
      setSession(null);
      setSensorConnected(false);
    } catch (error) {
      console.error('Stop session error:', error);
      toast.error('Failed to stop session');
    } finally {
      setIsStopping(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (swingTimeoutRef.current) {
        clearTimeout(swingTimeoutRef.current);
      }
    };
  }, [stopCamera]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Camera Preview */}
      <Card className="overflow-hidden">
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Camera status overlay */}
          {!cameraActive && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-muted-foreground">
                <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Camera preview will appear here</p>
              </div>
            </div>
          )}
          
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
              <div className="text-center text-destructive">
                <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm px-4">{cameraError}</p>
              </div>
            </div>
          )}
          
          {/* Swing detection flash */}
          {swingDetected && (
            <div className="absolute inset-0 bg-primary/30 animate-pulse pointer-events-none" />
          )}
          
          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-white font-medium">REC</span>
            </div>
          )}
          
          {/* Status indicators */}
          {session && (
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <Badge 
                variant={sensorConnected ? "default" : "destructive"}
                className="gap-1"
              >
                {sensorConnected ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                Sensor
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Camera className="w-3 h-3" />
                {cameraActive ? 'Active' : 'Off'}
              </Badge>
            </div>
          )}
          
          {/* Swing detected overlay */}
          {swingDetected && (
            <div className="absolute bottom-3 left-3 right-3">
              <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                <span className="font-semibold">Swing Detected!</span>
                <span className="ml-auto text-sm opacity-80">
                  {currentAcceleration.toFixed(1)}g
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Session Stats */}
      {session && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-xs">Swings</span>
            </div>
            <p className="text-2xl font-bold">{swingCount}</p>
          </Card>
          
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Duration</span>
            </div>
            <p className="text-2xl font-bold">{formatDuration(sessionDuration)}</p>
          </Card>
          
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-xs">Current G</span>
            </div>
            <p className="text-2xl font-bold">{currentAcceleration.toFixed(1)}</p>
          </Card>
        </div>
      )}

      {/* Control Button */}
      <Button
        size="lg"
        className={`w-full h-16 text-lg font-semibold ${
          session 
            ? 'bg-destructive hover:bg-destructive/90' 
            : 'bg-primary hover:bg-primary/90'
        }`}
        onClick={session ? handleStopSession : handleStartSession}
        disabled={isStarting || isStopping}
      >
        {isStarting ? (
          <>
            <Loader2 className="w-6 h-6 mr-2 animate-spin" />
            Starting Session...
          </>
        ) : isStopping ? (
          <>
            <Loader2 className="w-6 h-6 mr-2 animate-spin" />
            Stopping Session...
          </>
        ) : session ? (
          <>
            <Square className="w-6 h-6 mr-2" />
            Stop Session
          </>
        ) : (
          <>
            <Play className="w-6 h-6 mr-2" />
            Start Session
          </>
        )}
      </Button>

      {/* Session Info */}
      {session && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Session Active
              </CardTitle>
              <Badge variant="outline">
                {session.environment || 'General'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Swing detection threshold: {SWING_THRESHOLD_G}g</p>
            <p>Auto-clip: {PRE_SWING_BUFFER_MS/1000}s pre + {POST_SWING_BUFFER_MS/1000}s post</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
