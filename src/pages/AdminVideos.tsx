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
import { toast } from "sonner";
import { Upload, Trash2, Edit, Eye, EyeOff, Loader2, ArrowLeft, Video, CheckCircle2, Clock, AlertCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminHeader } from "@/components/AdminHeader";

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
  // Gumlet fields
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

export default function AdminVideos() {
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

  const handleDelete = async (video: DrillVideo) => {
    if (!confirm('Delete this video?')) return;

    try {
      const { data: { session: deleteSession } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos?id=${video.id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${deleteSession?.access_token}`
        }
      });

      if (!res.ok) throw new Error('Delete failed');

      toast.success('Video deleted');
      await fetchVideos();
    } catch (error) {
      toast.error('Failed to delete');
    }
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
    : videos.filter(v => v.status === statusFilter);

  const readyCount = videos.filter(v => v.status === 'ready_for_review').length;
  const processingCount = videos.filter(v => ['processing', 'transcribing', 'analyzing'].includes(v.status)).length;

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Video className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Video Library</h1>
                <p className="text-sm text-slate-400">
                  Drop videos to auto-transcribe and tag
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Auto-publish toggle */}
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
            
            
            {/* Upload button */}
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
          <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
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

        {/* Processing Status Banner */}
        {processingCount > 0 && (
          <div className="mb-6 bg-blue-950/30 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              <p className="text-sm text-blue-300">
                <strong>{processingCount} video(s)</strong> processing... 
                They'll appear here when ready for review.
              </p>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
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
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            {readyCount > 0 && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllReady}
                  className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Select All Ready ({readyCount})
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleBulkPublish}
                  disabled={selectedVideos.size === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Publish Selected ({selectedVideos.size})
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Videos Table */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-12 text-slate-400"></TableHead>
                <TableHead className="text-slate-400">Video</TableHead>
                <TableHead className="text-slate-400">Category</TableHead>
                <TableHead className="text-slate-400">Duration</TableHead>
                <TableHead className="text-slate-400">Access</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-500" />
                  </TableCell>
                </TableRow>
              ) : filteredVideos.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No videos yet. Upload your first video!
                  </TableCell>
                </TableRow>
              ) : (
                filteredVideos.map(video => {
                  const status = statusConfig[video.status] || statusConfig.draft;
                  const isProcessing = ['processing', 'transcribing', 'analyzing'].includes(video.status);
                  
                  return (
                    <TableRow key={video.id} className={`border-slate-800 hover:bg-slate-800/50 ${isProcessing ? 'opacity-70' : ''}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedVideos.has(video.id)}
                          onCheckedChange={() => toggleVideoSelection(video.id)}
                          disabled={isProcessing}
                          className="border-slate-600"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-14 bg-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                            {isProcessing ? (
                              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                            ) : (
                              <Video className="h-6 w-6 text-slate-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium line-clamp-1 text-white">{video.title}</p>
                            {video.drill_name && (
                              <p className="text-sm text-slate-400">{video.drill_name}</p>
                            )}
                            {video.description && !video.drill_name && (
                              <p className="text-sm text-slate-400 line-clamp-1">{video.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {video.four_b_category && (
                          <Badge className={`${categoryColors[video.four_b_category]} text-white`}>
                            {video.four_b_category}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-300">{formatDuration(video.duration_seconds)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">{video.access_level}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${status.color} text-white gap-1`}>
                          {status.icon}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => openEdit(video)}
                            disabled={isProcessing}
                            className="text-slate-400 hover:text-white hover:bg-slate-800"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handlePublish(video)}
                            disabled={isProcessing}
                            className="text-slate-400 hover:text-white hover:bg-slate-800"
                          >
                            {video.status === 'published' ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleDelete(video)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

        {/* Edit Dialog */}
        <Dialog open={!!editVideo} onOpenChange={(open) => !open && setEditVideo(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Edit Video</DialogTitle>
            </DialogHeader>
            {editVideo && (
              <div className="space-y-6">
                {/* Video Preview */}
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video 
                    src={editVideo.video_url} 
                    controls 
                    className="w-full h-full"
                  />
                </div>

                {/* AI-Generated Notice */}
                {editVideo.status === 'ready_for_review' && (
                  <div className="flex items-center gap-2 p-3 bg-green-950/30 rounded-lg border border-green-500/30">
                    <Sparkles className="h-5 w-5 text-green-400" />
                    <p className="text-sm text-green-300">
                      AI has pre-filled all fields. Review and publish when ready!
                    </p>
                  </div>
                )}

                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-slate-300">Title</label>
                    <Input
                      value={formData.title}
                      onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="bg-slate-800/50 border-slate-700 text-white mt-1"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium text-slate-300">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      className="bg-slate-800/50 border-slate-700 text-white mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300">4B Category</label>
                    <Select 
                      value={formData.four_b_category} 
                      onValueChange={v => setFormData(prev => ({ ...prev, four_b_category: v }))}
                    >
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="brain">🧠 Brain</SelectItem>
                        <SelectItem value="body">💪 Body</SelectItem>
                        <SelectItem value="bat">🏏 Bat</SelectItem>
                        <SelectItem value="ball">⚾ Ball</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300">Drill Name</label>
                    <Input
                      value={formData.drill_name}
                      onChange={e => setFormData(prev => ({ ...prev, drill_name: e.target.value }))}
                      placeholder="e.g., Tee Work, Hip Rotation Drill"
                      className="bg-slate-800/50 border-slate-700 text-white mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300">Access Level</label>
                    <Select 
                      value={formData.access_level} 
                      onValueChange={v => setFormData(prev => ({ ...prev, access_level: v }))}
                    >
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="paid">Academy</SelectItem>
                        <SelectItem value="inner_circle">Private Coaching</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300">Video Type</label>
                    <Select 
                      value={formData.video_type} 
                      onValueChange={v => setFormData(prev => ({ ...prev, video_type: v }))}
                    >
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="drill">Drill</SelectItem>
                        <SelectItem value="lesson">Lesson</SelectItem>
                        <SelectItem value="breakdown">Breakdown</SelectItem>
                        <SelectItem value="q_and_a">Q&A</SelectItem>
                        <SelectItem value="live_session">Live Session</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium text-slate-300">Problems Addressed</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {PROBLEMS_LIST.map(problem => (
                        <label key={problem} className="flex items-center gap-1.5 text-sm text-slate-300">
                          <Checkbox
                            checked={formData.problems_addressed.includes(problem)}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({
                                ...prev,
                                problems_addressed: checked
                                  ? [...prev.problems_addressed, problem]
                                  : prev.problems_addressed.filter(p => p !== problem)
                              }));
                            }}
                            className="border-slate-600"
                          />
                          {problem.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300">Motor Profiles</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {MOTOR_PROFILES.map(profile => (
                        <label key={profile} className="flex items-center gap-1.5 text-sm text-slate-300">
                          <Checkbox
                            checked={formData.motor_profiles.includes(profile)}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({
                                ...prev,
                                motor_profiles: checked
                                  ? [...prev.motor_profiles, profile]
                                  : prev.motor_profiles.filter(p => p !== profile)
                              }));
                            }}
                            className="border-slate-600"
                          />
                          {profile}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300">Player Level</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {PLAYER_LEVELS.map(level => (
                        <label key={level} className="flex items-center gap-1.5 text-sm text-slate-300">
                          <Checkbox
                            checked={formData.player_level.includes(level)}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({
                                ...prev,
                                player_level: checked
                                  ? [...prev.player_level, level]
                                  : prev.player_level.filter(l => l !== level)
                              }));
                            }}
                            className="border-slate-600"
                          />
                          {level.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium text-slate-300">Tags (comma-separated)</label>
                    <Input
                      value={formData.tags}
                      onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="hip rotation, power, follow through"
                      className="bg-slate-800/50 border-slate-700 text-white mt-1"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium text-slate-300">Transcript</label>
                    <Textarea
                      value={formData.transcript}
                      onChange={e => setFormData(prev => ({ ...prev, transcript: e.target.value }))}
                      rows={6}
                      placeholder="Transcript will appear here after transcription..."
                      className="bg-slate-800/50 border-slate-700 text-white mt-1"
                    />
                  </div>
                </div>

                <div className="flex justify-between gap-3">
                  <Button 
                    onClick={() => {
                      handlePublish(editVideo);
                      setEditVideo(null);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Save & Publish
                  </Button>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setEditVideo(null)}
                      className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSave}
                      className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                    >
                      Save Draft
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
