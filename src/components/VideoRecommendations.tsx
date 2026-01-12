import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Play, Lock, Clock, X, Brain, Dumbbell, Target, CircleDot, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GumletVideoPlayer } from '@/components/video/GumletVideoPlayer';
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
  transcript?: string | null;
  transcript_segments?: Json | null;
  four_b_category: string | null;
  drill_name?: string | null;
  problems_addressed: string[] | null;
  duration_seconds: number | null;
  access_level: string | null;
  relevance_score?: number;
  // Gumlet fields
  gumlet_playback_url?: string | null;
  gumlet_hls_url?: string | null;
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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [lockedVideo, setLockedVideo] = useState<DrillVideo | null>(null);
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const watchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecommendedVideos();
  }, [weakestCategory, problemsAddressed, sessionId]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (watchIntervalRef.current) {
        clearInterval(watchIntervalRef.current);
      }
    };
  }, []);

  const fetchRecommendedVideos = async () => {
    setLoading(true);
    try {
      // Try to use the database function if we have a sessionId
      if (sessionId) {
        const { data, error } = await supabase.rpc('get_recommended_videos', {
          p_session_id: sessionId,
          p_limit: maxVideos
        });

        if (!error && data && data.length > 0) {
          setVideos(data as DrillVideo[]);
          setLoading(false);
          return;
        }
      }

      // Fallback: fetch by weakest category
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

  const handleVideoClick = (video: DrillVideo) => {
    const locked = !hasAccess(video.access_level);
    if (locked) {
      setLockedVideo(video);
      setShowUpgradeModal(true);
    } else {
      setSelectedVideo(video);
      trackVideoView(video.id);
    }
  };

  // Track video view
  const trackVideoView = async (videoId: string) => {
    try {
      const { data, error } = await supabase
        .from('video_views')
        .insert({
          video_id: videoId,
          session_id: sessionId || null,
          watched_seconds: 0,
          completed: false
        })
        .select('id')
        .single();

      if (!error && data) {
        setCurrentViewId(data.id);
        startWatchTimeTracking(data.id);
      }
    } catch (error) {
      console.error('Error tracking video view:', error);
    }
  };

  // Start tracking watch time
  const startWatchTimeTracking = (viewId: string) => {
    if (watchIntervalRef.current) {
      clearInterval(watchIntervalRef.current);
    }

    watchIntervalRef.current = setInterval(async () => {
      if (videoRef.current && viewId) {
        const seconds = Math.floor(videoRef.current.currentTime);
        const completed = videoRef.current.ended;

        await supabase
          .from('video_views')
          .update({ watched_seconds: seconds, completed })
          .eq('id', viewId);

        if (completed && watchIntervalRef.current) {
          clearInterval(watchIntervalRef.current);
        }
      }
    }, 10000); // Update every 10 seconds
  };

  // Handle video close
  const handleVideoClose = async () => {
    if (watchIntervalRef.current) {
      clearInterval(watchIntervalRef.current);
    }

    // Final update
    if (currentViewId && videoRef.current) {
      const seconds = Math.floor(videoRef.current.currentTime);
      const completed = videoRef.current.ended;
      await supabase
        .from('video_views')
        .update({ watched_seconds: seconds, completed })
        .eq('id', currentViewId);
    }

    setSelectedVideo(null);
    setCurrentViewId(null);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const seekToTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
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
      <Card className="p-6 mb-8 bg-gradient-to-br from-card to-muted/30">
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                VIDEOS FOR YOU
              </h2>
              <p className="text-sm text-muted-foreground">
                Based on your <span className="font-semibold text-accent">{categoryLabel.toUpperCase()}</span> score, Coach Rick recommends:
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/library')}
              className="gap-1"
            >
              See all {categoryLabel} videos
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {videos.map(video => {
            const locked = !hasAccess(video.access_level);
            const category = video.four_b_category ? categoryInfo[video.four_b_category] : null;
            const isWeakestMatch = video.four_b_category === weakestCategory.toLowerCase();

            return (
              <div 
                key={video.id}
                className="cursor-pointer transition-all hover:scale-[1.02] group"
                onClick={() => handleVideoClick(video)}
              >
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-2 shadow-md group-hover:shadow-lg transition-shadow">
                  {video.thumbnail_url ? (
                    <img 
                      src={video.thumbnail_url} 
                      alt={video.title}
                      className={`w-full h-full object-cover transition-all ${locked ? 'blur-[2px] brightness-75' : ''}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <Play className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Duration badge */}
                  {video.duration_seconds && (
                    <Badge 
                      className="absolute bottom-1 right-1 bg-black/80 text-white text-xs"
                      variant="secondary"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDuration(video.duration_seconds)}
                    </Badge>
                  )}

                  {/* Category badge */}
                  {category && (
                    <Badge className={`absolute top-1 left-1 ${category.color} text-white text-xs`}>
                      {category.icon}
                      <span className="ml-1">{category.label}</span>
                    </Badge>
                  )}

                  {/* Lock overlay */}
                  {locked && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                      <Lock className="h-6 w-6 text-white mb-1" />
                      <span className="text-xs text-white font-medium">Upgrade to watch</span>
                    </div>
                  )}

                  {/* Play overlay on hover */}
                  {!locked && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="h-6 w-6 text-primary ml-1" />
                      </div>
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-medium line-clamp-2">{video.title}</h3>
                
                {/* Relevance tag */}
                {isWeakestMatch && (
                  <p className="text-xs text-accent mt-1">
                    Targets your {categoryLabel}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Unlock This Video
            </DialogTitle>
            <DialogDescription>
              "{lockedVideo?.title}" is available with a paid analysis
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* $37 Option */}
            <div 
              className="border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors"
              onClick={() => {
                setShowUpgradeModal(false);
                navigate('/analyze');
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">Single Swing Score</h3>
                <span className="text-2xl font-bold text-primary">$37</span>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground mb-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  AI analysis of 1 swing video
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  Your 4B Score breakdown
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  Access to paid video library
                </li>
              </ul>
              <Button className="w-full" variant="outline">
                Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            {/* $97 Option - Highlighted */}
            <div 
              className="border-2 border-accent rounded-lg p-4 cursor-pointer hover:bg-accent/5 transition-colors relative"
              onClick={() => {
                setShowUpgradeModal(false);
                navigate('/analyze');
              }}
            >
              <Badge className="absolute -top-2.5 left-4 bg-accent text-accent-foreground">
                BEST VALUE
              </Badge>
              <div className="flex items-center justify-between mb-2 mt-1">
                <h3 className="font-bold text-lg">Complete Swing Review™</h3>
                <span className="text-2xl font-bold text-accent">$97</span>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground mb-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  AI analysis of 5 swing videos
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  Best vs Worst swing comparison
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  Percentile ranking vs peers
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  30-day improvement plan
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  Full video library access
                </li>
              </ul>
              <Button className="w-full" variant="accent">
                Get Complete Review
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Player Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && handleVideoClose()}>
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
                  <Button variant="ghost" size="icon" onClick={handleVideoClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
                <div className="lg:col-span-2">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <GumletVideoPlayer
                      src={selectedVideo.gumlet_playback_url || selectedVideo.video_url}
                      hlsSrc={selectedVideo.gumlet_hls_url || undefined}
                      poster={selectedVideo.thumbnail_url || undefined}
                      title={selectedVideo.title}
                      autoPlay={true}
                      muted={false}
                      onTimeUpdate={(time) => {
                        // Update videoRef simulation for transcript seek
                        if (videoRef.current) {
                          (videoRef.current as any).currentTime = time;
                        }
                      }}
                    />
                  </div>

                  {selectedVideo.description && (
                    <p className="mt-4 text-muted-foreground">{selectedVideo.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedVideo.four_b_category && categoryInfo[selectedVideo.four_b_category] && (
                      <Badge className={`${categoryInfo[selectedVideo.four_b_category].color} text-white`}>
                        {categoryInfo[selectedVideo.four_b_category].icon}
                        <span className="ml-1">{categoryInfo[selectedVideo.four_b_category].label}</span>
                      </Badge>
                    )}
                    {selectedVideo.problems_addressed?.map(problem => (
                      <Badge key={problem} variant="outline">
                        {problem.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
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
