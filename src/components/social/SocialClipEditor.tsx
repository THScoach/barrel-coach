import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  User, 
  Crosshair, 
  Circle, 
  EyeOff, 
  Download, 
  Loader2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Pencil,
  Trash2,
  SkipBack,
  SkipForward,
  Zap,
  Target,
  X
} from "lucide-react";
import { useSAM3Segment, SegmentMode } from "@/hooks/useSAM3Segment";
import { SpotlightCanvas, SpotlightCanvasRef } from "./SpotlightCanvas";
import { BatPathTrail, BatPathTrailRef } from "./BatPathTrail";
import { useVideoExport, downloadBlob } from "@/hooks/useVideoExport";
import { toast } from "sonner";

interface SocialClipEditorProps {
  videoUrl: string;
  onExport?: (blob: Blob, preset: string) => void;
}

type VisualMode = "spotlight" | "highlight" | "mute";

interface Preset {
  id: string;
  label: string;
  aspectRatio: string;
  width: number;
  height: number;
}

interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  frame: number;
}

const EXPORT_PRESETS: Preset[] = [
  { id: "vertical", label: "9:16 Vertical", aspectRatio: "9/16", width: 1080, height: 1920 },
  { id: "square", label: "1:1 Square", aspectRatio: "1/1", width: 1080, height: 1080 },
  { id: "landscape", label: "16:9 Landscape", aspectRatio: "16/9", width: 1920, height: 1080 },
];

const SEGMENT_MODES: { mode: SegmentMode; label: string; icon: React.ReactNode; description: string }[] = [
  { mode: "hitter", label: "Hitter", icon: <User className="h-4 w-4" />, description: "Spotlight the batter" },
  { mode: "bat", label: "Bat", icon: <Crosshair className="h-4 w-4" />, description: "Track the bat path" },
  { mode: "barrel", label: "Barrel", icon: <Circle className="h-4 w-4" />, description: "Highlight barrel zone" },
  { mode: "background", label: "Background", icon: <EyeOff className="h-4 w-4" />, description: "Mute the cage" },
];

const TRAIL_COLORS = [
  { id: "amber", color: "#f59e0b", label: "Amber" },
  { id: "red", color: "#ef4444", label: "Red" },
  { id: "green", color: "#22c55e", label: "Green" },
  { id: "blue", color: "#3b82f6", label: "Blue" },
  { id: "purple", color: "#a855f7", label: "Purple" },
  { id: "white", color: "#ffffff", label: "White" },
];

