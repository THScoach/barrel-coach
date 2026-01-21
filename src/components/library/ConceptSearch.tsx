/**
 * Concept Search - Search video titles AND transcripts
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Search, Loader2, Play, Clock, Brain, Dumbbell, Target, Zap, 
  FileText, X, Sparkles
} from "lucide-react";
import DOMPurify from "dompurify";

interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  transcript: string | null;
  four_b_category: string | null;
  problems_addressed: string[] | null;
  duration_seconds: number | null;
  status: string;
  gumlet_playback_url: string | null;
  gumlet_hls_url: string | null;
  relevance_score: number;
  matched_excerpt: string | null;
}

interface ConceptSearchProps {
  onVideoSelect?: (video: SearchResult) => void;
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  brain: { icon: <Brain className="h-4 w-4" />, color: 'text-blue-400' },
  body: { icon: <Dumbbell className="h-4 w-4" />, color: 'text-green-400' },
  bat: { icon: <Target className="h-4 w-4" />, color: 'text-red-400' },
  ball: { icon: <Zap className="h-4 w-4" />, color: 'text-orange-400' }
};

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const sanitizeHeadline = (html: string): string => {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['mark'] });
};

export function ConceptSearch({ onVideoSelect }: ConceptSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const searchVideos = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      // Use the enhanced search function that searches transcripts
      const { data, error } = await supabase.rpc('search_videos_by_concept', {
        search_query: searchQuery,
        category_filter: null,
        max_results: 50
      });

      if (error) throw error;
      setResults((data || []) as SearchResult[]);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchVideos(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchVideos]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search by concept (e.g., "The Anchor", "hip rotation", "timing")...'
          className="pl-12 pr-24 py-6 text-lg bg-slate-900 border-slate-700 focus:border-primary"
        />
        {query && (
          <button 
            onClick={handleClear}
            className="absolute right-16 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 rounded"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        )}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Sparkles className="h-5 w-5 text-slate-500" />
          )}
        </div>
      </div>

      {/* Search hint */}
      {!hasSearched && (
        <p className="text-center text-sm text-slate-500 mt-2">
          Searches video titles and full transcripts to find every mention
        </p>
      )}

      {/* Results */}
      {hasSearched && (
        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {results.length} {results.length === 1 ? 'result' : 'results'} for "{query}"
            </span>
            {results.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Transcript Match
              </Badge>
            )}
          </div>

          <ScrollArea className="max-h-[400px]">
            {results.length === 0 && !loading ? (
              <div className="p-8 text-center text-slate-500">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>No videos found mentioning "{query}"</p>
                <p className="text-sm mt-1">Try different keywords or phrases</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {results.map(video => {
                  const catConfig = video.four_b_category 
                    ? categoryConfig[video.four_b_category] 
                    : null;

                  return (
                    <div 
                      key={video.id}
                      className="p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                      onClick={() => onVideoSelect?.(video)}
                    >
                      <div className="flex gap-4">
                        {/* Thumbnail */}
                        <div className="w-24 h-16 bg-slate-800 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {video.thumbnail_url ? (
                            <img 
                              src={video.thumbnail_url} 
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Play className="h-6 w-6 text-slate-600" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-white truncate">
                              {video.title}
                            </h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {catConfig && (
                                <span className={catConfig.color}>
                                  {catConfig.icon}
                                </span>
                              )}
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(video.duration_seconds)}
                              </span>
                            </div>
                          </div>

                          {/* Matched excerpt from transcript */}
                          {video.matched_excerpt && (
                            <p 
                              className="text-sm text-slate-400 mt-2 line-clamp-2"
                              dangerouslySetInnerHTML={{ 
                                __html: sanitizeHeadline(video.matched_excerpt) 
                              }}
                            />
                          )}

                          {/* Relevance indicator */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden max-w-32">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${Math.min(video.relevance_score * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">
                              {(video.relevance_score * 100).toFixed(0)}% match
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
