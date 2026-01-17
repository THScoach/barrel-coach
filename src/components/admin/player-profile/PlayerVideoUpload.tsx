import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Video, Loader2, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface PlayerVideoUploadProps {
  playerId: string;
  playerName: string;
}

const FRAME_RATES = [
  { value: "120", label: "120 fps" },
  { value: "240", label: "240 fps (recommended)" },
  { value: "480", label: "480 fps" },
  { value: "600", label: "600 fps" },
];

const SESSION_TYPES = [
  { value: "practice", label: "Practice" },
  { value: "game", label: "Game" },
];

export function PlayerVideoUpload({ playerId, playerName }: PlayerVideoUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [frameRate, setFrameRate] = useState("240");
  const [sessionType, setSessionType] = useState<"practice" | "game">("practice");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "analyzing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["video/mp4", "video/quicktime"];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload MP4 or MOV files only.");
      return;
    }

    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 500MB.");
      return;
    }

    setSelectedFile(file);
    setUploadStatus("idle");
    setErrorMessage(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a video file first");
      return;
    }

    setUploadStatus("uploading");
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      // Step 1: Upload to Supabase Storage
      const timestamp = Date.now();
      const safeFilename = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${playerId}/${timestamp}_${safeFilename}`;

      setUploadProgress(10);

      const { error: uploadError } = await supabase.storage
        .from("swing-videos")
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      setUploadProgress(40);

      // Step 2: Get public URL
      const { data: urlData } = supabase.storage
        .from("swing-videos")
        .getPublicUrl(storagePath);

      const videoUrl = urlData.publicUrl;

      setUploadProgress(60);
      setUploadStatus("analyzing");

      // Step 3: Call analyze-video-2d edge function (stores in video_2d_sessions)
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        "analyze-video-2d",
        { 
          body: { 
            player_id: playerId,
            video_url: videoUrl,
            video_filename: selectedFile.name,
            video_storage_path: storagePath,
            context: sessionType,
            frame_rate: parseInt(frameRate),
            is_paid_user: false, // Admin uploads default to free tier analysis
          } 
        }
      );

      setUploadProgress(90);

      if (analysisError || !analysisResult?.success) {
        console.error("2D Analysis error:", analysisError || analysisResult?.error);
        toast.warning("Video uploaded but analysis failed. Please try again.");
        setUploadStatus("error");
        setErrorMessage(analysisResult?.error || analysisError?.message || "Analysis failed");
        return;
      }

      setUploadProgress(100);
      setUploadStatus("success");
      
      const analysis = analysisResult.analysis;
      toast.success(
        `Analysis complete! Composite: ${analysis?.composite || 'N/A'}, Leak: ${analysis?.leak_detected || 'None'}`
      );
      
      // Reset form
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Refresh upload history
      queryClient.invalidateQueries({ queryKey: ['player-2d-sessions', playerId] });
      queryClient.invalidateQueries({ queryKey: ['player-upload-history', playerId] });

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Upload failed";
      setErrorMessage(errorMsg);
      setUploadStatus("error");
      toast.error(errorMsg);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadStatus("idle");
    setUploadProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Swing Video (2D Analysis)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input */}
        <div className="space-y-2">
          <Label className="text-slate-300">Video File</Label>
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              selectedFile 
                ? "border-emerald-500/50 bg-emerald-500/5" 
                : "border-slate-700 hover:border-slate-600 bg-slate-800/30"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov"
              onChange={handleFileSelect}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <Video className="h-6 w-6" />
                <span className="font-medium">{selectedFile.name}</span>
                <span className="text-sm text-slate-400">
                  ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>
            ) : (
              <div className="text-slate-400">
                <Video className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Click to select a video</p>
                <p className="text-xs mt-1">MP4 or MOV, max 500MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Frame Rate & Session Type */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Frame Rate</Label>
            <Select value={frameRate} onValueChange={setFrameRate}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {FRAME_RATES.map((rate) => (
                  <SelectItem key={rate.value} value={rate.value}>
                    {rate.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Session Type</Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType(v as "practice" | "game")}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {SESSION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Progress Bar */}
        {(uploadStatus === "uploading" || uploadStatus === "analyzing") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {uploadStatus === "uploading" ? "Uploading video..." : "Running AI analysis..."}
              </span>
              <span className="text-slate-400">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Success Message */}
        {uploadStatus === "success" && (
          <div className="flex flex-col gap-2 text-emerald-400 bg-emerald-500/10 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Video analyzed successfully!</span>
            </div>
            <span className="text-sm text-slate-300">
              2D analysis complete. Check upload history for full results.
            </span>
          </div>
        )}

        {/* Error Message */}
        {uploadStatus === "error" && errorMessage && (
          <div className="text-red-400 bg-red-500/10 p-3 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploadStatus === "uploading" || uploadStatus === "analyzing"}
            className="flex-1 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
          >
            {uploadStatus === "uploading" || uploadStatus === "analyzing" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploadStatus === "uploading" ? "Uploading..." : "Analyzing..."}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload & Analyze
              </>
            )}
          </Button>
          {(selectedFile || uploadStatus !== "idle") && (
            <Button
              variant="outline"
              onClick={resetUpload}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}