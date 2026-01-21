/**
 * Transcript Search - Search videos by spoken content
 * Uses full-text search across video transcripts
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GumletVideoPlayer } from "@/components/video/GumletVideoPlayer";
import { 
  Search, 
  Loader2, 
  Play, 
  Clock,
  Brain,
  Activity,
  Zap,
  Target,
  X,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";

interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  transcript: string | null;
  four_b_category: string | null;
  duration_seconds: number | null;
  gumlet_playback_url: string | null;
  gumlet_hls_url: string | null;
  relevance_score: number;
  matched_excerpt: string | null;
}

interface TranscriptSearchProps {
  onVideoSelect?: (video: SearchResult) => void;
  showInlinePlayer?: boolean;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Brain; color: string; bgColor: string }> = {
  brain: { icon: Brain, color: "text-purple-400", bgColor: "bg-purple-500/10" },
  body: { icon: Activity, color: "text-blue-400", bgColor: "bg-blue-500/10" },
  bat: { icon: Zap, color: "text-orange-400", bgColor: "bg-orange-500/10" },
  ball: { icon: Target, color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptSearch({ onVideoSelect, showInlinePlayer = true }: TranscriptSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState<SearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      searchVideos(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const searchVideos = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.rpc('search_videos_by_concept', {
        search_query: searchQuery,
        max_results: 20
      });

      if (error) throw error;
      setResults((data || []) as SearchResult[]);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoClick = (video: SearchResult) => {
    if (showInlinePlayer) {
      setActiveVideo(video);
    }
    onVideoSelect?.(video);
  };

  const sanitizeHtml = (html: string) => {
    return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['mark'] });
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search transcripts... (e.g., 'backside', 'hip rotation', 'barrel path')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Searching transcripts...</span>
        </div>
      ) : hasSearched && results.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No videos found mentioning "{query}"</p>
          <p className="text-sm mt-1">Try different keywords or phrases</p>
        </div>
      ) : results.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {results.length} video{results.length !== 1 ? 's' : ''} mention "{query}"
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y divide-border">
                {results.map((video) => {
                  const config = CATEGORY_CONFIG[video.four_b_category?.toLowerCase() || "brain"];
                  const Icon = config?.icon || Brain;

                  return (
                    <button
                      key={video.id}
                      onClick={() => handleVideoClick(video)}
                      className="w-full flex items-start gap-4 p-4 text-left hover:bg-muted/50 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-28 h-16 bg-muted rounded overflow-hidden shrink-0">
                        {video.thumbnail_url ? (
                          <img 
                            src={video.thumbnail_url} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        {video.duration_seconds && (
                          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(video.duration_seconds)}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground line-clamp-1">
                            {video.title}
                          </span>
                          {video.four_b_category && (
                            <Badge 
                              variant="secondary" 
                              className={cn("text-xs shrink-0", config?.bgColor, config?.color)}
                            >
                              <Icon className="h-3 w-3 mr-1" />
                              {video.four_b_category}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Matched excerpt with highlighting */}
                        {video.matched_excerpt && (
                          <p 
                            className="text-sm text-muted-foreground line-clamp-2 [&>mark]:bg-yellow-500/30 [&>mark]:text-foreground [&>mark]:px-0.5 [&>mark]:rounded"
                            dangerouslySetInnerHTML={{ 
                              __html: sanitizeHtml(video.matched_excerpt) 
                            }}
                          />
                        )}

                        {/* Relevance indicator */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Relevance: {(video.relevance_score * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      {/* Inline Video Player Dialog */}
      {showInlinePlayer && activeVideo && (
        <Dialog open={!!activeVideo} onOpenChange={() => setActiveVideo(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle>{activeVideo.title}</DialogTitle>
            </DialogHeader>
            <div className="aspect-video bg-black">
              <GumletVideoPlayer
                src={activeVideo.gumlet_hls_url || activeVideo.gumlet_playback_url || activeVideo.video_url}
                poster={activeVideo.thumbnail_url || undefined}
                autoPlay
                showControls
              />
            </div>
            {activeVideo.description && (
              <div className="p-4 pt-0">
                <p className="text-sm text-muted-foreground">{activeVideo.description}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
