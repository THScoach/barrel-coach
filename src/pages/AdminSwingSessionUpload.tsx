/**
 * ADMIN SWING SESSION UPLOAD PAGE
 * 
 * Multi-video upload for swing analysis sessions:
 * - Select player from dropdown
 * - Drag & drop zone for 1-15 videos
 * - Upload progress per file
 * - Auto-trigger 2D analysis after upload
 * - Redirect to session view
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Upload, 
  Video, 
  X, 
  CheckCircle, 
  Loader2, 
  AlertCircle, 
  ArrowLeft,
  Sparkles,
  User
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { cn } from "@/lib/utils";

interface VideoFile {
  file: File;
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'analyzing' | 'complete' | 'error';
  progress: number;
  storagePath?: string;
  errorMessage?: string;
}

interface Player {
  id: string;
  name: string;
  team?: string | null;
  level?: string | null;
}

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v"];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
const MIN_SWINGS = 1;
const MAX_SWINGS = 15;

export default function AdminSwingSessionUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Player selection
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  
  // Session config
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [context, setContext] = useState<string>('practice');
  
  // Video upload
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Load players on mount
  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    setLoadingPlayers(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, team, level')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
      toast.error('Failed to load players');
    } finally {
      setLoadingPlayers(false);
    }
  };

  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const remainingCapacity = MAX_SWINGS - videos.length;
    if (remainingCapacity <= 0) {
      toast.error(`Maximum ${MAX_SWINGS} videos per session`);
      return;
    }

    const newVideos: VideoFile[] = [];
    const fileArray = Array.from(files).slice(0, remainingCapacity);

    for (const file of fileArray) {
      // Check file type
      const isValidType = ACCEPTED_TYPES.includes(file.type) || 
        file.name.toLowerCase().endsWith('.mov') ||
        file.name.toLowerCase().endsWith('.mp4') ||
        file.name.toLowerCase().endsWith('.m4v');
      
      if (!isValidType) {
        toast.error(`${file.name}: Must be .mp4, .mov, or .m4v`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(`${file.name}: File too large (max 500MB)`);
        continue;
      }

      newVideos.push({
        file,
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        status: 'pending',
        progress: 0,
      });
    }

    setVideos(prev => [...prev, ...newVideos]);
  }, [videos.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeVideo = (id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadVideoToStorage = async (
    video: VideoFile, 
    sessionId: string, 
    index: number,
    onProgress: (progress: number) => void
  ): Promise<string | null> => {
    const ext = video.name.split('.').pop()?.toLowerCase() || 'mp4';
    const storagePath = `swing-videos/${sessionId}/${index}.${ext}`;

    try {
      // Upload with XHR for progress tracking
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(storagePath);
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/swing-videos/${storagePath}`);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.send(video.file);
      });
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const createSessionAndUpload = async () => {
    if (!selectedPlayerId) {
      toast.error('Please select a player');
      return;
    }

    if (videos.length < MIN_SWINGS) {
      toast.error(`Please add at least ${MIN_SWINGS} video`);
      return;
    }

    setIsCreating(true);

    try {
      // 1. Create video_swing_sessions record
      const { data: sessionData, error: sessionError } = await supabase
        .from('video_swing_sessions')
        .insert({
          player_id: selectedPlayerId,
          session_date: sessionDate,
          source: 'admin_upload',
          context,
          status: 'pending',
          video_count: videos.length,
        })
        .select('id')
        .single();

      if (sessionError || !sessionData) {
        throw new Error(sessionError?.message || 'Failed to create session');
      }

      const newSessionId = sessionData.id;
      setSessionId(newSessionId);

      // 2. Upload each video
      let uploadedCount = 0;
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];

        // Update status to uploading
        setVideos(prev => prev.map(v =>
          v.id === video.id ? { ...v, status: 'uploading', progress: 0 } : v
        ));

        const storagePath = await uploadVideoToStorage(
          video,
          newSessionId,
          i,
          (progress) => {
            setVideos(prev => prev.map(v =>
              v.id === video.id ? { ...v, progress } : v
            ));
          }
        );

        if (!storagePath) {
          setVideos(prev => prev.map(v =>
            v.id === video.id ? { ...v, status: 'error', errorMessage: 'Upload failed' } : v
          ));
          continue;
        }

        // Create video_swings record
        const { error: swingError } = await supabase
          .from('video_swings')
          .insert({
            session_id: newSessionId,
            swing_index: i,
            video_storage_path: storagePath,
            status: 'uploaded',
          });

        if (swingError) {
          console.error('Error creating swing record:', swingError);
          setVideos(prev => prev.map(v =>
            v.id === video.id ? { ...v, status: 'error', errorMessage: 'Failed to save' } : v
          ));
          continue;
        }

        uploadedCount++;
        setVideos(prev => prev.map(v =>
          v.id === video.id ? { ...v, status: 'uploaded', progress: 100, storagePath } : v
        ));
      }

      // 3. Update session with final count
      await supabase
        .from('video_swing_sessions')
        .update({ video_count: uploadedCount, status: 'uploaded' })
        .eq('id', newSessionId);

      if (uploadedCount > 0) {
        toast.success(`Uploaded ${uploadedCount} video${uploadedCount !== 1 ? 's' : ''}`);
        
        // 4. Trigger 2D analysis
        setVideos(prev => prev.map(v =>
          v.status === 'uploaded' ? { ...v, status: 'analyzing' } : v
        ));

        try {
          const { data, error } = await supabase.functions.invoke('analyze-video-swing-session', {
            body: { sessionId: newSessionId }
          });

          if (error) {
            console.error('Analysis error:', error);
            toast.error('Analysis failed, but videos were uploaded');
          } else {
            setVideos(prev => prev.map(v =>
              v.status === 'analyzing' ? { ...v, status: 'complete' } : v
            ));
            toast.success('2D analysis complete!');
          }
        } catch (analysisError) {
          console.error('Analysis error:', analysisError);
        }

        // 5. Redirect to session view
        setTimeout(() => {
          navigate(`/admin/sessions/${newSessionId}`);
        }, 1500);
      } else {
        toast.error('No videos were uploaded successfully');
      }
    } catch (error: any) {
      console.error('Session creation error:', error);
      toast.error(error.message || 'Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  const pendingCount = videos.filter(v => v.status === 'pending').length;
  const uploadingCount = videos.filter(v => v.status === 'uploading').length;
  const uploadedCount = videos.filter(v => v.status === 'uploaded' || v.status === 'analyzing' || v.status === 'complete').length;
  const errorCount = videos.filter(v => v.status === 'error').length;
  const isProcessing = isCreating || uploadingCount > 0;

  const getStatusIcon = (status: VideoFile['status']) => {
    switch (status) {
      case 'pending':
        return <Video className="h-4 w-4 text-muted-foreground" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'uploaded':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'analyzing':
        return <Sparkles className="h-4 w-4 animate-pulse text-purple-500" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: VideoFile['status']) => {
    switch (status) {
      case 'pending': return 'Ready';
      case 'uploading': return 'Uploading';
      case 'uploaded': return 'Uploaded';
      case 'analyzing': return 'Analyzing';
      case 'complete': return 'Complete';
      case 'error': return 'Failed';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="container py-6 max-w-3xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/analyzer')}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Analyzer
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>New Swing Session</CardTitle>
            <CardDescription>
              Upload 1-15 swing videos for biomechanics analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Player Selection */}
            <div className="space-y-2">
              <Label htmlFor="player">Player</Label>
              <Select 
                value={selectedPlayerId} 
                onValueChange={setSelectedPlayerId}
                disabled={isProcessing}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingPlayers ? "Loading players..." : "Select a player"} />
                </SelectTrigger>
                <SelectContent>
                  {players.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{player.name}</span>
                        {player.team && (
                          <span className="text-xs text-muted-foreground">({player.team})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Session Date */}
            <div className="space-y-2">
              <Label htmlFor="session-date">Session Date</Label>
              <Input
                id="session-date"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            {/* Context */}
            <div className="space-y-2">
              <Label htmlFor="context">Context</Label>
              <Select value={context} onValueChange={setContext} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue placeholder="Select context" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="game">Game</SelectItem>
                  <SelectItem value="cage">Cage Work</SelectItem>
                  <SelectItem value="lesson">Lesson</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Drag & Drop Zone */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Videos ({videos.length}/{MAX_SWINGS})</Label>
                {videos.length > 0 && pendingCount > 0 && (
                  <Badge variant="outline">
                    {pendingCount} ready to upload
                  </Badge>
                )}
              </div>
              
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all",
                  isDragOver 
                    ? "border-primary bg-primary/5" 
                    : videos.length >= MAX_SWINGS 
                      ? "border-muted bg-muted/20 cursor-not-allowed"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                <Upload className={cn(
                  "h-10 w-10 mb-3 transition-colors",
                  isDragOver ? "text-primary" : "text-muted-foreground"
                )} />
                <span className="text-sm text-muted-foreground font-medium">
                  {videos.length >= MAX_SWINGS 
                    ? 'Maximum videos reached' 
                    : isDragOver 
                      ? 'Drop videos here' 
                      : 'Drag & drop videos or click to browse'}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  .mp4, .mov, .m4v (max 500MB each)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  disabled={videos.length >= MAX_SWINGS || isProcessing}
                />
              </div>
            </div>

            {/* Video List */}
            {videos.length > 0 && (
              <div className="space-y-2">
                <Label>Upload Queue</Label>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {videos.map((video, idx) => (
                    <div
                      key={video.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        video.status === 'error' 
                          ? "bg-red-500/10 border-red-500/30"
                          : video.status === 'complete'
                            ? "bg-green-500/10 border-green-500/30"
                            : "bg-muted/30 border-border"
                      )}
                    >
                      <div className="flex items-center justify-center h-8 w-8 rounded bg-muted text-sm font-medium">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm truncate font-medium">{video.name}</p>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatFileSize(video.size)}
                          </span>
                        </div>
                        {video.status === 'uploading' && (
                          <Progress value={video.progress} className="h-1.5 mt-1.5" />
                        )}
                        {video.errorMessage && (
                          <p className="text-xs text-red-500 mt-1">{video.errorMessage}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(video.status)}
                          <span className="text-xs text-muted-foreground">
                            {getStatusLabel(video.status)}
                          </span>
                        </div>
                        {!isProcessing && video.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeVideo(video.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary Stats */}
            {videos.length > 0 && isProcessing && (
              <div className="flex items-center justify-center gap-6 py-3 bg-muted/30 rounded-lg">
                {uploadingCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span>{uploadingCount} uploading</span>
                  </div>
                )}
                {uploadedCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{uploadedCount} uploaded</span>
                  </div>
                )}
                {errorCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span>{errorCount} failed</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => navigate('/admin/analyzer')}
                disabled={isProcessing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={createSessionAndUpload}
                disabled={!selectedPlayerId || videos.length < MIN_SWINGS || isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Analyze
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
