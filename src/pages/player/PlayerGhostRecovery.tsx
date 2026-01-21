/**
 * Ghost Session Recovery Page
 * Simple 2-question intake: Environment + Pitch Speed
 */
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Ghost, 
  Target, 
  Zap, 
  Loader2, 
  Check,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GhostSessionData {
  id: string;
  swing_count: number;
  avg_bat_speed: number | null;
  max_bat_speed: number | null;
  detected_at: string;
}

const ENVIRONMENTS = [
  { id: 'tee', label: 'Tee', emoji: '🎯', description: 'Stationary ball on tee' },
  { id: 'front_toss', label: 'Front Toss', emoji: '🤚', description: 'Soft toss from front' },
  { id: 'machine', label: 'Machine', emoji: '⚙️', description: 'Pitching machine' },
  { id: 'live', label: 'Live Pitch', emoji: '🔥', description: 'Live pitcher throwing' },
];

const SPEED_PRESETS = [40, 50, 60, 70, 80, 90];

export default function PlayerGhostRecovery() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ghostId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ghostSession, setGhostSession] = useState<GhostSessionData | null>(null);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [pitchSpeed, setPitchSpeed] = useState<number>(50);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (ghostId) {
      loadGhostSession();
    } else {
      setLoading(false);
    }
  }, [ghostId]);

  const loadGhostSession = async () => {
    const { data, error } = await supabase
      .from('ghost_sessions')
      .select('id, swing_count, avg_bat_speed, max_bat_speed, detected_at')
      .eq('id', ghostId)
      .eq('status', 'pending')
      .single();

    if (error || !data) {
      toast.error("Ghost session not found or already recovered");
      setLoading(false);
      return;
    }

    setGhostSession(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!ghostId || !environment) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('recover-ghost-session', {
        body: {
          ghostSessionId: ghostId,
          environment,
          estimatedPitchSpeed: pitchSpeed,
        }
      });

      if (error) throw error;

      setResult(data);
      toast.success("Your 4B Report is ready! 🎉");
    } catch (err) {
      console.error('Recovery error:', err);
      toast.error("Failed to recover session. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your swings...</p>
        </div>
      </div>
    );
  }

  if (!ghostSession && !result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <Ghost className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">No Ghost Session Found</h2>
            <p className="text-muted-foreground mb-6">
              This session may have already been recovered or the link is invalid.
            </p>
            <Button onClick={() => navigate('/player/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-primary/30">
          <CardContent className="pt-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-primary" />
            </div>
            
            <div>
              <h2 className="text-2xl font-black text-white mb-2">4B Report Complete! 🎉</h2>
              <p className="text-muted-foreground">
                {result.swing_count} swings analyzed
              </p>
            </div>

            {/* Score Display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400 uppercase">Overall</p>
                <p className="text-3xl font-black text-primary">{result.scores.composite}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400 uppercase">Projected EV</p>
                <p className="text-3xl font-black text-white">{result.projected_ev}</p>
                <p className="text-xs text-slate-500">mph</p>
              </div>
            </div>

            {/* 4B Breakdown */}
            <div className="grid grid-cols-4 gap-2">
              {['brain', 'body', 'bat', 'ball'].map(cat => (
                <div 
                  key={cat}
                  className={cn(
                    "rounded-lg p-2 text-center",
                    result.scores.weakest_link === cat 
                      ? "bg-primary/20 border border-primary/50" 
                      : "bg-slate-800/30"
                  )}
                >
                  <p className="text-[10px] text-slate-400 uppercase">{cat}</p>
                  <p className="text-lg font-bold text-white">{result.scores[cat]}</p>
                </div>
              ))}
            </div>

            {result.leaks?.length > 0 && (
              <div className="flex justify-center gap-2">
                {result.leaks.map((leak: string) => (
                  <Badge key={leak} variant="outline" className="border-primary/50 text-primary">
                    {leak.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            )}

            <Button 
              onClick={() => navigate('/player/ghost-lab')}
              className="w-full bg-primary hover:bg-primary/90"
            >
              View Full Report
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-primary/30">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Ghost className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl font-black">
            I Caught Your Swings! 👻
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Give me 5 seconds of info so I can finish your 4B Report
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Session Summary */}
          <div className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Swings Detected</p>
              <p className="text-2xl font-bold text-white">{ghostSession?.swing_count}</p>
            </div>
            {ghostSession?.max_bat_speed && (
              <div className="text-right">
                <p className="text-sm text-slate-400">Max Bat Speed</p>
                <p className="text-2xl font-bold text-primary">{ghostSession.max_bat_speed} mph</p>
              </div>
            )}
          </div>

          {/* Step 1: Environment Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                What was the setup? 🎯
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {ENVIRONMENTS.map(env => (
                  <button
                    key={env.id}
                    onClick={() => {
                      setEnvironment(env.id);
                      // Auto-advance to step 2 if not tee
                      if (env.id !== 'tee') {
                        setStep(2);
                      } else {
                        // Tee = 0 pitch speed
                        setPitchSpeed(0);
                        handleSubmit();
                      }
                    }}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all text-left",
                      environment === env.id
                        ? "border-primary bg-primary/10"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                    )}
                  >
                    <span className="text-3xl block mb-2">{env.emoji}</span>
                    <span className="font-semibold text-white block">{env.label}</span>
                    <span className="text-xs text-slate-400">{env.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Pitch Speed */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  How fast was the ball? ⚡
                </Label>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                  Back
                </Button>
              </div>
              
              {/* Speed Presets */}
              <div className="grid grid-cols-3 gap-2">
                {SPEED_PRESETS.map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPitchSpeed(speed)}
                    className={cn(
                      "py-3 rounded-lg border-2 font-bold transition-all",
                      pitchSpeed === speed
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-slate-700 bg-slate-800/50 text-white hover:border-slate-600"
                    )}
                  >
                    {speed} mph
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Or enter:</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={pitchSpeed}
                  onChange={(e) => setPitchSpeed(parseInt(e.target.value) || 0)}
                  className="w-24 text-center font-bold"
                />
                <span className="text-sm text-slate-400">mph</span>
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={submitting || !environment}
                className="w-full bg-primary hover:bg-primary/90 font-bold py-6 text-lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Generate My 4B Report
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
