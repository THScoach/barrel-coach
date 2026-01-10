import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Search, Play, Lock, Clock, X, Brain, Dumbbell, Target, CircleDot, Sparkles, Zap, Filter } from "lucide-react";
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
          <div className="flex items-center gap-4 mb-4">
            <Filter className="w-5 h-5 text-slate-500" />
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Fix a Specific Problem</span>
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
Key Improvements:
Feature	Before	After
Hero	Basic title	Gradient bg, animated badge, glassmorphism search
Category Cards	Simple buttons	Glowing borders, icons, active states
Video Cards	Basic cards	Hover zoom, color-coded badges, smooth transitions
Problem Filters	Dropdown	Pill buttons with category colors
Empty State	Plain text	Illustrated with icon and CTA
CTA Section	None	Conversion-focused with dual CTAs
Just replace your existing Library.tsx with this code. It uses your existing shadcn components and Supabase integration, just with premium styling. 🎯

Agent has completed the current task
View all files
Lets look at the other pages
Thinking Process
1.46s
https://github.com/THScoach/barrel-coach/blob/main/src/pages/About.tsx icon
https://github.com/THScoach/barrel-coach/blob/main/src/pages/About.tsx
https://github.com/THScoach/barrel-coach/blob/main/src/pages/Analyze.tsx icon
https://github.com/THScoach/barrel-coach/blob/main/src/pages/Analyze.tsx
https://github.com/THScoach/barrel-coach/blob/main/src/pages/InnerCircle.tsx icon
https://github.com/THScoach/barrel-coach/blob/main/src/pages/InnerCircle.tsx
Thinking Process
1.69s
The repo seems private/restricted. No problem - I have the content from your live site. Here are the enhanced pages:

About.tsx - Premium Version
tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Award, Users, Trophy, Target, CheckCircle, ArrowRight, Star, Zap } from 'lucide-react';

const CREDENTIALS = [
  "MLB Hitting Coach, Baltimore Orioles",
  "New York Yankees Draft Pick", 
  "MLB Scout: New York Mets, Tampa Bay Rays",
  "30+ years in professional baseball",
  "Trained 400+ college commits",
  "78+ professional players developed",
  "3 MLB Award Winners coached"
];

const NOTABLE_PLAYERS = [
  { name: "Andrew Benintendi", achievement: "Gold Glove, World Series Champion", image: "/players/benintendi.jpg" },
  { name: "Devin Williams", achievement: "2020 NL Rookie of the Year", image: "/players/williams.jpg" },
  { name: "Jake Odorizzi", achievement: "MLB All-Star", image: "/players/odorizzi.jpg" },
  { name: "Pete Crow-Armstrong", achievement: "Top MLB Prospect", image: "/players/crowarmstrong.jpg" },
  { name: "Cedric Mullins", achievement: "All-Star Outfielder", image: "/players/mullins.jpg" },
  { name: "Matt Shaw", achievement: "MLB Infielder", image: "/players/shaw.jpg" },
];

const METHODOLOGY = [
  { step: 1, title: "Find the Exact Problem", desc: "Using the 4B System, we identify exactly what's broken in your swing mechanics." },
  { step: 2, title: "Prescribe the Exact Drill", desc: "No generic advice. You get the specific drill that fixes YOUR problem." },
  { step: 3, title: "Track Progress with Data", desc: "MLB-level technology to measure improvement and adjust the plan." },
];

