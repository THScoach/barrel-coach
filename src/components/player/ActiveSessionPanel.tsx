/**
 * ActiveSessionPanel
 * Shows the current active session status and allows ending it.
 * Displays upload count, progress, and end session button.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Video, 
  Upload, 
  CheckCircle, 
  Loader2, 
  XCircle,
  Play,
  Square
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ActiveSession {
  id: string;
  session_date: string;
  context: string;
  video_count: number;
  is_active: boolean;
  created_at: string;
}

interface ActiveSessionPanelProps {
  playerId: string;
  onSessionEnd?: (sessionId: string, results: any) => void;
  onUploadClick?: (sessionId: string) => void;
}

const MAX_SWINGS = 15;
const MIN_SWINGS = 5;

export function ActiveSessionPanel({ 
  playerId, 
  onSessionEnd,
  onUploadClick 
}: ActiveSessionPanelProps) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnding, setIsEnding] = useState(false);

  const loadActiveSession = useCallback(async () => {
    if (!playerId) return;
    
    const { data, error } = await supabase
      .from('video_swing_sessions')
      .select('id, session_date, context, video_count, is_active, created_at')
      .eq('player_id', playerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setActiveSession(data);
    } else {
      setActiveSession(null);
    }
    setIsLoading(false);
  }, [playerId]);

  useEffect(() => {
    loadActiveSession();
    
    // Subscribe to changes
    const channel = supabase
      .channel(`active-session-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_swing_sessions',
          filter: `player_id=eq.${playerId}`,
        },
        () => {
          loadActiveSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, loadActiveSession]);

  const handleEndSession = async () => {
    if (!activeSession) return;
    
    if (activeSession.video_count < MIN_SWINGS) {
      toast.error(`Upload at least ${MIN_SWINGS} swings before ending session`);
      return;
    }

    setIsEnding(true);
    try {
      const { data, error } = await supabase.functions.invoke('end-session', {
        body: { sessionId: activeSession.id },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to end session');

      toast.success('Session analyzed!', {
        description: `Score: ${data.data.scores.composite} | ${data.data.swingCount} swings analyzed`,
      });

      setActiveSession(null);
      onSessionEnd?.(activeSession.id, data.data);
    } catch (error) {
      console.error('End session error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to end session');
    } finally {
      setIsEnding(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!activeSession) {
    return null; // No active session - parent will show Start Session button
  }

  const progress = (activeSession.video_count / MAX_SWINGS) * 100;
  const canEnd = activeSession.video_count >= MIN_SWINGS;
  const isFull = activeSession.video_count >= MAX_SWINGS;

  return (
    <Card className={cn(
      "border-2 transition-colors",
      isEnding ? "border-amber-500/50 bg-amber-500/5" : "border-primary/50 bg-primary/5"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Active Session
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {format(new Date(activeSession.session_date), 'MMM d')} • {activeSession.context}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              <Video className="h-4 w-4 inline mr-1" />
              {activeSession.video_count} / {MAX_SWINGS} swings
            </span>
            {!canEnd && (
              <span className="text-amber-500 text-xs">
                Need {MIN_SWINGS - activeSession.video_count} more
              </span>
            )}
            {isFull && (
              <span className="text-green-500 text-xs">Session full</span>
            )}
          </div>
          <Progress 
            value={progress} 
            className={cn(
              "h-2",
              canEnd ? "[&>div]:bg-green-500" : "[&>div]:bg-amber-500"
            )} 
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isFull && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onUploadClick?.(activeSession.id)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Add Swing
            </Button>
          )}
          <Button
            size="sm"
            className={cn(
              "flex-1",
              canEnd 
                ? "bg-primary hover:bg-primary/90" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            onClick={handleEndSession}
            disabled={!canEnd || isEnding}
          >
            {isEnding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Square className="h-4 w-4 mr-2" />
                End & Analyze
              </>
            )}
          </Button>
        </div>

        {/* Helper Text */}
        <p className="text-xs text-muted-foreground text-center">
          {canEnd 
            ? "Ready to analyze! End session to see your 4B scores." 
            : `Upload ${MIN_SWINGS - activeSession.video_count} more swing${MIN_SWINGS - activeSession.video_count > 1 ? 's' : ''} to unlock analysis.`
          }
        </p>
      </CardContent>
    </Card>
  );
}
