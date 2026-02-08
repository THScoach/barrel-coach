import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload as UploadIcon, Video, X, CheckCircle, Loader2 } from "lucide-react";

interface Player {
  id: string;
  name: string;
}

interface UploadFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

export default function Upload() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedAthlete = searchParams.get("athlete") || "";

  const [selectedPlayer, setSelectedPlayer] = useState(preselectedAthlete);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [frameRate, setFrameRate] = useState("240");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: players = [] } = useQuery({
    queryKey: ["athletes-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Player[];
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const newFiles: UploadFile[] = selected.map((file) => ({
      file,
      id: crypto.randomUUID(),
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpload = async () => {
    if (!selectedPlayer) {
      toast.error("Select an athlete first");
      return;
    }
    if (files.length === 0) {
      toast.error("Add at least one video");
      return;
    }

    setUploading(true);
    let rebootSessionId: string | undefined;

    try {
      for (let i = 0; i < files.length; i++) {
        const uploadFile = files[i];

        // Update status to uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "uploading", progress: 10 } : f
          )
        );

        // Upload video to Supabase storage
        const storagePath = `uploads/${selectedPlayer}/${Date.now()}_${uploadFile.file.name}`;
        const { error: storageError } = await supabase.storage
          .from("swing-videos")
          .upload(storagePath, uploadFile.file);

        if (storageError) throw storageError;

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, progress: 40 } : f
          )
        );

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("swing-videos")
          .getPublicUrl(storagePath);

        // Upload to Reboot (reuse session for videos 2+)
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, progress: 60 } : f
          )
        );

        const { data, error } = await supabase.functions.invoke("upload-to-reboot", {
          body: {
            player_id: selectedPlayer,
            video_url: urlData.publicUrl,
            filename: uploadFile.file.name,
            frame_rate: Number(frameRate),
            existing_session_id: rebootSessionId,
          },
        });

        if (error) throw error;

        // Save session ID for subsequent uploads
        if (data?.reboot_session_id) {
          rebootSessionId = data.reboot_session_id;
          setSessionId(data.reboot_session_id);
        }

        // Mark done
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "done", progress: 100 } : f
          )
        );
      }

      toast.success(`${files.length} video(s) uploaded successfully!`);
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Upload failed");

      // Mark remaining as error
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading"
            ? { ...f, status: "error", error: err.message }
            : f
        )
      );
    } finally {
      setUploading(false);
    }
  };

  const allDone = files.length > 0 && files.every((f) => f.status === "done");

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header />
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto w-full">
        <h1 className="text-2xl md:text-3xl font-black text-white mb-8">Upload Videos</h1>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Send Swings to Reboot Motion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Athlete selector */}
            <div>
              <Label className="text-slate-300">Athlete *</Label>
              <Select value={selectedPlayer} onValueChange={setSelectedPlayer} disabled={uploading}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select athlete" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frame rate */}
            <div>
              <Label className="text-slate-300">Frame Rate</Label>
              <Select value={frameRate} onValueChange={setFrameRate} disabled={uploading}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="120">120 fps</SelectItem>
                  <SelectItem value="240">240 fps</SelectItem>
                  <SelectItem value="480">480 fps</SelectItem>
                  <SelectItem value="600">600 fps</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File drop zone */}
            <div>
              <Label className="text-slate-300">Videos</Label>
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className="mt-2 border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-slate-500 transition-colors"
              >
                <UploadIcon className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Click to select videos</p>
                <p className="text-xs text-slate-500 mt-1">MP4, MOV • Multiple files OK</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3"
                  >
                    <Video className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{f.file.name}</p>
                      <p className="text-xs text-slate-500">
                        {(f.file.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                      {f.status === "uploading" && (
                        <Progress value={f.progress} className="mt-1 h-1" />
                      )}
                      {f.status === "error" && (
                        <p className="text-xs text-red-400 mt-1">{f.error}</p>
                      )}
                    </div>
                    {f.status === "done" ? (
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    ) : f.status === "uploading" ? (
                      <Loader2 className="w-5 h-5 text-slate-400 animate-spin shrink-0" />
                    ) : (
                      <button
                        onClick={() => removeFile(f.id)}
                        className="text-slate-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            {!allDone && (
              <Button
                onClick={handleUpload}
                disabled={uploading || files.length === 0 || !selectedPlayer}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-4 h-4 mr-2" />
                    Upload {files.length} Video{files.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            )}

            {/* Success state */}
            {allDone && sessionId && (
              <div className="text-center space-y-4 py-4">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <div>
                  <p className="text-white font-semibold">Upload Complete!</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Processing takes 5–15 minutes. Check the session for results.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    asChild
                    className="bg-red-600 hover:bg-red-700 text-white font-bold"
                  >
                    <a
                      href={`https://dashboard.rebootmotion.com/sessions/${sessionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View in Reboot Dashboard →
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-700 text-slate-300 hover:text-white"
                    onClick={() => {
                      setFiles([]);
                      setSessionId(null);
                    }}
                  >
                    Upload More Videos
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
