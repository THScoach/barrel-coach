/**
 * ADMIN SESSION VIEW PAGE
 * 
 * View all swings in a session:
 * - Grid of swing thumbnails
 * - Each swing shows 2D analysis status
 * - Click to expand video + scores
 * - Import Reboot 3D data button
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Loader2,
  Sparkles,
  AlertCircle,
  Box,
  Camera,
  Link2,
  Grid3X3,
  List,
  User
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { RebootCsvImportModal } from "@/components/video-analyzer/RebootCsvImportModal";
import { useAnalyzeVideoSwingSession } from "@/hooks/useAnalyzeVideoSwingSession";
import { cn } from "@/lib/utils";

interface VideoSwing {
  id: string;
  swing_index: number;
  video_storage_path: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  status: string;
  sequence_analysis: any;
  sequence_score: number | null;
  frame_rate: number | null;
}

interface VideoSwingSession {
  id: string;
  player_id: string;
  session_date: string;
  context: string;
  status: string;
  video_count: number;
  analyzed_count: number;
  reboot_imported?: boolean;
  players?: { name: string; team: string | null } | null;
}

export default function AdminSessionView() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<VideoSwingSession | null>(null);
  const [swings, setSwings] = useState<VideoSwing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSwing, setSelectedSwing] = useState<VideoSwing | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [rebootImportOpen, setRebootImportOpen] = useState(false);
  
  const { analyze, isAnalyzing, analyzingSessionId } = useAnalyzeVideoSwingSession();

  useEffect(() => {
    if (sessionId) {
      loadSessionData();
    }
  }, [sessionId]);

  const loadSessionData = async () => {
    if (!sessionId) return;
    
    setLoading(true);

    // Load session with player info
    const { data: sessionData, error: sessionError } = await supabase
      .from('video_swing_sessions')
      .select(`
        *,
        players:player_id (name, team)
      `)
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

  const handleAnalyze = async (forceRecompute = false) => {
    if (!sessionId) return;
    
    const result = await analyze(sessionId, forceRecompute);
    if (result?.success) {
      loadSessionData();
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

  const getSwingStatusBadge = (swing: VideoSwing) => {
    if (swing.status === 'analyzed' || swing.sequence_score !== null) {
      return (
        <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Analyzed
        </Badge>
      );
    }
    if (swing.status === 'processing' || swing.status === 'analyzing') {
      return (
        <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Processing
        </Badge>
      );
    }
    if (swing.status === 'error') {
      return (
        <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
          <AlertCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <main className="container py-6">
          <Button variant="ghost" onClick={() => navigate('/admin/analyzer')} className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Analyzer
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading session...</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <main className="container py-6">
          <Button variant="ghost" onClick={() => navigate('/admin/analyzer')} className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Analyzer
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Session not found</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const isSessionAnalyzing = isAnalyzing && analyzingSessionId === sessionId;
  const isSessionAnalyzed = session.status === 'analyzed' || session.analyzed_count > 0;
  const analyzedSwings = swings.filter(s => s.status === 'analyzed' || s.sequence_score !== null);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="container py-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <Button variant="ghost" onClick={() => navigate('/admin/analyzer')} className="gap-2 mb-2 -ml-3">
              <ArrowLeft className="h-4 w-4" />
              Back to Analyzer
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {format(new Date(session.session_date), 'MMMM d, yyyy')}
              </h1>
              <Badge variant="outline">
                {getContextLabel(session.context)}
              </Badge>
            </div>
            {session.players && (
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <User className="h-4 w-4" />
                <span>{session.players.name}</span>
                {session.players.team && (
                  <span className="text-sm">({session.players.team})</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
              <span>{session.video_count} videos</span>
              <span>•</span>
              <span>{analyzedSwings.length} analyzed</span>
              {/* 2D Status */}
              {isSessionAnalyzed ? (
                <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                  <Camera className="h-3 w-3 mr-1" />
                  2D Complete
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  2D Pending
                </Badge>
              )}
              {/* 3D Status */}
              {session.reboot_imported ? (
                <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                  <Box className="h-3 w-3 mr-1" />
                  3D Imported
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  <Box className="h-3 w-3 mr-1" />
                  3D Not Imported
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Toggle */}
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Import 3D */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRebootImportOpen(true)}
              className={cn(
                session.reboot_imported && "border-green-500/50 text-green-400 hover:text-green-300"
              )}
            >
              <Link2 className="h-4 w-4 mr-2" />
              {session.reboot_imported ? 'Re-import 3D' : 'Import 3D Data'}
            </Button>

            {/* 2D Analysis */}
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
                    Re-analyze All
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
                    Run 2D Analysis
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Swings Display */}
        {swings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No videos in this session</p>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {swings.map((swing, index) => (
              <Card
                key={swing.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg overflow-hidden group",
                  selectedSwing?.id === swing.id && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedSwing(selectedSwing?.id === swing.id ? null : swing)}
              >
                <div className="aspect-video bg-muted relative">
                  {swing.thumbnail_url ? (
                    <img
                      src={swing.thumbnail_url}
                      alt={`Swing ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-10 w-10 text-white" />
                  </div>
                  {/* Swing number */}
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded">
                    #{index + 1}
                  </div>
                  {/* Score badge */}
                  {swing.sequence_score !== null && (
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded">
                      {swing.sequence_score}
                    </div>
                  )}
                </div>
                <CardContent className="p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Swing {index + 1}</span>
                    {getSwingStatusBadge(swing)}
                  </div>
                  {swing.frame_rate && (
                    <span className="text-xs text-muted-foreground">
                      {swing.frame_rate}fps
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* List View */
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {swings.map((swing, index) => (
                  <div
                    key={swing.id}
                    className={cn(
                      "flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                      selectedSwing?.id === swing.id && "bg-muted"
                    )}
                    onClick={() => setSelectedSwing(selectedSwing?.id === swing.id ? null : swing)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Swing {index + 1}</span>
                        {swing.frame_rate && (
                          <Badge variant="outline" className="text-xs">
                            {swing.frame_rate}fps
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {swing.video_storage_path?.split('/').pop() || 'Video'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {swing.sequence_score !== null && (
                        <div className="text-right">
                          <p className="text-2xl font-bold">{swing.sequence_score}</p>
                          <p className="text-xs text-muted-foreground">Score</p>
                        </div>
                      )}
                      {getSwingStatusBadge(swing)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expanded Video View */}
        {selectedSwing && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Swing {selectedSwing.swing_index + 1}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSwing(null)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Video Player */}
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  {selectedSwing.video_url ? (
                    <video
                      src={selectedSwing.video_url}
                      controls
                      className="w-full h-full object-contain"
                      playsInline
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-muted-foreground">Video not available</p>
                    </div>
                  )}
                </div>

                {/* Analysis Data */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Analysis Status</h4>
                    {getSwingStatusBadge(selectedSwing)}
                  </div>

                  {selectedSwing.sequence_score !== null && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Sequence Score</p>
                      <p className="text-4xl font-bold">{selectedSwing.sequence_score}</p>
                    </div>
                  )}

                  {selectedSwing.sequence_analysis && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Metrics</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(selectedSwing.sequence_analysis).map(([key, value]) => {
                          if (typeof value === 'object' || key === 'notes') return null;
                          return (
                            <div key={key} className="bg-muted/30 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground capitalize">
                                {key.replace(/_/g, ' ')}
                              </p>
                              <p className="font-medium">
                                {typeof value === 'number' ? value.toFixed(1) : String(value)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedSwing.frame_rate && (
                    <div className="text-sm text-muted-foreground">
                      Frame Rate: {selectedSwing.frame_rate}fps
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Reboot CSV Import Modal */}
      {sessionId && (
        <RebootCsvImportModal
          open={rebootImportOpen}
          onOpenChange={setRebootImportOpen}
          sessionId={sessionId}
          swingCount={swings.length}
          onSuccess={loadSessionData}
        />
      )}
    </div>
  );
}
