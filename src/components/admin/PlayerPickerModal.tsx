/**
 * Player Picker Modal for New Session Flow
 * 
 * Shows existing players to select from, or option to add a new player.
 * After selection, navigates to session creation with the player pre-filled.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  UserPlus, 
  Loader2, 
  User,
  ChevronRight 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  level: string | null;
  team: string | null;
  latest_composite_score: number | null;
}

interface PlayerPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlayerPickerModal({ open, onOpenChange }: PlayerPickerModalProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('players')
        .select('id, name, email, phone, level, team, latest_composite_score')
        .order('name', { ascending: true })
        .limit(50);

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (open) {
      const debounce = setTimeout(fetchPlayers, 300);
      return () => clearTimeout(debounce);
    }
  }, [open, fetchPlayers]);

  const handleSelectPlayer = (player: Player) => {
    setSelectedPlayer(player);
    onOpenChange(false);
    navigate(`/admin/new-session?player=${player.id}&name=${encodeURIComponent(player.name)}`);
  };

  const handleAddNewPlayer = () => {
    onOpenChange(false);
    navigate('/admin/new-session?new=true');
  };

  const handleClose = () => {
    setSearch("");
    setSelectedPlayer(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Who is this session for?</DialogTitle>
          <DialogDescription className="text-slate-400">
            Select an existing player or add a new one
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              autoFocus
            />
          </div>

          {/* Add New Player Button */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 border-dashed border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-500"
            onClick={handleAddNewPlayer}
          >
            <UserPlus className="h-4 w-4 text-red-400" />
            <span>Add New Player</span>
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Button>

          {/* Players List */}
          <ScrollArea className="h-[300px] -mx-2">
            <div className="px-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : players.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {search ? `No players matching "${search}"` : "No players yet"}
                </div>
              ) : (
                players.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleSelectPlayer(player)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                      "hover:bg-slate-800 focus:bg-slate-800 focus:outline-none",
                      selectedPlayer?.id === player.id && "bg-slate-800"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{player.name}</span>
                        {player.latest_composite_score && (
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                            {player.latest_composite_score}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-400 truncate">
                        {[player.level, player.team].filter(Boolean).join(' • ') || player.email || 'No details'}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
