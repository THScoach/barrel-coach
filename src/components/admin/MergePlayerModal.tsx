import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  GitMerge,
  Search,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MergePlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current player (loser - will be absorbed) */
  currentPlayerId: string;
  currentPlayerName: string;
}

export function MergePlayerModal({
  open,
  onOpenChange,
  currentPlayerId,
  currentPlayerName,
}: MergePlayerModalProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWinner, setSelectedWinner] = useState<any>(null);
  const [isMerging, setIsMerging] = useState(false);

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["merge-player-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data, error } = await supabase
        .from("players")
        .select("id, name, email, phone, reboot_athlete_id, level, team, created_at")
        .neq("id", currentPlayerId)
        .ilike("name", `%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: open && searchQuery.length >= 2,
  });

  const handleMerge = async () => {
    if (!selectedWinner) return;
    setIsMerging(true);
    try {
      const { data, error } = await supabase.functions.invoke("merge-player-accounts", {
        body: { winner_id: selectedWinner.id, loser_id: currentPlayerId },
      });
      if (error) {
        let msg = "Merge failed";
        try {
          // FunctionsHttpError stores the response in context
          const resp = (error as any).context;
          if (resp && typeof resp.json === 'function') {
            const body = await resp.json();
            if (body?.error) msg = body.error;
          } else if (error.message) {
            msg = error.message;
          }
        } catch {
          if (error.message) msg = error.message;
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      const moved = data.sessions_moved || 0;
      const copied = data.fields_copied?.length || 0;
      const details = moved > 0 || copied > 0 
        ? `${moved} records moved, ${copied} fields copied` 
        : "Duplicate removed, no data needed moving";
      toast.success(`✅ Merged successfully — ${details}`);
      onOpenChange(false);

      // Find the winner's profile page - check if they have a player_profiles entry
      const { data: profile } = await supabase
        .from("player_profiles")
        .select("id")
        .eq("players_id", selectedWinner.id)
        .maybeSingle();

      const targetId = profile?.id || selectedWinner.id;
      navigate(`/admin/players/${targetId}`, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Merge failed");
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Merge With Another Player
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current player (loser) */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              This player will be absorbed (deleted)
            </p>
            <Card className="bg-red-900/20 border-red-800/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-red-600/30 text-red-400 text-xs">LOSER</Badge>
                </div>
                <p className="text-white font-medium">{currentPlayerName}</p>
                <p className="text-xs text-slate-400 font-mono">{currentPlayerId.slice(0, 16)}...</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-slate-500" />
          </div>

          {/* Search for winner */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Search for the winner (survives)
            </p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by player name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedWinner(null);
                }}
                className="pl-10 bg-slate-800/50 border-slate-700 text-white"
              />
            </div>

            {isSearching && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            )}

            {searchResults && searchResults.length > 0 && !selectedWinner && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedWinner(player)}
                    className="w-full text-left p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-green-700 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{player.name || "Unknown"}</p>
                        <p className="text-xs text-slate-400">
                          {player.email || "No email"} • {player.level || "No level"} •{" "}
                          {player.team || "No team"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {player.reboot_athlete_id && (
                          <Badge variant="outline" className="border-blue-700 text-blue-400 text-xs">
                            Reboot
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedWinner && (
              <Card className="bg-green-900/20 border-green-800/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-green-600/30 text-green-400 text-xs">WINNER</Badge>
                    {selectedWinner.reboot_athlete_id && (
                      <Badge variant="outline" className="border-blue-700 text-blue-400 text-xs">
                        Reboot
                      </Badge>
                    )}
                  </div>
                  <p className="text-white font-medium">{selectedWinner.name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedWinner.id.slice(0, 16)}...
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedWinner.email || "No email"} • {selectedWinner.level || "No level"}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedWinner(null)}
                    className="mt-2 text-slate-400 hover:text-white text-xs h-7"
                  >
                    Change selection
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {selectedWinner && (
            <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-400">
                <strong>{currentPlayerName}</strong> will be permanently deleted. All their
                sessions and data will be moved to <strong>{selectedWinner.name}</strong>.
                This cannot be undone.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700 text-slate-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!selectedWinner || isMerging}
            className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
          >
            {isMerging ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <GitMerge className="h-4 w-4 mr-2" />
            )}
            Confirm Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
