import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, User, Search, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Player {
  id: string;
  name: string;
  handedness: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  level: string | null;
  team: string | null;
}

export default function Athletes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    handedness: "",
    height_inches: "",
    weight_lbs: "",
    level: "",
    team: "",
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { data: players = [], isLoading, refetch } = useQuery({
    queryKey: ["athletes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, handedness, height_inches, weight_lbs, level, team")
        .order("name");
      if (error) throw error;
      return data as Player[];
    },
  });

  const filtered = players.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!newPlayer.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("players").insert({
        name: newPlayer.name.trim(),
        handedness: newPlayer.handedness || null,
        height_inches: newPlayer.height_inches ? Number(newPlayer.height_inches) : null,
        weight_lbs: newPlayer.weight_lbs ? Number(newPlayer.weight_lbs) : null,
        level: newPlayer.level || null,
        team: newPlayer.team.trim() || null,
      });
      if (error) throw error;
      toast.success("Athlete added");
      setNewPlayer({ name: "", handedness: "", height_inches: "", weight_lbs: "", level: "", team: "" });
      setAddOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to add athlete");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncFromReboot = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-reboot-players", {
        body: { preview_only: false },
      });
      if (error) throw error;
      toast.success(data?.message || "Players synced from Reboot");
      refetch();
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error(err.message || "Failed to sync from Reboot");
    } finally {
      setSyncing(false);
    }
  };

  const formatHeight = (inches: number | null) => {
    if (!inches) return null;
    const ft = Math.floor(inches / 12);
    const rem = inches % 12;
    return `${ft}'${rem}"`;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header />
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-white">Athletes</h1>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSyncFromReboot}
              disabled={syncing}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Refresh from Reboot"}
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700 text-white font-bold">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Athlete
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Athlete</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-slate-300">Name *</Label>
                  <Input
                    value={newPlayer.name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                    placeholder="Full name"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Handedness</Label>
                    <Select
                      value={newPlayer.handedness}
                      onValueChange={(v) => setNewPlayer({ ...newPlayer, handedness: v })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="right">Right</SelectItem>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="switch">Switch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300">Level</Label>
                    <Select
                      value={newPlayer.level}
                      onValueChange={(v) => setNewPlayer({ ...newPlayer, level: v })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youth">Youth</SelectItem>
                        <SelectItem value="high_school">High School</SelectItem>
                        <SelectItem value="college">College</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="mlb">MLB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Height (inches)</Label>
                    <Input
                      type="number"
                      value={newPlayer.height_inches}
                      onChange={(e) => setNewPlayer({ ...newPlayer, height_inches: e.target.value })}
                      placeholder="72"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Weight (lbs)</Label>
                    <Input
                      type="number"
                      value={newPlayer.weight_lbs}
                      onChange={(e) => setNewPlayer({ ...newPlayer, weight_lbs: e.target.value })}
                      placeholder="185"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Team</Label>
                  <Input
                    value={newPlayer.team}
                    onChange={(e) => setNewPlayer({ ...newPlayer, team: e.target.value })}
                    placeholder="Team name"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <Button
                  onClick={handleAdd}
                  disabled={saving}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {saving ? "Adding..." : "Add Athlete"}
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search athletes..."
            className="pl-10 bg-slate-900 border-slate-700 text-white"
          />
        </div>

        {/* Athletes list */}
        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading athletes...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <User className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">
              {search ? "No athletes match your search" : "No athletes yet"}
            </p>
            {!search && (
              <Button
                onClick={() => setAddOpen(true)}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:text-white"
              >
                Add your first athlete
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((player) => (
              <Card
                key={player.id}
                className="bg-slate-900/80 border-slate-800 hover:border-slate-600 transition-colors cursor-pointer"
                onClick={() => navigate(`/upload?athlete=${player.id}`)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{player.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {player.handedness && <span className="capitalize">{player.handedness}</span>}
                        {player.level && <span className="capitalize">{player.level.replace("_", " ")}</span>}
                        {player.team && <span>{player.team}</span>}
                        {formatHeight(player.height_inches) && (
                          <span>{formatHeight(player.height_inches)}</span>
                        )}
                        {player.weight_lbs && <span>{player.weight_lbs} lbs</span>}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                    Upload →
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
