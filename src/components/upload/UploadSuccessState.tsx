import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadSuccessStateProps {
  sessionId: string;
  onUploadMore: () => void;
}

export function UploadSuccessState({ sessionId, onUploadMore }: UploadSuccessStateProps) {
  return (
    <div className="text-center space-y-4 py-4">
      <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
      <div>
        <p className="text-white font-semibold">Upload Complete!</p>
        <p className="text-sm text-slate-400 mt-1">
          Processing takes 5–15 minutes. Check the session for results.
        </p>
        <p className="text-xs text-slate-600 mt-2 font-mono truncate">
          Session: {sessionId}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <a
          href={`https://dashboard.rebootmotion.com/sessions/${sessionId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-700 text-white font-bold h-10 px-4 py-2 text-sm transition-colors w-full"
        >
          View in Reboot Dashboard →
        </a>
        <Button
          variant="outline"
          className="border-slate-700 text-slate-300 hover:text-white"
          onClick={onUploadMore}
        >
          Upload More Videos
        </Button>
      </div>
    </div>
  );
}
