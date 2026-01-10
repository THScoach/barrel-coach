import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Play, Trash2, Edit, Eye, EyeOff, Loader2, ArrowLeft, Video, CheckCircle2, Clock, AlertCircle, Sparkles } from "lucide-react";
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
  draft: { label: 'Draft', icon: <Clock className="h-3 w-3" />, color: 'bg-gray-500' },
  published: { label: 'Published', icon: <Eye className="h-3 w-3" />, color: 'bg-green-600' },
  failed: { label: 'Failed', icon: <AlertCircle className="h-3 w-3" />, color: 'bg-red-500' }
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

  // Form state
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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos`);
      if (!res.ok) throw new Error('Failed to fetch videos');
      const data = await res.json();
      setVideos(data);
      
      // Check if any videos are still processing
      const hasProcessing = data.some((v: DrillVideo) => 
        ['processing', 'transcribing', 'analyzing'].includes(v.status)
      );
      
      // If processing, poll more frequently
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
        
        // Generate unique filename
        const ext = file.name.split('.').pop() || 'mp4';
        const filename = `${crypto.randomUUID()}.${ext}`;
        const storagePath = `drills/${filename}`;
        const originalTitle = file.name.replace(/\.[^/.]+$/, '') || 'Processing...';

        // Upload directly to Supabase Storage from client (avoids edge function memory limits)
        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Call lightweight edge function to create DB record and trigger pipeline
        const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    
    // Start polling for updates
    if (!pollIntervalRef.current) {
      pollIntervalRef.current = window.setInterval(fetchVideos, 5000);
    }
    
    await fetchVideos();
    setUploading(false);
    setUploadProgress(0);
    
    // Reset file input
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

      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos?id=${editVideo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos?id=${video.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    for (const video of toPublish) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos?id=${video.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-videos?id=${video.id}`, {
        method: 'DELETE'
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
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Video Library Admin</h1>
              <p className="text-sm text-muted-foreground">
                Drop videos to auto-transcribe and tag
              </p>
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
              <label htmlFor="auto-publish" className="text-sm">
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
              <Button disabled={uploading}>
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
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Uploading videos...</p>
                  <Progress value={uploadProgress} className="mt-2" />
                </div>
                <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing Status Banner */}
        {processingCount > 0 && (
          <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <p className="text-sm">
                  <strong>{processingCount} video(s)</strong> processing... 
                  They'll appear here when ready for review.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
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
                <Button variant="outline" size="sm" onClick={selectAllReady}>
                  Select All Ready ({readyCount})
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleBulkPublish}
                  disabled={selectedVideos.size === 0}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Publish Selected ({selectedVideos.size})
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Videos Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredVideos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No videos yet. Upload your first video!
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVideos.map(video => {
                    const status = statusConfig[video.status] || statusConfig.draft;
                    const isProcessing = ['processing', 'transcribing', 'analyzing'].includes(video.status);
                    
                    return (
                      <TableRow key={video.id} className={isProcessing ? 'opacity-70' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedVideos.has(video.id)}
                            onCheckedChange={() => toggleVideoSelection(video.id)}
                            disabled={isProcessing}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-14 bg-muted rounded flex items-center justify-center relative overflow-hidden">
                              {isProcessing ? (
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              ) : (
                                <Video className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium line-clamp-1">{video.title}</p>
                              {video.drill_name && (
                                <p className="text-sm text-muted-foreground">{video.drill_name}</p>
                              )}
                              {video.description && !video.drill_name && (
                                <p className="text-sm text-muted-foreground line-clamp-1">{video.description}</p>
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
                        <TableCell>{formatDuration(video.duration_seconds)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{video.access_level}</Badge>
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
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handlePublish(video)}
                              disabled={isProcessing}
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
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editVideo} onOpenChange={(open) => !open && setEditVideo(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Video</DialogTitle>
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
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200">
                    <Sparkles className="h-5 w-5 text-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-400">
                      AI has pre-filled all fields. Review and publish when ready!
                    </p>
                  </div>
                )}

                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={formData.title}
                      onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">4B Category</label>
                    <Select 
                      value={formData.four_b_category} 
                      onValueChange={v => setFormData(prev => ({ ...prev, four_b_category: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brain">🧠 Brain</SelectItem>
                        <SelectItem value="body">💪 Body</SelectItem>
                        <SelectItem value="bat">🏏 Bat</SelectItem>
                        <SelectItem value="ball">⚾ Ball</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Drill Name</label>
                    <Input
                      value={formData.drill_name}
                      onChange={e => setFormData(prev => ({ ...prev, drill_name: e.target.value }))}
                      placeholder="e.g., Tee Work, Hip Rotation Drill"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Access Level</label>
                    <Select 
                      value={formData.access_level} 
                      onValueChange={v => setFormData(prev => ({ ...prev, access_level: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="inner_circle">Inner Circle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Video Type</label>
                    <Select 
                      value={formData.video_type} 
                      onValueChange={v => setFormData(prev => ({ ...prev, video_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="drill">Drill</SelectItem>
                        <SelectItem value="lesson">Lesson</SelectItem>
                        <SelectItem value="breakdown">Breakdown</SelectItem>
                        <SelectItem value="q_and_a">Q&A</SelectItem>
                        <SelectItem value="live_session">Live Session</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium">Problems Addressed</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {PROBLEMS_LIST.map(problem => (
                        <label key={problem} className="flex items-center gap-1.5 text-sm">
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
                          />
                          {problem.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Motor Profiles</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {MOTOR_PROFILES.map(profile => (
                        <label key={profile} className="flex items-center gap-1.5 text-sm">
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
                          />
                          {profile}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Player Level</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {PLAYER_LEVELS.map(level => (
                        <label key={level} className="flex items-center gap-1.5 text-sm">
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
                          />
                          {level.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium">Tags (comma-separated)</label>
                    <Input
                      value={formData.tags}
                      onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="hip rotation, power, follow through"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium">Transcript</label>
                    <Textarea
                      value={formData.transcript}
                      onChange={e => setFormData(prev => ({ ...prev, transcript: e.target.value }))}
                      rows={6}
                      placeholder="Transcript will appear here after transcription..."
                    />
                  </div>
                </div>

                <div className="flex justify-between gap-3">
                  <Button 
                    variant="default"
                    onClick={() => {
                      handlePublish(editVideo);
                      setEditVideo(null);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Save & Publish
                  </Button>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setEditVideo(null)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
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