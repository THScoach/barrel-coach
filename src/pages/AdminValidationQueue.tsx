import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Video,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ValidationModal } from "@/components/admin/validation/ValidationModal";

interface PendingSwing {
  id: string;
  session_id: string;
  swing_index: number;
  video_url: string | null;
  thumbnail_url: string | null;
  status: string | null;
  frame_rate: number | null;
  sequence_score: number | null;
  sequence_analysis: any;
  created_at: string;
  session: {
    id: string;
    player_id: string;
    session_date: string;
    context: string | null;
    player: {
      id: string;
      name: string;
      level: string | null;
    } | null;
  } | null;
}

const getScoreColor = (score: number | null): string => {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 70) return "bg-green-500/20 text-green-400";
  if (score >= 55) return "bg-blue-500/20 text-blue-400";
  if (score >= 45) return "bg-yellow-500/20 text-yellow-400";
  return "bg-red-500/20 text-red-400";
};

const getConfidenceBadge = (frameRate: number | null) => {
  if (!frameRate) return <Badge variant="outline" className="text-xs">Unknown FPS</Badge>;
  if (frameRate >= 120) return <Badge className="bg-green-500/20 text-green-400 text-xs">High ({frameRate} fps)</Badge>;
  if (frameRate >= 60) return <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">Medium ({frameRate} fps)</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 text-xs">Low ({frameRate} fps)</Badge>;
};

export default function AdminValidationQueue() {
  const queryClient = useQueryClient();
  const [selectedSwing, setSelectedSwing] = useState<PendingSwing | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch pending swings with player info
  const { data: pendingSwings = [], isLoading, refetch } = useQuery({
    queryKey: ["pending-validation-swings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_swings")
        .select(`
          id,
          session_id,
          swing_index,
          video_url,
          thumbnail_url,
          status,
          frame_rate,
          sequence_score,
          sequence_analysis,
          created_at,
          session:video_swing_sessions!inner(
            id,
            player_id,
            session_date,
            context,
            player:players!inner(
              id,
              name,
              level
            )
          )
        `)
        .eq("status", "pending_validation")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching pending swings:", error);
        throw error;
      }

      return (data || []) as unknown as PendingSwing[];
    },
  });

  // Also fetch analyzed swings that might need review
  const { data: analyzedSwings = [] } = useQuery({
    queryKey: ["analyzed-swings-for-validation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_swings")
        .select(`
          id,
          session_id,
          swing_index,
          video_url,
          thumbnail_url,
          status,
          frame_rate,
          sequence_score,
          sequence_analysis,
          created_at,
          session:video_swing_sessions!inner(
            id,
            player_id,
            session_date,
            context,
            player:players!inner(
              id,
              name,
              level
            )
          )
        `)
        .eq("status", "analyzed")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching analyzed swings:", error);
        return [];
      }

      return (data || []) as unknown as PendingSwing[];
    },
  });

  const allSwings = [...pendingSwings, ...analyzedSwings];

  const handleOpenValidation = (swing: PendingSwing) => {
    setSelectedSwing(swing);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSwing(null);
  };

  const handleValidationComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["pending-validation-swings"] });
    queryClient.invalidateQueries({ queryKey: ["analyzed-swings-for-validation"] });
    handleCloseModal();
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Validation Queue</h1>
            <p className="text-slate-400">Review and approve swing analyses before players see them</p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-slate-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-yellow-500/20">
                  <Clock className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{pendingSwings.length}</p>
                  <p className="text-sm text-slate-400">Pending Validation</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-500/20">
                  <Eye className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analyzedSwings.length}</p>
                  <p className="text-sm text-slate-400">Recently Analyzed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-500/20">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">-</p>
                  <p className="text-sm text-slate-400">Approved Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-red-500/20">
                  <XCircle className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">-</p>
                  <p className="text-sm text-slate-400">Rejected Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Swings Table */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Video className="h-5 w-5" />
              Swings Awaiting Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : allSwings.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-slate-400">All caught up! No swings pending validation.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Player</TableHead>
                    <TableHead className="text-slate-400">Swing</TableHead>
                    <TableHead className="text-slate-400">Auto Score</TableHead>
                    <TableHead className="text-slate-400">Confidence</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Uploaded</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSwings.map((swing) => (
                    <TableRow
                      key={swing.id}
                      className="border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => handleOpenValidation(swing)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {swing.thumbnail_url ? (
                            <img
                              src={swing.thumbnail_url}
                              alt="Thumbnail"
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center">
                              <Video className="h-5 w-5 text-slate-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-white">
                              {swing.session?.player?.name || "Unknown Player"}
                            </p>
                            <p className="text-sm text-slate-400">
                              {swing.session?.player?.level || "Unknown Level"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-white">Swing #{swing.swing_index + 1}</p>
                          <p className="text-xs text-slate-400">
                            {swing.session?.context || "No context"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getScoreColor(swing.sequence_score)}>
                          {swing.sequence_score !== null ? swing.sequence_score : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(swing.frame_rate)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            swing.status === "pending_validation"
                              ? "border-yellow-500 text-yellow-400"
                              : swing.status === "analyzed"
                              ? "border-blue-500 text-blue-400"
                              : "border-slate-500 text-slate-400"
                          }
                        >
                          {swing.status === "pending_validation" ? "Pending" : swing.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {format(new Date(swing.created_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenValidation(swing);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Validation Modal */}
      {selectedSwing && (
        <ValidationModal
          swing={selectedSwing}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onComplete={handleValidationComplete}
        />
      )}
    </div>
  );
}
