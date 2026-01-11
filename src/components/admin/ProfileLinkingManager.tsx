import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Link2,
  Link2Off,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  RefreshCw,
} from "lucide-react";

interface UnlinkedProfile {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  level: string | null;
  current_team: string | null;
  created_at: string;
}

interface LinkedProfile {
  id: string;
  first_name: string;
  last_name: string | null;
  players_id: string | null;
  player_name: string | null;
  mlb_id: string | null;
  fangraphs_id: string | null;
  baseball_reference_id: string | null;
  updated_at: string;
}

interface BackfillResult {
  profile_id: string;
  created_player_id: string;
  player_name: string;
  linked: boolean;
}

export function ProfileLinkingManager() {
  const queryClient = useQueryClient();
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResults, setBackfillResults] = useState<BackfillResult[]>([]);

  // Fetch unlinked profiles count and list
  const { data: unlinkedData, isLoading: loadingUnlinked } = useQuery({
    queryKey: ["unlinked-profiles"],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("player_profiles")
        .select("id, first_name, last_name, email, phone, level, current_team, created_at", { count: "exact" })
        .is("players_id", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return { profiles: data as UnlinkedProfile[], count: count || 0 };
    },
  });

  // Fetch linked profiles
  const { data: linkedData, isLoading: loadingLinked } = useQuery({
    queryKey: ["linked-profiles"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("player_profiles")
        .select("id, first_name, last_name, players_id, mlb_id, fangraphs_id, baseball_reference_id, updated_at")
        .not("players_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch player names for linked profiles
      const playerIds = profiles?.map((p) => p.players_id).filter(Boolean) || [];
      let playerNames: Record<string, string> = {};

      if (playerIds.length > 0) {
        const { data: players } = await supabase
          .from("players")
          .select("id, name")
          .in("id", playerIds);

        playerNames = (players || []).reduce((acc, p) => {
          acc[p.id] = p.name;
          return acc;
        }, {} as Record<string, string>);
      }

      return (profiles || []).map((p) => ({
        ...p,
        player_name: p.players_id ? playerNames[p.players_id] || "Unknown" : null,
      })) as LinkedProfile[];
    },
  });

  const handleBackfill = async () => {
    setIsBackfilling(true);
    setBackfillResults([]);

    try {
      const { data, error } = await supabase.rpc("backfill_players_from_profiles", {
        limit_count: 200,
      });

      if (error) throw error;

      const results = (data || []) as BackfillResult[];
      setBackfillResults(results);

      toast.success(`Backfill complete: ${results.length} profiles linked`);

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["unlinked-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["linked-profiles"] });
    } catch (error: any) {
      console.error("Backfill error:", error);
      toast.error(error.message || "Backfill failed");
    } finally {
      setIsBackfilling(false);
    }
  };

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["unlinked-profiles"] });
    queryClient.invalidateQueries({ queryKey: ["linked-profiles"] });
    setBackfillResults([]);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Unlinked Profiles</p>
                <p className="text-3xl font-bold text-red-400">
                  {loadingUnlinked ? "..." : unlinkedData?.count || 0}
                </p>
              </div>
              <Link2Off className="h-8 w-8 text-red-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Linked Profiles</p>
                <p className="text-3xl font-bold text-green-400">
                  {loadingLinked ? "..." : linkedData?.length || 0}
                </p>
              </div>
              <Link2 className="h-8 w-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleBackfill}
                disabled={isBackfilling || (unlinkedData?.count || 0) === 0}
                className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 flex-1"
              >
                {isBackfilling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Backfilling...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Backfill Players
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={refreshData}
                className="border-slate-700 text-slate-400 hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backfill Results */}
      {backfillResults.length > 0 && (
        <Card className="bg-green-900/20 border-green-800">
          <CardHeader>
            <CardTitle className="text-green-400 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Backfill Results
            </CardTitle>
            <CardDescription className="text-green-400/70">
              {backfillResults.length} profiles successfully linked to new player records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-green-800 hover:bg-transparent">
                  <TableHead className="text-green-400/70">Player Name</TableHead>
                  <TableHead className="text-green-400/70">Profile ID</TableHead>
                  <TableHead className="text-green-400/70">New Player ID</TableHead>
                  <TableHead className="text-green-400/70">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backfillResults.slice(0, 10).map((result) => (
                  <TableRow key={result.profile_id} className="border-green-800/50">
                    <TableCell className="text-white">{result.player_name || "N/A"}</TableCell>
                    <TableCell className="font-mono text-xs text-green-400/70">
                      {result.profile_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="font-mono text-xs text-green-400/70">
                      {result.created_player_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-500/20 text-green-400">Linked</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {backfillResults.length > 10 && (
                  <TableRow className="border-green-800/50">
                    <TableCell colSpan={4} className="text-center text-green-400/70">
                      ... and {backfillResults.length - 10} more
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Unlinked/Linked */}
      <Tabs defaultValue="unlinked" className="space-y-4">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="unlinked" className="data-[state=active]:bg-slate-700">
            <Link2Off className="h-4 w-4 mr-2" />
            Unlinked ({unlinkedData?.count || 0})
          </TabsTrigger>
          <TabsTrigger value="linked" className="data-[state=active]:bg-slate-700">
            <Link2 className="h-4 w-4 mr-2" />
            Linked ({linkedData?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unlinked">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Unlinked Player Profiles
              </CardTitle>
              <CardDescription className="text-slate-400">
                These profiles don't have a linked players record. Run the backfill to create player records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUnlinked ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (unlinkedData?.profiles?.length || 0) === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  <p>All profiles are linked!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Name</TableHead>
                      <TableHead className="text-slate-400">Email</TableHead>
                      <TableHead className="text-slate-400">Level</TableHead>
                      <TableHead className="text-slate-400">Team</TableHead>
                      <TableHead className="text-slate-400">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unlinkedData?.profiles.map((profile) => (
                      <TableRow key={profile.id} className="border-slate-800">
                        <TableCell className="text-white font-medium">
                          {profile.first_name} {profile.last_name || ""}
                        </TableCell>
                        <TableCell className="text-slate-400">{profile.email || "-"}</TableCell>
                        <TableCell>
                          {profile.level ? (
                            <Badge variant="secondary" className="bg-slate-800">
                              {profile.level}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-slate-400">{profile.current_team || "-"}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {format(new Date(profile.created_at), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="linked">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                Linked Player Profiles
              </CardTitle>
              <CardDescription className="text-slate-400">
                Profiles with an associated players record for data sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLinked ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (linkedData?.length || 0) === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Link2Off className="h-12 w-12 mx-auto text-slate-600 mb-2" />
                  <p>No linked profiles yet. Run the backfill to create links.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Profile Name</TableHead>
                      <TableHead className="text-slate-400">Linked Player</TableHead>
                      <TableHead className="text-slate-400">Player ID</TableHead>
                      <TableHead className="text-slate-400">External IDs</TableHead>
                      <TableHead className="text-slate-400">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedData?.map((profile) => (
                      <TableRow key={profile.id} className="border-slate-800">
                        <TableCell className="text-white font-medium">
                          {profile.first_name} {profile.last_name || ""}
                        </TableCell>
                        <TableCell className="text-green-400">{profile.player_name || "-"}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">
                          {profile.players_id?.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {profile.mlb_id && (
                              <Badge variant="outline" className="text-xs border-blue-800 text-blue-400">
                                MLB
                              </Badge>
                            )}
                            {profile.fangraphs_id && (
                              <Badge variant="outline" className="text-xs border-purple-800 text-purple-400">
                                FG
                              </Badge>
                            )}
                            {profile.baseball_reference_id && (
                              <Badge variant="outline" className="text-xs border-amber-800 text-amber-400">
                                BBRef
                              </Badge>
                            )}
                            {!profile.mlb_id && !profile.fangraphs_id && !profile.baseball_reference_id && (
                              <span className="text-slate-500">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {format(new Date(profile.updated_at), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