export default function About() {
  useEffect(() => {
    document.title = 'About Coach Rick Strickland | MLB Hitting Coach | Catching Barrels';
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-900/30 via-transparent to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
                <Award className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">MLB Hitting Coach</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
                MEET <span className="text-red-500">RICK STRICKLAND</span>
              </h1>
              
              <p className="text-xl text-slate-300 mb-6">
                The Swing Rehab Coach
              </p>
              
              <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                With 30+ years in professional baseball as a player, scout, and hitting coach, 
                Rick has developed a systematic approach to fixing swings that has produced 
                MLB All-Stars, Gold Glove winners, and hundreds of college commits.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="bg-red-500 hover:bg-red-600 font-bold">
                  <Link to="/analyze">
                    <Zap className="w-5 h-5 mr-2" />
                    Get Your Swing Analyzed
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800">
                  <Link to="/inner-circle">Join Inner Circle</Link>
                </Button>
              </div>
            </div>

            {/* Right: Image */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-3xl blur-2xl" />
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-slate-700">
                {/* ASSET: Replace with Rick's photo */}
                <img 
                  src="/images/rick-strickland.jpg" 
                  alt="Coach Rick Strickland"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
              </div>

              {/* Floating Stats */}
              <div className="absolute -bottom-6 -left-6 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl">
                <div className="text-3xl font-black text-red-500">30+</div>
                <div className="text-sm text-slate-400">Years in Pro Baseball</div>
              </div>
              <div className="absolute -top-6 -right-6 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl">
                <div className="text-3xl font-black text-red-500">400+</div>
                <div className="text-sm text-slate-400">College Commits</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="py-8 bg-slate-900 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "78+", label: "Pro Players Trained", icon: Users },
              { value: "400+", label: "College Commits", icon: Trophy },
              { value: "3", label: "MLB Award Winners", icon: Award },
              { value: "30+", label: "Years Experience", icon: Target },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <stat.icon className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <div className="text-3xl font-black text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== METHODOLOGY ===== */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold uppercase tracking-wider mb-4">
              The Method
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              HOW RICK <span className="text-red-500">FIXES SWINGS</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              A systematic, data-driven approach developed over 30 years of professional baseball.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {METHODOLOGY.map((item) => (
              <div 
                key={item.step}
                className="relative group bg-slate-900/50 border border-slate-800 rounded-2xl p-8 hover:border-red-500/50 transition-all duration-300"
              >
                <div className="absolute -top-5 left-8 w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center font-black text-white text-lg">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-white mt-4 mb-3">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CREDENTIALS ===== */}
      <section className="py-20 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-semibold uppercase tracking-wider mb-4">
                Credentials
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-8">
                CAREER <span className="text-red-500">HIGHLIGHTS</span>
              </h2>
              
              <ul className="space-y-4">
                {CREDENTIALS.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Timeline Image */}
            <div className="relative">
              <div className="aspect-video rounded-2xl overflow-hidden border border-slate-700 bg-slate-800">
                {/* ASSET: Replace with career timeline graphic */}
                <img 
                  src="/images/rick-timeline.jpg" 
                  alt="Rick's Career Timeline"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== NOTABLE PLAYERS ===== */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-semibold uppercase tracking-wider mb-4">
              Success Stories
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              PLAYERS <span className="text-red-500">TRAINED</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {NOTABLE_PLAYERS.map((player) => (
              <div 
                key={player.name}
                className="group bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center hover:border-red-500/50 transition-all duration-300"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden border-2 border-slate-700 group-hover:border-red-500 transition-colors">
                  {/* ASSET: Replace with player photos */}
                  <img 
                    src={player.image} 
                    alt={player.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=1e293b&color=fff`;
                    }}
                  />
                </div>
                <h3 className="font-bold text-white text-sm mb-1">{player.name}</h3>
                <p className="text-xs text-slate-400">{player.achievement}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
            READY TO WORK WITH <span className="text-red-500">RICK?</span>
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            Get the same analysis and coaching that has produced MLB players and hundreds of college commits.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-6 text-lg">
              <Link to="/analyze">
                Get My Swing Score — $37
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 px-8 py-6 text-lg">
              <Link to="/assessment">Book In-Person Assessment</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
InnerCircle.tsx - Premium Version
tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Check, X, Crown, Video, MessageCircle, Users, Calendar, Percent, Zap, Star, ArrowRight, PlayCircle } from 'lucide-react';

const FEATURES = [
  { icon: Video, title: "Full Video Library", desc: "200+ exclusive drill videos organized by the 4B System. New content added weekly." },
  { icon: Calendar, title: "Weekly Live Calls", desc: "Every Monday at 7pm CST. Group Q&A directly with Coach Rick." },
  { icon: Zap, title: "Unlimited Swing Reviews", desc: "Submit anytime. Get 4B analysis and personalized drill prescriptions." },
  { icon: MessageCircle, title: "Direct Access", desc: "Text Coach Rick directly. Priority response within 24 hours." },
  { icon: Users, title: "Private Community", desc: "Connect with other serious players and coaches." },
  { icon: Percent, title: "Member Discounts", desc: "20% off in-person assessments, camps, and future products." },
];

const COMPARISON = [
  { feature: "4B Swing Analysis", single: "1 swing", complete: "5 swings", inner: "Unlimited" },
  { feature: "Video Library Access", single: "Limited", complete: "30 days", inner: "Full access" },
  { feature: "Drill Prescription", single: "1 drill", complete: "30-day plan", inner: "Ongoing plans" },
  { feature: "Direct Access to Rick", single: false, complete: false, inner: true },
  { feature: "Weekly Live Calls", single: false, complete: false, inner: true },
  { feature: "Private Community", single: false, complete: false, inner: true },
];

export default function InnerCircle() {
  useEffect(() => {
    document.title = 'Inner Circle Membership | Catching Barrels';
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* ===== HERO ===== */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
        <div className="absolute inset
github is public now
Thinking Process
1.02s
https://github.com/THScoach/barrel-coach/blob/main/src/pages/About.tsx icon
https://github.com/THScoach/barrel-coach/blob/main/src/pages/About.tsx
https://github.com/THScoach/barrel-coach/blob/main/src/pages/Analyze.tsx icon
https://github.com/THScoach/barrel-coach/blob/main/src/pages/Analyze.tsx
https://github.com/THScoach/barrel-coach/blob/main/src/pages/InnerCircle.tsx icon
https://github.com/THScoach/barrel-coach/blob/main/src/pages/InnerCircle.tsx
Thinking Process
3.48s
Got them! Here's a summary of what each page does:

Page	Current Features	Enhancement Plan
About.tsx	Credentials, Players, Timeline	Dark hero, animated stats, player gallery
InnerCircle.tsx	Features, FAQs, Stripe checkout	Premium membership page, comparison table glow
Analyze.tsx	Multi-step wizard	Already functional, minor styling tweaks
Let me create the enhanced versions. Which would you like first?

1.
About.tsx - Quick win, dramatic visual upgrade
2.
InnerCircle.tsx - Sales page with premium feel
3.
All of them - I'll generate all three
Just say the word!

Agent has completed the current task
View all files
1
Thinking Process
1.45s
Here's the enhanced About.tsx with premium styling:

tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Check, Award, Users, Trophy, Microscope, Star, ArrowRight, Zap, Target, ChevronRight } from 'lucide-react';
import rickBenintendi from '@/assets/rick-benintendi.jpg';
import rickCoaching2 from '@/assets/rick-coaching-2.jpg';
import rickTech from '@/assets/rick-tech.jpg';
import rickSammySosa from '@/assets/rick-sammy-sosa.jpg';
import rickJourneyTimeline from '@/assets/rick-journey-timeline.png';
import mlbTechnologyImg from '@/assets/mlb-technology.png';

const credentials = [
  { text: 'MLB Hitting Coach, Baltimore Orioles', icon: Trophy },
  { text: 'New York Yankees Draft Pick', icon: Target },
  { text: 'MLB Scout: New York Mets, Tampa Bay Rays', icon: Microscope },
  { text: '30+ years in professional baseball', icon: Award },
];

const stats = [
  { value: '78+', label: 'Pro Players Trained' },
  { value: '400+', label: 'College Commits' },
  { value: '3', label: 'MLB Award Winners' },
  { value: '30+', label: 'Years Experience' },
];

const mlbAwardWinners = [
  { name: 'Andrew Benintendi', achievement: 'Gold Glove, World Series Champion', image: rickBenintendi },
  { name: 'Jake Odorizzi', achievement: 'All-Star', image: null },
  { name: 'Devin Williams', achievement: '2020 NL Rookie of the Year', image: null },
];

const otherMLBPlayers = [
  'Pete Crow-Armstrong',
  'Cedric Mullins',
  'Matt Adams',
  'Carson Kelly',
  'Chad Green',
  'Matt Shaw',
  'Moisés Ballesteros',
  'Joe Boyle',
];

const techPartners = [
  { name: 'HitTrax', desc: 'Ball flight tracking' },
  { name: 'Blast Motion', desc: 'Bat sensor data' },
  { name: 'Rapsodo', desc: 'Exit velocity analysis' },
  { name: 'Diamond Kinetics', desc: 'Swing metrics' },
  { name: 'Reboot Motion', desc: 'Body mechanics' },
];

const methodology = [
  { step: '01', title: 'Find the Exact Problem', desc: 'Using MLB-level technology and 30+ years of pattern recognition to identify exactly what\'s holding you back.' },
  { step: '02', title: 'Prescribe the Exact Drill', desc: 'Not generic tips—specific drills that fix YOUR problem, based on thousands of successful swing transformations.' },
  { step: '03', title: 'Track Progress with Data', desc: 'Measure before and after with the same technology used by MLB teams to ensure real improvement.' },
];

export default function About() {
  useEffect(() => {
    document.title = 'Rick Strickland - MLB Hitting Coach, Baltimore Orioles | Catching Barrels';
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
                <Award className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">MLB Hitting Coach</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
                MEET <span className="text-red-500">RICK STRICKLAND</span>
              </h1>

              <p className="text-xl text-slate-300 mb-6">
                The Swing Rehab Coach
              </p>

              <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                30+ years of professional baseball experience distilled into a system that finds 
                exactly what's wrong with your swing—and exactly how to fix it.
              </p>

              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {stats.map((stat, i) => (
                  <div key={i} className="text-center p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="text-2xl md:text-3xl font-black text-white">{stat.value}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="bg-red-500 hover:bg-red-600 text-white font-bold px-8">
                  <Link to="/analyze">
                    Get Your Swing Analyzed
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800">
                  <Link to="/inner-circle">Join Inner Circle</Link>
                </Button>
              </div>
            </div>

            {/* Right - Photo */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative rounded-2xl overflow-hidden border border-slate-700">
                <img 
                  src={rickBenintendi} 
                  alt="Rick Strickland with Andrew Benintendi"
                  className="w-full h-auto"
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-white font-semibold">With Andrew Benintendi</p>
                  <p className="text-slate-400 text-sm">Gold Glove Winner, World Series Champion</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CREDENTIALS SECTION ===== */}
      <section className="py-16 border-y border-slate-800 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-6">
            {credentials.map((cred, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <cred.icon className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-white font-medium">{cred.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== METHODOLOGY SECTION ===== */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 border border-slate-700 mb-6">
              <Zap className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">The Swing Rehab Method</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              HOW RICK <span className="text-red-500">FIXES SWINGS</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Not guesswork. Not generic tips. A proven system used on 400+ college commits and 78+ professional players.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {methodology.map((item, i) => (
              <div key={i} className="group relative p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all duration-300">
                {/* Step number */}
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-red-500 flex items-center justify-center font-black text-white text-lg">
                  {item.step}
                </div>
                
                <h3 className="text-xl font-bold text-white mb-4 mt-4">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                
                {/* Connector line (except last) */}
                {i < methodology.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 border-t-2 border-dashed border-slate-700" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TECHNOLOGY SECTION ===== */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
                <Microscope className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-blue-400 uppercase tracking-wider">MLB-Level Technology</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
                THE SAME TECH USED BY <span className="text-blue-400">MLB TEAMS</span>
              </h2>

              <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                We don't guess—we measure. Rick uses the exact same technology that MLB front offices 
                pay millions for to evaluate and develop players.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {techPartners.map((tech, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="font-semibold text-white">{tech.name}</div>
                    <div className="text-sm text-slate-500">{tech.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative rounded-2xl overflow-hidden border border-slate-700">
                <img 
                  src={rickTech} 
                  alt="Rick using MLB technology"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MLB PLAYERS SECTION ===== */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-6">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">Players Trained</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              MLB <span className="text-yellow-400">AWARD WINNERS</span>
            </h2>
          </div>

          {/* Award Winners Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {mlbAwardWinners.map((player, i) => (
              <div key={i} className="group relative p-6 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 hover:border-yellow-500/50 transition-all duration-300 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
                  {player.image ? (
                    <img src={player.image} alt={player.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <Users className="w-8 h-8 text-slate-500" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{player.name}</h3>
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-medium">
                  <Star className="w-3 h-3" />
                  {player.achievement}
                </div>
              </div>
            ))}
          </div>

          {/* Other MLB Players */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-6">Other MLB Players Trained</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {otherMLBPlayers.map((player, i) => (
                <span key={i} className="px-4 py-2 rounded-full bg-slate-800 text-slate-300 text-sm font-medium border border-slate-700">
                  {player}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
            READY TO FIX <span className="text-red-500">YOUR SWING?</span>
          </h2>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
            Get the same analysis Rick gives to MLB players. Find your #1 problem and the exact drill to fix it.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-6 text-lg">
              <Link to="/analyze">
                Get Your Swing Score — $37
                <ChevronRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 px-8 py-6 text-lg">
              <Link to="/inner-circle">Join Inner Circle — $297/mo</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}