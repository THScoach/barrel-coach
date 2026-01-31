import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { LabReportData } from '@/lib/lab-report-types';
import type { KineticFingerprintResult } from '@/lib/kinetic-fingerprint-score';
import {
  ReportHeader,
  ReportFooter,
  FourBScoreboardV2,
  StructureCard,
  TimingCard,
  DirectionCard,
  EntryAngleCard,
  MotorProfileCardV2,
  EnergyLeakCard,
  PrescriptionCard,
  KineticFingerprintScoreCard,
  MLBComparisonCard,
} from '@/components/lab-report';

// ============================================================================
// Fetch report from edge function
// ============================================================================

async function fetchReport(sessionId: string): Promise<LabReportData> {
  const { data, error } = await supabase.functions.invoke('get-report', {
    body: { sessionId },
  });

  if (error) throw new Error(error.message || 'Failed to fetch report');
  return data;
}

function ReportSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-40 w-full bg-slate-800 rounded-lg" />
        <Skeleton className="h-6 w-32 mx-auto bg-slate-800" />
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-6 w-40 bg-slate-800" />
            <Skeleton className="h-4 w-32 bg-slate-800" />
          </CardContent>
        </Card>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <Skeleton className="h-24 w-full bg-slate-800" />
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

// Convert LabReportData KF score to KineticFingerprintResult for components
function convertKFScore(kfData?: LabReportData['kinetic_fingerprint']): KineticFingerprintResult | null {
  if (!kfData) return null;
  
  return {
    total: kfData.total,
    rating: kfData.rating,
    color: kfData.color,
    flags: kfData.flags,
    components: kfData.components,
  };
}

// ============================================================================
// MAIN COMPONENT - Lab Report v2.0
// ============================================================================

export default function SwingReport() {
  const { sessionId } = useParams<{ sessionId: string }>();
  
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['lab-report', sessionId],
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

  const kfScore = convertKFScore(data.kinetic_fingerprint);
  const mlbMatch = data.motor_profile?.mlb_match;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 1. Header - Player info, KF Score, Motor Profile */}
        <ReportHeader 
          session={data.session}
          kfScore={kfScore || undefined}
          motorProfile={data.motor_profile?.profile}
          mlbMatch={mlbMatch?.player_name}
        />
        
        {/* 2. Structure (Anthropometrics) */}
        {data.structure?.present && <StructureCard structure={data.structure} />}
        
        {/* 3. Kinetic Fingerprint Score Breakdown */}
        {kfScore && <KineticFingerprintScoreCard kfScore={kfScore} />}
        
        {/* 4. Timing Analysis */}
        {data.timing?.present && <TimingCard timing={data.timing} />}
        
        {/* 5. Motor Profile */}
        {data.motor_profile?.present && <MotorProfileCardV2 motorProfile={data.motor_profile} />}
        
        {/* 6. Direction Analysis */}
        {data.direction?.present && <DirectionCard direction={data.direction} />}
        
        {/* 7. Entry Angle */}
        {data.entry_angle?.present && <EntryAngleCard entryAngle={data.entry_angle} />}
        
        {/* 8. Energy Leak Report */}
        {data.energy_leak?.present && <EnergyLeakCard energyLeak={data.energy_leak} />}
        
        {/* 9. Coaching Prescription */}
        {data.prescription?.present && <PrescriptionCard prescription={data.prescription} />}
        
        {/* 10. MLB Comparison */}
        {kfScore && mlbMatch && (
          <MLBComparisonCard 
            playerKfScore={kfScore}
            mlbMatch={mlbMatch}
            playerProfile={data.motor_profile?.profile}
          />
        )}
        
        {/* 11. 4B Scoreboard (Secondary) */}
        <FourBScoreboardV2 scores={data.scores} />
        
        {/* 12. Report Footer */}
        <ReportFooter />
      </div>
    </div>
  );
}
