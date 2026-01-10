import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, RefreshCw, Check, X, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminHeader } from "@/components/AdminHeader";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface KommodoRecording {
  id: string;
  title?: string;
  name?: string;
  duration?: number;
  duration_seconds?: number;
  created_at?: string;
  transcript?: string;
  video_url?: string;
  playback_url?: string;
}

interface ImportResult {
  id: string;
  success: boolean;
  error?: string;
  video_id?: string;
}

export default function AdminImportKommodo() {
  const [recordings, setRecordings] = useState<KommodoRecording[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [autoPublish, setAutoPublish] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  const fetchRecordings = async () => {
    setLoading(true);
    setImportResults([]);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/kommodo-import?action=list`);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch recordings');
      }

      const data = await res.json();
      const recs = Array.isArray(data.recordings) ? data.recordings : [];
      setRecordings(recs);
      setSelectedIds(new Set());
      
      if (recs.length === 0) {
        toast.info('No recordings found in Kommodo');
      } else {
        toast.success(`Found ${recs.length} recording(s)`);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch recordings');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === recordings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recordings.map(r => r.id)));
    }
  };

  const importSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select recordings to import');
      return;
    }

    setImporting(true);
    setImportResults([]);
    
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/kommodo-import?action=import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recording_ids: Array.from(selectedIds),
          auto_publish: autoPublish
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Import failed');
      }

      const data = await res.json();
      setImportResults(data.results || []);
      
      const successCount = data.results.filter((r: ImportResult) => r.success).length;
      const failCount = data.results.filter((r: ImportResult) => !r.success).length;
      
      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} video(s)`);
      }
      if (failCount > 0) {
        toast.error(`Failed to import ${failCount} video(s)`);
      }

      // Clear selection for successful imports
      const failedIds = new Set<string>(data.results.filter((r: ImportResult) => !r.success).map((r: ImportResult) => r.id));
      setSelectedIds(failedIds);

    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getResultForId = (id: string): ImportResult | undefined => {
    return importResults.find(r => r.id === id);
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link to="/admin/videos">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Videos
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Import from Kommodo</h1>
            </div>
          </div>

          {/* Controls */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <Button onClick={fetchRecordings} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Fetch Videos from Kommodo
                </Button>

                {recordings.length > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={autoPublish}
                        onCheckedChange={setAutoPublish}
                        id="auto-publish"
                      />
                      <label htmlFor="auto-publish" className="text-sm">
                        Auto-publish after import
                      </label>
                    </div>

                    <Button
                      variant="outline"
                      onClick={selectAll}
                    >
                      {selectedIds.size === recordings.length ? 'Deselect All' : 'Select All'}
                    </Button>

                    <Button
                      onClick={importSelected}
                      disabled={importing || selectedIds.size === 0}
                    >
                      {importing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Import Selected ({selectedIds.size})
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recordings List */}
          {recordings.length > 0 ? (
            <div className="space-y-2">
              {recordings.map((rec) => {
                const result = getResultForId(rec.id);
                const title = rec.title || rec.name || 'Untitled';
                const duration = rec.duration || rec.duration_seconds;

                return (
                  <Card
                    key={rec.id}
                    className={`transition-colors ${
                      result?.success === true ? 'bg-green-500/10 border-green-500/30' :
                      result?.success === false ? 'bg-red-500/10 border-red-500/30' :
                      selectedIds.has(rec.id) ? 'bg-accent' : ''
                    }`}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={selectedIds.has(rec.id)}
                          onCheckedChange={() => toggleSelect(rec.id)}
                          disabled={importing || result !== undefined}
                        />

                        <Video className="h-5 w-5 text-muted-foreground shrink-0" />

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{title}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {duration && (
                              <span>{formatDuration(duration)}</span>
                            )}
                            {rec.created_at && (
                              <span>{new Date(rec.created_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>

                        {result !== undefined && (
                          <Badge variant={result.success ? 'default' : 'destructive'}>
                            {result.success ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Imported
                              </>
                            ) : (
                              <>
                                <X className="h-3 w-3 mr-1" />
                                {result.error || 'Failed'}
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-medium mb-2">No Recordings Loaded</h3>
                <p className="text-muted-foreground mb-4">
                  Click "Fetch Videos from Kommodo" to load your recordings
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