export function SocialClipEditor({ videoUrl, onExport }: SocialClipEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const spotlightCanvasRef = useRef<SpotlightCanvasRef>(null);
  const batTrailCanvasRef = useRef<BatPathTrailRef>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Segmentation state
  const { segment, isProcessing, lastResult } = useSAM3Segment();
  const [activeSegmentMode, setActiveSegmentMode] = useState<SegmentMode | null>(null);
  const [visualMode, setVisualMode] = useState<VisualMode>("spotlight");
  const [intensity, setIntensity] = useState(0.7);
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  
  // Bat path trail state
  const [trailEnabled, setTrailEnabled] = useState(false);
  const [trailRecording, setTrailRecording] = useState(false);
  const [trailColor, setTrailColor] = useState(TRAIL_COLORS[0].color);
  const [trailWidth, setTrailWidth] = useState(4);
  const [trailGlow, setTrailGlow] = useState(true);
  const [trailPoints, setTrailPoints] = useState<TrailPoint[]>([]);
  
  // Contact frame freeze state
  const [contactFrameEnabled, setContactFrameEnabled] = useState(false);
  const [contactFrameTime, setContactFrameTime] = useState<number | null>(null);
  const [contactFreezeActive, setContactFreezeActive] = useState(false);
  const [freezeDuration, setFreezeDuration] = useState(1.0); // seconds
  const [freezeEffectStyle, setFreezeEffectStyle] = useState<"flash" | "ripple" | "zoom">("flash");

  // Export state
  const [selectedPreset, setSelectedPreset] = useState<Preset>(EXPORT_PRESETS[0]);
  const { exportVideo, isExporting, progress: exportProgress, cancelExport } = useVideoExport();

  // Frame stepping for trail recording
  const stepFrame = useCallback((direction: 1 | -1) => {
    const video = videoRef.current;
    if (!video) return;
    
    const fps = 30; // Assume 30fps
    const frameTime = 1 / fps;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + (direction * frameTime)));
    setCurrentTime(video.currentTime);
  }, []);

  // Capture current frame for segmentation
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  // Handle segment request
  const handleSegment = useCallback(async (mode: SegmentMode) => {
    const frameDataUrl = captureFrame();
    if (!frameDataUrl) {
      toast.error("Could not capture frame");
      return;
    }

    setActiveSegmentMode(mode);
    
    const result = await segment({ imageDataUrl: frameDataUrl, mode });
    
    if (result) {
      setOverlayEnabled(true);
      toast.success(`${mode} segmentation complete`, {
        description: `Processed in ${(result.processingTime / 1000).toFixed(1)}s`
      });
    }
  }, [captureFrame, segment]);

  // Video controls
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
    }
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (video && value[0] !== undefined) {
      video.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  }, []);

  const resetOverlay = useCallback(() => {
    setOverlayEnabled(false);
    setActiveSegmentMode(null);
  }, []);

  // Mark current frame as contact frame
  const markContactFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setContactFrameTime(video.currentTime);
    toast.success("Contact frame marked!", {
      description: `Frame at ${formatTime(video.currentTime)}`
    });
  }, []);

  // Clear contact frame
  const clearContactFrame = useCallback(() => {
    setContactFrameTime(null);
    setContactFreezeActive(false);
    toast.info("Contact frame cleared");
  }, []);

  // Check if we should trigger freeze effect during playback
  const handleTimeUpdateWithFreeze = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setCurrentTime(video.currentTime);
    
    // Check for contact frame freeze
    if (contactFrameEnabled && contactFrameTime !== null) {
      const timeDiff = Math.abs(video.currentTime - contactFrameTime);
      if (timeDiff < 0.05 && !contactFreezeActive && isPlaying) {
        // Trigger freeze effect
        setContactFreezeActive(true);
        video.pause();
        setIsPlaying(false);
        
        // Auto-resume after freeze duration
        setTimeout(() => {
          setContactFreezeActive(false);
          if (video && !video.ended) {
            video.play();
            setIsPlaying(true);
          }
        }, freezeDuration * 1000);
      }
    }
  }, [contactFrameEnabled, contactFrameTime, contactFreezeActive, isPlaying, freezeDuration]);

  // Export handler using MediaRecorder
  const handleExport = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      toast.error("No video loaded");
      return;
    }

    // Collect all overlay canvases
    const overlayCanvases: HTMLCanvasElement[] = [];
    
    const spotlightCanvas = spotlightCanvasRef.current?.getCanvas();
    if (spotlightCanvas && overlayEnabled) {
      overlayCanvases.push(spotlightCanvas);
    }
    
    const trailCanvas = batTrailCanvasRef.current?.getCanvas();
    if (trailCanvas && trailEnabled) {
      overlayCanvases.push(trailCanvas);
    }

    toast.info("Starting export...", { 
      description: `${selectedPreset.label} • This may take a moment`
    });

    const blob = await exportVideo(
      video,
      overlayCanvases,
      {
        width: selectedPreset.width,
        height: selectedPreset.height,
        aspectRatio: selectedPreset.aspectRatio,
        frameRate: 30,
        videoBitsPerSecond: 8_000_000,
      },
      contactFrameEnabled ? contactFrameTime : null,
      freezeDuration
    );

    if (blob) {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `swing-clip-${selectedPreset.id}-${timestamp}.webm`;
      
      downloadBlob(blob, filename);
      
      toast.success("Export complete!", { 
        description: `Downloaded ${filename}` 
      });

      // Call optional callback
      onExport?.(blob, selectedPreset.id);
    }
  }, [selectedPreset, overlayEnabled, trailEnabled, contactFrameEnabled, contactFrameTime, freezeDuration, exportVideo, onExport]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Video Preview */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-slate-900 border-slate-700 overflow-hidden">
          <div 
            className="relative bg-black"
            style={{ aspectRatio: selectedPreset.aspectRatio }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdateWithFreeze}
              onLoadedMetadata={handleLoadedMetadata}
              playsInline
              muted
            />
            
            {/* SAM3 Overlay */}
            <SpotlightCanvas
              ref={spotlightCanvasRef}
              videoRef={videoRef}
              maskUrl={lastResult?.maskUrl || null}
              mode={visualMode}
              intensity={intensity}
              enabled={overlayEnabled}
            />
            
            {/* Bat Path Trail Overlay */}
            <BatPathTrail
              ref={batTrailCanvasRef}
              videoRef={videoRef}
              enabled={trailEnabled}
              isRecording={trailRecording}
              trailColor={trailColor}
              trailWidth={trailWidth}
              glowEnabled={trailGlow}
              onTrailUpdate={setTrailPoints}
            />
            
            {/* Recording indicator */}
            {trailRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-500/90 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full" />
                Recording Trail - Click barrel position
              </div>
            )}
            
            {/* Processing indicator */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto" />
                  <p className="text-sm text-slate-300">Processing segmentation...</p>
                </div>
              </div>
            )}
            
            {/* Contact Frame Freeze Effect Overlay */}
            {contactFreezeActive && (
              <div 
                className={`absolute inset-0 pointer-events-none ${
                  freezeEffectStyle === "flash" 
                    ? "animate-pulse bg-amber-500/30" 
                    : freezeEffectStyle === "ripple"
                    ? "bg-gradient-radial from-amber-500/40 via-transparent to-transparent"
                    : ""
                }`}
              >
                {/* Center impact indicator */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`
                    ${freezeEffectStyle === "flash" ? "animate-ping" : "animate-pulse"}
                    bg-amber-500/50 rounded-full w-24 h-24 flex items-center justify-center
                  `}>
                    <Zap className="h-10 w-10 text-amber-300" />
                  </div>
                </div>
                
                {/* "CONTACT" label */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                  <Badge className="bg-amber-500 text-black font-bold text-lg px-4 py-1 animate-pulse">
                    <Target className="h-4 w-4 mr-2" />
                    CONTACT
                  </Badge>
                </div>
                
                {/* Zoom effect overlay */}
                {freezeEffectStyle === "zoom" && (
                  <div className="absolute inset-0 border-4 border-amber-400 animate-pulse">
                    <div className="absolute inset-4 border-2 border-amber-300/50" />
                    <div className="absolute inset-8 border border-amber-200/30" />
                  </div>
                )}
              </div>
            )}
            
            {/* Contact frame marker indicator */}
            {contactFrameEnabled && contactFrameTime !== null && !contactFreezeActive && (
              <div className="absolute top-3 right-3 bg-amber-500/90 text-black text-xs px-2 py-1 rounded-full font-medium">
                <Target className="h-3 w-3 inline mr-1" />
                Contact @ {formatTime(contactFrameTime)}
              </div>
            )}
          </div>
          
          {/* Playback controls */}
          <div className="p-4 space-y-3 border-t border-slate-700">
            <div className="flex items-center gap-3">
              {/* Frame step back */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => stepFrame(-1)}
                className="h-8 w-8"
                title="Previous frame"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="h-8 w-8"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              {/* Frame step forward */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => stepFrame(1)}
                className="h-8 w-8"
                title="Next frame"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              
              <Slider
                value={[currentTime]}
                min={0}
                max={duration || 100}
                step={0.01}
                onValueChange={handleSeek}
                className="flex-1"
              />
              
              <span className="text-xs text-slate-400 w-20 text-right">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </Card>
        
        {/* Active Effect Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {overlayEnabled && activeSegmentMode && (
            <>
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Sparkles className="h-3 w-3 mr-1" />
                {activeSegmentMode.charAt(0).toUpperCase() + activeSegmentMode.slice(1)} {visualMode}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetOverlay}
                className="h-6 text-xs text-slate-400"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </>
          )}
          
          {trailEnabled && trailPoints.length > 0 && (
            <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
              <Pencil className="h-3 w-3 mr-1" />
              Trail: {trailPoints.length} points
            </Badge>
          )}
          
          {contactFrameEnabled && contactFrameTime !== null && (
            <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              <Target className="h-3 w-3 mr-1" />
              Contact @ {formatTime(contactFrameTime)}
            </Badge>
          )}
        </div>
      </div>

      {/* Controls Panel */}
      <div className="space-y-4">
        {/* Segment Mode Selection */}
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Segment Subject</h3>
          <div className="grid grid-cols-2 gap-2">
            {SEGMENT_MODES.map(({ mode, label, icon, description }) => (
              <Button
                key={mode}
                variant={activeSegmentMode === mode ? "default" : "outline"}
                size="sm"
                onClick={() => handleSegment(mode)}
                disabled={isProcessing}
                className="h-auto py-2 flex-col items-start text-left"
              >
                <div className="flex items-center gap-1.5 w-full">
                  {icon}
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">{description}</span>
              </Button>
            ))}
          </div>
        </Card>

        {/* Visual Effect Mode */}
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Visual Effect</h3>
          <div className="flex gap-2">
            {(["spotlight", "highlight", "mute"] as VisualMode[]).map((mode) => (
              <Button
                key={mode}
                variant={visualMode === mode ? "default" : "outline"}
                size="sm"
                onClick={() => setVisualMode(mode)}
                className="flex-1 capitalize text-xs"
              >
                {mode}
              </Button>
            ))}
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Intensity</span>
              <span className="text-xs text-slate-500">{Math.round(intensity * 100)}%</span>
            </div>
            <Slider
              value={[intensity]}
              min={0.1}
              max={1}
              step={0.05}
              onValueChange={(v) => setIntensity(v[0])}
            />
          </div>
        </Card>

        {/* Bat Path Trail */}
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">Bat Path Trail</h3>
            <Switch
              checked={trailEnabled}
              onCheckedChange={(checked) => {
                setTrailEnabled(checked);
                if (!checked) {
                  setTrailRecording(false);
                  setTrailPoints([]);
                }
              }}
            />
          </div>
          
          {trailEnabled && (
            <div className="space-y-4">
              {/* Recording controls */}
              <div className="flex gap-2">
                <Button
                  variant={trailRecording ? "destructive" : "default"}
                  size="sm"
                  onClick={() => setTrailRecording(!trailRecording)}
                  className="flex-1 text-xs"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  {trailRecording ? "Stop Recording" : "Start Recording"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTrailPoints([])}
                  disabled={trailPoints.length === 0}
                  className="text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              
              {trailRecording && (
                <p className="text-[10px] text-slate-400 bg-slate-700/50 p-2 rounded">
                  Step through frames and click on the barrel position to record the path.
                </p>
              )}
              
              {/* Trail color */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Trail Color</Label>
                <div className="flex gap-1">
                  {TRAIL_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setTrailColor(c.color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        trailColor === c.color 
                          ? "border-white scale-110" 
                          : "border-transparent hover:border-slate-500"
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
              
              {/* Trail width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-400">Trail Width</Label>
                  <span className="text-xs text-slate-500">{trailWidth}px</span>
                </div>
                <Slider
                  value={[trailWidth]}
                  min={2}
                  max={10}
                  step={1}
                  onValueChange={(v) => setTrailWidth(v[0])}
                />
              </div>
              
              {/* Glow toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400">Glow Effect</Label>
                <Switch
                  checked={trailGlow}
                  onCheckedChange={setTrailGlow}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Contact Frame Freeze */}
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Contact Freeze
            </h3>
            <Switch
              checked={contactFrameEnabled}
              onCheckedChange={(checked) => {
                setContactFrameEnabled(checked);
                if (!checked) {
                  setContactFrameTime(null);
                  setContactFreezeActive(false);
                }
              }}
            />
          </div>
          
          {contactFrameEnabled && (
            <div className="space-y-4">
              {/* Mark/Clear contact frame */}
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={markContactFrame}
                  className="flex-1 text-xs bg-amber-600 hover:bg-amber-700"
                >
                  <Target className="h-3 w-3 mr-1" />
                  Mark Contact Frame
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearContactFrame}
                  disabled={contactFrameTime === null}
                  className="text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              
              {contactFrameTime !== null && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2 text-center">
                  <p className="text-xs text-amber-400">
                    Contact marked at <span className="font-mono font-bold">{formatTime(contactFrameTime)}</span>
                  </p>
                </div>
              )}
              
              {/* Freeze duration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-400">Freeze Duration</Label>
                  <span className="text-xs text-slate-500">{freezeDuration.toFixed(1)}s</span>
                </div>
                <Slider
                  value={[freezeDuration]}
                  min={0.3}
                  max={3.0}
                  step={0.1}
                  onValueChange={(v) => setFreezeDuration(v[0])}
                />
              </div>
              
              {/* Effect style */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Effect Style</Label>
                <div className="flex gap-2">
                  {(["flash", "ripple", "zoom"] as const).map((style) => (
                    <Button
                      key={style}
                      variant={freezeEffectStyle === style ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFreezeEffectStyle(style)}
                      className="flex-1 text-xs capitalize"
                    >
                      {style}
                    </Button>
                  ))}
                </div>
              </div>
              
              <p className="text-[10px] text-slate-400 bg-slate-700/50 p-2 rounded">
                Navigate to the contact frame and click "Mark Contact Frame". The video will pause and highlight at this moment during playback.
              </p>
            </div>
          )}
        </Card>

        {/* Export Presets */}
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Export Format</h3>
          <div className="space-y-2">
            {EXPORT_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant={selectedPreset.id === preset.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPreset(preset)}
                className="w-full justify-start text-xs"
              >
                {preset.label}
                <span className="ml-auto text-slate-500">{preset.width}×{preset.height}</span>
              </Button>
            ))}
          </div>
          
          {/* Export Progress */}
          {isExporting && exportProgress && (
            <div className="space-y-2 p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{exportProgress.message}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelExport}
                  className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Progress value={exportProgress.progress} className="h-2" />
              <p className="text-[10px] text-slate-500 text-center">
                {Math.round(exportProgress.progress)}% complete
              </p>
            </div>
          )}
          
          <Button
            onClick={handleExport}
            disabled={isExporting || (!overlayEnabled && !trailEnabled && !contactFrameEnabled)}
            className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Clip
              </>
            )}
          </Button>
          
          {!overlayEnabled && !trailEnabled && !contactFrameEnabled && (
            <p className="text-[10px] text-slate-500 text-center mt-2">
              Apply at least one effect to enable export
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
