/**
 * Videos Tab - Displays instructional/drill videos in the Library
 * Moved from AdminVideos.tsx to consolidate under Library navigation
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { 
  Upload, Trash2, Edit, Eye, EyeOff, Loader2, Video, 
  CheckCircle2, Clock, AlertCircle, Sparkles 
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface DrillVideo {
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
  tags: string[] | null;
  access_level: string;
  duration_seconds: number | null;
  video_type: string;
  player_level: string[] | null;
  status: string;
  published_at: string | null;
  created_at: string;
  gumlet_asset_id?: string | null;
  gumlet_playback_url?: string | null;
  gumlet_hls_url?: string | null;
}

const PROBLEMS_LIST = [
  'spinning_out', 'casting', 'late_timing', 'early_timing', 'drifting',
  'rolling_over', 'ground_balls', 'no_power', 'chasing_pitches',
  'collapsing_back_side', 'long_swing', 'weak_rotation', 'poor_balance',
  'head_movement', 'bat_drag', 'uppercut', 'chopping'
];

const PLAYER_LEVELS = ['youth', 'travel', 'high_school', 'college', 'pro'];
const MOTOR_PROFILES = ['whipper', 'spinner', 'slinger', 'puncher'];

const categoryColors: Record<string, string> = {
  brain: 'bg-blue-500',
  body: 'bg-green-500',
  bat: 'bg-red-500',
  ball: 'bg-orange-500'
};

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  processing: { label: 'Uploading...', icon: <Loader2 className="h-3 w-3 animate-spin" />, color: 'bg-yellow-500' },
  transcribing: { label: 'Transcribing...', icon: <Loader2 className="h-3 w-3 animate-spin" />, color: 'bg-blue-500' },
  analyzing: { label: 'Analyzing...', icon: <Sparkles className="h-3 w-3 animate-pulse" />, color: 'bg-purple-500' },
  ready_for_review: { label: 'Ready for Review', icon: <CheckCircle2 className="h-3 w-3" />, color: 'bg-green-500' },
  draft: { label: 'Draft', icon: <Clock className="h-3 w-3" />, color: 'bg-slate-500' },
  published: { label: 'Published', icon: <Eye className="h-3 w-3" />, color: 'bg-green-600' },
  failed: { label: 'Failed', icon: <AlertCircle className="h-3 w-3" />, color: 'bg-red-500' },
  processing_failed: { label: 'Gumlet Failed', icon: <AlertCircle className="h-3 w-3" />, color: 'bg-red-500' }
};

export function VideosTab() {
  const [videos, setVideos] = useState<DrillVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editVideo, setEditVideo] = useState<DrillVideo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoPublish, setAutoPublish] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    four_b_category: '',
    drill_name: '',
    problems_addressed: [] as string[],
    motor_profiles: [] as string[],
    access_level: 'paid',
    video_type: 'drill',
    player_level: [] as string[],
    tags: '',
    transcript: ''
  });

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<DrillVideo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchVideos = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch videos');
      const data = await res.json();
      setVideos(data);
      
      const hasProcessing = data.some((v: DrillVideo) => 
        ['processing', 'transcribing', 'analyzing'].includes(v.status)
      );
      
      if (hasProcessing && !pollIntervalRef.current) {
        pollIntervalRef.current = window.setInterval(fetchVideos, 5000);
      } else if (!hasProcessing && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchVideos]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const totalFiles = files.length;
    let completedFiles = 0;

    for (const file of Array.from(files)) {
      try {
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100));
        
        const ext = file.name.split('.').pop() || 'mp4';
        const filename = `${crypto.randomUUID()}.${ext}`;
        const storagePath = `drills/${filename}`;
        const originalTitle = file.name.replace(/\.[^/.]+$/, '') || 'Processing...';

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        const { data: { session: uploadSession } } = await supabase.auth.getSession();
        const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-video`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${uploadSession?.access_token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            storage_path: storagePath,
            original_title: originalTitle,
            auto_publish: autoPublish
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Pipeline failed for ${file.name}`);
        }

        completedFiles++;
        toast.success(`Uploaded: ${file.name}`);
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploadProgress(100);
    toast.success(`${completedFiles} video(s) uploaded! Processing started automatically.`);
    
    if (!pollIntervalRef.current) {
      pollIntervalRef.current = window.setInterval(fetchVideos, 5000);
    }
    
    await fetchVideos();
    setUploading(false);
    setUploadProgress(0);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!editVideo) return;

    try {
      const updates = {
        title: formData.title,
        description: formData.description || null,
        four_b_category: formData.four_b_category || null,
        drill_name: formData.drill_name || null,
        problems_addressed: formData.problems_addressed.length ? formData.problems_addressed : null,
        motor_profiles: formData.motor_profiles.length ? formData.motor_profiles : null,
        access_level: formData.access_level,
        video_type: formData.video_type,
        player_level: formData.player_level.length ? formData.player_level : null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        transcript: formData.transcript || null
      };

      const { data: { session: saveSession } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos?id=${editVideo.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${saveSession?.access_token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(updates)
      });

      if (!res.ok) throw new Error('Save failed');

      toast.success('Video saved!');
      await fetchVideos();
      setEditVideo(null);
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const handlePublish = async (video: DrillVideo) => {
    const newStatus = video.status === 'published' ? 'draft' : 'published';
    
    try {
      const { data: { session: publishSession } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos?id=${video.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${publishSession?.access_token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error('Update failed');

      toast.success(newStatus === 'published' ? 'Video published!' : 'Video unpublished');
      await fetchVideos();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleBulkPublish = async () => {
    const toPublish = videos.filter(v => 
      selectedVideos.has(v.id) && v.status !== 'published'
    );
    
    if (toPublish.length === 0) {
      toast.error('No videos selected for publishing');
      return;
    }

    let published = 0;
    const { data: { session: bulkSession } } = await supabase.auth.getSession();
    for (const video of toPublish) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos?id=${video.id}`, {
          method: 'PUT',
          headers: { 
            'Authorization': `Bearer ${bulkSession?.access_token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({ status: 'published' })
        });
        if (res.ok) published++;
      } catch (error) {
        console.error('Failed to publish:', video.id);
      }
    }

    toast.success(`Published ${published} video(s)!`);
    setSelectedVideos(new Set());
    await fetchVideos();
  };

  // Extract storage path from video_url 
  const extractStoragePath = (video: DrillVideo): string | null => {
    if (!video.video_url) return null;
    // URL format: https://xxx.supabase.co/storage/v1/object/public/videos/drills/xxx.mp4
    const match = video.video_url.match(/\/videos\/(.+)$/);
    return match ? match[1] : null;
  };

  const deleteVideoWithStorage = async (video: DrillVideo) => {
    // Try to delete from storage first
    const storagePath = extractStoragePath(video);
    if (storagePath) {
      try {
        await supabase.storage.from('videos').remove([storagePath]);
      } catch (storageError) {
        console.warn('Storage delete failed (may already be deleted):', storageError);
      }
    }
    
    // Delete from database via edge function
    const { data: { session: deleteSession } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos?id=${video.id}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${deleteSession?.access_token}`
      }
    });

    if (!res.ok) throw new Error('Delete failed');
  };

  const handleDelete = async (video: DrillVideo) => {
    setVideoToDelete(video);
  };

  const confirmDelete = async () => {
    if (!videoToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteVideoWithStorage(videoToDelete);
      toast.success('Video deleted');
      await fetchVideos();
    } catch (error) {
      toast.error('Failed to delete');
    } finally {
      setIsDeleting(false);
      setVideoToDelete(null);
    }
  };

  const handleBulkDeleteFailed = async () => {
    const failedVideos = videos.filter(v => 
      ['failed', 'processing_failed', 'pending'].includes(v.status)
    );
    
    if (failedVideos.length === 0) {
      toast.error('No failed videos to delete');
      setShowBulkDeleteDialog(false);
      return;
    }

    setIsDeleting(true);
    let deletedCount = 0;
    
    for (const video of failedVideos) {
      try {
        await deleteVideoWithStorage(video);
        deletedCount++;
      } catch (error) {
        console.error('Failed to delete video:', video.id, error);
      }
    }
    
    toast.success(`Deleted ${deletedCount} failed video(s)`);
    setIsDeleting(false);
    setShowBulkDeleteDialog(false);
    await fetchVideos();
  };

  const openEdit = (video: DrillVideo) => {
    setEditVideo(video);
    setFormData({
      title: video.title,
      description: video.description || '',
      four_b_category: video.four_b_category || '',
      drill_name: video.drill_name || '',
      problems_addressed: video.problems_addressed || [],
      motor_profiles: video.motor_profiles || [],
      access_level: video.access_level,
      video_type: video.video_type,
      player_level: video.player_level || [],
      tags: (video.tags || []).join(', '),
      transcript: video.transcript || ''
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleVideoSelection = (id: string) => {
    const newSelection = new Set(selectedVideos);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedVideos(newSelection);
  };

  const selectAllReady = () => {
    const readyVideos = videos.filter(v => v.status === 'ready_for_review');
    setSelectedVideos(new Set(readyVideos.map(v => v.id)));
  };

  const filteredVideos = statusFilter === 'all' 
    ? videos 
    : statusFilter === 'failed'
      ? videos.filter(v => ['failed', 'processing_failed', 'pending'].includes(v.status))
      : videos.filter(v => v.status === statusFilter);

  const readyCount = videos.filter(v => v.status === 'ready_for_review').length;
  const processingCount = videos.filter(v => ['processing', 'transcribing', 'analyzing'].includes(v.status)).length;
  const failedCount = videos.filter(v => ['failed', 'processing_failed', 'pending'].includes(v.status)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Video className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Instructional Videos</h2>
            <p className="text-sm text-slate-400">Drop videos to auto-transcribe and tag</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoPublish}
              onCheckedChange={setAutoPublish}
              id="auto-publish"
            />
            <label htmlFor="auto-publish" className="text-sm text-slate-300">
              Auto-publish
            </label>
          </div>
          
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <Button 
              disabled={uploading}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Videos
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <Loader2 className="h-5 w-5 animate-spin text-red-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Uploading videos...</p>
              <Progress value={uploadProgress} className="mt-2" />
            </div>
            <span className="text-sm text-slate-400">{uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* Processing Banner - only show when videos are actively processing */}
      {processingCount > 0 && (
        <div className="bg-blue-950/30 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            <p className="text-sm text-blue-300">
              <strong>{processingCount} video(s)</strong> processing...
            </p>
          </div>
        </div>
      )}
      
      {/* Failed Banner - show when there are failed videos and no active processing */}
      {processingCount === 0 && failedCount > 0 && (
        <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-sm text-red-300">
                <strong>{failedCount} video(s)</strong> failed to process. Use "Clear All Failed" to remove them.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 bg-slate-900/50 border-slate-700 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ready_for_review">Ready for Review ({readyCount})</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="failed">Failed ({failedCount})</SelectItem>
            </SelectContent>
          </Select>

          {failedCount > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Failed ({failedCount})
            </Button>
          )}
        </div>

        {selectedVideos.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{selectedVideos.size} selected</span>
            <Button size="sm" onClick={handleBulkPublish}>
              Publish Selected
            </Button>
          </div>
        )}

        {readyCount > 0 && selectedVideos.size === 0 && (
          <Button variant="outline" size="sm" onClick={selectAllReady}>
            Select All Ready ({readyCount})
          </Button>
        )}
      </div>

      {/* Videos Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-slate-800/50">
              <TableHead className="w-8">
                <Checkbox 
                  checked={selectedVideos.size === filteredVideos.length && filteredVideos.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedVideos(new Set(filteredVideos.map(v => v.id)));
                    } else {
                      setSelectedVideos(new Set());
                    }
                  }}
                />
              </TableHead>
              <TableHead className="text-slate-300">Video</TableHead>
              <TableHead className="text-slate-300">Category</TableHead>
              <TableHead className="text-slate-300">Status</TableHead>
              <TableHead className="text-slate-300">Duration</TableHead>
              <TableHead className="text-slate-300 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVideos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                  No videos yet. Upload some to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredVideos.map((video) => {
                const status = statusConfig[video.status] || statusConfig.draft;
                return (
                  <TableRow key={video.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <Checkbox 
                        checked={selectedVideos.has(video.id)}
                        onCheckedChange={() => toggleVideoSelection(video.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-10 rounded bg-slate-800 flex items-center justify-center overflow-hidden">
                          {video.thumbnail_url ? (
                            <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Video className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white truncate max-w-[200px]">{video.title}</p>
                          <p className="text-xs text-slate-500">{video.drill_name || video.video_type}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {video.four_b_category && (
                        <Badge className={`${categoryColors[video.four_b_category]} text-white text-xs`}>
                          {video.four_b_category}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`${status.color} text-white border-0 flex items-center gap-1 w-fit`}
                      >
                        {status.icon}
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {formatDuration(video.duration_seconds)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePublish(video)}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                        >
                          {video.status === 'published' ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(video)}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(video)}
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete All Failed Uploads?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will permanently delete {failedCount} failed/pending video(s) and their storage files. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDeleteFailed}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete All Failed'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Individual Delete Confirmation Dialog */}
      <AlertDialog open={!!videoToDelete} onOpenChange={(open) => !open && setVideoToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Video?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will permanently delete "{videoToDelete?.title}" and its storage file. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editVideo} onOpenChange={() => setEditVideo(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Video</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">4B Category</label>
                <Select 
                  value={formData.four_b_category} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, four_b_category: val }))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="brain">Brain</SelectItem>
                    <SelectItem value="body">Body</SelectItem>
                    <SelectItem value="bat">Bat</SelectItem>
                    <SelectItem value="ball">Ball</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Access Level</label>
                <Select 
                  value={formData.access_level} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, access_level: val }))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select access" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid">Academy</SelectItem>
                    <SelectItem value="inner_circle">Private Coaching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Problems Addressed</label>
              <div className="flex flex-wrap gap-2">
                {PROBLEMS_LIST.map((problem) => (
                  <Badge
                    key={problem}
                    variant={formData.problems_addressed.includes(problem) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        problems_addressed: prev.problems_addressed.includes(problem)
                          ? prev.problems_addressed.filter(p => p !== problem)
                          : [...prev.problems_addressed, problem]
                      }));
                    }}
                  >
                    {problem.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Motor Profiles</label>
              <div className="flex flex-wrap gap-2">
                {MOTOR_PROFILES.map((profile) => (
                  <Badge
                    key={profile}
                    variant={formData.motor_profiles.includes(profile) ? "default" : "outline"}
                    className="cursor-pointer capitalize"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        motor_profiles: prev.motor_profiles.includes(profile)
                          ? prev.motor_profiles.filter(p => p !== profile)
                          : [...prev.motor_profiles, profile]
                      }));
                    }}
                  >
                    {profile}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Player Levels</label>
              <div className="flex flex-wrap gap-2">
                {PLAYER_LEVELS.map((level) => (
                  <Badge
                    key={level}
                    variant={formData.player_level.includes(level) ? "default" : "outline"}
                    className="cursor-pointer capitalize"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        player_level: prev.player_level.includes(level)
                          ? prev.player_level.filter(l => l !== level)
                          : [...prev.player_level, level]
                      }));
                    }}
                  >
                    {level.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Tags (comma-separated)</label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="power, timing, mechanics"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditVideo(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
