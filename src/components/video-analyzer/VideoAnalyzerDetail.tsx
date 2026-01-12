import { useState, useEffect } from "react";
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
  ChevronRight
} from "lucide-react";
import { VideoPlayer } from "@/components/analyzer/VideoPlayer";
import { MomentumSequenceVisualizer } from "@/components/analyzer/MomentumSequenceVisualizer";
import { cn } from "@/lib/utils";

interface VideoSwing {
  id: string;
  swing_index: number;
  video_storage_path: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            </div>
          </div>
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
                  />
                ) : (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">Video not available</p>
                  </div>
                )}
              </CardContent>
            </Card>

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
                          {swing.sequence_score !== null && (
                            <p className="text-xs text-muted-foreground">
                              Score: {swing.sequence_score}
                            </p>
                          )}
                        </div>
                      </div>
                      {swing.status === 'analyzed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
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
