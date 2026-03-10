import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Hash, MapPin, FileText, Video, ExternalLink, Activity, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface RebootSession {
  id: string;
  session_date: string | null;
  movement_type: string | null;
  status: string | null;
  session_number: number | null;
  reboot_session_id: string | null;
  reboot_player_id: string | null;
  location: string | null;
  notes: string | null;
  video_url: string | null;
  ik_file_path: string | null;
  me_file_path: string | null;
  error_message: string | null;
  completed_at: string | null;
  exported_at: string | null;
  processed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_polled_at: string | null;
}

interface RebootSessionDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: RebootSession | null;
}

function MetricRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between py-2 border-b border-slate-700/50">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-white font-medium text-sm">{value}</span>
    </div>
  );
}

const statusColor = (s: string | null) => {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s === "processing" || s === "exported") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
};

export function RebootSessionDetailDrawer({ open, onOpenChange, session }: RebootSessionDetailDrawerProps) {
  const [rawOpen, setRawOpen] = useState(false);

  if (!session) return null;

  const rebootUrl = session.reboot_session_id
    ? `https://app.rebootmotion.com/sessions/${session.reboot_session_id}`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-slate-900 border-slate-700 w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            Reboot Session
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Header info */}
          <div className="flex flex-wrap items-center gap-2">
            {session.session_date && (
              <Badge variant="outline" className="border-slate-700 text-slate-300 gap-1.5">
                <Calendar className="h-3 w-3" />
                {format(new Date(session.session_date), "MMM d, yyyy")}
              </Badge>
            )}
            <Badge variant="outline" className={statusColor(session.status)}>
              {session.status || "unknown"}
            </Badge>
            {session.movement_type && (
              <Badge variant="outline" className="border-slate-700 text-slate-400">
                {session.movement_type}
              </Badge>
            )}
          </div>

          <Separator className="bg-slate-700" />

          {/* Key details */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Session Details</h3>
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-0">
              <MetricRow label="Session Number" value={session.session_number} />
              <MetricRow label="Movement Type" value={session.movement_type} />
              <MetricRow label="Location" value={session.location} />
              <MetricRow
                label="Completed At"
                value={session.completed_at ? format(new Date(session.completed_at), "MMM d, yyyy h:mm a") : null}
              />
              <MetricRow
                label="Exported At"
                value={session.exported_at ? format(new Date(session.exported_at), "MMM d, yyyy h:mm a") : null}
              />
              <MetricRow
                label="Processed At"
                value={session.processed_at ? format(new Date(session.processed_at), "MMM d, yyyy h:mm a") : null}
              />
            </div>
          </div>

          {/* Files */}
          {(session.ik_file_path || session.me_file_path || session.video_url) && (
            <>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Files</h3>
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-0">
                  <MetricRow label="IK File" value={session.ik_file_path} />
                  <MetricRow label="ME File" value={session.me_file_path} />
                  {session.video_url && (
                    <div className="flex justify-between py-2 border-b border-slate-700/50 items-center">
                      <span className="text-slate-400 text-sm flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5" /> Video
                      </span>
                      <a
                        href={session.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {session.notes && (
            <>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Notes</h3>
                <p className="text-slate-300 text-sm bg-slate-800/50 rounded-lg p-4">{session.notes}</p>
              </div>
            </>
          )}

          {/* Error */}
          {session.error_message && (
            <>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">Error</h3>
                <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  {session.error_message}
                </p>
              </div>
            </>
          )}

          {/* View in Reboot */}
          {rebootUrl && (
            <>
              <Separator className="bg-slate-700" />
              <Button
                asChild
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600"
              >
                <a href={rebootUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in Reboot Motion
                </a>
              </Button>
            </>
          )}

          {/* Raw Data */}
          <Separator className="bg-slate-700" />
          <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold text-slate-400 uppercase tracking-wider py-1 hover:text-slate-300 transition-colors">
              Raw Data
              <ChevronDown className={`h-4 w-4 transition-transform ${rawOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-4 mt-2 overflow-auto max-h-80 whitespace-pre-wrap break-all">
                {JSON.stringify(session, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>

          {/* Metadata */}
          <div className="text-xs text-slate-500 space-y-1 pt-2">
            <div>ID: {session.id}</div>
            {session.reboot_session_id && <div>Reboot Session: {session.reboot_session_id}</div>}
            {session.reboot_player_id && <div>Reboot Player: {session.reboot_player_id}</div>}
            {session.created_at && <div>Created: {format(new Date(session.created_at), "MMM d, yyyy h:mm a")}</div>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
