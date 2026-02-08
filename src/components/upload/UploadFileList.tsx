import { Video, ExternalLink, X, CheckCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { UploadFile } from "@/types/upload";

interface UploadFileListProps {
  files: UploadFile[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function UploadFileList({ files, onRemove, disabled }: UploadFileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      {files.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3"
        >
          {f.source === "file" ? (
            <Video className="w-5 h-5 text-slate-400 shrink-0" />
          ) : (
            <ExternalLink className="w-5 h-5 text-blue-400 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{f.name}</p>
            <p className="text-xs text-slate-500">
              {f.source === "file" && f.file
                ? `${(f.file.size / (1024 * 1024)).toFixed(1)} MB`
                : "OnForm video"}
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
              onClick={() => onRemove(f.id)}
              disabled={disabled}
              className="text-slate-500 hover:text-white disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
