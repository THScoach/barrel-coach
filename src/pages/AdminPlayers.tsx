import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Users,
  Phone,
  Mail,
  ChevronRight,
  Loader2,
  Link2,
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { ProfileLinkingManager } from "@/components/admin/ProfileLinkingManager";

interface PlayerProfile {
  id: string;
  first_name: string;
  last_name: string | null;
  organization: string | null;
  current_team: string | null;
  level: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  total_sessions: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminPlayers() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const { data: players, isLoading, error } = useQuery({
    queryKey: ["player-profiles", searchQuery, orgFilter, levelFilter],
    queryFn: async () => {
      let query = supabase
        .from("player_profiles")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(
          `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`
        );
      }

      if (orgFilter && orgFilter !== "all") {
        query = query.eq("organization", orgFilter);
      }

      if (levelFilter && levelFilter !== "all") {
        query = query.eq("level", levelFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PlayerProfile[];
    },
  });

  const { data: filterOptions } = useQuery({
    queryKey: ["player-filter-options"],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_profiles")
        .select("organization, level")
        .eq("is_active", true);

      return {
        organizations: [
          ...new Set(data?.map((p) => p.organization).filter(Boolean) || []),
        ],
        levels: [...new Set(data?.map((p) => p.level).filter(Boolean) || [])],
      };
    },
  });

  const formatPhone = (phone: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  if (error) {
    toast.error("Failed to load players");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />

      <main className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="h-6 w-6" />
              Players
            </h1>
            <p className="text-slate-400">Manage your player database</p>
          </div>
          <Button
            onClick={() => navigate("/admin/players/new")}
            className="bg-red-600 hover:bg-red-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Player
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="roster" className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="roster" className="data-[state=active]:bg-slate-700">
              <Users className="h-4 w-4 mr-2" />
              Roster
            </TabsTrigger>
            <TabsTrigger value="linking" className="data-[state=active]:bg-slate-700">
              <Link2 className="h-4 w-4 mr-2" />
              Profile ↔ Player Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roster">
            {/* Filters */}
            <Card className="mb-6 bg-slate-900/80 border-slate-800">
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Search by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <Select value={orgFilter} onValueChange={setOrgFilter}>
                    <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700 text-slate-300">
                      <SelectValue placeholder="Organization" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="all">All Organizations</SelectItem>
                      {filterOptions?.organizations.map((org) => (
                        <SelectItem key={org} value={org!}>
                          {org}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger className="w-[150px] bg-slate-800/50 border-slate-700 text-slate-300">
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="all">All Levels</SelectItem>
                      {filterOptions?.levels.map((level) => (
                        <SelectItem key={level} value={level!}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Players Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : players && players.length > 0 ? (
              <Card className="bg-slate-900/80 border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Player</TableHead>
                      <TableHead className="text-slate-400">Organization</TableHead>
                      <TableHead className="text-slate-400">Level</TableHead>
                      <TableHead className="text-slate-400">Contact</TableHead>
                      <TableHead className="text-slate-400 text-center">
                        Sessions
                      </TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player) => (
                      <TableRow
                        key={player.id}
                        className="cursor-pointer border-slate-800 hover:bg-slate-800/50"
                        onClick={() => navigate(`/admin/players/${player.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">
                              {player.first_name} {player.last_name || ""}
                            </p>
                            {player.position && (
                              <p className="text-xs text-slate-500">
                                {player.position}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-slate-300">
                              {player.organization || "-"}
                            </p>
                            {player.current_team && (
                              <p className="text-xs text-slate-500">
                                {player.current_team}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {player.level ? (
                            <Badge
                              variant="secondary"
                              className="bg-slate-800 text-slate-300"
                            >
                              {player.level}
                            </Badge>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm">
                            {player.phone && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <Phone className="h-3 w-3" />
                                {formatPhone(player.phone)}
                              </div>
                            )}
                            {player.email && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <Mail className="h-3 w-3" />
                                {player.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={player.total_sessions > 0 ? "default" : "outline"}
                            className={
                              player.total_sessions > 0
                                ? "bg-green-500/20 text-green-400"
                                : "text-slate-500 border-slate-700"
                            }
                          >
                            {player.total_sessions}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card className="bg-slate-900/80 border-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-slate-800 mb-4">
                    <Users className="h-8 w-8 text-slate-500" />
                  </div>
                  <h3 className="font-medium text-white mb-1">No players yet</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Add your first player to get started
                  </p>
                  <Button
                    onClick={() => navigate("/admin/players/new")}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Player
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="linking">
            <ProfileLinkingManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
