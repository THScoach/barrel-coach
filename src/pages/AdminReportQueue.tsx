import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { MobileBottomNav } from "@/components/admin/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  FileCheck,
  Clock,
  Eye,
  Send,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ReportPreviewModal } from "@/components/admin/ReportPreviewModal";

interface UnpublishedReport {
  id: string;
  player_id: string;
  session_date: string;
  composite_score: number | null;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  processing_status: string | null;
  leak_detected: string | null;
  motor_profile: string | null;
  priority_drill: string | null;
  eighth_grade_summary: string | null;
  coach_notes_edited: string | null;
  created_at: string | null;
  player: {
    name: string;
    level: string | null;
  } | null;
}

export default function AdminReportQueue() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<UnpublishedReport | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Fetch unpublished reports
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["unpublished-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reboot_uploads")
        .select(`
          id,
          player_id,
          session_date,
          composite_score,
          brain_score,
          body_score,
          bat_score,
          processing_status,
          leak_detected,
          motor_profile,
          priority_drill,
          eighth_grade_summary,
          coach_notes_edited,
          created_at,
          player:players!reboot_uploads_player_id_fkey(name, level)
        `)
        .is("published_at", null)
        .eq("processing_status", "complete")
        .order("session_date", { ascending: false });

      if (error) throw error;
      return (data || []) as UnpublishedReport[];
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async ({ reportId, coachNotes }: { reportId: string; coachNotes?: string }) => {
      const { error } = await supabase
        .from("reboot_uploads")
        .update({
          published_at: new Date().toISOString(),
          coach_notes_edited: coachNotes || null,
        })
        .eq("id", reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unpublished-reports"] });
      toast.success("Report published to player app!");
      setIsPreviewOpen(false);
      setSelectedReport(null);
    },
    onError: (error) => {
      toast.error(`Failed to publish: ${error.message}`);
    },
  });

  const handleOpenPreview = (report: UnpublishedReport) => {
    setSelectedReport(report);
    setIsPreviewOpen(true);
  };

  const handlePublish = (reportId: string, coachNotes?: string) => {
    publishMutation.mutate({ reportId, coachNotes });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0B" }}>
      <AdminHeader />

      <main className={`container py-6 md:py-8 ${isMobile ? "pb-24" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              <FileCheck className="h-6 w-6" style={{ color: "#DC2626" }} />
              Report Approval Queue
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Review and publish swing reports to player apps
            </p>
          </div>
          <Badge 
            variant="outline" 
            className="border-[#DC2626]/50 text-[#DC2626] text-lg px-3 py-1"
          >
            {reports.length} Pending
          </Badge>
        </div>

        {/* Queue Table */}
        <Card
          className="border-2"
          style={{
            backgroundColor: "#111113",
            borderColor: "rgba(220, 38, 38, 0.3)",
          }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="h-5 w-5" style={{ color: "#DC2626" }} />
              Unpublished Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#DC2626" }} />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>All reports have been published!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-400">Player</TableHead>
                      <TableHead className="text-slate-400">Date</TableHead>
                      <TableHead className="text-slate-400 text-center">4B Score</TableHead>
                      <TableHead className="text-slate-400">Leak</TableHead>
                      <TableHead className="text-slate-400">Motor Profile</TableHead>
                      <TableHead className="text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow
                        key={report.id}
                        className="border-slate-700/50 hover:bg-slate-800/30 cursor-pointer"
                        onClick={() => handleOpenPreview(report)}
                      >
                        <TableCell className="font-medium text-white">
                          {report.player?.name || "Unknown"}
                          {report.player?.level && (
                            <span className="text-xs text-slate-500 ml-2">
                              {report.player.level}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {format(new Date(report.session_date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className="inline-flex items-center justify-center w-12 h-12 rounded-full text-lg font-bold"
                            style={{
                              backgroundColor: "rgba(220, 38, 38, 0.2)",
                              color: "#DC2626",
                              border: "2px solid rgba(220, 38, 38, 0.4)",
                            }}
                          >
                            {report.composite_score?.toFixed(0) || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {report.leak_detected ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/50 text-amber-400 text-xs"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {report.leak_detected}
                            </Badge>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300 capitalize">
                          {report.motor_profile || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#DC2626]/50 text-white hover:bg-[#DC2626]/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPreview(report);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePublish(report.id);
                              }}
                              disabled={publishMutation.isPending}
                            >
                              {publishMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Send className="h-4 w-4 mr-1" />
                                  Publish
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {isMobile && <MobileBottomNav />}

      {/* Preview Modal with iPhone Simulator */}
      <ReportPreviewModal
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        report={selectedReport}
        onPublish={handlePublish}
        isPublishing={publishMutation.isPending}
      />
    </div>
  );
}
