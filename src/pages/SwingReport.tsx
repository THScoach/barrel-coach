import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { mockReportData } from '@/lib/mock-report-data';
import { SwingReportData } from '@/lib/report-types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import {
  ReportHeader,
  ScoreboardCard,
  PotentialVsExpressionCard,
  LeakCard,
  FixOrderChecklist,
  HeatmapCard,
  MetricsChipsPanel,
  BallOutcomePanel,
  TrainingCard,
  ProgressBoard,
  CoachNoteCard,
} from '@/components/report';

// ============================================================================
// DEV SWITCH: Toggle between mock data and real edge function
// Set to true to fetch from get-report edge function (requires deployed function)
// Set to false to use local mock data for UI development
// ============================================================================
const USE_EDGE_FUNCTION = false;

async function fetchReport(sessionId: string): Promise<SwingReportData> {
  if (!USE_EDGE_FUNCTION) {
    // Return mock data immediately with the requested sessionId
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UX
    return {
      ...mockReportData,
      session: {
        ...mockReportData.session,
        id: sessionId,
      },
    };
  }

  // Edge function path - fetches real data from reboot_uploads
  // sessionId should be a reboot_uploads.id (UUID)
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-report?sessionId=${encodeURIComponent(sessionId)}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch report: ${response.status}`);
  }

  return response.json();
}

function ReportSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-6 w-32 mx-auto bg-slate-800" />
        
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-6 w-40 bg-slate-800" />
            <Skeleton className="h-4 w-32 bg-slate-800" />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-center">
              <Skeleton className="h-28 w-28 rounded-full bg-slate-800" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-6 w-full bg-slate-800" />
              ))}
            </div>
          </CardContent>
        </Card>

        {[1, 2].map((i) => (
          <Card key={i} className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <Skeleton className="h-20 w-full bg-slate-800" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ReportError({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <Card className="bg-slate-900 border-slate-800 max-w-sm w-full">
        <CardContent className="p-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold text-white">Report Unavailable</h2>
          <p className="text-sm text-slate-400">
            {message || "We couldn't load this report. Please try again."}
          </p>
          <Button onClick={onRetry} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SwingReport() {
  const { sessionId } = useParams<{ sessionId: string }>();
  
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['report', sessionId],
    queryFn: () => fetchReport(sessionId || 'test'),
    enabled: !!sessionId,
    retry: 1, // Only retry once for real API calls
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) {
    return (
      <ReportError 
        onRetry={() => refetch()} 
        message={error instanceof Error ? error.message : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-slate-400 text-center">Swing Report</h1>
        <ReportHeader session={data.session} />
        <ScoreboardCard scores={data.scores} />
        <PotentialVsExpressionCard potential={data.kinetic_potential} />
        {data.primary_leak && (data.primary_leak as any).present !== false && (
          <LeakCard leak={data.primary_leak} />
        )}
        {data.fix_order && data.fix_order.length > 0 && (
          <FixOrderChecklist items={data.fix_order} doNotChase={data.do_not_chase} />
        )}
        {data.square_up_window?.present && <HeatmapCard data={data.square_up_window} />}
        {data.weapon_panel?.present && <MetricsChipsPanel data={data.weapon_panel} />}
        {data.ball_panel?.present && <BallOutcomePanel data={data.ball_panel} />}
        {data.drills && data.drills.length > 0 && <TrainingCard drills={data.drills} />}
        {data.session_history && data.session_history.length > 0 && (
          <ProgressBoard history={data.session_history} badges={data.badges} />
        )}
        {data.coach_note && (data.coach_note as any).present !== false && (
          <CoachNoteCard note={data.coach_note} />
        )}
        <div className="h-8" />
      </div>
    </div>
  );
}
