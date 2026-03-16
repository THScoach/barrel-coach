/**
 * VideoUploadToReboot
 * ====================
 * Drag-and-drop video upload component that sends swing videos
 * to Reboot Motion for 3D biomechanical processing.
 *
 * Flow: Local file → Supabase storage → edge function → Reboot API
 */

import { useState, useCallback, useRef } from 'react';
import {
  UploadProgress,
  uploadVideoToReboot,
  validateVideoFile,
} from '@/services/rebootUpload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Film,
  X,
  Loader2,
} from 'lucide-react';

interface VideoUploadToRebootProps {
  playerId: string;
  playerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (sessionId: string) => void;
  frameRate?: number;
}

export function VideoUploadToReboot({
  playerId,
  playerName,
  open,
  onOpenChange,
  onSuccess,
  frameRate = 240,
}: VideoUploadToRebootProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    status: 'idle',
    percentage: 0,
    message: '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isUploading = progress.status === 'uploading' || progress.status === 'processing' || progress.status === 'validating';

  const handleFile = useCallback((f: File) => {
    const error = validateVideoFile(f);
    if (error) {
      setValidationError(error);
      setFile(null);
      return;
    }
    setValidationError(null);
    setFile(f);
    setProgress({ status: 'idle', percentage: 0, message: '' });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file) return;

    try {
      const result = await uploadVideoToReboot(file, playerId, setProgress, frameRate);
      onSuccess?.(result.sessionId);
    } catch (err: any) {
      setProgress({
        status: 'error',
        percentage: 0,
        message: '',
        error: err.message || 'Upload failed',
      });
    }
  };

  const handleReset = () => {
    setFile(null);
    setValidationError(null);
    setProgress({ status: 'idle', percentage: 0, message: '' });
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = (open: boolean) => {
    if (!isUploading) {
      if (!open) handleReset();
      onOpenChange(open);
    }
  };

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : '0';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Film className="h-5 w-5 text-blue-400" />
            Upload Video to Reboot
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {playerName
              ? `Upload a swing video for ${playerName} for 3D biomechanical analysis.`
              : 'Upload a swing video for 3D biomechanical analysis.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          {progress.status === 'idle' && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => inputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors duration-200
                  ${dragOver
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                  }
                `}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".mp4,.mov,video/mp4,video/quicktime"
                  onChange={handleInputChange}
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-2">
                    <Film className="h-8 w-8 mx-auto text-blue-400" />
                    <p className="text-white font-medium text-sm truncate max-w-xs mx-auto">
                      {file.name}
                    </p>
                    <p className="text-slate-400 text-xs">{fileSizeMB} MB</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReset(); }}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-slate-500" />
                    <p className="text-slate-300 text-sm">
                      Drag & drop a video or <span className="text-blue-400 underline">browse</span>
                    </p>
                    <p className="text-slate-500 text-xs">MP4 or MOV, max 500MB</p>
                  </div>
                )}
              </div>

              {/* Validation Error */}
              {validationError && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-400 text-sm">{validationError}</p>
                </div>
              )}

              {/* Upload Button */}
              {file && !validationError && (
                <button
                  onClick={handleUpload}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  Upload to Reboot Motion
                </button>
              )}
            </>
          )}

          {/* Progress State */}
          {(progress.status === 'validating' || progress.status === 'uploading' || progress.status === 'processing') && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
              </div>
              <Progress value={progress.percentage} className="h-2" />
              <p className="text-slate-300 text-sm text-center">{progress.message}</p>
              <p className="text-slate-500 text-xs text-center">
                {progress.status === 'processing'
                  ? 'Processing typically takes 30-60 minutes after upload.'
                  : 'Do not close this dialog while uploading.'}
              </p>
            </div>
          )}

          {/* Success State */}
          {progress.status === 'complete' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-green-400 font-medium">Video Uploaded Successfully</p>
                <p className="text-slate-300 text-sm">{progress.message}</p>
              </div>
              {progress.sessionId && (
                <div className="bg-slate-800 rounded-lg p-3 text-center">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Session ID</p>
                  <p className="text-white font-mono text-xs break-all">{progress.sessionId}</p>
                </div>
              )}
              <button
                onClick={() => handleClose(false)}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Error State */}
          {progress.status === 'error' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-red-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-red-400 font-medium">Upload Failed</p>
                <p className="text-slate-400 text-sm">{progress.error}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => handleClose(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VideoUploadToReboot;
