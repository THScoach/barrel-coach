/**
 * Admin Rescore Panel
 * Batch scoring operations + diagnostics for admin dashboard.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Zap, Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface RescoreResult {
  processed: number;
  failed: number;
  skipped: number;
  total: number;
  csv_downloaded?: number;
  errors?: { session_id: string; error: string }[];
}

export function AdminRescorePanel({ playerId }: { playerId?: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RescoreResult | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);

  // Fetch recent scoring statuses for this player
  const { data: scoringDiag, refetch: refetchDiag } = useQuery({
    queryKey: ['scoring-diagnostics', playerId],
    enabled: !!playerId && diagOpen,
    queryFn: async () => {
      const { data: sessions } = await supabase
        .from('player_sessions')
        .select('id, session_date, scoring_status, scored_at, overall_score, brain_score, body_score, bat_score, reboot_session_id')
        .eq('player_id', playerId!)
        .order('session_date', { ascending: false })
        .limit(15);

      return sessions || [];
    },
  });

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
        errors: data.errors || [],
      });

      toast.success(`Scored ${data.processed} sessions. ${data.failed} failed. ${data.skipped} skipped.`);
      refetchDiag();
    } catch (err) {
      toast.error('Rescore failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'scored') return <CheckCircle2 className="h-3 w-3 text-emerald-400" />;
    if (status === 'failed') return <AlertTriangle className="h-3 w-3 text-red-400" />;
    return <Loader2 className="h-3 w-3 text-amber-400" />;
  };

  const statusColor = (status: string) => {
    if (status === 'scored') return 'text-emerald-400';
    if (status === 'failed') return 'text-red-400';
    return 'text-amber-400';
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
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{result.processed} scored</Badge>
              {result.csv_downloaded ? <Badge variant="outline" className="border-blue-500/30 text-blue-400">{result.csv_downloaded} CSVs fetched</Badge> : null}
              {result.failed > 0 && <Badge variant="outline" className="border-red-500/30 text-red-400">{result.failed} failed</Badge>}
              {result.skipped > 0 && <Badge variant="outline">{result.skipped} skipped</Badge>}
              <Badge variant="outline">{result.total} total</Badge>
            </div>

            {/* Inline errors from last run */}
            {result.errors && result.errors.length > 0 && (
              <div className="bg-red-950/30 border border-red-900/40 rounded-md p-2 space-y-1">
                <p className="text-[10px] font-medium text-red-400 uppercase tracking-wider">Last Run Errors</p>
                {result.errors.map((e, i) => (
                  <div key={i} className="text-[11px] text-red-300/80 font-mono truncate" title={e.error}>
                    <span className="text-red-500">✗</span> {e.session_id?.substring(0, 8)}… — {e.error.substring(0, 120)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Diagnostics collapsible */}
        {playerId && (
          <Collapsible open={diagOpen} onOpenChange={setDiagOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground h-7 px-2">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3 w-3" />
                  Scoring Diagnostics
                </span>
                {diagOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                {scoringDiag && scoringDiag.length > 0 ? (
                  <div className="space-y-0.5">
                    <div className="grid grid-cols-[80px_60px_1fr_60px] gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-1 pb-1 border-b border-border">
                      <span>Date</span>
                      <span>Status</span>
                      <span>Scores (Br/Bo/Ba)</span>
                      <span>Overall</span>
                    </div>
                    {scoringDiag.map((s: any) => (
                      <div key={s.id} className="grid grid-cols-[80px_60px_1fr_60px] gap-1 text-[11px] px-1 py-0.5 rounded hover:bg-muted/30">
                        <span className="text-muted-foreground font-mono">
                          {new Date(s.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`flex items-center gap-1 ${statusColor(s.scoring_status || 'pending')}`}>
                          {statusIcon(s.scoring_status || 'pending')}
                          <span className="capitalize text-[10px]">{s.scoring_status || 'pending'}</span>
                        </span>
                        <span className="font-mono text-foreground">
                          {s.brain_score != null ? `${s.brain_score}/${s.body_score}/${s.bat_score}` : '—'}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {s.overall_score ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : diagOpen ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No sessions found</p>
                ) : null}

                {/* Summary stats */}
                {scoringDiag && scoringDiag.length > 0 && (
                  <div className="flex gap-3 pt-2 border-t border-border text-[10px] text-muted-foreground">
                    <span className="text-emerald-400">
                      {scoringDiag.filter((s: any) => s.scoring_status === 'scored').length} scored
                    </span>
                    <span className="text-amber-400">
                      {scoringDiag.filter((s: any) => !s.scoring_status || s.scoring_status === 'pending').length} pending
                    </span>
                    <span className="text-red-400">
                      {scoringDiag.filter((s: any) => s.scoring_status === 'failed').length} failed
                    </span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
