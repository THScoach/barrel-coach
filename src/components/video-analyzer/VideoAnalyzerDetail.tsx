import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Video, 
  Play, 
  CheckCircle2, 
  Clock,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Zap,
  AlertCircle,
  Download
} from "lucide-react";
import { VideoPlayer } from "@/components/analyzer/VideoPlayer";
import { MomentumSequenceVisualizer } from "@/components/analyzer/MomentumSequenceVisualizer";
import { useAnalyzeVideoSwingSession } from "@/hooks/useAnalyzeVideoSwingSession";
import { cn } from "@/lib/utils";
import { 
  type MomentumOverlay, 
  generateMockOverlay 
} from "@/lib/momentum-overlay-types";
import type { Json } from "@/integrations/supabase/types";

interface VideoSwing {
  id: string;
  swing_index: number;
  video_storage_path: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  frame_rate: number | null;
  status: string;
  sequence_analysis: any;
  sequence_score: number | null;
}

interface VideoSwingSession {
  id: string;
  session_date: string;
  context: string;
  status: string;
  video_count: number;
  analyzed_count: number;
  momentum_overlays?: Json | null;
}

interface VideoAnalyzerDetailProps {
  sessionId: string;
  onBack: () => void;
}

export function VideoAnalyzerDetail({ sessionId, onBack }: VideoAnalyzerDetailProps) {
  const [session, setSession] = useState<VideoSwingSession | null>(null);
  const [swings, setSwings] = useState<VideoSwing[]>([]);
  const [selectedSwingIndex, setSelectedSwingIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  
  const { analyze, isAnalyzing, analyzingSessionId } = useAnalyzeVideoSwingSession();

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    setLoading(true);

    // Load session
    const { data: sessionData, error: sessionError } = await supabase
      .from('video_swing_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Error loading session:', sessionError);
      setLoading(false);
      return;
    }

    setSession(sessionData);

    // Load swings
    const { data: swingsData, error: swingsError } = await supabase
      .from('video_swings')
      .select('*')
      .eq('session_id', sessionId)
      .order('swing_index', { ascending: true });

    if (swingsError) {
      console.error('Error loading swings:', swingsError);
    } else {
      // Get fresh signed URLs for each swing
      const swingsWithUrls = await Promise.all(
        (swingsData || []).map(async (swing) => {
          if (swing.video_storage_path) {
            const { data: urlData } = await supabase.storage
              .from('swing-videos')
              .createSignedUrl(swing.video_storage_path, 3600);
            return { ...swing, video_url: urlData?.signedUrl || swing.video_url };
          }
          return swing;
        })
      );
      setSwings(swingsWithUrls);
    }

    setLoading(false);
  };

  const selectedSwing = swings[selectedSwingIndex];
  
  // Parse momentum overlay from session data
  const momentumOverlay = useMemo((): MomentumOverlay | null => {
    if (!session?.momentum_overlays) return null;
    try {
      // The overlay is stored as JSON in the database
      return session.momentum_overlays as unknown as MomentumOverlay;
    } catch {
      return null;
    }
  }, [session?.momentum_overlays]);

  const handleTimeUpdate = (time: number) => {
    setCurrentTimeMs(time * 1000);
  };

  const handlePrevSwing = () => {
    if (selectedSwingIndex > 0) {
      setSelectedSwingIndex(selectedSwingIndex - 1);
      setCurrentTimeMs(0);
    }
  };

  const handleNextSwing = () => {
    if (selectedSwingIndex < swings.length - 1) {
      setSelectedSwingIndex(selectedSwingIndex + 1);
      setCurrentTimeMs(0);
    }
  };

  const getContextLabel = (context: string) => {
    const labels: Record<string, string> = {
      practice: 'Practice',
      game: 'Game',
      cage: 'Cage Work',
      lesson: 'Lesson',
      other: 'Other',
    };
    return labels[context] || context;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Sessions
        </Button>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Loading session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Sessions
        </Button>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Session not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSessionAnalyzing = isAnalyzing && analyzingSessionId === sessionId;
  const isSessionAnalyzed = session.status === 'analyzed' || session.analyzed_count > 0;

  const handleAnalyze = async (forceRecompute = false) => {
    const result = await analyze(sessionId, forceRecompute);
    if (result?.success) {
      // Reload session data to get updated scores
      loadSessionData();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="font-semibold text-lg">
              {format(new Date(session.session_date), 'MMMM d, yyyy')}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                {getContextLabel(session.context)}
              </Badge>
              <span>•</span>
              <span>{session.video_count} videos</span>
              {isSessionAnalyzed && (
                <>
                  <span>•</span>
                  <Badge variant="default" className="bg-green-600 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Analyzed
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Analyze Button */}
        <div className="flex items-center gap-2">
          {isSessionAnalyzed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAnalyze(true)}
              disabled={isSessionAnalyzing}
            >
              {isSessionAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Re-analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Re-analyze
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => handleAnalyze(false)}
              disabled={isSessionAnalyzing || swings.length === 0}
            >
              {isSessionAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Sequence
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {swings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No videos in this session</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Video Player + Sequence Visualizer */}
          <div className="lg:col-span-2 space-y-4">
            {/* Swing Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevSwing}
                disabled={selectedSwingIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm font-medium">
                Swing {selectedSwingIndex + 1} of {swings.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextSwing}
                disabled={selectedSwingIndex === swings.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Video Player */}
            <Card>
              <CardContent className="p-4">
                {selectedSwing?.video_url ? (
                  <VideoPlayer
                    src={selectedSwing.video_url}
                    enableSAM3={true}
                    onTimeUpdate={handleTimeUpdate}
                    momentumOverlay={momentumOverlay}
                    enableMomentumOverlay={true}
                  />
                ) : (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">Video not available</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* No Momentum Overlay Note */}
            {!momentumOverlay && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <AlertCircle className="h-4 w-4 text-slate-400" />
                <span>No momentum overlay generated for this session yet. Overlays are created by KRS + SAM3 analysis.</span>
              </div>
            )}

            {/* Momentum Sequence Visualizer */}
            <MomentumSequenceVisualizer
              analysis={selectedSwing?.sequence_analysis || null}
              currentTimeMs={currentTimeMs}
              durationMs={videoDuration}
            />
          </div>

          {/* Swing List Sidebar */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground px-1">All Swings</h3>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {swings.map((swing, index) => (
                <Card
                  key={swing.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    index === selectedSwingIndex 
                      ? "border-primary bg-primary/5" 
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => {
                    setSelectedSwingIndex(index);
                    setCurrentTimeMs(0);
                  }}
                >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-8 w-8 rounded flex items-center justify-center text-xs font-medium",
                            index === selectedSwingIndex 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted"
                          )}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium">Swing {index + 1}</p>
                            <div className="flex items-center gap-1.5">
                              {swing.sequence_score !== null && (
                                <span className="text-xs text-muted-foreground">
                                  Score: {swing.sequence_score}
                                </span>
                              )}
                              {swing.frame_rate && swing.frame_rate >= 120 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-green-600/50 text-green-400">
                                  {swing.frame_rate}fps
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Download button for high-speed videos (120fps+) */}
                          {swing.frame_rate && swing.frame_rate >= 120 && swing.video_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Trigger download using the signed URL
                                const link = document.createElement('a');
                                link.href = swing.video_url!;
                                link.download = `swing-${swing.swing_index + 1}-${swing.frame_rate}fps.mp4`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              title={`Download ${swing.frame_rate}fps video for Reboot analysis`}
                            >
                              <Download className="h-3.5 w-3.5 text-green-400" />
                            </Button>
                          )}
                          {swing.status === 'analyzed' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
