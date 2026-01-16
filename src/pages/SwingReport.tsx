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
  LeakCard,
  FixOrderChecklist,
  TrainingCard,
  FourBScoreboardExpanded,
} from '@/components/report';
import { MotorProfileCard } from '@/components/report/MotorProfileCard';
import type { UnifiedMetrics, LeadLegBraking, FreemanComparison, MotorProfile, DataSource, ViewerTier } from '@/lib/unified-metrics-types';

// ============================================================================
// MOCK DATA - Unified metrics that feed the 4B calculations
// ============================================================================
const mockUnifiedData = {
  data_source: '2d_video' as DataSource,
  viewer_tier: 'krs' as ViewerTier,
  unified_metrics: {
    present: true,
    load_sequence: { raw: '+67ms', value: 67, score_20_80: 62, grade: '60' as const, grade_label: 'Above Average' as const },
    tempo: { raw: '2.3:1', value: 2.3, score_20_80: 58, grade: '55' as const, grade_label: 'Average' as const },
    separation: { raw: '14°', value: 14, score_20_80: 48, grade: '50' as const, grade_label: 'Fringe' as const },
    sync_score: { raw: '55', value: 55, score_20_80: 55, grade: '55' as const, grade_label: 'Average' as const },
    composite: { raw: '56', value: 56, score_20_80: 56, grade: '55' as const, grade_label: 'Average' as const }
  } as UnifiedMetrics,
  lead_leg_braking: {
    present: true,
    brace_timing_ms: 15,
    brace_timing_status: 'on_time' as const,
    knee_angle_at_ffs: 142,
    knee_angle_at_contact: 168,
    knee_extension_range: 26,
    confidence: 'estimated' as const,
    interpretation: 'Borderline timing. Lead leg braces about the same time as hip peak.'
  } as LeadLegBraking,
  freeman_comparison: {
    present: true,
    load_sequence: { player_value: 67, player_raw: '+67ms', benchmark_value: 75, benchmark_raw: '+75ms', status: 'similar' as const },
    tempo: { player_value: 2.3, player_raw: '2.3:1', benchmark_value: 2.1, benchmark_raw: '2.1:1', status: 'similar' as const },
    separation: { player_value: 14, player_raw: '14°', benchmark_value: 26, benchmark_raw: '26°', status: 'room_to_grow' as const }
  } as FreemanComparison,
  motor_profile: {
    present: true,
    suggested: 'spinner' as const,
    confidence: 'hint' as const,
    reasoning: 'Based on your rotation-dominant load pattern.',
    characteristics: [
      'Rotation-dominant energy transfer',
      'Quick hip turn initiates the swing',
      'Benefits from rotational drills'
    ]
  } as MotorProfile,
  // BAT and BALL scores from existing data sources
  bat_score: 58,
  ball_score: 52
};

// ============================================================================
// ENV SWITCH: Toggle between mock data and real edge function
// ============================================================================
const USE_EDGE_FUNCTION = import.meta.env.VITE_USE_EDGE_FUNCTION === 'true';

async function fetchReport(sessionId: string): Promise<SwingReportData> {
  if (!USE_EDGE_FUNCTION) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      ...mockReportData,
      generated_at: new Date().toISOString(),
      session: {
        ...mockReportData.session,
        id: sessionId,
      },
    };
  }

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

  return await response.json();
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
                <Skeleton key={i} className="h-12 w-full bg-slate-800 rounded-lg" />
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

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
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <h1 className="text-lg font-semibold text-slate-400 text-center">Swing Report</h1>
        
        {/* 1. Header - Player info and session details */}
        <ReportHeader session={data.session} />
        
        {/* 2. 4B Scoreboard with expandable details */}
        <FourBScoreboardExpanded 
          unifiedMetrics={mockUnifiedData.unified_metrics}
          leadLegBraking={mockUnifiedData.lead_leg_braking}
          freemanComparison={mockUnifiedData.freeman_comparison}
          dataSource={mockUnifiedData.data_source}
          batScore={mockUnifiedData.bat_score}
          ballScore={mockUnifiedData.ball_score}
        />
        
        {/* 3. Primary Leak */}
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
        
        {/* 4. Fix Order Checklist */}
        {isPresent(data.fix_order) && getItems(data.fix_order).length > 0 && (
          <FixOrderChecklist 
            items={getItems(data.fix_order)} 
            doNotChase={data.fix_order.do_not_chase ?? []} 
          />
        )}
        
        {/* 5. Motor Profile */}
        <MotorProfileCard 
          profile={mockUnifiedData.motor_profile} 
          viewerTier={mockUnifiedData.viewer_tier} 
        />
        
        {/* 6. Drills Section */}
        {isPresent(data.drills) && getItems(data.drills).length > 0 && (
          <TrainingCard drills={getItems(data.drills)} />
        )}
        
        <div className="h-8" />
      </div>
    </div>
  );
}
