/**
 * Admin Rescore Panel
 * Batch scoring operations for admin dashboard.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Zap } from "lucide-react";

interface RescoreResult {
  processed: number;
  failed: number;
  skipped: number;
  total: number;
  csv_downloaded?: number;
}

export function AdminRescorePanel({ playerId }: { playerId?: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RescoreResult | null>(null);

  const runBackfill = async (forceRescore: boolean) => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('backfill-4b-scores', {
        body: { player_id: playerId || undefined, force_rescore: forceRescore },
      });

      if (error) throw error;

      setResult({
        processed: data.processed || 0,
        failed: data.failed || 0,
        skipped: data.skipped || 0,
        total: data.total || 0,
        csv_downloaded: data.csv_downloaded || 0,
      });

      toast.success(`Scored ${data.processed} sessions. ${data.failed} failed. ${data.skipped} skipped.`);
    } catch (err) {
      toast.error('Rescore failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          4B Scoring Engine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => runBackfill(false)}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            {playerId ? 'Score Unscored' : 'Score All Unscored'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={loading}
            onClick={() => {
              if (confirm('This will re-score ALL sessions. Continue?')) {
                runBackfill(true);
              }
            }}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
            Force Rescore All
          </Button>
        </div>

        {result && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{result.processed} scored</Badge>
            {result.csv_downloaded ? <Badge variant="outline" className="border-blue-500/30 text-blue-400">{result.csv_downloaded} CSVs fetched</Badge> : null}
            {result.failed > 0 && <Badge variant="outline" className="border-red-500/30 text-red-400">{result.failed} failed</Badge>}
            {result.skipped > 0 && <Badge variant="outline">{result.skipped} skipped</Badge>}
            <Badge variant="outline">{result.total} total</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
