import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  SkipForward
} from "lucide-react";
import { useSAM3Segment, SegmentMode } from "@/hooks/useSAM3Segment";
import { SpotlightCanvas } from "./SpotlightCanvas";
import { BatPathTrail } from "./BatPathTrail";
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
  
  // Export state
  const [selectedPreset, setSelectedPreset] = useState<Preset>(EXPORT_PRESETS[0]);
  const [isExporting, setIsExporting] = useState(false);

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
    
    const result = await segment(frameDataUrl, mode);
    
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

  // Export handler (simplified - in production would use MediaRecorder or ffmpeg.wasm)
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    toast.info("Preparing export...", { description: "This feature is in development" });
    
    // Simulate export delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast.success("Export ready!", { 
      description: `${selectedPreset.label} format` 
    });
    setIsExporting(false);
  }, [selectedPreset]);

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
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              playsInline
              muted
            />
            
            {/* SAM3 Overlay */}
            <SpotlightCanvas
              videoRef={videoRef}
              maskUrl={lastResult?.maskUrl || null}
              mode={visualMode}
              intensity={intensity}
              enabled={overlayEnabled}
            />
            
            {/* Bat Path Trail Overlay */}
            <BatPathTrail
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
          
          <Button
            onClick={handleExport}
            disabled={isExporting || !overlayEnabled}
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
