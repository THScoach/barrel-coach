import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface ManualRebootUploadProps {
  playersTableId: string;
  playerName?: string;
}

export function ManualRebootUpload({ playersTableId, playerName }: ManualRebootUploadProps) {
  const queryClient = useQueryClient();
  const [meFile, setMeFile] = useState<File | null>(null);
  const [ikFile, setIkFile] = useState<File | null>(null);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const meInputRef = useRef<HTMLInputElement>(null);
  const ikInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!meFile) throw new Error("ME (momentum-energy) CSV is required");

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("player_id", playersTableId);
      formData.append("session_date", sessionDate);
      formData.append("notes", notes || `Manual upload for ${playerName || "player"}`);
      formData.append("me_file", meFile);
      if (ikFile) {
        formData.append("ik_file", ikFile);
      }

      const { data, error } = await supabase.functions.invoke("manual-reboot-upload", {
        body: formData,
      });

      if (error) throw new Error(error.message || "Upload failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const scores = data?.scores;
      const msg = scores
        ? `Processed! Brain: ${scores.brain} | Body: ${scores.body} | Bat: ${scores.bat} | Ball: ${scores.ball}`
        : data?.message || "Session uploaded and processed";
      toast.success(msg);
      setMeFile(null);
      setIkFile(null);
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["reboot-sessions", playersTableId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFileSelect = (type: "me" | "ik") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }
    if (type === "me") setMeFile(file);
    else setIkFile(file);
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Manual CSV Upload
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Upload historical Reboot Motion CSVs (exported from Reboot dashboard) for 4B analysis.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session date */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Session Date</label>
          <Input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="max-w-[200px] h-9 bg-slate-800 border-slate-700 text-white text-sm"
          />
        </div>

        {/* ME File (Required) */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            Momentum-Energy CSV <span className="text-red-400">*</span>
          </label>
          <input
            ref={meInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect("me")}
            className="hidden"
          />
          {meFile ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5">
                <FileText className="h-3 w-3" />
                {meFile.name}
                <span className="text-emerald-500/60">
                  ({(meFile.size / 1024).toFixed(0)} KB)
                </span>
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setMeFile(null); if (meInputRef.current) meInputRef.current.value = ""; }}
                className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => meInputRef.current?.click()}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 border-dashed"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Select ME CSV
            </Button>
          )}
        </div>

        {/* IK File (Optional) */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            Inverse-Kinematics CSV <span className="text-slate-600">(optional)</span>
          </label>
          <input
            ref={ikInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect("ik")}
            className="hidden"
          />
          {ikFile ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5">
                <FileText className="h-3 w-3" />
                {ikFile.name}
                <span className="text-emerald-500/60">
                  ({(ikFile.size / 1024).toFixed(0)} KB)
                </span>
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setIkFile(null); if (ikInputRef.current) ikInputRef.current.value = ""; }}
                className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => ikInputRef.current?.click()}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 border-dashed"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Select IK CSV
            </Button>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Notes</label>
          <Input
            placeholder="e.g. 2023 Fall session export"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="max-w-sm h-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm"
          />
        </div>

        {/* Upload button */}
        <Button
          onClick={() => uploadMutation.mutate()}
          disabled={!meFile || uploadMutation.isPending}
          className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload & Process
            </>
          )}
        </Button>

        {uploadMutation.isSuccess && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle className="h-4 w-4" />
            Session processed — check sessions list below.
          </div>
        )}

        {uploadMutation.isError && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4" />
            {(uploadMutation.error as Error).message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
