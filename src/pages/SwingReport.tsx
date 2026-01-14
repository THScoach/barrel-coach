import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { mockReportData } from '@/lib/mock-report-data';
import { SwingReportData, isPresent, getItems } from '@/lib/report-types';
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
  BarrelSlingCard,
} from '@/components/report';

// ============================================================================
// ENV SWITCH: Toggle between mock data and real edge function
// Set VITE_USE_EDGE_FUNCTION=true in .env to fetch from get-report edge function
// Default: false (uses local mock data for UI development)
// ============================================================================
const USE_EDGE_FUNCTION = import.meta.env.VITE_USE_EDGE_FUNCTION === 'true';

async function fetchReport(sessionId: string): Promise<SwingReportData> {
  if (!USE_EDGE_FUNCTION) {
    // Return mock data immediately with the requested sessionId
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UX
    return {
      ...mockReportData,
      generated_at: new Date().toISOString(),
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

  const data: SwingReportData = await response.json();
  return data;
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
    retry: 1,
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
        
        {/* Always present: session header and scores */}
        <ReportHeader session={data.session} />
        <ScoreboardCard scores={data.scores} />
        
        {/* Kinetic Potential - with present flag */}
        {isPresent(data.kinetic_potential) && (
          <PotentialVsExpressionCard 
            potential={{ 
              ceiling: data.kinetic_potential.ceiling ?? 0, 
              current: data.kinetic_potential.current ?? 0 
            }} 
          />
        )}
        
        {/* Primary Leak - with present flag */}
        {isPresent(data.primary_leak) && (
          <LeakCard 
            leak={{
              title: data.primary_leak.title ?? '',
              description: data.primary_leak.description ?? '',
              why_it_matters: data.primary_leak.why_it_matters ?? '',
              frame_url: data.primary_leak.frame_url,
              loop_url: data.primary_leak.loop_url,
            }} 
          />
        )}
        
        {/* Fix Order - with present flag and items array */}
        {isPresent(data.fix_order) && getItems(data.fix_order).length > 0 && (
          <FixOrderChecklist 
            items={getItems(data.fix_order)} 
            doNotChase={data.fix_order.do_not_chase ?? []} 
          />
        )}
        
        {/* Square Up Window - with present flag */}
        {isPresent(data.square_up_window) && (
          <HeatmapCard data={data.square_up_window} />
        )}
        
        {/* Weapon Panel - with present flag */}
        {isPresent(data.weapon_panel) && (
          <MetricsChipsPanel data={data.weapon_panel} />
        )}
        
        {/* Ball Panel - with present flag */}
        {isPresent(data.ball_panel) && (
          <BallOutcomePanel data={data.ball_panel} />
        )}
        
        {/* Barrel Sling Index - with present flag */}
        {isPresent(data.barrel_sling_panel) && (
          <BarrelSlingCard data={{
            barrel_sling_score: data.barrel_sling_panel.barrel_sling_score,
            sling_load_score: data.barrel_sling_panel.sling_load_score,
            sling_start_score: data.barrel_sling_panel.sling_start_score,
            sling_deliver_score: data.barrel_sling_panel.sling_deliver_score,
            notes: data.barrel_sling_panel.notes,
            confidence: data.barrel_sling_panel.confidence,
          }} />
        )}
        
        {/* Drills - with present flag and items array */}
        {isPresent(data.drills) && getItems(data.drills).length > 0 && (
          <TrainingCard drills={getItems(data.drills)} />
        )}
        
        {/* Session History - with present flag and items array */}
        {isPresent(data.session_history) && getItems(data.session_history).length > 0 && (
          <ProgressBoard 
            history={getItems(data.session_history)} 
            badges={data.badges} 
          />
        )}
        
        {/* Coach Note - with present flag */}
        {isPresent(data.coach_note) && (
          <CoachNoteCard 
            note={{ 
              text: data.coach_note.text ?? '', 
              audio_url: data.coach_note.audio_url 
            }} 
          />
        )}
        
        <div className="h-8" />
      </div>
    </div>
  );
}
