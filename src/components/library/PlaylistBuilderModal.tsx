/**
 * Playlist Builder Modal - Create/edit manual playlists by selecting videos
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Loader2, Play, Clock, Search, Brain, Dumbbell, Target, Zap, 
  GripVertical, X
} from "lucide-react";

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

interface PlaylistBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlist: VideoPlaylist | null;
  onSaved: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  brain: <Brain className="h-3 w-3 text-blue-400" />,
  body: <Dumbbell className="h-3 w-3 text-green-400" />,
  bat: <Target className="h-3 w-3 text-red-400" />,
  ball: <Zap className="h-3 w-3 text-orange-400" />
};

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function PlaylistBuilderModal({ open, onOpenChange, playlist, onSaved }: PlaylistBuilderModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [videos, setVideos] = useState<DrillVideo[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [orderedVideos, setOrderedVideos] = useState<DrillVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('drill_videos')
        .select('id, title, thumbnail_url, four_b_category, duration_seconds, status')
        .eq('status', 'published')
        .order('title', { ascending: true });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlaylistVideos = useCallback(async () => {
    if (!playlist) return;

    try {
      const { data, error } = await supabase
        .from('playlist_videos')
        .select(`
          video_id,
          position,
          drill_videos!inner (
            id, title, thumbnail_url, four_b_category, duration_seconds, status
          )
        `)
        .eq('playlist_id', playlist.id)
        .order('position', { ascending: true });

      if (error) throw error;
      
      const videoIds = new Set((data || []).map(pv => pv.video_id));
      setSelectedVideoIds(videoIds);
      
      const ordered = (data || []).map(pv => {
        const video = pv.drill_videos as unknown as DrillVideo;
        return video;
      });
      setOrderedVideos(ordered);
    } catch (error) {
      console.error('Failed to load playlist videos:', error);
    }
  }, [playlist]);

  useEffect(() => {
    if (open) {
      fetchVideos();
      if (playlist) {
        setName(playlist.name);
        setDescription(playlist.description || '');
        fetchPlaylistVideos();
      } else {
        setName('');
        setDescription('');
        setSelectedVideoIds(new Set());
        setOrderedVideos([]);
      }
    }
  }, [open, playlist, fetchVideos, fetchPlaylistVideos]);

  const handleToggleVideo = (video: DrillVideo) => {
    const newSelected = new Set(selectedVideoIds);
    if (newSelected.has(video.id)) {
      newSelected.delete(video.id);
      setOrderedVideos(prev => prev.filter(v => v.id !== video.id));
    } else {
      newSelected.add(video.id);
      setOrderedVideos(prev => [...prev, video]);
    }
    setSelectedVideoIds(newSelected);
  };

  const handleRemoveFromOrder = (videoId: string) => {
    setSelectedVideoIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(videoId);
      return newSet;
    });
    setOrderedVideos(prev => prev.filter(v => v.id !== videoId));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a playlist name');
      return;
    }

    setSaving(true);
    try {
      if (playlist) {
        // Update existing playlist
        const { error: updateError } = await supabase
          .from('video_playlists')
          .update({
            name: name.trim(),
            description: description.trim() || null
          })
          .eq('id', playlist.id);

        if (updateError) throw updateError;

        // Delete existing video associations
        await supabase
          .from('playlist_videos')
          .delete()
          .eq('playlist_id', playlist.id);

        // Add new video associations
        if (orderedVideos.length > 0) {
          const videoRecords = orderedVideos.map((video, index) => ({
            playlist_id: playlist.id,
            video_id: video.id,
            position: index
          }));

          const { error: insertError } = await supabase
            .from('playlist_videos')
            .insert(videoRecords);

          if (insertError) throw insertError;
        }

        toast.success('Playlist updated');
      } else {
        // Create new playlist
        const { data: newPlaylist, error: createError } = await supabase
          .from('video_playlists')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            playlist_type: 'manual',
            is_published: false
          })
          .select()
          .single();

        if (createError) throw createError;

        // Add video associations
        if (orderedVideos.length > 0 && newPlaylist) {
          const videoRecords = orderedVideos.map((video, index) => ({
            playlist_id: newPlaylist.id,
            video_id: video.id,
            position: index
          }));

          const { error: insertError } = await supabase
            .from('playlist_videos')
            .insert(videoRecords);

          if (insertError) throw insertError;
        }

        toast.success('Playlist created');
      }

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save playlist:', error);
      toast.error('Failed to save playlist');
    } finally {
      setSaving(false);
    }
  };

  const filteredVideos = videos.filter(v => 
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDuration = orderedVideos.reduce((acc, v) => acc + (v.duration_seconds || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-slate-950 border-slate-800 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {playlist ? 'Edit Playlist' : 'Create New Playlist'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Playlist Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., 7-Day Power Course"
                className="bg-slate-900 border-slate-700"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="bg-slate-900 border-slate-700"
              />
            </div>
          </div>

          <div className="flex gap-4 flex-1 overflow-hidden">
            {/* Video Selection */}
            <div className="flex-1 flex flex-col border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-slate-800 bg-slate-900/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search videos..."
                    className="pl-10 bg-slate-900 border-slate-700"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredVideos.map(video => (
                      <div 
                        key={video.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedVideoIds.has(video.id) 
                            ? 'bg-primary/20 border border-primary/50' 
                            : 'hover:bg-slate-800'
                        }`}
                        onClick={() => handleToggleVideo(video)}
                      >
                        <Checkbox checked={selectedVideoIds.has(video.id)} />
                        <div className="w-16 h-10 bg-slate-800 rounded flex items-center justify-center flex-shrink-0">
                          {video.thumbnail_url ? (
                            <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover rounded" />
                          ) : (
                            <Play className="h-4 w-4 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{video.title}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            {video.four_b_category && categoryIcons[video.four_b_category]}
                            <span>{formatDuration(video.duration_seconds)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Selected Videos Order */}
            <div className="w-80 flex flex-col border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    Playlist Order ({orderedVideos.length})
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {Math.floor(totalDuration / 60)}m
                  </Badge>
                </div>
              </div>
              <ScrollArea className="flex-1">
                {orderedVideos.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    Select videos from the left to add them here
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {orderedVideos.map((video, index) => (
                      <div 
                        key={video.id}
                        className="flex items-center gap-2 p-2 bg-slate-900 rounded-lg group"
                      >
                        <GripVertical className="h-4 w-4 text-slate-600" />
                        <span className="text-xs text-slate-500 w-4">{index + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{video.title}</p>
                        </div>
                        <button 
                          onClick={() => handleRemoveFromOrder(video.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800 rounded"
                        >
                          <X className="h-3 w-3 text-slate-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {playlist ? 'Update Playlist' : 'Create Playlist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
