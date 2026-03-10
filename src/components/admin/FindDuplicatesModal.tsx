import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  Search,
} from "lucide-react";

interface DuplicatePair {
  winner: PlayerRecord;
  loser: PlayerRecord;
  matchReason: string;
}

interface PlayerRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  reboot_athlete_id: string | null;
  level: string | null;
  team: string | null;
  created_at: string;
  session_count: number;
}

export function FindDuplicatesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [mergedPairs, setMergedPairs] = useState<Set<string>>(new Set());
  const [mergingId, setMergingId] = useState<string | null>(null);

  const { data: duplicates, isLoading } = useQuery({
    queryKey: ["find-duplicate-players"],
    queryFn: async () => {
      // Fetch all players with relevant fields
      const { data: players, error } = await supabase
        .from("players")
        .select("id, name, email, phone, reboot_athlete_id, level, team, created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!players || players.length === 0) return [];

      // Get session counts per player
      const playerIds = players.map((p) => p.id);
      const sessionCounts: Record<string, number> = {};

      // Count from multiple session tables
      for (const table of ["sessions", "reboot_sessions", "sensor_sessions", "player_sessions"] as const) {
        try {
          const { data } = await supabase
            .from(table)
            .select("player_id")
            .in("player_id", playerIds);
          (data || []).forEach((row: any) => {
            sessionCounts[row.player_id] = (sessionCounts[row.player_id] || 0) + 1;
          });
        } catch {
          // Table might not exist or have different schema
        }
      }

      // Find duplicates by name (case-insensitive) or email
      const pairs: DuplicatePair[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const a = players[i];
          const b = players[j];
          const pairKey = [a.id, b.id].sort().join("-");
          if (seen.has(pairKey)) continue;

          let matchReason = "";
          const aName = (a.name || "").trim().toLowerCase();
          const bName = (b.name || "").trim().toLowerCase();

          if (aName && bName && aName === bName) {
            matchReason = "Same name";
          } else if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
            matchReason = "Same email";
          }

          if (!matchReason) continue;
          seen.add(pairKey);

          const toRecord = (p: typeof a): PlayerRecord => ({
            id: p.id,
            name: p.name || "Unknown",
            email: p.email,
            phone: p.phone,
            reboot_athlete_id: p.reboot_athlete_id,
            level: p.level,
            team: p.team,
            created_at: p.created_at || "",
            session_count: sessionCounts[p.id] || 0,
          });

          // Winner = one with reboot_athlete_id, or more sessions
          let winner = toRecord(a);
          let loser = toRecord(b);

          if (b.reboot_athlete_id && !a.reboot_athlete_id) {
            winner = toRecord(b);
            loser = toRecord(a);
          } else if (!a.reboot_athlete_id && !b.reboot_athlete_id) {
            // Neither has reboot, pick one with more sessions
            if ((sessionCounts[b.id] || 0) > (sessionCounts[a.id] || 0)) {
              winner = toRecord(b);
              loser = toRecord(a);
            }
          }

          pairs.push({ winner, loser, matchReason });
        }
      }

      return pairs;
    },
    enabled: open,
  });

  const handleMerge = async (pair: DuplicatePair) => {
    const pairKey = [pair.winner.id, pair.loser.id].sort().join("-");
    setMergingId(pairKey);
    try {
      const { data, error } = await supabase.functions.invoke("merge-player-accounts", {
        body: { winner_id: pair.winner.id, loser_id: pair.loser.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const moved = data.sessions_moved || 0;
      const copied = data.fields_copied?.length || 0;
      const details = moved > 0 || copied > 0 
        ? `${moved} records moved, ${copied} fields copied` 
        : "Duplicate removed, no data needed moving";
      toast.success(`✅ Merged successfully — ${details}`);
      setMergedPairs((prev) => new Set([...prev, pairKey]));
      queryClient.invalidateQueries({ queryKey: ["admin-player-roster"] });
    } catch (err: any) {
      toast.error(err.message || "Merge failed");
    } finally {
      setMergingId(null);
    }
  };

  const activePairs = (duplicates || []).filter(
    (p) => !mergedPairs.has([p.winner.id, p.loser.id].sort().join("-"))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Duplicate Players
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-400">Scanning for duplicates...</span>
          </div>
        ) : activePairs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
            <p className="text-lg font-medium">No duplicates found</p>
            <p className="text-sm mt-1">All player records appear unique.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Found {activePairs.length} suspected duplicate pair
              {activePairs.length !== 1 ? "s" : ""}. The Reboot-linked record is
              auto-designated as the winner.
            </p>
            {activePairs.map((pair) => {
              const pairKey = [pair.winner.id, pair.loser.id].sort().join("-");
              const isMerging = mergingId === pairKey;
              return (
                <Card key={pairKey} className="bg-slate-800/60 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="border-amber-700 text-amber-400 text-xs">
                        {pair.matchReason}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Winner */}
                      <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-green-600/30 text-green-400 text-xs">WINNER</Badge>
                          {pair.winner.reboot_athlete_id && (
                            <Badge variant="outline" className="border-blue-700 text-blue-400 text-xs">
                              Reboot
                            </Badge>
                          )}
                        </div>
                        <p className="text-white font-medium">{pair.winner.name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-1">
                          {pair.winner.id.slice(0, 12)}...
                        </p>
                        {pair.winner.email && (
                          <p className="text-xs text-slate-400 mt-1">{pair.winner.email}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {pair.winner.session_count} sessions • {pair.winner.level || "No level"}
                        </p>
                      </div>
                      {/* Loser */}
                      <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-red-600/30 text-red-400 text-xs">ABSORBED</Badge>
                        </div>
                        <p className="text-white font-medium">{pair.loser.name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-1">
                          {pair.loser.id.slice(0, 12)}...
                        </p>
                        {pair.loser.email && (
                          <p className="text-xs text-slate-400 mt-1">{pair.loser.email}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {pair.loser.session_count} sessions • {pair.loser.level || "No level"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleMerge(pair)}
                        disabled={isMerging}
                        className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
                      >
                        {isMerging ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <GitMerge className="h-4 w-4 mr-2" />
                        )}
                        Merge →
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
