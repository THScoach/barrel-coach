/**
 * REBOOT CSV IMPORT MODAL
 * 
 * Allows importing Reboot Motion kinematics CSV (IK) and momentum CSV (ME)
 * and matching them to swings in a video session by index.
 */
import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Link2,
  X,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface RebootCsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  swingCount: number;
  onSuccess: () => void;
}

interface CsvFile {
  file: File;
  type: 'ik' | 'me';
  status: 'pending' | 'parsing' | 'parsed' | 'error';
  swingCount?: number;
  error?: string;
}

export function RebootCsvImportModal({
  open,
  onOpenChange,
  sessionId,
  swingCount,
  onSuccess,
}: RebootCsvImportModalProps) {
  const [ikFile, setIkFile] = useState<CsvFile | null>(null);
  const [meFile, setMeFile] = useState<CsvFile | null>(null);
  const [matchMode, setMatchMode] = useState<'auto' | 'manual'>('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const resetState = () => {
    setIkFile(null);
    setMeFile(null);
    setMatchMode('auto');
    setProgress(0);
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetState();
      onOpenChange(false);
    }
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'ik' | 'me') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    const csvFile: CsvFile = {
      file,
      type,
      status: 'pending',
    };

    if (type === 'ik') {
      setIkFile(csvFile);
    } else {
      setMeFile(csvFile);
    }

    // Quick parse to count swings
    parseSwingCount(file).then(count => {
      const updated = { ...csvFile, status: 'parsed' as const, swingCount: count };
      if (type === 'ik') {
        setIkFile(updated);
      } else {
        setMeFile(updated);
      }
    }).catch(err => {
      const updated = { ...csvFile, status: 'error' as const, error: err.message };
      if (type === 'ik') {
        setIkFile(updated);
      } else {
        setMeFile(updated);
      }
    });

    e.target.value = '';
  }, []);

  const parseSwingCount = async (file: File): Promise<number> => {
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return 0;
    
    // Look for movement_id column to count unique swings
    const header = lines[0].toLowerCase();
    const movementIdIndex = header.split(',').findIndex(col => 
      col.includes('movement_id') || col.includes('movementid')
    );
    
    if (movementIdIndex >= 0) {
      const movementIds = new Set<string>();
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols[movementIdIndex]) {
          movementIds.add(cols[movementIdIndex].trim());
        }
      }
      return movementIds.size;
    }
    
    // Fallback: count rows with data
    return lines.length - 1;
  };

  const handleImport = async () => {
    if (!meFile) {
      toast.error('ME (Momentum-Energy) CSV is required');
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      // Read file contents
      const meContent = await meFile.file.text();
      const ikContent = ikFile ? await ikFile.file.text() : null;
      
      setProgress(30);

      // Call edge function to process CSVs
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compute-4b-from-csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          meCSV: meContent,
          ikCSV: ikContent,
          matchMode,
        })
      });

      setProgress(70);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setProgress(100);

      // Update session with 3D import status
      const { error: updateError } = await supabase
        .from('video_swing_sessions')
        .update({ 
          reboot_imported: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.warn('Failed to update swing flags:', updateError);
      }

      toast.success(`Imported 3D data for ${result.swingsProcessed || swingCount} swings`);
      handleClose();
      onSuccess();

    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const csvSwingCount = meFile?.swingCount || ikFile?.swingCount || 0;
  const countMismatch = csvSwingCount > 0 && csvSwingCount !== swingCount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Import Reboot 3D Data
          </DialogTitle>
          <DialogDescription>
            Upload kinematics (IK) and momentum (ME) CSV exports from Reboot Motion to add 3D biomechanics data to this session's {swingCount} swing{swingCount !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Box */}
          <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg text-sm">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-muted-foreground">
              <p className="font-medium text-foreground">How it works:</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                <li>• ME CSV is <strong>required</strong> (momentum/energy data)</li>
                <li>• IK CSV is optional (kinematics/angles)</li>
                <li>• Swings are matched by index (1st CSV row → Swing 1)</li>
              </ul>
            </div>
          </div>

          {/* ME File (Required) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <span>Momentum-Energy CSV</span>
              <Badge variant="destructive" className="text-xs">Required</Badge>
            </Label>
            {meFile ? (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{meFile.file.name}</span>
                  {meFile.swingCount && (
                    <Badge variant="outline" className="text-xs">
                      {meFile.swingCount} swings
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setMeFile(null)}
                  disabled={isProcessing}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors border-muted-foreground/25 hover:border-primary/50">
                <div className="text-center">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <span className="text-sm text-muted-foreground">Drop ME CSV or click to browse</span>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileSelect(e, 'me')}
                  className="hidden"
                  disabled={isProcessing}
                />
              </label>
            )}
          </div>

          {/* IK File (Optional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <span>Kinematics CSV</span>
              <Badge variant="secondary" className="text-xs">Optional</Badge>
            </Label>
            {ikFile ? (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{ikFile.file.name}</span>
                  {ikFile.swingCount && (
                    <Badge variant="outline" className="text-xs">
                      {ikFile.swingCount} swings
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIkFile(null)}
                  disabled={isProcessing}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors border-muted-foreground/25 hover:border-primary/50">
                <div className="text-center">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <span className="text-sm text-muted-foreground">Drop IK CSV or click to browse</span>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileSelect(e, 'ik')}
                  className="hidden"
                  disabled={isProcessing}
                />
              </label>
            )}
          </div>

          {/* Count Mismatch Warning */}
          {countMismatch && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-amber-200">
                <p className="font-medium">Swing count mismatch</p>
                <p className="text-xs mt-0.5">
                  CSV has {csvSwingCount} swings, session has {swingCount}. First {Math.min(csvSwingCount, swingCount)} will be matched.
                </p>
              </div>
            </div>
          )}

          {/* Match Mode */}
          <div className="space-y-2">
            <Label>Match Mode</Label>
            <Select value={matchMode} onValueChange={(v) => setMatchMode(v as 'auto' | 'manual')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (by swing index)</SelectItem>
                <SelectItem value="manual" disabled>Manual matching (coming soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!meFile || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Import 3D Data
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
