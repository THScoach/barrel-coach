import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlayerVideoUpload } from "./PlayerVideoUpload";
import { PlayerUploadHistory } from "./PlayerUploadHistory";
import { RebootConnectionStatus } from "./RebootConnectionStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Activity, Download, Loader2, Calendar, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlayerVideoTabProps {
  playerId: string;
  playersTableId: string | null | undefined;
  playerName: string;
}

interface RebootSession {
  id: string;
  name?: string;
  created_at?: string;
  session_date?: string;
}

export function PlayerVideoTab({ playerId, playersTableId, playerName }: PlayerVideoTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [availableSessions, setAvailableSessions] = useState<RebootSession[]>([]);
  const [fetchingsessions, setFetchingessions] = useState(false);
  const [importingSessionId, setImportingSessionId] = useState<string | null>(null);

  // Fetch player's Reboot connection status from players table
  const { data: playerData } = useQuery({
    queryKey: ['player-reboot-status', playersTableId],
    queryFn: async () => {
      if (!playersTableId) return null;
      
      const { data, error } = await supabase
        .from('players')
        .select('reboot_player_id, reboot_athlete_id, latest_composite_score, latest_bat_score, latest_body_score, latest_brain_score, latest_ball_score')
        .eq('id', playersTableId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!playersTableId,
  });

  const rebootPlayerId = playerData?.reboot_player_id || playerData?.reboot_athlete_id;

  const handleFetchSessions = async () => {
    if (!rebootPlayerId) return;
    
    setFetchingessions(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-reboot-sessions', {
        body: { org_player_id: rebootPlayerId }
      });

      if (error) throw error;

      setAvailableSessions(data?.sessions || []);
      toast({
        title: "Sessions fetched",
        description: `Found ${data?.sessions?.length || 0} available sessions`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to fetch sessions",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setFetchingessions(false);
    }
  };

  const handleImportSession = async (sessionId: string) => {
    if (!playersTableId || !rebootPlayerId) return;
    
    setImportingSessionId(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke('process-reboot-session', {
        body: { session_id: sessionId, org_player_id: rebootPlayerId, player_id: playersTableId }
      });

      if (error) throw error;

      toast({
        title: "Session imported",
        description: "4B scores have been calculated and saved",
      });

      // Refresh upload history
      queryClient.invalidateQueries({ queryKey: ['player-upload-history', playersTableId] });
      queryClient.invalidateQueries({ queryKey: ['player-reboot-status', playersTableId] });

      // Remove from available list
      setAvailableSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err: any) {
      toast({
        title: "Import failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImportingSessionId(null);
    }
  };

  if (!playersTableId) {
    return (
      <Card className="bg-slate-900/80 border-slate-800">
        <CardContent className="py-12 text-center">
          <Video className="h-12 w-12 mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">Player Not Linked</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            This player profile needs to be linked to an analytics identity before uploading videos. 
            Use the "Link Player" option in the player settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reboot Connection Status */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Reboot Motion Status
            </span>
            <RebootConnectionStatus rebootPlayerId={rebootPlayerId} />
          </CardTitle>
        </CardHeader>
        {playerData?.latest_composite_score && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{playerData.latest_composite_score}</div>
                <div className="text-xs text-slate-400">Composite</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-purple-400">{playerData.latest_brain_score || '-'}</div>
                <div className="text-xs text-slate-400">Brain</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-blue-400">{playerData.latest_body_score || '-'}</div>
                <div className="text-xs text-slate-400">Body</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-orange-400">{playerData.latest_bat_score || '-'}</div>
                <div className="text-xs text-slate-400">Bat</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-emerald-400">{playerData.latest_ball_score || '-'}</div>
                <div className="text-xs text-slate-400">Ball</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Import Sessions from Reboot */}
      {rebootPlayerId && (
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Import Sessions from Reboot
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchSessions}
                disabled={fetchingsessions}
              >
                {fetchingsessions ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Fetch Available Sessions
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableSessions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                Click "Fetch Available Sessions" to load sessions from Reboot Motion
              </p>
            ) : (
              <div className="space-y-2">
                {availableSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="text-sm font-medium text-white">
                          {session.name || `Session ${session.id.slice(0, 8)}`}
                        </div>
                        <div className="text-xs text-slate-400">
                          {session.session_date || session.created_at
                            ? new Date(session.session_date || session.created_at!).toLocaleDateString()
                            : 'Date unknown'}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleImportSession(session.id)}
                      disabled={importingSessionId === session.id}
                    >
                      {importingSessionId === session.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Import'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Video Upload Form */}
      <PlayerVideoUpload playerId={playersTableId} playerName={playerName} />

      {/* Upload History */}
      <PlayerUploadHistory playerId={playersTableId} />
    </div>
  );
}
