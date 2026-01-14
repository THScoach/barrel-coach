import { useParams } from 'react-router-dom';
import { mockReportData } from '@/lib/mock-report-data';
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

export default function SwingReport() {
  const { sessionId } = useParams<{ sessionId: string }>();
  
  // TODO: Replace with real data fetch using sessionId
  const data = mockReportData;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Mobile-first container */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Page title */}
        <h1 className="text-lg font-semibold text-slate-400 text-center">
          Swing Report
        </h1>

        {/* 1. Header Card */}
        <ReportHeader session={data.session} />

        {/* 2. Scoreboard Card */}
        <ScoreboardCard scores={data.scores} />

        {/* 3. Kinetic Potential Card */}
        <PotentialVsExpressionCard potential={data.kineticPotential} />

        {/* 4. Primary Leak Card */}
        <LeakCard leak={data.primaryLeak} />

        {/* 5. Fix Order Card */}
        <FixOrderChecklist 
          items={data.fixOrder} 
          doNotChase={data.doNotChase} 
        />

        {/* 6. Square-Up Window Card (Conditional) */}
        {data.squareUpWindow?.present && (
          <HeatmapCard data={data.squareUpWindow} />
        )}

        {/* 7. Diamond Kinetics Panel (Conditional) */}
        {data.diamondKinetics?.present && (
          <MetricsChipsPanel data={data.diamondKinetics} />
        )}

        {/* 8. Ball Outcome Panel (Conditional) */}
        {data.ballData?.present && (
          <BallOutcomePanel data={data.ballData} />
        )}

        {/* 9. This Week's Training Card */}
        <TrainingCard drills={data.drills} />

        {/* 10. Progress Board Card */}
        <ProgressBoard 
          history={data.sessionHistory} 
          badges={data.badges} 
        />

        {/* 11. Coach Note Card */}
        <CoachNoteCard note={data.coachNote} />

        {/* Footer spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
}
