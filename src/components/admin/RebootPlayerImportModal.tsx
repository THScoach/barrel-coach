import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Loader2,
  Download,
  Search,
  Users,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface RebootPlayer {
  reboot_id: string;
  name: string;
  first_name: string;
  last_name: string;
  height: string | null;
  weight: string | null;
  bats: string | null;
  level: string | null;
  team: string | null;
}

interface RebootPlayerImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function RebootPlayerImportModal({
  open,
  onOpenChange,
  onImportComplete,
}: RebootPlayerImportModalProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch players from Reboot (preview mode)
  const {
    data: rebootData,
    isLoading: isFetching,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: ["reboot-players-preview"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("fetch-reboot-players", {
        body: { preview_only: true },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch Reboot players");
      }

      return response.data as {
        success: boolean;
        players: RebootPlayer[];
        total: number;
      };
    },
    enabled: open,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch existing local players to check which are already imported
  const { data: existingPlayers } = useQuery({
    queryKey: ["existing-reboot-players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("reboot_athlete_id")
        .not("reboot_athlete_id", "is", null);

      if (error) throw error;
      return new Set(data.map((p) => p.reboot_athlete_id));
    },
    enabled: open,
  });

  // Import selected players mutation
  const importMutation = useMutation({
    mutationFn: async (playerIds: string[]) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("fetch-reboot-players", {
        body: { player_ids: playerIds },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to import players");
      }

      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Imported ${data.created} new players, updated ${data.updated}`);
      queryClient.invalidateQueries({ queryKey: ["admin-player-roster"] });
      queryClient.invalidateQueries({ queryKey: ["admin-player-filter-options"] });
      queryClient.invalidateQueries({ queryKey: ["existing-reboot-players"] });
      setSelectedIds(new Set());
      onOpenChange(false);
      onImportComplete?.();
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  // Filter players by search query
  const filteredPlayers = rebootData?.players?.filter((player) =>
    player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.team?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Toggle selection
  const togglePlayer = (rebootId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(rebootId)) {
      newSelected.delete(rebootId);
    } else {
      newSelected.add(rebootId);
    }
    setSelectedIds(newSelected);
  };

  // Select all visible (not already imported)
  const selectAllNew = () => {
    const newIds = filteredPlayers
      .filter((p) => !existingPlayers?.has(p.reboot_id))
      .map((p) => p.reboot_id);
    setSelectedIds(new Set(newIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleImport = () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one player to import");
      return;
    }
    importMutation.mutate(Array.from(selectedIds));
  };

  const newPlayersCount = filteredPlayers.filter(
    (p) => !existingPlayers?.has(p.reboot_id)
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-white max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-orange-400" />
            Import from Reboot Motion
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Select players from your Reboot Motion roster to add to the local database.
          </DialogDescription>
        </DialogHeader>

        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-2 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllNew}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 whitespace-nowrap"
            >
              Select New ({newPlayersCount})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="text-slate-400 hover:text-white"
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="text-slate-400 hover:text-white"
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Player List */}
        <ScrollArea className="flex-1 min-h-0 border border-slate-700 rounded-lg">
          {isFetching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <span className="ml-3 text-slate-400">Loading Reboot roster...</span>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <AlertCircle className="h-8 w-8 text-red-400 mb-3" />
              <p className="text-red-400 font-medium">Failed to load Reboot players</p>
              <p className="text-slate-500 text-sm mt-1">{(fetchError as Error).message}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-4 border-slate-600"
              >
                Try Again
              </Button>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-8 w-8 text-slate-500 mb-3" />
              <p className="text-slate-400">No players found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredPlayers.map((player) => {
                const isImported = existingPlayers?.has(player.reboot_id);
                const isSelected = selectedIds.has(player.reboot_id);

                return (
                  <label
                    key={player.reboot_id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors ${
                      isSelected ? "bg-slate-800" : ""
                    } ${isImported ? "opacity-60" : ""}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => togglePlayer(player.reboot_id)}
                      disabled={isImported}
                      className="border-slate-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">
                          {player.name}
                        </span>
                        {isImported && (
                          <Badge
                            variant="secondary"
                            className="bg-green-500/20 text-green-400 border-0 text-xs"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Imported
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-400 mt-0.5">
                        {player.team && <span>{player.team}</span>}
                        {player.level && (
                          <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                            {player.level}
                          </Badge>
                        )}
                        {player.bats && <span>Bats: {player.bats}</span>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="flex-row justify-between items-center pt-4 border-t border-slate-700">
          <div className="text-sm text-slate-400">
            {selectedIds.size > 0 ? (
              <span className="text-orange-400 font-medium">
                {selectedIds.size} selected
              </span>
            ) : (
              <span>{rebootData?.total || 0} players in Reboot</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importMutation.isPending}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Import Selected
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
