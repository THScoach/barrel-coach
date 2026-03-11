import { Card, CardContent } from "@/components/ui/card";
import { Video } from "lucide-react";
import { PlayerVideoUpload } from "./PlayerVideoUpload";

interface PlayerVideoTabProps {
  playerId: string;
  playersTableId: string | null | undefined;
  playerName: string;
}

export function PlayerVideoTab({ playerId, playersTableId, playerName }: PlayerVideoTabProps) {
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
      {/* Video Upload Form (2D swing analysis) */}
      <PlayerVideoUpload playerId={playersTableId} playerName={playerName} />
    </div>
  );
}
