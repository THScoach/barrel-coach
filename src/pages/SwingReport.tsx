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

// Mock fetch - replace with real API call when edge function is ready
async function fetchReport(sessionId: string): Promise<SwingReportData> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Return mock data with the requested sessionId
  return {
    ...mockReportData,
    session: {
      ...mockReportData.session,
      id: sessionId,
    },
  };
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

function ReportError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <Card className="bg-slate-900 border-slate-800 max-w-sm w-full">
        <CardContent className="p-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold text-white">Report Unavailable</h2>
          <p className="text-sm text-slate-400">
            We couldn't load this report. Please try again.
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
  
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['report', sessionId],
    queryFn: () => fetchReport(sessionId || 'test'),
    enabled: !!sessionId,
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) return <ReportError onRetry={() => refetch()} />;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-slate-400 text-center">Swing Report</h1>
        <ReportHeader session={data.session} />
        <ScoreboardCard scores={data.scores} />
        <PotentialVsExpressionCard potential={data.kineticPotential} />
        <LeakCard leak={data.primaryLeak} />
        <FixOrderChecklist items={data.fixOrder} doNotChase={data.doNotChase} />
        {data.squareUpWindow?.present && <HeatmapCard data={data.squareUpWindow} />}
        {data.diamondKinetics?.present && <MetricsChipsPanel data={data.diamondKinetics} />}
        {data.ballData?.present && <BallOutcomePanel data={data.ballData} />}
        <TrainingCard drills={data.drills} />
        <ProgressBoard history={data.sessionHistory} badges={data.badges} />
        <CoachNoteCard note={data.coachNote} />
        <div className="h-8" />
      </div>
    </div>
  );
}
