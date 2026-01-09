import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, Mic, Tag, Play, Trash2, Edit, Eye, EyeOff, Loader2, ArrowLeft, Video } from "lucide-react";
import { Link } from "react-router-dom";

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

export default function AdminVideos() {
  const [videos, setVideos] = useState<DrillVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editVideo, setEditVideo] = useState<DrillVideo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
    } catch (error) {
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('title', formData.title || file.name);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-video`, {
        method: 'POST',
        body: formDataUpload
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!res.ok) throw new Error('Upload failed');

      const { video_id } = await res.json();
      toast.success('Video uploaded successfully!');
      
      // Fetch the new video and open edit
      await fetchVideos();
      const newVideo = videos.find(v => v.id === video_id);
      if (newVideo) {
        setEditVideo(newVideo);
      }
      setUploadOpen(false);
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleTranscribe = async () => {
    if (!editVideo) return;

    setTranscribing(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: editVideo.id })
      });

      if (!res.ok) throw new Error('Transcription failed');

      const { transcript, duration } = await res.json();
      
      setFormData(prev => ({ ...prev, transcript }));
      setEditVideo(prev => prev ? { ...prev, transcript, duration_seconds: duration } : null);
      
      toast.success('Transcription complete!');
      await fetchVideos();
    } catch (error) {
      toast.error('Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  const handleAutoTag = async () => {
    if (!editVideo) return;

    setAutoTagging(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/auto-tag-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: editVideo.id })
      });

      if (!res.ok) throw new Error('Auto-tagging failed');

      const { analysis } = await res.json();
      
      setFormData(prev => ({
        ...prev,
        title: analysis.suggested_title || prev.title,
        description: analysis.suggested_description || prev.description,
        four_b_category: analysis.four_b_category || prev.four_b_category,
        drill_name: analysis.drill_name || prev.drill_name,
        problems_addressed: analysis.problems_addressed || prev.problems_addressed,
        motor_profiles: analysis.motor_profiles || prev.motor_profiles,
        video_type: analysis.video_type || prev.video_type,
        player_level: analysis.player_level || prev.player_level,
        tags: (analysis.suggested_tags || []).join(', ')
      }));
      
      toast.success('Auto-tagging complete! Review suggestions.');
    } catch (error) {
      toast.error('Auto-tagging failed');
    } finally {
      setAutoTagging(false);
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

  const filteredVideos = statusFilter === 'all' 
    ? videos 
    : videos.filter(v => v.status === statusFilter);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold">Video Library Admin</h1>
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Upload Video
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Videos Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredVideos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No videos yet. Upload your first video!
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVideos.map(video => (
                    <TableRow key={video.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-14 bg-muted rounded flex items-center justify-center">
                            <Video className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{video.title}</p>
                            {video.drill_name && (
                              <p className="text-sm text-muted-foreground">{video.drill_name}</p>
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
                        <Badge variant={video.status === 'published' ? 'default' : 'secondary'}>
                          {video.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(video)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handlePublish(video)}>
                            {video.status === 'published' ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(video)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload New Video</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Video title"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                {uploading ? (
                  <div className="space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p>Uploading... {uploadProgress}%</p>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">
                      Drag and drop or click to upload
                    </p>
                    <Input
                      type="file"
                      accept="video/*"
                      className="cursor-pointer"
                      onChange={handleFileUpload}
                    />
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

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

                {/* AI Actions */}
                <div className="flex gap-3">
                  <Button 
                    onClick={handleTranscribe} 
                    disabled={transcribing}
                    variant="outline"
                  >
                    {transcribing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Transcribing...
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        🎤 Transcribe
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleAutoTag} 
                    disabled={autoTagging || !editVideo.transcript}
                    variant="outline"
                  >
                    {autoTagging ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Tag className="h-4 w-4 mr-2" />
                        🏷️ Auto-Tag
                      </>
                    )}
                  </Button>
                  {!editVideo.transcript && (
                    <p className="text-sm text-muted-foreground self-center">
                      Transcribe first to enable auto-tagging
                    </p>
                  )}
                </div>

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

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setEditVideo(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
