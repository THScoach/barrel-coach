/**
 * Collections Tab - Dynamic 4B collections and manual playlists
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Brain, Dumbbell, Target, Zap, Plus, Folder, Play, Clock, 
  ListVideo, Grid3X3, Trash2, Edit, Eye, EyeOff, Loader2, GripVertical
} from "lucide-react";
import { PlaylistBuilderModal } from "./PlaylistBuilderModal";

interface VideoPlaylist {
  id: string;
  name: string;
  description: string | null;
  playlist_type: 'manual' | 'smart';
  smart_filter: { four_b_category?: string; problems?: string[] } | null;
  cover_image_url: string | null;
  is_published: boolean;
  video_count: number;
  total_duration_seconds: number;
  created_at: string;
}

interface DrillVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  four_b_category: string | null;
  duration_seconds: number | null;
  status: string;
}

interface CategoryStats {
  category: string;
  count: number;
  totalDuration: number;
}

const categoryConfig = {
  brain: { 
    icon: Brain, 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/20', 
    borderColor: 'border-blue-500/50',
    label: 'Brain'
  },
  body: { 
    icon: Dumbbell, 
    color: 'text-green-400', 
    bgColor: 'bg-green-500/20', 
    borderColor: 'border-green-500/50',
    label: 'Body'
  },
  bat: { 
    icon: Target, 
    color: 'text-red-400', 
    bgColor: 'bg-red-500/20', 
    borderColor: 'border-red-500/50',
    label: 'Bat'
  },
  ball: { 
    icon: Zap, 
    color: 'text-orange-400', 
    bgColor: 'bg-orange-500/20', 
    borderColor: 'border-orange-500/50',
    label: 'Ball'
  }
};

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTotalDuration = (seconds: number): string => {
  if (!seconds) return '0 min';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} min`;
};

export function CollectionsTab() {
  const [activeView, setActiveView] = useState<'smart' | 'manual'>('smart');
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [playlists, setPlaylists] = useState<VideoPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<VideoPlaylist | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryVideos, setCategoryVideos] = useState<DrillVideo[]>([]);
  const [loadingCategoryVideos, setLoadingCategoryVideos] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch category stats from published videos
      const { data: videos, error: videosError } = await supabase
        .from('drill_videos')
        .select('four_b_category, duration_seconds')
        .eq('status', 'published');

      if (videosError) throw videosError;

      // Calculate stats per category
      const stats: Record<string, { count: number; totalDuration: number }> = {};
      (videos || []).forEach(v => {
        const cat = v.four_b_category || 'uncategorized';
        if (!stats[cat]) stats[cat] = { count: 0, totalDuration: 0 };
        stats[cat].count++;
        stats[cat].totalDuration += v.duration_seconds || 0;
      });

      setCategoryStats(
        Object.entries(stats)
          .filter(([cat]) => cat in categoryConfig)
          .map(([category, data]) => ({ category, ...data }))
      );

      // Fetch manual playlists
      const { data: playlistData, error: playlistError } = await supabase
        .from('video_playlists')
        .select('*')
        .order('created_at', { ascending: false });

      if (playlistError) throw playlistError;
      setPlaylists((playlistData || []) as VideoPlaylist[]);

    } catch (error) {
      console.error('Failed to load collections:', error);
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategoryVideos = async (category: string) => {
    setLoadingCategoryVideos(true);
    try {
      const { data, error } = await supabase
        .from('drill_videos')
        .select('id, title, thumbnail_url, four_b_category, duration_seconds, status')
        .eq('status', 'published')
        .eq('four_b_category', category)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCategoryVideos(data || []);
    } catch (error) {
      console.error('Failed to load category videos:', error);
    } finally {
      setLoadingCategoryVideos(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedCategory) {
      fetchCategoryVideos(selectedCategory);
    }
  }, [selectedCategory]);

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Delete this playlist? Videos will not be deleted.')) return;
    
    try {
      const { error } = await supabase
        .from('video_playlists')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Playlist deleted');
      fetchData();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      toast.error('Failed to delete playlist');
    }
  };

  const handleTogglePublish = async (playlist: VideoPlaylist) => {
    try {
      const { error } = await supabase
        .from('video_playlists')
        .update({ is_published: !playlist.is_published })
        .eq('id', playlist.id);

      if (error) throw error;
      toast.success(playlist.is_published ? 'Playlist unpublished' : 'Playlist published');
      fetchData();
    } catch (error) {
      console.error('Failed to toggle publish:', error);
      toast.error('Failed to update playlist');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex items-center justify-between">
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'smart' | 'manual')}>
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="smart" className="data-[state=active]:bg-primary">
              <Grid3X3 className="h-4 w-4 mr-2" />
              4B Collections
            </TabsTrigger>
            <TabsTrigger value="manual" className="data-[state=active]:bg-primary">
              <ListVideo className="h-4 w-4 mr-2" />
              Playlists
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeView === 'manual' && (
          <Button onClick={() => { setEditingPlaylist(null); setIsBuilderOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Playlist
          </Button>
        )}
      </div>

      {/* Smart Collections View */}
      {activeView === 'smart' && (
        <div className="space-y-6">
          <p className="text-slate-400">
            Videos automatically grouped by their 4B category tags
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {categoryStats.map(stat => {
              const config = categoryConfig[stat.category as keyof typeof categoryConfig];
              if (!config) return null;
              const Icon = config.icon;
              
              return (
                <Dialog key={stat.category}>
                  <DialogTrigger asChild>
                    <Card 
                      className={`cursor-pointer transition-all hover:scale-[1.02] ${config.bgColor} ${config.borderColor} border-2`}
                      onClick={() => setSelectedCategory(stat.category)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Icon className={`h-8 w-8 ${config.color}`} />
                          <Badge variant="secondary" className="text-lg font-bold">
                            {stat.count}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardTitle className={`text-xl ${config.color}`}>{config.label}</CardTitle>
                        <div className="flex items-center gap-1 mt-2 text-slate-400 text-sm">
                          <Clock className="h-3 w-3" />
                          {formatTotalDuration(stat.totalDuration)}
                        </div>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl bg-slate-950 border-slate-800">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        {config.label} Videos
                        <Badge variant="secondary">{stat.count}</Badge>
                      </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                      {loadingCategoryVideos ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-1">
                          {categoryVideos.map(video => (
                            <div 
                              key={video.id}
                              className="group relative rounded-lg overflow-hidden bg-slate-900 border border-slate-800"
                            >
                              <div className="aspect-video bg-slate-800 flex items-center justify-center">
                                {video.thumbnail_url ? (
                                  <img 
                                    src={video.thumbnail_url} 
                                    alt={video.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Play className="h-8 w-8 text-slate-600" />
                                )}
                              </div>
                              <div className="p-2">
                                <p className="text-sm font-medium text-white truncate">
                                  {video.title}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {formatDuration(video.duration_seconds)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual Playlists View */}
      {activeView === 'manual' && (
        <div className="space-y-4">
          {playlists.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 rounded-lg border border-slate-800">
              <Folder className="h-12 w-12 mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No playlists yet</h3>
              <p className="text-slate-400 mb-4">
                Create your first playlist like "7-Day Power Course"
              </p>
              <Button onClick={() => { setEditingPlaylist(null); setIsBuilderOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Create Playlist
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map(playlist => (
                <Card key={playlist.id} className="bg-slate-900 border-slate-800 overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center relative">
                    {playlist.cover_image_url ? (
                      <img 
                        src={playlist.cover_image_url} 
                        alt={playlist.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ListVideo className="h-12 w-12 text-primary/50" />
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                      {playlist.video_count} videos
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-white">{playlist.name}</h3>
                        {playlist.description && (
                          <p className="text-sm text-slate-400 line-clamp-2">{playlist.description}</p>
                        )}
                      </div>
                      <Badge variant={playlist.is_published ? 'default' : 'secondary'}>
                        {playlist.is_published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTotalDuration(playlist.total_duration_seconds)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => { setEditingPlaylist(playlist); setIsBuilderOpen(true); }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleTogglePublish(playlist)}
                      >
                        {playlist.is_published ? (
                          <><EyeOff className="h-3 w-3 mr-1" /> Unpublish</>
                        ) : (
                          <><Eye className="h-3 w-3 mr-1" /> Publish</>
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleDeletePlaylist(playlist.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Playlist Builder Modal */}
      <PlaylistBuilderModal 
        open={isBuilderOpen}
        onOpenChange={setIsBuilderOpen}
        playlist={editingPlaylist}
        onSaved={fetchData}
      />
    </div>
  );
}
