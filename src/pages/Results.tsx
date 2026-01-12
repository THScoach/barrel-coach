import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Brain, Activity, Zap, Target, Play, MessageCircle, ArrowRight, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { FourBScoreCard } from "@/components/FourBScoreCard";
import { TrainingSwingVisualizer } from "@/components/TrainingSwingVisualizer";
import { LeakType } from "@/lib/reboot-parser";
interface SessionData {
  id: string;
  player_name: string;
  composite_score: number | null;
  grade: string | null;
  four_b_brain: number | null;
  four_b_body: number | null;
  four_b_bat: number | null;
  four_b_ball: number | null;
  weakest_category: string | null;
  product_type: string;
  status: string;
  // Privacy-safe fields for Training Visualizer
  swing_count: number | null;
  has_contact_event: boolean | null;
  leak_type: string | null;
}

interface AnalysisData {
  primary_problem: string;
  secondary_problems: string[] | null;
  coach_notes: string | null;
  motor_profile: string | null;
  recommended_drill_ids: string[] | null;
  leak_type?: string | null;
}

interface DrillVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
}

// Map primary problem string to LeakType for legacy data
function mapProblemToLeak(problem: string): LeakType {
  const normalized = problem.toLowerCase().replace(/[\s_-]+/g, '_');
  
  if (normalized.includes('early') && normalized.includes('back')) {
    return LeakType.EARLY_BACK_LEG_RELEASE;
  }
  if (normalized.includes('late') && normalized.includes('lead')) {
    return LeakType.LATE_LEAD_LEG_ACCEPTANCE;
  }
  if (normalized.includes('vertical') || normalized.includes('push')) {
    return LeakType.VERTICAL_PUSH;
  }
  if (normalized.includes('glide') || normalized.includes('drift')) {
    return LeakType.GLIDE_WITHOUT_CAPTURE;
  }
  if (normalized.includes('late') && (normalized.includes('engine') || normalized.includes('timing'))) {
    return LeakType.LATE_ENGINE;
  }
  if (normalized.includes('core') || normalized.includes('disconnect') || normalized.includes('sequence')) {
    return LeakType.CORE_DISCONNECT;
  }
  if (normalized.includes('clean') || normalized.includes('good')) {
    return LeakType.CLEAN_TRANSFER;
  }
  
  return LeakType.UNKNOWN;
}

export default function Results() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [drills, setDrills] = useState<DrillVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResults() {
      if (!sessionId) {
        setError('Invalid session');
        setLoading(false);
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase
          .rpc('get_session_public_data', { session_id_param: sessionId });

        if (sessionError || !sessionData || sessionData.length === 0) {
          setError('Results not found');
          setLoading(false);
          return;
        }

        const sess = sessionData[0];
        if (sess.status !== 'complete') {
          setError('Results not ready yet');
          setLoading(false);
          return;
        }

        setSession(sess);

        const { data: analysisData } = await supabase
          .from('swing_analyses')
          .select('primary_problem, secondary_problems, coach_notes, motor_profile, recommended_drill_ids')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (analysisData) {
          setAnalysis(analysisData);
          if (analysisData.recommended_drill_ids?.length) {
            const { data: drillsData } = await supabase
              .from('drill_videos')
              .select('id, title, description, video_url, thumbnail_url, duration_seconds')
              .in('id', analysisData.recommended_drill_ids)
              .eq('status', 'published');
            setDrills(drillsData || []);
          }
        }
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('Failed to load results');
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-red-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="h-8 w-8 text-slate-500" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{error || 'Results not found'}</h1>
        <p className="text-slate-400 mb-6">This link may be invalid or expired.</p>
        <Button asChild className="bg-red-500 hover:bg-red-600 text-white">
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  const isCompleteReview = session.product_type === 'complete_assessment';
  const firstName = session.player_name.split(' ')[0];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <Logo size="lg" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-8 px-4">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full text-slate-300 text-sm mb-4">
            Hey {firstName}! 👋
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Here's your Swing DNA Results
          </h1>
        </div>

        {/* Training Visualizer - Always render, defaults to UNKNOWN when no leak type */}
        <TrainingSwingVisualizer
          leakType={mapProblemToLeak(session.leak_type ?? analysis?.primary_problem ?? 'UNKNOWN')}
          swingCount={session.swing_count ?? undefined}
          hasContactEvent={session.has_contact_event ?? undefined}
        />

        {/* 4B Score Card - Shows HOW the swing grades */}
        <div className="mb-8">
          <FourBScoreCard
            brainScore={session.four_b_brain}
            bodyScore={session.four_b_body}
            batScore={session.four_b_bat}
            ballScore={session.four_b_ball}
            compositeScore={session.composite_score}
            grade={session.grade}
            weakestCategory={session.weakest_category}
            primaryProblem={analysis?.primary_problem}
          />
        </div>

        {/* Coach Notes */}
        {analysis?.coach_notes && (
          <Card className="mb-8 bg-slate-900/80 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-red-400" />
                </div>
                <h2 className="font-bold text-lg text-white">Coach Rick's Notes</h2>
              </div>
              <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                {analysis.coach_notes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Motor Profile (Complete Review) */}
        {isCompleteReview && analysis?.motor_profile && (
          <Card className="mb-8 bg-slate-900/80 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Brain className="h-5 w-5 text-blue-400" />
                </div>
                <h2 className="font-bold text-lg text-white">Your Motor Profile</h2>
              </div>
              <p className="text-xl font-semibold text-white capitalize mb-2">
                {analysis.motor_profile}
              </p>
              <p className="text-sm text-slate-400">
                Understanding your motor profile helps you train smarter, not harder.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recommended Drills */}
        {drills.length > 0 && (
          <div className="mb-8">
            <h2 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-red-500" />
              Your {drills.length === 1 ? 'Drill' : 'Drills'} to Fix It
            </h2>
            <div className="space-y-3">
              {drills.map(drill => (
                <Card key={drill.id} className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {drill.thumbnail_url ? (
                        <img src={drill.thumbnail_url} alt={drill.title} className="w-24 h-16 object-cover rounded-lg flex-shrink-0" />
                      ) : (
                        <div className="w-24 h-16 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Play className="h-6 w-6 text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white">{drill.title}</h3>
                        {drill.description && (
                          <p className="text-sm text-slate-400 line-clamp-2">{drill.description}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button className="w-full mt-4 bg-red-500 hover:bg-red-600 text-white" asChild>
              <Link to="/library">
                <Play className="h-4 w-4 mr-2" />
                Watch Your Drills
              </Link>
            </Button>
          </div>
        )}

        {/* Upsell (Single Swing / Free Diagnostic) */}
        {!isCompleteReview && (
          <Card className="mb-8 bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
                Free Snapshot Complete
              </div>
              <h2 className="font-bold text-xl text-white mb-2">Unlock Full KRS Report & Coaching</h2>
              <p className="text-slate-300 mb-6">
                This is just the snapshot. Get your full motor profile, weekly live calls with Rick, 
                personalized drill prescriptions, and ongoing feedback to actually fix what's broken.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" className="bg-red-500 hover:bg-red-600 text-white" asChild>
                  <Link to="/coaching">
                    Start Coaching — $99/mo
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800" asChild>
                  <Link to="/assessment">
                    In-Person Assessment — $299
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <h3 className="font-medium text-white">Questions?</h3>
              <p className="text-slate-400">Text Coach Rick anytime.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
