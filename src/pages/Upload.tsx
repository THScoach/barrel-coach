import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload as UploadIcon, Loader2 } from "lucide-react";
import { UploadFileList } from "@/components/upload/UploadFileList";
import { OnFormLinksInput } from "@/components/upload/OnFormLinksInput";
import { UploadSuccessState } from "@/components/upload/UploadSuccessState";
import type { UploadFile } from "@/types/upload";

interface Player {
  id: string;
  name: string;
}

export default function Upload() {
  const [searchParams] = useSearchParams();
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
      source: "file",
      name: file.name,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddOnformFiles = (newFiles: UploadFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileStatus = (id: string, updates: Partial<UploadFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
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
      for (const uploadFile of files) {
        updateFileStatus(uploadFile.id, { status: "uploading", progress: 10 });

        let videoUrl: string;
        let filename: string;

        if (uploadFile.source === "file" && uploadFile.file) {
          // Upload file to Supabase storage
          const storagePath = `uploads/${selectedPlayer}/${Date.now()}_${uploadFile.file.name}`;
          const { error: storageError } = await supabase.storage
            .from("swing-videos")
            .upload(storagePath, uploadFile.file);
          if (storageError) throw storageError;

          updateFileStatus(uploadFile.id, { progress: 40 });

          const { data: urlData } = supabase.storage
            .from("swing-videos")
            .getPublicUrl(storagePath);
          videoUrl = urlData.publicUrl;
          filename = uploadFile.file.name;
        } else if (uploadFile.source === "onform" && uploadFile.url) {
          // OnForm link — pass directly; the edge function will resolve it
          videoUrl = uploadFile.url;
          filename = `onform_${uploadFile.onformId || "unknown"}.mp4`;
          updateFileStatus(uploadFile.id, { progress: 30 });
        } else {
          updateFileStatus(uploadFile.id, {
            status: "error",
            error: "Invalid file source",
          });
          continue;
        }

        updateFileStatus(uploadFile.id, { progress: 60 });

        console.log("[Upload] Sending to upload-to-reboot:", {
          player_id: selectedPlayer,
          video_url: videoUrl,
          filename,
          frame_rate: Number(frameRate),
          existing_session_id: rebootSessionId,
        });

        const { data, error } = await supabase.functions.invoke(
          "upload-to-reboot",
          {
            body: {
              player_id: selectedPlayer,
              video_url: videoUrl,
              filename,
              frame_rate: Number(frameRate),
              existing_session_id: rebootSessionId,
            },
          }
        );

        console.log("[Upload] Response:", data);
        console.log("[Upload] Error:", error);

        if (error) throw error;

        // Capture session ID from first successful upload
        if (data?.reboot_session_id) {
          rebootSessionId = data.reboot_session_id;
          setSessionId(data.reboot_session_id);
          console.log("[Upload] ✅ Captured session ID:", rebootSessionId);
        }

        updateFileStatus(uploadFile.id, { status: "done", progress: 100 });
      }

      toast.success(`${files.length} video(s) uploaded successfully!`);
    } catch (err: any) {
      console.error("[Upload] Error:", err);
      toast.error(err.message || "Upload failed");

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

  const handleUploadMore = () => {
    setFiles([]);
    setSessionId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header />
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto w-full">
        <h1 className="text-2xl md:text-3xl font-black text-white mb-8">
          Upload Videos
        </h1>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">
              Send Swings to Reboot Motion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Athlete selector */}
            <div>
              <Label className="text-slate-300">Athlete *</Label>
              <Select
                value={selectedPlayer}
                onValueChange={setSelectedPlayer}
                disabled={uploading}
              >
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
              <Select
                value={frameRate}
                onValueChange={setFrameRate}
                disabled={uploading}
              >
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

            {/* Upload method tabs */}
            <Tabs defaultValue="files">
              <TabsList className="bg-slate-800 border-slate-700 w-full">
                <TabsTrigger value="files" className="flex-1">
                  File Upload
                </TabsTrigger>
                <TabsTrigger value="onform" className="flex-1">
                  OnForm Links
                </TabsTrigger>
              </TabsList>

              <TabsContent value="files" className="mt-4">
                <div>
                  <Label className="text-slate-300">Videos</Label>
                  <div
                    onClick={() =>
                      !uploading && fileInputRef.current?.click()
                    }
                    className="mt-2 border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-slate-500 transition-colors"
                  >
                    <UploadIcon className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">
                      Click to select videos
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      MP4, MOV • Multiple files OK
                    </p>
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
              </TabsContent>

              <TabsContent value="onform" className="mt-4">
                <OnFormLinksInput
                  onAddFiles={handleAddOnformFiles}
                  disabled={uploading}
                />
              </TabsContent>
            </Tabs>

            {/* File list */}
            <UploadFileList
              files={files}
              onRemove={removeFile}
              disabled={uploading}
            />

            {/* Upload button */}
            {!allDone && files.length > 0 && (
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedPlayer}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading…
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
              <UploadSuccessState
                sessionId={sessionId}
                onUploadMore={handleUploadMore}
              />
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
