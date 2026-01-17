import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  Video, 
  X, 
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Video2DAnalysisCard } from "@/components/admin/Video2DAnalysisCard";

interface Video2DUploaderProps {
  playerId: string;
  playerName: string;
  playerAge?: number;
  playerLevel?: string;
  isPaidUser: boolean;
  onUpgradeClick?: () => void;
}

type UploadState = "idle" | "uploading" | "analyzing" | "complete" | "error";

export function Video2DUploader({
  playerId,
  playerName,
  playerAge,
  playerLevel,
  isPaidUser,
  onUpgradeClick,
}: Video2DUploaderProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      toast.error("Video must be under 500MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysisResult(null);
    setErrorMessage(null);
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return;

    setUploadState("uploading");
    setUploadProgress(0);

    try {
      // 1. Upload to Supabase storage
      const fileName = `${playerId}/${Date.now()}_${selectedFile.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("swing-videos")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(50);

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from("swing-videos")
        .getPublicUrl(fileName);

      const videoUrl = urlData.publicUrl;
      
      setUploadState("analyzing");
      setUploadProgress(75);

      // 3. Call analyze-video-2d edge function
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        "analyze-video-2d",
        {
          body: {
            player_id: playerId,
            video_url: videoUrl,
            is_paid_user: isPaidUser,
            player_age: playerAge,
            player_level: playerLevel,
          },
        }
      );

      if (analysisError) throw analysisError;

      if (!analysisData.success) {
        throw new Error(analysisData.error || "Analysis failed");
      }

      setUploadProgress(100);
      setAnalysisResult(analysisData);
      setUploadState("complete");
      toast.success("Video analyzed successfully!");
    } catch (error) {
      console.error("Upload/analysis error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
      setUploadState("error");
      toast.error("Failed to analyze video");
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setUploadState("idle");
    setUploadProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Show analysis result
  if (uploadState === "complete" && analysisResult?.analysis) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Your Swing Analysis</h3>
          <Button variant="outline" size="sm" onClick={handleReset}>
            Analyze Another
          </Button>
        </div>
        <Video2DAnalysisCard
          analysis={analysisResult.analysis}
          isPaidUser={isPaidUser}
          pendingReboot={analysisResult.pending_reboot}
          onUpgrade={onUpgradeClick}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Upload Swing Video
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload Area */}
        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          >
            <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Click to upload swing video</p>
            <p className="text-sm text-muted-foreground mt-1">
              MP4, MOV, or WebM up to 500MB
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Best results: Side view, good lighting, full swing visible
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={previewUrl || undefined}
                className="w-full h-full object-contain"
                controls
                muted
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70"
                onClick={handleReset}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* File Info */}
            <div className="flex items-center justify-between text-sm">
              <span className="truncate">{selectedFile.name}</span>
              <span className="text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>

            {/* Progress */}
            {(uploadState === "uploading" || uploadState === "analyzing") && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {uploadState === "uploading" ? "Uploading video..." : "Analyzing swing..."}
                </div>
              </div>
            )}

            {/* Error */}
            {uploadState === "error" && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-sm">Analysis Failed</p>
                  <p className="text-xs text-muted-foreground">{errorMessage}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto">
                  Try Again
                </Button>
              </div>
            )}

            {/* Actions */}
            {uploadState === "idle" && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleUploadAndAnalyze} className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Analyze Swing
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Tips for best analysis:</strong></p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Film from the side (open or closed side)</li>
            <li>Keep camera steady, full body in frame</li>
            <li>Good lighting, minimal background distractions</li>
            <li>Include full swing from setup to finish</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
