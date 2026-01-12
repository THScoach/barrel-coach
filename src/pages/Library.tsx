import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Search, Play, Lock, Clock, X, Brain, Dumbbell, Target, CircleDot, Sparkles, Zap, Filter, FileText, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VideoRecommendations } from "@/components/VideoRecommendations";
import type { Json } from "@/integrations/supabase/types";

// Sanitize HTML from search results
const sanitizeHeadline = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: []
  });
};

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
  motor_profiles: string[] | null;
  player_level: string[] | null;
  duration_seconds: number | null;
  access_level: string | null;
  video_type: string | null;
  tags: string[] | null;
  rank?: number;
  headline?: string;
}

const parseTranscriptSegments = (segments: Json | null): TranscriptSegment[] | null => {
  if (!segments || !Array.isArray(segments)) return null;
  return segments as unknown as TranscriptSegment[];
};

const categoryInfo: Record<string, { color: string; bgColor: string; icon: JSX.Element; label: string }> = {
  brain: { color: 'text-purple-400', bgColor: 'bg-purple-500/20 border-purple-500/30', icon: <Brain className="w-5 h-5" />, label: 'Brain' },
  body: { color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30', icon: <Dumbbell className="w-5 h-5" />, label: 'Body' },
  bat: { color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30', icon: <Target className="w-5 h-5" />, label: 'Bat' },
  ball: { color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30', icon: <CircleDot className="w-5 h-5" />, label: 'Ball' }
};

const PROBLEMS_LIST = [
  { value: 'spinning_out', label: 'Spinning Out', category: 'body' },
  { value: 'casting', label: 'Casting / Long Swing', category: 'bat' },
  { value: 'late_timing', label: 'Late on Fastballs', category: 'brain' },
  { value: 'early_timing', label: 'Early on Off-Speed', category: 'brain' },
  { value: 'drifting', label: 'Drifting Forward', category: 'body' },
  { value: 'rolling_over', label: 'Rolling Over', category: 'bat' },
  { value: 'ground_balls', label: 'Ground Ball Machine', category: 'ball' },
  { value: 'no_power', label: 'No Power / Low Exit Velo', category: 'ball' },
  { value: 'chasing', label: 'Chasing Pitches', category: 'brain' },
  { value: 'collapsing', label: 'Collapsing Back Side', category: 'body' }
];

export default function Library() {
  const [videos, setVideos] = useState<DrillVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [problemFilter, setProblemFilter] = useState('all');
  const [transcribedOnly, setTranscribedOnly] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<DrillVideo | null>(null);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  const [userSession, setUserSession] = useState<{
    weakestCategory: string | null;
    accessLevel: 'free' | 'paid' | 'inner_circle';
    sessionId: string | null;
  } | null>(null);

  useEffect(() => {
    document.title = "Video Vault | Coach Rick's Drill Library | Catching Barrels";
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session');

      if (sessionId) {
        const { data: session } = await supabase
          .from('sessions')
          .select('weakest_category, product_type, status')
          .eq('id', sessionId)
          .maybeSingle();

        if (session && session.status === 'complete' && session.weakest_category) {
          setUserSession({
            weakestCategory: session.weakest_category,
            accessLevel: session.product_type === 'complete_review' ? 'paid' : 'paid',
            sessionId
          });
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: latestSession } = await supabase
          .from('sessions')
          .select('id, weakest_category, product_type')
          .eq('user_id', user.id)
          .eq('status', 'complete')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestSession?.weakest_category) {
          setUserSession({
            weakestCategory: latestSession.weakest_category,
            accessLevel: 'paid',
            sessionId: latestSession.id
          });
        }
      }
    } catch (error) {
      console.error('Error checking user session:', error);
    }
  };

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const { data, error } = await supabase.rpc('search_videos', {
          search_query: searchQuery,
          category_filter: categoryFilter === 'all' ? null : categoryFilter,
          level_filter: null
        });
        if (error) throw error;
        setVideos((data || []) as DrillVideo[]);
      } else {
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
        if (transcribedOnly) {
          query = query.not('transcript', 'is', null);
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
  }, [searchQuery, categoryFilter, problemFilter, transcribedOnly]);

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

  const hasAccess = (videoAccessLevel: string | null) => {
    if (!videoAccessLevel || videoAccessLevel === 'free') return true;
    const userLevel = userSession?.accessLevel || 'free';
    if (userLevel === 'inner_circle') return true;
    if (userLevel === 'paid' && videoAccessLevel === 'paid') return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      
      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent" />
        
        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Content */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">Coach Rick's Drill Library</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
              VIDEO <span className="text-red-500">VAULT</span>
            </h1>
            
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
              {videos.length} coaching videos to fix any swing problem. 
              Search by category, problem, or technique.
            </p>

            {/* Glassmorphism Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                <div className="relative flex items-center bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden">
                  <Search className="w-5 h-5 text-slate-500 ml-4" />
                  <Input
                    type="text"
                    placeholder="Search drills, problems, or techniques..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-0 text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 py-4 px-4 text-lg"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="p-2 mr-2 text-slate-400 hover:text-white transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== 4B CATEGORY CARDS ===== */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Object.entries(categoryInfo).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key)}
                className={`group relative p-6 rounded-2xl border transition-all duration-300 ${
                  categoryFilter === key 
                    ? `${info.bgColor} border-current shadow-lg shadow-current/20` 
                    : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <div className={`flex flex-col items-center gap-3 ${info.color}`}>
                  <div className={`p-3 rounded-xl ${categoryFilter === key ? 'bg-current/20' : 'bg-slate-800'} transition-colors`}>
                    {info.icon}
                  </div>
                  <span className={`font-bold uppercase tracking-wider text-sm ${categoryFilter === key ? info.color : 'text-white'}`}>
                    {info.label}
                  </span>
                </div>
                {categoryFilter === key && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-current rounded-full animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Reset Filter Button */}
          {categoryFilter !== 'all' && (
            <div className="text-center mb-8">
              <Button 
                variant="ghost" 
                onClick={() => setCategoryFilter('all')}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4 mr-2" />
                Clear {categoryInfo[categoryFilter]?.label} Filter
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ===== PROBLEM FILTERS ===== */}
      <section className="py-8 border-y border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-slate-500" />
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Fix a Specific Problem</span>
            </div>
            
            {/* Transcription Filter Toggle */}
            <button
              onClick={() => setTranscribedOnly(!transcribedOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                transcribedOnly
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-transparent'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Transcribed Only</span>
              {transcribedOnly && <CheckCircle2 className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {PROBLEMS_LIST.map((problem) => {
              const catInfo = categoryInfo[problem.category];
              return (
                <button
                  key={problem.value}
                  onClick={() => setProblemFilter(problemFilter === problem.value ? 'all' : problem.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    problemFilter === problem.value
                      ? `${catInfo?.bgColor} ${catInfo?.color} border`
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  {problem.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== PERSONALIZED RECOMMENDATIONS ===== */}
      {userSession?.weakestCategory && (
        <section className="py-12 bg-gradient-to-r from-red-900/20 via-slate-900 to-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Recommended for You</h2>
                <p className="text-sm text-slate-400">Based on your weakest link: <span className="text-red-400 font-semibold capitalize">{userSession.weakestCategory}</span></p>
              </div>
            </div>
            <VideoRecommendations 
              weakestCategory={userSession.weakestCategory} 
              sessionId={userSession.sessionId}
            />
          </div>
        </section>
      )}

      {/* ===== VIDEO GRID ===== */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">
              {searchQuery ? `Search Results` : 'All Drills'}
              <span className="ml-3 text-lg text-slate-500 font-normal">({videos.length})</span>
            </h2>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-video bg-slate-800 rounded-xl mb-4" />
                  <div className="h-4 bg-slate-800 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            /* Empty State */
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-800 flex items-center justify-center">
                <Search className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No videos found</h3>
              <p className="text-slate-400 mb-6">Try adjusting your search or filters</p>
              <Button 
                onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setProblemFilter('all'); }}
                className="bg-red-500 hover:bg-red-600"
              >
                Clear All Filters
              </Button>
            </div>
          ) : (
            /* Video Cards Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => {
                const catInfo = video.four_b_category ? categoryInfo[video.four_b_category] : null;
                const canAccess = hasAccess(video.access_level);
                
                return (
                  <div
                    key={video.id}
                    onClick={() => canAccess && setSelectedVideo(video)}
                    className={`group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 transition-all duration-300 ${
                      canAccess 
                        ? 'cursor-pointer hover:border-slate-600 hover:shadow-2xl hover:shadow-red-500/10 hover:-translate-y-1' 
                        : 'opacity-60'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video overflow-hidden">
                      {video.thumbnail_url ? (
                        <img 
                          src={video.thumbnail_url} 
                          alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                          <Play className="w-12 h-12 text-slate-700" />
                        </div>
                      )}
                      
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {canAccess ? (
                          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform">
                            <Play className="w-7 h-7 text-white ml-1" />
                          </div>
                        ) : (
                          <Lock className="w-8 h-8 text-white" />
                        )}
                      </div>

                      {/* Duration Badge */}
                      {video.duration_seconds && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white font-medium">
                          {formatDuration(video.duration_seconds)}
                        </div>
                      )}

                      {/* Category Badge */}
                      {catInfo && (
                        <div className={`absolute top-2 left-2 px-3 py-1 rounded-full ${catInfo.bgColor} border flex items-center gap-1.5`}>
                          <span className={catInfo.color}>{catInfo.icon}</span>
                          <span className={`text-xs font-semibold ${catInfo.color}`}>{catInfo.label}</span>
                        </div>
                      )}

                      {/* Lock Badge for Paid Content */}
                      {!canAccess && (
                        <div className="absolute top-2 right-2 p-2 bg-black/70 rounded-full">
                          <Lock className="w-4 h-4 text-yellow-400" />
                        </div>
                      )}

                      {/* Transcript Status Badge */}
                      {canAccess && video.transcript && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-400 font-medium">
                          <FileText className="w-3 h-3" />
                          <span>Transcribed</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-red-400 transition-colors">
                        {video.headline ? (
                          <span dangerouslySetInnerHTML={{ __html: sanitizeHeadline(video.headline) }} />
                        ) : (
                          video.title
                        )}
                      </h3>
                      
                      {video.description && (
                        <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                          {video.description}
                        </p>
                      )}

                      {/* Tags */}
                      {video.problems_addressed && video.problems_addressed.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {video.problems_addressed.slice(0, 2).map((problem) => (
                            <span key={problem} className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">
                              {PROBLEMS_LIST.find(p => p.value === problem)?.label || problem}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            WANT <span className="text-red-500">UNLIMITED ACCESS?</span>
          </h2>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
            Join the Inner Circle for full access to 200+ drills, weekly live calls with Coach Rick, and unlimited swing reviews.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-6 text-lg">
              <a href="/inner-circle">Join Inner Circle — $297/mo</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 px-8 py-6 text-lg">
              <a href="/analyze">Get Single Analysis — $37</a>
            </Button>
          </div>
        </div>
      </section>

      <Footer />

      {/* ===== VIDEO MODAL ===== */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-5xl bg-slate-900 border-slate-700 p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold text-white pr-8">
              {selectedVideo?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedVideo && (
            <div className="p-6 pt-4">
              {/* Video Player */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-6">
                <video
                  ref={(ref) => setVideoRef(ref)}
                  src={selectedVideo.video_url}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              </div>

              {/* Video Info */}
              <div className="flex flex-wrap gap-3 mb-4">
                {selectedVideo.four_b_category && categoryInfo[selectedVideo.four_b_category] && (
                  <Badge className={`${categoryInfo[selectedVideo.four_b_category].bgColor} ${categoryInfo[selectedVideo.four_b_category].color} border`}>
                    {categoryInfo[selectedVideo.four_b_category].icon}
                    <span className="ml-1">{categoryInfo[selectedVideo.four_b_category].label}</span>
                  </Badge>
                )}
                {selectedVideo.duration_seconds && (
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDuration(selectedVideo.duration_seconds)}
                  </Badge>
                )}
              </div>

              {selectedVideo.description && (
                <p className="text-slate-300 mb-6">{selectedVideo.description}</p>
              )}

              {/* Transcript with Timestamps */}
              {selectedVideo.transcript_segments && (
                <div className="border-t border-slate-700 pt-6">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Transcript</h4>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {parseTranscriptSegments(selectedVideo.transcript_segments)?.map((segment, i) => (
                        <button
                          key={i}
                          onClick={() => seekToTime(segment.start)}
                          className="w-full text-left p-3 rounded-lg hover:bg-slate-800 transition group"
                        >
                          <span className="text-xs text-red-400 font-mono mr-3 group-hover:text-red-300">
                            {formatTimestamp(segment.start)}
                          </span>
                          <span className="text-slate-300 group-hover:text-white">
                            {segment.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
