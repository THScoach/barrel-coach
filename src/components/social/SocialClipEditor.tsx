import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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
  Sparkles
} from "lucide-react";
import { useSAM3Segment, SegmentMode } from "@/hooks/useSAM3Segment";
import { SpotlightCanvas } from "./SpotlightCanvas";
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
  
  // Export state
  const [selectedPreset, setSelectedPreset] = useState<Preset>(EXPORT_PRESETS[0]);
  const [isExporting, setIsExporting] = useState(false);

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
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="h-8 w-8"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
        
        {/* Active Effect Badge */}
        {overlayEnabled && activeSegmentMode && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
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
