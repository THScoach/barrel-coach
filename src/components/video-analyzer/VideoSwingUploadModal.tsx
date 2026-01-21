/**
 * SWING ANALYZER VIDEO UPLOAD
 * 
 * This modal handles uploads for HIGH-SPEED SWING ANALYSIS CLIPS only.
 * Videos go to: video_swing_sessions + video_swings tables
 * Storage: swing-videos bucket
 * 
 * DO NOT use this for instructional/drill content.
 * For drill videos, use AdminVideos.tsx → upload-video edge function → drill_videos table
 * 
 * @see src/lib/video-types.ts for architecture documentation
 */
import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Upload, 
  Video, 
  X, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Info,
  Link as LinkIcon
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface VideoSwingUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string; // Must be players.id
  playerName: string;
  source: 'player_upload' | 'admin_upload' | 'coach_upload';
  onSuccess: (sessionId: string) => void;
  /** If provided, uploads go to this active session instead of creating a new one */
  activeSessionId?: string;
}

interface VideoFile {
  file: File;
  id: string;
  previewUrl: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  storagePath?: string;
}

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_SIZE_BYTES = 250 * 1024 * 1024;
const MIN_SWINGS = 5;
const MAX_SWINGS = 15;

export function VideoSwingUploadModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  source,
  onSuccess,
  activeSessionId,
}: VideoSwingUploadModalProps) {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [context, setContext] = useState<string>('practice');
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'onform'>('upload');
  const [onformUrls, setOnformUrls] = useState('');
  const [importingOnform, setImportingOnform] = useState(false);
  const [existingVideoCount, setExistingVideoCount] = useState(0);

  // Load existing video count if we have an active session
  useEffect(() => {
    if (activeSessionId && open) {
      supabase
        .from('video_swing_sessions')
        .select('video_count')
        .eq('id', activeSessionId)
        .single()
        .then(({ data }) => {
          setExistingVideoCount(data?.video_count || 0);
        });
    } else {
      setExistingVideoCount(0);
    }
  }, [activeSessionId, open]);

  const resetState = () => {
    videos.forEach(v => URL.revokeObjectURL(v.previewUrl));
    setVideos([]);
    setSessionDate(new Date().toISOString().split('T')[0]);
    setContext('practice');
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingCapacity = MAX_SWINGS - videos.length;
    if (remainingCapacity <= 0) {
      toast.error(`Maximum ${MAX_SWINGS} videos per session`);
      return;
    }

    const newVideos: VideoFile[] = [];
    const fileArray = Array.from(files).slice(0, remainingCapacity);

    for (const file of fileArray) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Must be .mp4, .mov, or .webm`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(`${file.name}: File too large (max 250MB)`);
        continue;
      }

      newVideos.push({
        file,
        id: crypto.randomUUID(),
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
      });
    }

    setVideos(prev => [...prev, ...newVideos]);
    e.target.value = '';
  }, [videos.length]);

  const removeVideo = (id: string) => {
    setVideos(prev => {
      const video = prev.find(v => v.id === id);
      if (video) URL.revokeObjectURL(video.previewUrl);
      return prev.filter(v => v.id !== id);
    });
  };

  const handleOnformImport = async () => {
    const urlList = onformUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0 && (u.includes('getonform.com') || u.includes('onform.com')));

    if (urlList.length === 0) {
      toast.error('Please paste valid OnForm URLs (one per line)');
      return;
    }

    if (urlList.length > MAX_SWINGS) {
      toast.error(`Maximum ${MAX_SWINGS} videos per session`);
      return;
    }

    setImportingOnform(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/import-onform-video`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          urls: urlList, 
          playerId, 
          sessionDate,
          context,
          source,
          forSwingAnalysis: true
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      // Session was created by the edge function - trigger success callback
      if (data.sessionId) {
        toast.success(data.message || `Imported ${urlList.length} video(s)`);
        setOnformUrls('');
        setActiveTab('upload');
        handleClose();
        onSuccess(data.sessionId);
      } else {
        throw new Error('No session was created');
      }
    } catch (error) {
      console.error('OnForm import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImportingOnform(false);
    }
  };

  const uploadVideoToStorage = async (video: VideoFile, sessionId: string, index: number): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Please log in to upload videos");
      return null;
    }

    const ext = video.file.name.split('.').pop() || 'mp4';
    const storagePath = `swing-videos/${sessionId}/${index}.${ext}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('swing-videos')
      .upload(storagePath, video.file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    return storagePath;
  };

  const createSession = async () => {
    if (!playerId) {
      toast.error("Player ID missing");
      return;
    }

    if (videos.length === 0) {
      toast.error("Please add at least one video");
      return;
    }

    // Check if adding these videos would exceed the limit
    const totalAfterUpload = existingVideoCount + videos.length;
    if (totalAfterUpload > MAX_SWINGS) {
      toast.error(`Can only upload ${MAX_SWINGS - existingVideoCount} more videos (session limit: ${MAX_SWINGS})`);
      return;
    }

    setIsCreating(true);

    try {
      let sessionId: string;

      // Use active session if provided, otherwise create new
      if (activeSessionId) {
        sessionId = activeSessionId;
      } else {
        // Create new video_swing_sessions record
        const { data: sessionData, error: sessionError } = await supabase
          .from('video_swing_sessions')
          .insert({
            player_id: playerId,
            session_date: sessionDate,
            source,
            context,
            status: 'pending',
            video_count: videos.length,
            is_active: true,
          })
          .select('id')
          .single();

        if (sessionError || !sessionData) {
          throw new Error(sessionError?.message || 'Failed to create session');
        }
        sessionId = sessionData.id;
      }

      // 2. Upload each video and create video_swings records
      let uploadedCount = 0;
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        
        setVideos(prev => prev.map(v => 
          v.id === video.id ? { ...v, status: 'uploading', progress: 10 } : v
        ));

        const storagePath = await uploadVideoToStorage(video, sessionId, i);
        
        if (!storagePath) {
          setVideos(prev => prev.map(v => 
            v.id === video.id ? { ...v, status: 'error' } : v
          ));
          continue;
        }

        // Get signed URL for the video
        const { data: urlData } = await supabase.storage
          .from('swing-videos')
          .createSignedUrl(storagePath, 3600);

        // Create video_swings record
        const { error: swingError } = await supabase
          .from('video_swings')
          .insert({
            session_id: sessionId,
            swing_index: i,
            video_storage_path: storagePath,
            video_url: urlData?.signedUrl || null,
            status: 'uploaded',
          });

        if (swingError) {
          console.error('Error creating swing record:', swingError);
          setVideos(prev => prev.map(v => 
            v.id === video.id ? { ...v, status: 'error' } : v
          ));
          continue;
        }

        uploadedCount++;
        setVideos(prev => prev.map(v => 
          v.id === video.id ? { ...v, status: 'uploaded', progress: 100, storagePath } : v
        ));
      }

      // 3. Update session with final count (increment if active session)
      const newVideoCount = activeSessionId ? existingVideoCount + uploadedCount : uploadedCount;
      await supabase
        .from('video_swing_sessions')
        .update({ video_count: newVideoCount })
        .eq('id', sessionId);

      toast.success(`Uploaded ${uploadedCount} videos`);
      handleClose();
      onSuccess(sessionId);

    } catch (error: any) {
      console.error('Session creation error:', error);
      toast.error(error.message || 'Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  const uploadedCount = videos.filter(v => v.status === 'uploaded').length;
  const isUploading = videos.some(v => v.status === 'uploading');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Swing Videos</DialogTitle>
          <DialogDescription>
            Upload 5–15 swing videos for {playerName}. Higher frame-rate (120–240 fps) gives more accurate timing and sequence analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Guidelines */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-muted-foreground">
              <p className="font-medium text-foreground">Recommended specs:</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                <li>• 120–240 fps for best sequence accuracy</li>
                <li>• 0.8–1.2 seconds around contact</li>
                <li>• Side or slightly open angle</li>
              </ul>
            </div>
          </div>

          {/* Session Date */}
          <div className="space-y-2">
            <Label htmlFor="session-date">Session Date</Label>
            <Input
              id="session-date"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          {/* Context */}
          <div className="space-y-2">
            <Label htmlFor="context">Context</Label>
            <Select value={context} onValueChange={setContext}>
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

          {/* Tabbed Upload Options */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'onform')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Files
              </TabsTrigger>
              <TabsTrigger value="onform" className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                OnForm Link
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <Label>Videos ({videos.length}/{MAX_SWINGS})</Label>
                {videos.length > 0 && videos.length < MIN_SWINGS && (
                  <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                    Add {MIN_SWINGS - videos.length} more for best results
                  </Badge>
                )}
              </div>
              
              <label 
                className={cn(
                  "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors",
                  videos.length >= MAX_SWINGS 
                    ? "border-muted bg-muted/20 cursor-not-allowed" 
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {videos.length >= MAX_SWINGS ? 'Maximum videos reached' : 'Click or drag videos here'}
                </span>
                <span className="text-xs text-muted-foreground mt-1">.mp4, .mov, .webm (max 250MB each)</span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={videos.length >= MAX_SWINGS}
                />
              </label>
            </TabsContent>
            
            <TabsContent value="onform" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Paste OnForm URLs (one per line)</Label>
                <Textarea
                  placeholder="https://link.getonform.com/view?id=...&#10;https://link.getonform.com/view?id=...&#10;(one per line)"
                  value={onformUrls}
                  onChange={(e) => setOnformUrls(e.target.value)}
                  rows={4}
                  className="text-sm"
                />
              </div>
              <Button
                onClick={handleOnformImport}
                disabled={importingOnform || !onformUrls.trim()}
                className="w-full"
              >
                {importingOnform ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing from OnForm...
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Import {onformUrls.trim().split('\n').filter(u => u.trim()).length || ''} Video{onformUrls.trim().split('\n').filter(u => u.trim()).length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Video List */}
          {videos.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {videos.map((video, idx) => (
                <div 
                  key={video.id}
                  className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg"
                >
                  <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{video.file.name}</p>
                    {video.status === 'uploading' && (
                      <Progress value={video.progress} className="h-1 mt-1" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {video.status === 'pending' && (
                      <Badge variant="outline" className="text-xs">Pending</Badge>
                    )}
                    {video.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {video.status === 'uploaded' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {video.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    {!isCreating && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeVideo(video.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button 
              onClick={createSession}
              disabled={videos.length === 0 || isCreating || isUploading}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {videos.length} Video{videos.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
