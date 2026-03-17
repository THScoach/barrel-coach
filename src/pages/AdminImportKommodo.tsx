import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, Loader2, Link2, Unlink, Users, Video,
  Clock, Calendar, Play, Search, Zap, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AdminHeader } from "@/components/AdminHeader";
import { supabase } from "@/integrations/supabase/client";
import { kommodoApi } from "@/hooks/useKommodoApi";

export default function AdminImportKommodo() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("unlinked");
  const [searchPlayer, setSearchPlayer] = useState("");
  const [selectedPlayerForLink, setSelectedPlayerForLink] = useState<Record<string, string>>({});

  // ── Data queries ──

  const { data: unlinkedData, isLoading: loadingUnlinked, refetch: refetchUnlinked } = useQuery({
    queryKey: ['kommodo-unlinked'],
    queryFn: () => kommodoApi.getUnlinkedRecordings(),
    enabled: activeTab === 'unlinked',
  });

  const { data: syncData, isLoading: loadingSync } = useQuery({
    queryKey: ['kommodo-sync-status'],
    queryFn: () => kommodoApi.getSyncStatus(),
  });

  const { data: membersData, isLoading: loadingMembers } = useQuery({
    queryKey: ['kommodo-members'],
    queryFn: () => kommodoApi.listMembers(),
    enabled: activeTab === 'mapping',
  });

  const { data: playersData } = useQuery({
    queryKey: ['all-players-for-kommodo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, kommodo_member_id')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // ── Mutations ──

  const syncMutation = useMutation({
    mutationFn: () => kommodoApi.runSync(),
    onSuccess: (data) => {
      toast.success(`Sync complete: ${data.recordings_linked} linked, ${data.recordings_unlinked} unmatched`);
      queryClient.invalidateQueries({ queryKey: ['kommodo-unlinked'] });
      queryClient.invalidateQueries({ queryKey: ['kommodo-sync-status'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkMutation = useMutation({
    mutationFn: ({ recordingId, playerId }: { recordingId: string; playerId: string }) =>
      kommodoApi.linkRecording(recordingId, playerId),
    onSuccess: () => {
      toast.success('Recording linked!');
      queryClient.invalidateQueries({ queryKey: ['kommodo-unlinked'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const memberMappingMutation = useMutation({
    mutationFn: ({ playerId, memberId }: { playerId: string; memberId: string | null }) =>
      kommodoApi.updateMemberMapping(playerId, memberId),
    onSuccess: () => {
      toast.success('Mapping updated!');
      queryClient.invalidateQueries({ queryKey: ['all-players-for-kommodo'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unlinkedRecordings = unlinkedData?.recordings || [];
  const members = membersData?.members || membersData?.data || membersData || [];
  const lastSync = syncData?.last_sync;
  const players = playersData || [];

  const filteredPlayers = searchPlayer
    ? players.filter((p: any) => p.name?.toLowerCase().includes(searchPlayer.toLowerCase()))
    : players;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link to="/admin/videos">
                <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-white">Kommodo Integration</h1>
            </div>
          </div>

          {/* Sync Status Bar */}
          <Card className="mb-6 bg-slate-900/80 border-slate-800">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-slate-400">
                    {lastSync ? (
                      <>
                        <span className="text-slate-300">Last sync:</span>{' '}
                        {new Date(lastSync.started_at).toLocaleString()}{' '}
                        <Badge variant={lastSync.status === 'completed' ? 'default' : lastSync.status === 'failed' ? 'destructive' : 'secondary'} className="ml-2">
                          {lastSync.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {lastSync.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                          {lastSync.status === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {lastSync.status}
                        </Badge>
                        {lastSync.recordings_linked > 0 && (
                          <span className="ml-2 text-green-400">{lastSync.recordings_linked} linked</span>
                        )}
                      </>
                    ) : (
                      <span>No syncs yet</span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Run Sync Now
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-900/80 border border-slate-800 mb-6">
              <TabsTrigger value="unlinked" className="data-[state=active]:bg-slate-800 text-slate-400 data-[state=active]:text-white">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Unlinked ({unlinkedRecordings.length})
              </TabsTrigger>
              <TabsTrigger value="mapping" className="data-[state=active]:bg-slate-800 text-slate-400 data-[state=active]:text-white">
                <Users className="h-4 w-4 mr-2" />
                Member Mapping
              </TabsTrigger>
            </TabsList>

            {/* Section 1: Unlinked Recordings */}
            <TabsContent value="unlinked">
              <Card className="bg-slate-900/80 border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg">Unlinked Kommodo Recordings</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchUnlinked()}
                      disabled={loadingUnlinked}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingUnlinked ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingUnlinked ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : unlinkedRecordings.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500" />
                      <p className="text-slate-300">All recordings are linked!</p>
                      <p className="text-slate-500 text-sm mt-1">Run a sync to check for new recordings.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-800 hover:bg-transparent">
                            <TableHead className="text-slate-400">Recording</TableHead>
                            <TableHead className="text-slate-400">Date</TableHead>
                            <TableHead className="text-slate-400">Resolution</TableHead>
                            <TableHead className="text-slate-400 min-w-[200px]">Link to Player</TableHead>
                            <TableHead className="text-slate-400 w-[100px]">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unlinkedRecordings.map((rec: any) => (
                            <TableRow key={rec.id} className="border-slate-800 hover:bg-slate-800/50">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Video className="h-4 w-4 text-slate-500 shrink-0" />
                                  <span className="text-white text-sm font-medium truncate max-w-[250px]">
                                    {rec.title || rec.name || 'Untitled'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-400 text-sm">
                                {(rec.createdAt || rec.created_at) ? new Date(rec.createdAt || rec.created_at).toLocaleDateString() : '--'}
                              </TableCell>
                              <TableCell className="text-slate-400 text-sm">
                                {rec.width && rec.height ? `${rec.width}×${rec.height}` : formatDuration(rec.duration || rec.duration_seconds)}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={selectedPlayerForLink[rec.id] || ''}
                                  onValueChange={(v) => setSelectedPlayerForLink(prev => ({ ...prev, [rec.id]: v }))}
                                >
                                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white text-sm h-9">
                                    <SelectValue placeholder="Select player..." />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                                    {players.map((p: any) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name || 'Unnamed'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  disabled={!selectedPlayerForLink[rec.id] || linkMutation.isPending}
                                  onClick={() => {
                                    if (selectedPlayerForLink[rec.id]) {
                                      linkMutation.mutate({
                                        recordingId: rec.id,
                                        playerId: selectedPlayerForLink[rec.id],
                                      });
                                    }
                                  }}
                                  className="bg-green-600 hover:bg-green-700 text-white h-9"
                                >
                                  <Link2 className="h-3 w-3 mr-1" />
                                  Link
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Section 2: Member Mapping */}
            <TabsContent value="mapping">
              <Card className="bg-slate-900/80 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg">Player ↔ Kommodo Member Mapping</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Input
                      placeholder="Search players..."
                      value={searchPlayer}
                      onChange={(e) => setSearchPlayer(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white max-w-sm"
                    />
                  </div>

                  {loadingMembers ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-800 hover:bg-transparent">
                            <TableHead className="text-slate-400">Player</TableHead>
                            <TableHead className="text-slate-400">Current Mapping</TableHead>
                            <TableHead className="text-slate-400 min-w-[200px]">Kommodo Member</TableHead>
                            <TableHead className="text-slate-400 w-[100px]">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPlayers.map((player: any) => (
                            <TableRow key={player.id} className="border-slate-800 hover:bg-slate-800/50">
                              <TableCell className="text-white font-medium">{player.name || 'Unnamed'}</TableCell>
                              <TableCell>
                                {player.kommodo_member_id ? (
                                  <Badge variant="default" className="text-xs">
                                    {player.kommodo_member_id}
                                  </Badge>
                                ) : (
                                  <span className="text-slate-500 text-sm">Not mapped</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={player.kommodo_member_id || 'none'}
                                  onValueChange={(v) => {
                                    memberMappingMutation.mutate({
                                      playerId: player.id,
                                      memberId: v === 'none' ? null : v,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white text-sm h-9">
                                    <SelectValue placeholder="Select member..." />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                                    <SelectItem value="none">None</SelectItem>
                                    {(Array.isArray(members) ? members : []).map((m: any) => (
                                      <SelectItem key={m.id} value={m.id}>
                                        {m.name || m.email || m.id}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {player.kommodo_member_id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => memberMappingMutation.mutate({ playerId: player.id, memberId: null })}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-9"
                                  >
                                    <Unlink className="h-3 w-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
