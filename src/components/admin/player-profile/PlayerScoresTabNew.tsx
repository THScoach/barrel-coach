/**
 * Rick Lab Player Scores Tab - Longitudinal View
 * ================================================
 * Sub-tabs: Progression (default), Kinematic Sequence, Drill Intel, Stability
 * KRS Reports removed — per-session scores live on Reboot Motion tab only.
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  LineChart, 
  Loader2,
  Zap,
  Beaker,
  Shield,
} from "lucide-react";
import { PlayerProgressionDashboard } from "./PlayerProgressionDashboard";
import { DrillIntelTab } from "./DrillIntelTab";
import { KineticSequenceTab } from "./KineticSequenceTab";
import { StabilityTab } from "./StabilityTab";

interface PlayerScoresTabNewProps {
  playerId: string;
  playersTableId?: string;
  playerName: string;
}

export function PlayerScoresTabNew({ playerId, playersTableId, playerName }: PlayerScoresTabNewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSubTab = searchParams.get('subtab') || 'progression';
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);
  const [mappedPlayersId, setMappedPlayersId] = useState<string | null>(playersTableId || null);

  useEffect(() => {
    const subtab = searchParams.get('subtab');
    if (subtab && ['progression', 'kinetic', 'stability', 'drill-intel'].includes(subtab)) {
      setActiveSubTab(subtab);
    }
  }, [searchParams]);

  const handleSubTabChange = (value: string) => {
    setActiveSubTab(value);
    setSearchParams({ tab: 'scores', subtab: value });
  };

  useEffect(() => {
    if (!playersTableId && playerId) {
      resolvePlayersId();
    } else if (playersTableId) {
      setMappedPlayersId(playersTableId);
    }
  }, [playerId, playersTableId]);

  const resolvePlayersId = async () => {
    try {
      const { data: linkedPlayerId, error } = await supabase
        .rpc('ensure_player_linked', { p_profile_id: playerId });
      if (!error && linkedPlayerId) {
        setMappedPlayersId(linkedPlayerId);
      }
    } catch (error) {
      console.error('[PlayerScoresTabNew] Error resolving players_id:', error);
    }
  };

  const loadingSpinner = (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={handleSubTabChange}>
        <TabsList className="bg-slate-800/50">
          <TabsTrigger 
            value="progression" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <LineChart className="h-4 w-4 mr-2" />
            Progression
          </TabsTrigger>
          <TabsTrigger 
            value="kinetic" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <Zap className="h-4 w-4 mr-2" />
            Kinetic Sequence
          </TabsTrigger>
          <TabsTrigger 
            value="drill-intel" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <Beaker className="h-4 w-4 mr-2" />
            Drill Intel
          </TabsTrigger>
          <TabsTrigger 
            value="stability" 
            className="text-slate-400 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <Shield className="h-4 w-4 mr-2" />
            Stability
          </TabsTrigger>
        </TabsList>

        {/* ===== PROGRESSION DASHBOARD ===== */}
        <TabsContent value="progression" className="mt-6">
          {mappedPlayersId ? (
            <PlayerProgressionDashboard
              playerId={playerId}
              playersTableId={mappedPlayersId}
              playerName={playerName}
            />
          ) : loadingSpinner}
        </TabsContent>

        {/* ===== KINETIC SEQUENCE ===== */}
        <TabsContent value="kinetic" className="mt-6">
          {mappedPlayersId ? (
            <KineticSequenceTab
              playersTableId={mappedPlayersId}
              playerName={playerName}
            />
          ) : loadingSpinner}
        </TabsContent>

        {/* ===== DRILL INTEL ===== */}
        <TabsContent value="drill-intel" className="mt-6">
          {mappedPlayersId ? (
            <DrillIntelTab
              playersTableId={mappedPlayersId}
              playerName={playerName}
            />
          ) : loadingSpinner}
        </TabsContent>

        {/* ===== STABILITY ===== */}
        <TabsContent value="stability" className="mt-6">
          {mappedPlayersId ? (
            <StabilityTab
              playersTableId={mappedPlayersId}
              playerName={playerName}
            />
          ) : loadingSpinner}
        </TabsContent>
      </Tabs>
    </div>
  );
}
