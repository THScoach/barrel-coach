import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Play, Lock, Clock, X, Brain, Dumbbell, Target, CircleDot, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Json } from '@/integrations/supabase/types';

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface DrillVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  transcript: string | null;
  transcript_segments: Json | null;
  four_b_category: string | null;
  drill_name: string | null;
  problems_addressed: string[] | null;
  duration_seconds: number | null;
  access_level: string | null;
}

interface VideoRecommendationsProps {
  weakestCategory: string;
  problemsAddressed?: string[];
  userAccessLevel?: 'free' | 'paid' | 'inner_circle';
  maxVideos?: number;
  showHeader?: boolean;
  sessionId?: string;
}

const categoryInfo: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  brain: { color: 'bg-blue-500', icon: <Brain className="h-4 w-4" />, label: 'Brain' },
  body: { color: 'bg-green-500', icon: <Dumbbell className="h-4 w-4" />, label: 'Body' },
  bat: { color: 'bg-red-500', icon: <Target className="h-4 w-4" />, label: 'Bat' },
  ball: { color: 'bg-orange-500', icon: <CircleDot className="h-4 w-4" />, label: 'Ball' }
};

const parseTranscriptSegments = (segments: Json | null): TranscriptSegment[] | null => {
  if (!segments || !Array.isArray(segments)) return null;
  return segments as unknown as TranscriptSegment[];
};

export function VideoRecommendations({ 
  weakestCategory, 
  problemsAddressed = [],
  userAccessLevel = 'free',
  maxVideos = 5,
  showHeader = true,
  sessionId
}: VideoRecommendationsProps) {
  const [videos, setVideos] = useState<DrillVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<DrillVideo | null>(null);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecommendedVideos();
  }, [weakestCategory, problemsAddressed]);

  const fetchRecommendedVideos = async () => {
    setLoading(true);
    try {
      // First, fetch videos matching weakest category
      let { data: categoryVideos, error } = await supabase
        .from('drill_videos')
        .select('*')
        .eq('status', 'published')
        .eq('four_b_category', weakestCategory.toLowerCase())
        .limit(maxVideos);

      if (error) throw error;

      let allVideos = categoryVideos || [];

      // If we have problems addressed, also fetch those
      if (problemsAddressed.length > 0 && allVideos.length < maxVideos) {
        const { data: problemVideos, error: problemError } = await supabase
          .from('drill_videos')
          .select('*')
          .eq('status', 'published')
          .overlaps('problems_addressed', problemsAddressed)
          .limit(maxVideos - allVideos.length);

        if (!problemError && problemVideos) {
          // Merge and deduplicate
          const existingIds = new Set(allVideos.map(v => v.id));
          const uniqueProblemVideos = problemVideos.filter(v => !existingIds.has(v.id));
          allVideos = [...allVideos, ...uniqueProblemVideos];
        }
      }

      setVideos(allVideos.slice(0, maxVideos));
    } catch (error) {
      console.error('Error fetching recommended videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasAccess = (accessLevel: string | null): boolean => {
    if (!accessLevel || accessLevel === 'free') return true;
    if (userAccessLevel === 'inner_circle') return true;
    if (userAccessLevel === 'paid' && accessLevel === 'paid') return true;
    return false;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const seekToTime = (seconds: number) => {
    if (videoRef) {
      videoRef.currentTime = seconds;
      videoRef.play();
    }
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const categoryLabel = categoryInfo[weakestCategory.toLowerCase()]?.label || weakestCategory;

  if (loading) {
    return (
      <Card className="p-6 mb-8">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-video bg-muted rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (videos.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="p-6 mb-8">
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold">VIDEOS FOR YOU</h2>
              <p className="text-sm text-muted-foreground">
                Based on your <span className="font-semibold text-foreground">{categoryLabel.toUpperCase()}</span> score, Coach Rick recommends these videos:
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/library')}
              className="gap-1"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {videos.map(video => {
            const locked = !hasAccess(video.access_level);
            const category = video.four_b_category ? categoryInfo[video.four_b_category] : null;

            return (
              <div 
                key={video.id}
                className={`cursor-pointer transition-all hover:scale-[1.02] ${locked ? 'opacity-75' : ''}`}
                onClick={() => setSelectedVideo(video)}
              >
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-2">
                  {video.thumbnail_url ? (
                    <img 
                      src={video.thumbnail_url} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  
                  {video.duration_seconds && (
                    <Badge 
                      className="absolute bottom-1 right-1 bg-black/80 text-white text-xs"
                      variant="secondary"
                    >
                      {formatDuration(video.duration_seconds)}
                    </Badge>
                  )}

                  {locked && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Lock className="h-6 w-6 text-white" />
                    </div>
                  )}

                  {!locked && (
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                      <Play className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-medium line-clamp-2">{video.title}</h3>
                {category && (
                  <Badge className={`${category.color} text-white text-xs mt-1`}>
                    {category.label}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Video Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0 overflow-hidden">
          {selectedVideo && (
            <>
              <DialogHeader className="p-4 pb-0">
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedVideo.title}</DialogTitle>
                    {selectedVideo.drill_name && (
                      <p className="text-muted-foreground">{selectedVideo.drill_name}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedVideo(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
                <div className="lg:col-span-2">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    {hasAccess(selectedVideo.access_level) ? (
                      <video
                        ref={setVideoRef}
                        src={selectedVideo.video_url}
                        controls
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-white">
                        <Lock className="h-12 w-12 mb-4" />
                        <p className="text-lg font-medium mb-2">Upgrade to Access</p>
                        <p className="text-sm text-gray-400 mb-4">
                          {selectedVideo.access_level === 'inner_circle' 
                            ? 'This video requires Inner Circle access'
                            : 'Get a Swing Analysis to unlock this video'}
                        </p>
                        <Button onClick={() => navigate('/analyze')}>
                          {selectedVideo.access_level === 'inner_circle' 
                            ? 'Join Inner Circle'
                            : 'Get Swing Analysis - $37'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {selectedVideo.description && (
                    <p className="mt-4 text-muted-foreground">{selectedVideo.description}</p>
                  )}
                </div>

                <div className="lg:col-span-1">
                  <h4 className="font-semibold mb-2">Transcript</h4>
                  <ScrollArea className="h-[400px] border rounded-lg p-3">
                    {parseTranscriptSegments(selectedVideo.transcript_segments) ? (
                      <div className="space-y-2">
                        {parseTranscriptSegments(selectedVideo.transcript_segments)!.map((segment, i) => (
                          <div 
                            key={i}
                            className="group cursor-pointer hover:bg-muted p-2 rounded"
                            onClick={() => seekToTime(segment.start)}
                          >
                            <span className="text-xs text-primary font-mono">
                              {formatTimestamp(segment.start)}
                            </span>
                            <p className="text-sm">{segment.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : selectedVideo.transcript ? (
                      <p className="text-sm">{selectedVideo.transcript}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No transcript available</p>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
