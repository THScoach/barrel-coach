import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";

interface ManualRebootUploadProps {
  playersTableId: string;
  playerName?: string;
}

export function ManualRebootUpload({ playersTableId, playerName }: ManualRebootUploadProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"ik" | "momentum">("momentum");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    metrics?: Record<string, unknown>;
    bothPresent?: boolean;
  } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a CSV file first");

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("player_id", playersTableId);
      formData.append("file_type", fileType);
      formData.append("session_date", sessionDate);
      formData.append("file", file);

      const { data, error } = await supabase.functions.invoke("manual-reboot-upload", {
        body: formData,
      });

      if (error) throw new Error(error.message || "Upload failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setLastResult({
        success: true,
        message: data.message,
        metrics: data.metrics_extracted,
        bothPresent: data.both_files_present,
      });

      if (data.scoring) {
        const s = data.scoring;
        toast.success(`4B Scores — Brain: ${s.brain} | Body: ${s.body} | Bat: ${s.bat} | Ball: ${s.ball}`);
      } else {
        toast.success(data.message);
      }

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["reboot-sessions", playersTableId] });
    },
    onError: (e: Error) => {
      setLastResult({ success: false, message: e.message });
      toast.error(e.message);
    },
  });

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload Reboot Files
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Upload historical CSVs exported from Reboot Motion. No date restriction — works for any session age.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: File Type + Date */}
        <div className="flex flex-wrap gap-3">
          <div className="w-[180px]">
            <label className="text-xs text-slate-400 mb-1 block">File Type</label>
            <Select value={fileType} onValueChange={(v) => setFileType(v as "ik" | "momentum")}>
              <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="momentum">Momentum-Energy</SelectItem>
                <SelectItem value="ik">Inverse Kinematics</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Session Date</label>
            <Input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-[170px] h-9 bg-slate-800 border-slate-700 text-white text-sm"
            />
          </div>
        </div>

        {/* File selection */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            {fileType === "momentum" ? "Momentum-Energy CSV" : "Inverse-Kinematics CSV"}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && !f.name.endsWith(".csv")) {
                toast.error("Please select a CSV file");
                return;
              }
              setFile(f || null);
              setLastResult(null);
            }}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5">
                <FileText className="h-3 w-3" />
                {file.name}
                <span className="text-emerald-500/60">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 border-dashed"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Select {fileType === "momentum" ? "ME" : "IK"} CSV
            </Button>
          )}
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-800/40 rounded-lg p-3">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Upload files one at a time. If both ME and IK files are uploaded for the same date,
            they'll be combined automatically. 4B scoring triggers when the Momentum-Energy file is present.
          </span>
        </div>

        {/* Upload button */}
        <Button
          onClick={() => uploadMutation.mutate()}
          disabled={!file || uploadMutation.isPending}
          className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading & Processing…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload & Process
            </>
          )}
        </Button>

        {/* Result feedback */}
        {lastResult && (
          <div className={`flex items-start gap-2 text-sm rounded-lg p-3 ${
            lastResult.success
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            {lastResult.success ? (
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <div>
              <p>{lastResult.message}</p>
              {lastResult.metrics && (
                <p className="text-xs mt-1 opacity-70">
                  {(lastResult.metrics as { row_count?: number }).row_count} rows parsed,{" "}
                  {((lastResult.metrics as { movement_ids?: string[] }).movement_ids || []).length} movements detected
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
