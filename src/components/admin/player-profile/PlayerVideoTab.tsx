import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlayerVideoUpload } from "./PlayerVideoUpload";
import { PlayerUploadHistory } from "./PlayerUploadHistory";
import { RebootConnectionStatus } from "./RebootConnectionStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Activity } from "lucide-react";

interface PlayerVideoTabProps {
  playerId: string;
  playersTableId: string | null | undefined;
  playerName: string;
}

export function PlayerVideoTab({ playerId, playersTableId, playerName }: PlayerVideoTabProps) {
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

      {/* Video Upload Form */}
      <PlayerVideoUpload playerId={playersTableId} playerName={playerName} />

      {/* Upload History */}
      <PlayerUploadHistory playerId={playersTableId} />
    </div>
  );
}
