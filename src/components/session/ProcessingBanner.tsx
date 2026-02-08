import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";

interface ProcessingBannerProps {
  status: string;
  movementCount?: number;
}

export function ProcessingBanner({ status, movementCount }: ProcessingBannerProps) {
  if (status === "complete" || status === "completed") {
    return null;
  }

  if (status === "failed" || status === "error") {
    return (
      <div className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
        <div>
          <p className="text-red-400 font-medium">Processing Failed</p>
          <p className="text-red-400/70 text-sm">
            There was an issue processing this session. Try re-uploading the videos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg flex items-center gap-3">
      <Loader2 className="w-5 h-5 text-yellow-400 animate-spin shrink-0" />
      <div>
        <p className="text-yellow-400 font-medium">Processing…</p>
        <p className="text-yellow-400/70 text-sm">
          Biomechanics data will appear here when ready (5–15 minutes).
          {movementCount != null && movementCount > 0 && (
            <> {movementCount} movement{movementCount !== 1 ? "s" : ""} detected.</>
          )}
        </p>
      </div>
    </div>
  );
}
