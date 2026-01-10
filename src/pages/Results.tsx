import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Activity, Zap, Target, Play, MessageCircle, ArrowRight, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/Logo";

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
}

interface AnalysisData {
  primary_problem: string;
  secondary_problems: string[] | null;
  coach_notes: string | null;
  motor_profile: string | null;
  recommended_drill_ids: string[] | null;
}

interface DrillVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
}

const categoryConfig = {
  brain: { label: 'Brain', subtitle: 'Timing', icon: Brain, color: 'text-blue-500', bg: 'bg-blue-500' },
  body: { label: 'Body', subtitle: 'Lower Half', icon: Activity, color: 'text-green-500', bg: 'bg-green-500' },
  bat: { label: 'Bat', subtitle: 'Mechanics', icon: Zap, color: 'text-red-500', bg: 'bg-red-500' },
  ball: { label: 'Ball', subtitle: 'Impact', icon: Target, color: 'text-orange-500', bg: 'bg-orange-500' }
};

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
        // Fetch public session data using RPC
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

        // Fetch analysis data
        const { data: analysisData } = await supabase
          .from('swing_analyses')
          .select('primary_problem, secondary_problems, coach_notes, motor_profile, recommended_drill_ids')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (analysisData) {
          setAnalysis(analysisData);

          // Fetch recommended drills
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

  const formatScore = (score: number | null) => {
    if (score === null) return '—';
    return (score / 10).toFixed(1);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold mb-2">{error || 'Results not found'}</h1>
        <p className="text-muted-foreground mb-6">This link may be invalid or expired.</p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  const isCompleteReview = session.product_type === 'complete_assessment';
  const firstName = session.player_name.split(' ')[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b py-4">
        <div className="container flex items-center justify-center">
          <Logo size="lg" />
        </div>
      </header>

      <main className="container py-8 max-w-3xl mx-auto px-4">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Hey {firstName}! 👋
          </h1>
          <p className="text-lg text-muted-foreground">
            Here's your Swing DNA Results
          </p>
        </div>

        {/* 4B Scores Card */}
        <Card className="mb-8 overflow-hidden">
          <CardContent className="p-6">
            <div className="grid grid-cols-4 gap-4 mb-6">
              {(['brain', 'body', 'bat', 'ball'] as const).map(category => {
                const config = categoryConfig[category];
                const score = session[`four_b_${category}` as keyof SessionData] as number | null;
                const isWeakest = session.weakest_category === category;
                
                return (
                  <div key={category} className="text-center">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${isWeakest ? 'bg-amber-500/20 ring-2 ring-amber-500' : 'bg-muted'}`}>
                      <config.icon className={`h-6 w-6 ${config.color}`} />
                    </div>
                    <div className={`text-2xl md:text-3xl font-bold ${getScoreColor(score)}`}>
                      {formatScore(score)}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">
                      {config.label}
                    </div>
                    {isWeakest && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        Focus Area
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="border-t pt-4 flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Overall Score</span>
              </div>
              <div className="text-right">
                <span className={`text-3xl font-bold ${getScoreColor(session.composite_score)}`}>
                  {formatScore(session.composite_score)}
                </span>
                <span className="text-muted-foreground"> / 10</span>
                {session.grade && (
                  <Badge className="ml-3" variant="secondary">
                    {session.grade}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Priority Issue */}
        {session.weakest_category && analysis?.primary_problem && (
          <Card className="mb-8 border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="bg-amber-500/20 rounded-full p-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg mb-1">
                    Your #1 Priority: {session.weakest_category.toUpperCase()} — {analysis.primary_problem.replace(/_/g, ' ')}
                  </h2>
                  <p className="text-muted-foreground">
                    This is the most important thing to fix right now. Focus here first.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coach Notes */}
        {analysis?.coach_notes && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Coach Rick's Notes
              </h2>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {analysis.coach_notes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Motor Profile (Complete Review) */}
        {isCompleteReview && analysis?.motor_profile && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="font-bold text-lg mb-2">Your Motor Profile</h2>
              <Badge className="text-lg px-4 py-1 capitalize">{analysis.motor_profile}</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Understanding your motor profile helps you train smarter, not harder.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recommended Drills */}
        {drills.length > 0 && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Your {drills.length === 1 ? 'Drill' : 'Drills'} to Fix It
              </h2>
              <div className="space-y-4">
                {drills.map(drill => (
                  <div key={drill.id} className="flex gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="relative w-24 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                      {drill.thumbnail_url ? (
                        <img src={drill.thumbnail_url} alt={drill.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{drill.title}</h3>
                      {drill.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{drill.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <Button className="w-full mt-4" asChild>
                <Link to="/library">
                  Watch Your Drills
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upsell (Single Swing only) */}
        {!isCompleteReview && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardContent className="p-6 text-center">
              <h2 className="font-bold text-xl mb-2">Want the Complete Analysis?</h2>
              <p className="text-muted-foreground mb-4">
                Get your full motor profile, 3-5 personalized drills, and detailed breakdown of all 4B categories.
              </p>
              <Button size="lg" asChild>
                <Link to="/analyze">
                  Upgrade to Complete Review — $60 more
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <div className="text-center text-muted-foreground">
          <p>Questions? Text Coach Rick anytime.</p>
        </div>
      </main>
    </div>
  );
}
