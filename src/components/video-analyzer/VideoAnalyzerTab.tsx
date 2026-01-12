import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  Video, 
  Upload, 
  Play, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  BarChart3,
  Loader2,
  Sparkles
} from "lucide-react";
import { VideoSwingUploadModal } from "./VideoSwingUploadModal";
import { VideoAnalyzerDetail } from "./VideoAnalyzerDetail";
import { useAnalyzeVideoSwingSession } from "@/hooks/useAnalyzeVideoSwingSession";
import { cn } from "@/lib/utils";

interface VideoSwingSession {
  id: string;
  session_date: string;
  context: string;
  status: string;
  video_count: number;
  analyzed_count: number;
  created_at: string;
}

interface VideoAnalyzerTabProps {
  playerId: string; // Must be players.id
  playerName: string;
  source: 'player_upload' | 'admin_upload';
  className?: string;
}

export function VideoAnalyzerTab({ 
  playerId, 
  playerName, 
  source,
  className 
}: VideoAnalyzerTabProps) {
  const [sessions, setSessions] = useState<VideoSwingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  const { analyze, isAnalyzing, analyzingSessionId } = useAnalyzeVideoSwingSession();

  useEffect(() => {
    if (playerId) {
      loadSessions();
    }
  }, [playerId]);

  const loadSessions = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('video_swing_sessions')
      .select('*')
      .eq('player_id', playerId)
      .order('session_date', { ascending: false });

    if (error) {
      console.error('Error loading video sessions:', error);
    } else {
      setSessions(data || []);
    }
    
    setLoading(false);
  };

  const getStatusBadge = (status: string, analyzedCount: number, videoCount: number) => {
    if (status === 'analyzed' || analyzedCount === videoCount) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Analyzed
        </Badge>
      );
    }
    if (status === 'processing') {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1 animate-spin" />
          Processing
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <Clock className="h-3 w-3 mr-1" />
        Not analyzed
      </Badge>
    );
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

  // If a session is selected, show the detail view
  if (selectedSessionId) {
    return (
      <VideoAnalyzerDetail
        sessionId={selectedSessionId}
        onBack={() => setSelectedSessionId(null)}
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Video Analyzer</h3>
          <p className="text-sm text-muted-foreground">
            Upload swing videos for 4B sequence analysis
          </p>
        </div>
        <Button onClick={() => setUploadModalOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Swing Videos
        </Button>
      </div>

      {/* Guidance Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Video className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Get the most accurate analysis</p>
              <p className="text-muted-foreground mt-1">
                Upload 5–15 swings per session. Higher frame-rate (120–240 fps) improves timing and sequence accuracy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Loading sessions...</p>
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No video sessions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your first swing videos to get started with 4B analysis.
            </p>
            <Button 
              className="mt-4" 
              onClick={() => setUploadModalOpen(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Videos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const isThisSessionAnalyzing = isAnalyzing && analyzingSessionId === session.id;
            const isAnalyzed = session.status === 'analyzed' || session.analyzed_count === session.video_count;
            
            const handleAnalyzeClick = async (e: React.MouseEvent) => {
              e.stopPropagation();
              const result = await analyze(session.id, false);
              if (result?.success) {
                loadSessions();
              }
            };
            
            return (
              <Card 
                key={session.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedSessionId(session.id)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Video className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {format(new Date(session.session_date), 'MMM d, yyyy')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {getContextLabel(session.context)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {session.video_count} video{session.video_count !== 1 ? 's' : ''}
                          {session.analyzed_count > 0 && ` • ${session.analyzed_count} analyzed`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Analyze button for unanalyzed sessions */}
                      {!isAnalyzed && !isThisSessionAnalyzing && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleAnalyzeClick}
                          className="gap-1"
                        >
                          <Sparkles className="h-3 w-3" />
                          Analyze
                        </Button>
                      )}
                      {isThisSessionAnalyzing && (
                        <Button variant="secondary" size="sm" disabled className="gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Analyzing...
                        </Button>
                      )}
                      {getStatusBadge(session.status, session.analyzed_count, session.video_count)}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <VideoSwingUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        playerId={playerId}
        playerName={playerName}
        source={source}
        onSuccess={(sessionId) => {
          loadSessions();
          setSelectedSessionId(sessionId);
        }}
      />
    </div>
  );
}
