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
  Download,
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { ProfileLinkingManager } from "@/components/admin/ProfileLinkingManager";
import { RebootPlayerImportModal } from "@/components/admin/RebootPlayerImportModal";
import { MobileBottomNav } from "@/components/admin/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [showRebootImport, setShowRebootImport] = useState(false);

  const { data: players, isLoading, error, refetch } = useQuery({
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

  const hasFilters = searchQuery || orgFilter !== "all" || levelFilter !== "all";

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />

      <main className={`container py-6 md:py-8 ${isMobile ? 'pb-24' : ''}`}>
        {/* Header - High contrast */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-50 flex items-center gap-2.5 tracking-tight">
              <Users className="h-5 w-5 md:h-6 md:w-6 text-slate-300" />
              Players
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-0.5">Manage your player database</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRebootImport(true)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Import from Reboot</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button
              onClick={() => navigate("/admin/players/new")}
              className="btn-primary gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Player</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Main Tabs - Higher Contrast */}
        <Tabs defaultValue="roster" className="space-y-4 md:space-y-6">
          <TabsList className="bg-slate-900 border border-slate-700 p-1">
            <TabsTrigger 
              value="roster" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:font-semibold text-slate-300 hover:text-white min-h-[44px] px-4"
            >
              <Users className="h-4 w-4 mr-2" />
              Roster
            </TabsTrigger>
            <TabsTrigger 
              value="linking" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:font-semibold text-slate-300 hover:text-white min-h-[44px] px-4"
            >
              <Link2 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Profile ↔ Player</span>
              <span className="sm:hidden">Link</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roster">
            {/* Compact Filters Row */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-slate-500"
                />
              </div>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 bg-slate-900 border-slate-700 text-slate-200">
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
                <SelectTrigger className="w-full sm:w-[130px] h-9 bg-slate-900 border-slate-700 text-slate-200">
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

            {/* Error State */}
            {error ? (
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-red-500/10 mb-4">
                    <Users className="h-8 w-8 text-red-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">Failed to load players</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Something went wrong. Please try again.
                  </p>
                  <Button
                    onClick={() => refetch()}
                    variant="outline"
                    className="border-slate-700 text-white hover:bg-slate-800"
                  >
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : players && players.length > 0 ? (
              <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800">
                      <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wide">Player</TableHead>
                      <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wide hidden md:table-cell">Organization</TableHead>
                      <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wide">Level</TableHead>
                      <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wide hidden sm:table-cell">Contact</TableHead>
                      <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wide text-center hidden sm:table-cell">
                        Sessions
                      </TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player, index) => (
                      <TableRow
                        key={player.id}
                        className={`cursor-pointer border-slate-800 hover:bg-slate-800 transition-colors ${
                          index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/60'
                        }`}
                        onClick={() => navigate(`/admin/players/${player.id}`)}
                      >
                        <TableCell className="py-3.5">
                          <div>
                            <p className="font-semibold text-white text-[15px]">
                              {player.first_name} {player.last_name || ""}
                            </p>
                            {player.position && (
                              <p className="text-xs text-slate-400 font-medium mt-0.5">
                                {player.position}
                              </p>
                            )}
                            {/* Show org on mobile */}
                            <p className="text-xs text-slate-500 md:hidden mt-1">
                              {player.organization || player.current_team || ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div>
                            <p className="text-white font-medium">
                              {player.organization || "-"}
                            </p>
                            {player.current_team && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {player.current_team}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {player.level ? (
                            <Badge
                              variant="secondary"
                              className="bg-slate-700 text-white font-medium border border-slate-600"
                            >
                              {player.level}
                            </Badge>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col gap-1.5 text-sm">
                            {player.phone && (
                              <div className="flex items-center gap-1.5 text-slate-200">
                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-medium">{formatPhone(player.phone)}</span>
                              </div>
                            )}
                            {player.email && (
                              <div className="flex items-center gap-1.5 text-slate-300">
                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                                <span className="truncate max-w-[140px]">{player.email}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <Badge
                            variant={player.total_sessions > 0 ? "default" : "outline"}
                            className={
                              player.total_sessions > 0
                                ? "bg-green-500/20 text-green-300 border-green-500/40 font-semibold"
                                : "text-slate-400 border-slate-600"
                            }
                          >
                            {player.total_sessions}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4">
                          <ChevronRight className="h-5 w-5 text-slate-500" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : hasFilters ? (
              /* No results for current filter */
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-slate-800 mb-4">
                    <Search className="h-8 w-8 text-slate-500" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">No players match this filter</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Try adjusting your search or filter criteria
                  </p>
                  <Button
                    onClick={() => {
                      setSearchQuery("");
                      setOrgFilter("all");
                      setLevelFilter("all");
                    }}
                    variant="outline"
                    className="border-slate-700 text-white hover:bg-slate-800"
                  >
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              /* Empty state - no players at all */
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-slate-800 mb-4">
                    <Users className="h-8 w-8 text-slate-500" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">No players yet</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Add your first player to get started
                  </p>
                  <Button
                    onClick={() => navigate("/admin/players/new")}
                    className="btn-primary"
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

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileBottomNav />}

      {/* Reboot Import Modal */}
      <RebootPlayerImportModal
        open={showRebootImport}
        onOpenChange={setShowRebootImport}
        onImportComplete={() => refetch()}
      />
    </div>
  );
}
