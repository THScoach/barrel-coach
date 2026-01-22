import { useState } from "react";
import { SessionControl } from "@/components/session/SessionControl";
import { SwingAnalysisReport } from "@/components/session/SwingAnalysisReport";
import { CaptureSession, SwingMetrics } from "@/services/CatchingBarrelsService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Activity, 
  History,
  BarChart3,
  Trophy
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";

interface CapturedSwingData {
  swingNumber: number;
  metrics: SwingMetrics;
  videoUrl: string | null;
}

export default function Session() {
  const navigate = useNavigate();
  const [capturedSwings, setCapturedSwings] = useState<CapturedSwingData[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [completedSession, setCompletedSession] = useState<CaptureSession | null>(null);

  const handleSwingCaptured = (swing: CapturedSwingData) => {
    setCapturedSwings(prev => [...prev, swing]);
  };

  const handleSessionEnd = (session: CaptureSession) => {
    setCompletedSession(session);
    setSessionEnded(true);
  };

  const handleNewSession = () => {
    setCapturedSwings([]);
    setSessionEnded(false);
    setCompletedSession(null);
  };

  // Calculate session averages
  const getSessionAverages = () => {
    if (capturedSwings.length === 0) return null;
    
    const avg = {
      batSpeed: 0,
      attackAngle: 0,
      handSpeed: 0,
      timeToContact: 0,
      tempoScore: 0,
      efficiency: 0,
    };
    
    capturedSwings.forEach(swing => {
      avg.batSpeed += swing.metrics.bat_speed_mph;
      avg.attackAngle += swing.metrics.attack_angle_deg;
      avg.handSpeed += swing.metrics.hand_speed_mph;
      avg.timeToContact += swing.metrics.time_to_contact_ms;
      avg.tempoScore += swing.metrics.tempo_score;
      avg.efficiency += swing.metrics.efficiency_rating;
    });
    
    const count = capturedSwings.length;
    return {
      batSpeed: Math.round(avg.batSpeed / count * 10) / 10,
      attackAngle: Math.round(avg.attackAngle / count * 10) / 10,
      handSpeed: Math.round(avg.handSpeed / count * 10) / 10,
      timeToContact: Math.round(avg.timeToContact / count),
      tempoScore: Math.round(avg.tempoScore / count),
      efficiency: Math.round(avg.efficiency / count * 10) / 10,
    };
  };

  const averages = getSessionAverages();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Logo size="sm" />
              <span className="font-semibold">Capture Session</span>
            </div>
            {capturedSwings.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Activity className="w-3 h-3" />
                {capturedSwings.length} swings
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 pb-24">
        {sessionEnded ? (
          /* Session Summary View */
          <div className="space-y-6">
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Session Complete!</h1>
              <p className="text-muted-foreground">
                {capturedSwings.length} swings captured and analyzed
              </p>
            </div>

            {/* Session Averages */}
            {averages && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Session Averages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{averages.batSpeed}</p>
                      <p className="text-xs text-muted-foreground">Avg Bat Speed (mph)</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{averages.tempoScore}</p>
                      <p className="text-xs text-muted-foreground">Avg Tempo Score</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{averages.efficiency}</p>
                      <p className="text-xs text-muted-foreground">Avg Efficiency</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Swing History */}
            <Tabs defaultValue="swings" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="swings">Individual Swings</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
              </TabsList>
              
              <TabsContent value="swings" className="mt-4">
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-4 pr-4">
                    {capturedSwings.map((swing, idx) => (
                      <SwingAnalysisReport
                        key={idx}
                        swingNumber={swing.swingNumber}
                        metrics={swing.metrics}
                        videoUrl={swing.videoUrl}
                        showRecommendations={false}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="summary" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Total Swings</span>
                        <span className="font-bold">{capturedSwings.length}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Best Bat Speed</span>
                        <span className="font-bold">
                          {Math.max(...capturedSwings.map(s => s.metrics.bat_speed_mph))} mph
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Best Tempo Score</span>
                        <span className="font-bold">
                          {Math.max(...capturedSwings.map(s => s.metrics.tempo_score))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground">Dominant Motor Profile</span>
                        <Badge>
                          {getMostFrequentProfile(capturedSwings)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* New Session Button */}
            <Button 
              size="lg" 
              className="w-full h-14"
              onClick={handleNewSession}
            >
              Start New Session
            </Button>
          </div>
        ) : (
          /* Active Session View */
          <div className="space-y-6">
            {/* Session Control */}
            <SessionControl
              onSwingCaptured={handleSwingCaptured}
              onSessionEnd={handleSessionEnd}
            />

            {/* Recent Swings */}
            {capturedSwings.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-medium">Recent Swings</h3>
                </div>
                <ScrollArea className="h-[40vh]">
                  <div className="space-y-4 pr-4">
                    {[...capturedSwings].reverse().slice(0, 5).map((swing, idx) => (
                      <SwingAnalysisReport
                        key={idx}
                        swingNumber={swing.swingNumber}
                        metrics={swing.metrics}
                        videoUrl={swing.videoUrl}
                        showRecommendations={false}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Helper function to get most frequent motor profile
function getMostFrequentProfile(swings: CapturedSwingData[]): string {
  const counts: Record<string, number> = {};
  swings.forEach(swing => {
    const profile = swing.metrics.motor_profile_prediction;
    counts[profile] = (counts[profile] || 0) + 1;
  });
  
  let maxCount = 0;
  let mostFrequent = 'UNKNOWN';
  Object.entries(counts).forEach(([profile, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = profile;
    }
  });
  
  return mostFrequent;
}
