import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Search, Play, Lock, Clock, X, Brain, Dumbbell, Target, CircleDot } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { Json } from "@/integrations/supabase/types";
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  transcript: string | null;
  transcript_segments: { start: number; end: number; text: string }[] | null;
  four_b_category: string | null;
  drill_name: string | null;
  problems_addressed: string[] | null;
  motor_profiles: string[] | null;
  player_level: string[] | null;
  duration_seconds: number | null;
  access_level: string;
  video_type: string;
  tags: string[] | null;
  rank?: number;
  headline?: string;
}

const categoryInfo: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  brain: { color: 'bg-blue-500', icon: <Brain className="h-4 w-4" />, label: 'Brain' },
  body: { color: 'bg-green-500', icon: <Dumbbell className="h-4 w-4" />, label: 'Body' },
  bat: { color: 'bg-red-500', icon: <Target className="h-4 w-4" />, label: 'Bat' },
  ball: { color: 'bg-orange-500', icon: <CircleDot className="h-4 w-4" />, label: 'Ball' }
};

const PROBLEMS_LIST = [
  { value: 'spinning_out', label: 'Spinning Out' },
  { value: 'casting', label: 'Casting' },
  { value: 'late_timing', label: 'Late Timing' },
  { value: 'early_timing', label: 'Early Timing' },
  { value: 'drifting', label: 'Drifting' },
  { value: 'rolling_over', label: 'Rolling Over' },
  { value: 'ground_balls', label: 'Ground Balls' },
  { value: 'no_power', label: 'No Power' },
  { value: 'chasing_pitches', label: 'Chasing Pitches' }
];

export default function Library() {
  const [videos, setVideos] = useState<DrillVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [problemFilter, setProblemFilter] = useState<string>('all');
  const [selectedVideo, setSelectedVideo] = useState<DrillVideo | null>(null);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        // Use search function
        const { data, error } = await supabase.rpc('search_videos', {
          search_query: searchQuery,
          category_filter: categoryFilter === 'all' ? null : categoryFilter,
          level_filter: null
        });

        if (error) throw error;
        setVideos(data || []);
      } else {
        // Regular query
        let query = supabase
          .from('drill_videos')
          .select('*')
          .eq('status', 'published')
          .order('created_at', { ascending: false });

        if (categoryFilter !== 'all') {
          query = query.eq('four_b_category', categoryFilter);
        }

        if (problemFilter !== 'all') {
          query = query.contains('problems_addressed', [problemFilter]);
        }

        const { data, error } = await query;
        if (error) throw error;
        setVideos(data || []);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, problemFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchVideos, 300);
    return () => clearTimeout(debounce);
  }, [fetchVideos]);

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

  // Check user access (simplified - you can expand this)
  const hasAccess = (accessLevel: string) => {
    // For now, show all as accessible
    // In production, check against user's purchase history or subscription
    return accessLevel === 'free';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Coach Rick's Video Vault</h1>
          <p className="text-muted-foreground text-lg">
            {videos.length} coaching videos • Search drills, problems, or techniques
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              className="pl-12 h-14 text-lg"
              placeholder="Search drills, problems, or techniques..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {/* Category Pills */}
          <div className="flex gap-2">
            <Button
              variant={categoryFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('all')}
            >
              All
            </Button>
            {Object.entries(categoryInfo).map(([key, { color, icon, label }]) => (
              <Button
                key={key}
                variant={categoryFilter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(key)}
                className={categoryFilter === key ? color : ''}
              >
                {icon}
                <span className="ml-1">{label}</span>
              </Button>
            ))}
          </div>

          {/* Problem Filter */}
          <Select value={problemFilter} onValueChange={setProblemFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by problem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Problems</SelectItem>
              {PROBLEMS_LIST.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Video Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-video bg-muted" />
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">
              {searchQuery ? 'No videos found for your search' : 'No videos available yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map(video => {
              const locked = !hasAccess(video.access_level);
              const category = video.four_b_category ? categoryInfo[video.four_b_category] : null;

              return (
                <Card 
                  key={video.id}
                  className={`cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${locked ? 'opacity-75' : ''}`}
                  onClick={() => setSelectedVideo(video)}
                >
                  <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    {video.thumbnail_url ? (
                      <img 
                        src={video.thumbnail_url} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Play className="h-12 w-12 text-muted-foreground" />
                    )}
                    
                    {/* Duration Badge */}
                    {video.duration_seconds && (
                      <Badge 
                        className="absolute bottom-2 right-2 bg-black/80 text-white"
                        variant="secondary"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(video.duration_seconds)}
                      </Badge>
                    )}

                    {/* Lock Overlay */}
                    {locked && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Lock className="h-8 w-8 text-white" />
                      </div>
                    )}

                    {/* Play Overlay */}
                    {!locked && (
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                        <Play className="h-12 w-12 text-white" />
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold line-clamp-2">{video.title}</h3>
                      {category && (
                        <Badge className={`${category.color} text-white shrink-0`}>
                          {category.label}
                        </Badge>
                      )}
                    </div>

                    {/* Search Highlight */}
                    {video.headline && (
                      <p 
                        className="text-sm text-muted-foreground line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: video.headline }}
                      />
                    )}

                    {video.drill_name && !video.headline && (
                      <p className="text-sm text-muted-foreground">{video.drill_name}</p>
                    )}

                    {/* Tags */}
                    {video.problems_addressed && video.problems_addressed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {video.problems_addressed.slice(0, 3).map(problem => (
                          <Badge key={problem} variant="outline" className="text-xs">
                            {problem.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

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
                {/* Video Player */}
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
                          This video requires {selectedVideo.access_level === 'inner_circle' ? 'Inner Circle' : 'Paid'} access
                        </p>
                        <Button>Upgrade Now</Button>
                      </div>
                    )}
                  </div>

                  {/* Video Info */}
                  <div className="mt-4 space-y-3">
                    {selectedVideo.description && (
                      <p className="text-muted-foreground">{selectedVideo.description}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {selectedVideo.four_b_category && (
                        <Badge className={`${categoryInfo[selectedVideo.four_b_category]?.color} text-white`}>
                          {categoryInfo[selectedVideo.four_b_category]?.icon}
                          <span className="ml-1">{categoryInfo[selectedVideo.four_b_category]?.label}</span>
                        </Badge>
                      )}
                      {selectedVideo.problems_addressed?.map(problem => (
                        <Badge key={problem} variant="outline">
                          {problem.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                      {selectedVideo.player_level?.map(level => (
                        <Badge key={level} variant="secondary">
                          {level.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Transcript */}
                <div className="lg:col-span-1">
                  <h4 className="font-semibold mb-2">Transcript</h4>
                  <ScrollArea className="h-[400px] border rounded-lg p-3">
                    {selectedVideo.transcript_segments ? (
                      <div className="space-y-2">
                        {selectedVideo.transcript_segments.map((segment, i) => (
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

      <Footer />
    </div>
  );
}
