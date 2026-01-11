import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Upload, BarChart3, Target, Activity, Zap, Video, ChevronRight, Database, MoreVertical, Trash2 } from "lucide-react";
import { UnifiedDataUploadModal } from "@/components/UnifiedDataUploadModal";
import { getBrandDisplayName } from "@/lib/csv-detector";
import { LaunchMonitorBrand } from "@/lib/csv-detector";
import { toast } from "sonner";

interface PlayerDataTabProps {
  playerId: string;
  playerName: string;
}

type DataFilter = 'all' | 'analyzer' | 'reboot' | 'hittrax' | 'batsensor' | 'videos';

interface DataSession {
  id: string;
  type: DataFilter;
  typeName: string;
  date: Date;
  source?: string;
  scores?: {
    brain?: number;
    body?: number;
    bat?: number;
    ball?: number;
  };
  swingCount?: number;
  reviewed: boolean;
}

export function PlayerDataTab({ playerId, playerName }: PlayerDataTabProps) {
  const [filter, setFilter] = useState<DataFilter>('all');
  const [sessions, setSessions] = useState<DataSession[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteSession, setDeleteSession] = useState<DataSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  // playersTableId is the ID in the `players` table (different from player_profiles)
  const [playersTableId, setPlayersTableId] = useState<string | null>(null);

  // Lookup or create the corresponding players table record
  const lookupOrCreatePlayersRecord = async () => {
    // First try to find existing players record by name
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .ilike('name', playerName)
      .maybeSingle();
    
    if (existingPlayer) {
      setPlayersTableId(existingPlayer.id);
      return existingPlayer.id;
    }
    
    // If not found, create a new players record
    const { data: newPlayer, error: createError } = await supabase
      .from('players')
      .insert({ name: playerName })
      .select('id')
      .single();
    
    if (createError) {
      console.error('Error creating players record:', createError);
      // Fallback: use the profile ID (will fail on FK but at least shows data)
      setPlayersTableId(playerId);
      return playerId;
    }
    
    setPlayersTableId(newPlayer.id);
    return newPlayer.id;
  };

  useEffect(() => {
    const init = async () => {
      const pId = await lookupOrCreatePlayersRecord();
      loadSessions(pId);
    };
    init();
  }, [playerId, playerName]);

  const loadSessions = async (pId?: string) => {
    const resolvedId = pId || playersTableId || playerId;
    setLoading(true);
    
    const [sessionsRes, launchRes, rebootRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('player_id', playerId), // sessions uses player_profiles
      supabase.from('launch_monitor_sessions').select('*').eq('player_id', resolvedId),
      supabase.from('reboot_uploads').select('*').eq('player_id', resolvedId),
    ]);

    const allSessions: DataSession[] = [
      ...(sessionsRes.data || []).map(s => ({
        id: s.id,
        type: 'analyzer' as DataFilter,
        typeName: 'Swing Analysis',
        date: new Date(s.created_at || new Date()),
        scores: {
          brain: s.four_b_brain ?? undefined,
          body: s.four_b_body ?? undefined,
          bat: s.four_b_bat ?? undefined,
        },
        reviewed: s.status === 'completed',
      })),
      ...(launchRes.data || []).map(s => ({
        id: s.id,
        type: 'hittrax' as DataFilter,
        typeName: getBrandDisplayName((s.source || 'generic') as LaunchMonitorBrand),
        date: new Date(s.session_date),
        source: s.source || undefined,
        swingCount: s.total_swings,
        scores: {
          ball: s.ball_score ?? undefined,
        },
        reviewed: true,
      })),
      ...(rebootRes.data || []).map(s => ({
        id: s.id,
        type: 'reboot' as DataFilter,
        typeName: s.ik_file_uploaded && s.me_file_uploaded ? 'Reboot IK+ME' : s.ik_file_uploaded ? 'Reboot IK' : 'Reboot ME',
        date: new Date(s.created_at || new Date()),
        scores: {
          brain: s.brain_score ?? undefined,
          body: s.body_score ?? undefined,
          bat: s.bat_score ?? undefined,
        },
        reviewed: true,
      })),
    ];

    allSessions.sort((a, b) => b.date.getTime() - a.date.getTime());
    setSessions(allSessions);
    setLoading(false);
  };

  const handleDeleteSession = async () => {
    if (!deleteSession) return;
    
    setDeleting(true);
    try {
      let error: { message: string } | null = null;
      
      switch (deleteSession.type) {
        case 'analyzer':
          ({ error } = await supabase.from('sessions').delete().eq('id', deleteSession.id));
          break;
        case 'hittrax':
          ({ error } = await supabase.from('launch_monitor_sessions').delete().eq('id', deleteSession.id));
          break;
        case 'reboot':
          ({ error } = await supabase.from('reboot_uploads').delete().eq('id', deleteSession.id));
          break;
        default:
          throw new Error('Unknown session type');
      }

      if (error) throw error;

      toast.success('Session deleted');
      setDeleteSession(null);
      loadSessions(playersTableId || undefined);
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    } finally {
      setDeleting(false);
    }
  };

  const filteredSessions = filter === 'all' 
    ? sessions 
    : sessions.filter(s => s.type === filter);

  const getTypeIcon = (type: DataFilter) => {
    switch (type) {
      case 'analyzer': return <BarChart3 className="h-4 w-4 text-primary" />;
      case 'hittrax': return <Target className="h-4 w-4 text-emerald-500" />;
      case 'reboot': return <Activity className="h-4 w-4 text-blue-500" />;
      case 'batsensor': return <Zap className="h-4 w-4 text-amber-500" />;
      case 'videos': return <Video className="h-4 w-4 text-purple-500" />;
      default: return null;
    }
  };

  const filterButtons: { value: DataFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'All Data', icon: <Database className="h-4 w-4" /> },
    { value: 'analyzer', label: 'Analyzer', icon: <BarChart3 className="h-4 w-4" /> },
    { value: 'reboot', label: 'Reboot', icon: <Activity className="h-4 w-4" /> },
    { value: 'hittrax', label: 'HitTrax', icon: <Target className="h-4 w-4" /> },
    { value: 'batsensor', label: 'Bat Sensors', icon: <Zap className="h-4 w-4" /> },
    { value: 'videos', label: 'Videos', icon: <Video className="h-4 w-4" /> },
  ];

  const getCounts = () => {
    const counts: Record<DataFilter, number> = {
      all: sessions.length,
      analyzer: sessions.filter(s => s.type === 'analyzer').length,
      reboot: sessions.filter(s => s.type === 'reboot').length,
      hittrax: sessions.filter(s => s.type === 'hittrax').length,
      batsensor: sessions.filter(s => s.type === 'batsensor').length,
      videos: sessions.filter(s => s.type === 'videos').length,
    };
    return counts;
  };

  const counts = getCounts();

  return (
    <div className="flex gap-6">
      {/* Left Sidebar: Source Filter */}
      <div className="w-48 space-y-1">
        {filterButtons.map(btn => (
          <Button
            key={btn.value}
            variant={filter === btn.value ? 'secondary' : 'ghost'}
            className={`w-full justify-between ${
              filter === btn.value 
                ? 'bg-slate-800 text-white' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
            onClick={() => setFilter(btn.value)}
          >
            <span className="flex items-center gap-2">
              {btn.icon}
              {btn.label}
            </span>
            <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
              {counts[btn.value]}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Right: Sessions List */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">
            {filterButtons.find(b => b.value === filter)?.label || 'All Data'}
          </h3>
          <Button 
            onClick={() => setUploadModalOpen(true)}
            className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
          >
            <Upload className="h-4 w-4 mr-2" /> Upload Data
          </Button>
        </div>

        {loading ? (
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="py-8 text-center">
              <p className="text-slate-400">Loading...</p>
            </CardContent>
          </Card>
        ) : filteredSessions.length === 0 ? (
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="py-12 text-center">
              <Database className="h-12 w-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No data sessions found.</p>
              <p className="text-slate-500 text-sm mt-1">Upload some data to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900/80 border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Type</TableHead>
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400">Scores</TableHead>
                  <TableHead className="text-slate-400">Details</TableHead>
                  <TableHead className="text-slate-400"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map(session => (
                  <TableRow key={session.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(session.type)}
                        <span className="text-white">{session.typeName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{format(session.date, 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {session.scores && (
                        <div className="flex gap-1 text-xs">
                          {session.scores.brain !== undefined && (
                            <Badge variant="outline" className="border-slate-700 text-slate-300">B:{session.scores.brain}</Badge>
                          )}
                          {session.scores.body !== undefined && (
                            <Badge variant="outline" className="border-slate-700 text-slate-300">Bo:{session.scores.body}</Badge>
                          )}
                          {session.scores.bat !== undefined && (
                            <Badge variant="outline" className="border-slate-700 text-slate-300">Ba:{session.scores.bat}</Badge>
                          )}
                          {session.scores.ball !== undefined && (
                            <Badge variant="outline" className="border-slate-700 text-slate-300">Ball:{session.scores.ball}</Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {session.swingCount && (
                        <span className="text-slate-400 text-sm">
                          {session.swingCount} swings
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                          View <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                            <DropdownMenuItem 
                              onClick={() => setDeleteSession(session)}
                              className="text-red-400 focus:text-red-300 focus:bg-slate-800"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Upload Modal */}
      <UnifiedDataUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        playerId={playersTableId || playerId}
        playerName={playerName}
        onSuccess={() => {
          loadSessions(playersTableId || undefined);
          setUploadModalOpen(false);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSession} onOpenChange={(open) => !open && setDeleteSession(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete this session?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This cannot be undone. All data associated with this session will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSession}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
