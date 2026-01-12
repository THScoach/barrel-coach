import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  Copy,
  Trash2,
  RefreshCw,
  MailOpen,
  Phone,
  ExternalLink,
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { MobileBottomNav } from "@/components/admin/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow, format } from "date-fns";

type InviteType = "diagnostic" | "assessment" | "membership" | "beta";
type InviteStatus = "pending" | "accepted" | "expired" | "cancelled";

interface Invite {
  id: string;
  email: string | null;
  phone: string | null;
  player_name: string | null;
  invite_type: InviteType;
  status: InviteStatus;
  invite_token: string;
  player_id: string | null;
  expires_at: string | null;
  last_sent_at: string | null;
  opened_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

const INVITE_TYPE_LABELS: Record<InviteType, string> = {
  diagnostic: "Free Diagnostic",
  assessment: "$37 Assessment",
  membership: "Membership",
  beta: "Beta Access",
};

const STATUS_CONFIG: Record<InviteStatus, { label: string; variant: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", variant: "bg-amber-500/20 text-amber-300 border-amber-500/40", icon: <Clock className="h-3 w-3" /> },
  accepted: { label: "Accepted", variant: "bg-green-500/20 text-green-300 border-green-500/40", icon: <CheckCircle className="h-3 w-3" /> },
  expired: { label: "Expired", variant: "bg-slate-500/20 text-slate-400 border-slate-500/40", icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", variant: "bg-red-500/20 text-red-400 border-red-500/40", icon: <XCircle className="h-3 w-3" /> },
};

export default function AdminInvites() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewInvite, setShowNewInvite] = useState(false);
  const [newInvite, setNewInvite] = useState({
    email: "",
    phone: "",
    player_name: "",
    invite_type: "beta" as InviteType,
  });

  // Fetch invites
  const { data: invites, isLoading, error, refetch } = useQuery({
    queryKey: ["invites", searchQuery, typeFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("invites")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,player_name.ilike.%${searchQuery}%`);
      }

      if (typeFilter && typeFilter !== "all") {
        query = query.eq("invite_type", typeFilter as InviteType);
      }

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter as InviteStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Invite[];
    },
  });

  // Create invite mutation
  const createInviteMutation = useMutation({
    mutationFn: async (invite: typeof newInvite) => {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: invite,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.ghl_sent) {
        toast.success("Invite created and sent to GoHighLevel!");
      } else {
        toast.success("Invite created! Contact will be handled in GoHighLevel.", {
          description: data?.ghl_error || "Check GoHighLevel for communication",
        });
      }
      setShowNewInvite(false);
      setNewInvite({ email: "", phone: "", player_name: "", invite_type: "beta" });
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error) => {
      toast.error(`Failed to send invite: ${error.message}`);
    },
  });

  // Resend invite mutation
  const resendMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: { resend_invite_id: inviteId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.ghl_sent) {
        toast.success("Invite resent to GoHighLevel!");
      } else {
        toast.success("Invite updated! Check GoHighLevel for communication.");
      }
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error) => {
      toast.error(`Failed to resend: ${error.message}`);
    },
  });

  // Cancel invite mutation
  const cancelMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("invites")
        .update({ status: "cancelled" as InviteStatus })
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invite cancelled");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error) => {
      toast.error(`Failed to cancel: ${error.message}`);
    },
  });

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied!");
  };

  const stats = {
    total: invites?.length || 0,
    pending: invites?.filter((i) => i.status === "pending").length || 0,
    accepted: invites?.filter((i) => i.status === "accepted").length || 0,
    expired: invites?.filter((i) => i.status === "expired").length || 0,
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />

      <main className={`container py-6 md:py-8 ${isMobile ? "pb-24" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-50 flex items-center gap-2.5 tracking-tight">
              <Mail className="h-5 w-5 md:h-6 md:w-6 text-slate-300" />
              Invites
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-0.5">
              Invites are sent via GoHighLevel
            </p>
          </div>
          <Button
            onClick={() => setShowNewInvite(true)}
            className="btn-primary gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Invite</span>
            <span className="sm:hidden">Invite</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-xs text-slate-400">Total Invites</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-400">{stats.pending}</div>
              <div className="text-xs text-slate-400">Pending</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-400">{stats.accepted}</div>
              <div className="text-xs text-slate-400">Accepted</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-slate-500">{stats.expired}</div>
              <div className="text-xs text-slate-400">Expired</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-slate-500"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 bg-slate-900 border-slate-700 text-slate-200">
              <SelectValue placeholder="Invite Type" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="diagnostic">Diagnostic</SelectItem>
              <SelectItem value="assessment">Assessment</SelectItem>
              <SelectItem value="membership">Membership</SelectItem>
              <SelectItem value="beta">Beta</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 bg-slate-900 border-slate-700 text-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {error ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-red-500/10 mb-4">
                <Mail className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="font-semibold text-white mb-1">Failed to load invites</h3>
              <p className="text-sm text-slate-400 mb-4">Something went wrong. Please try again.</p>
              <Button onClick={() => refetch()} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : invites && invites.length > 0 ? (
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800">
                  <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wide">Recipient</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wide">Type</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wide hidden md:table-cell">Sent</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wide text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite, index) => (
                  <TableRow
                    key={invite.id}
                    className={`border-slate-800 hover:bg-slate-800 transition-colors ${
                      index % 2 === 0 ? "bg-slate-900" : "bg-slate-900/60"
                    }`}
                  >
                    <TableCell className="py-3.5">
                      <div>
                        <p className="font-semibold text-white text-[15px]">
                          {invite.player_name || "—"}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
                          {invite.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {invite.email}
                            </span>
                          )}
                          {invite.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {invite.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-700 text-white font-medium border border-slate-600">
                        {INVITE_TYPE_LABELS[invite.invite_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_CONFIG[invite.status].variant} font-medium gap-1`}>
                        {STATUS_CONFIG[invite.status].icon}
                        {STATUS_CONFIG[invite.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">
                        <p className="text-white">{format(new Date(invite.created_at), "MMM d, yyyy")}</p>
                        <p className="text-slate-400 text-xs">
                          {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                        </p>
                        {invite.opened_at && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <MailOpen className="h-3 w-3" />
                            Opened {formatDistanceToNow(new Date(invite.opened_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {invite.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                              onClick={() => resendMutation.mutate(invite.id)}
                              disabled={resendMutation.isPending}
                            >
                              <RefreshCw className={`h-4 w-4 ${resendMutation.isPending ? "animate-spin" : ""}`} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                              onClick={() => copyInviteLink(invite.invite_token)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-slate-700"
                              onClick={() => {
                                if (confirm("Cancel this invite?")) {
                                  cancelMutation.mutate(invite.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {invite.status !== "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                            onClick={() => copyInviteLink(invite.invite_token)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-slate-800 mb-4">
                <Mail className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="font-semibold text-white mb-1">No invites yet</h3>
              <p className="text-sm text-slate-400 mb-4">
                Send your first invite to get started
              </p>
              <Button onClick={() => setShowNewInvite(true)} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Send Invite
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* New Invite Dialog */}
      <Dialog open={showNewInvite} onOpenChange={setShowNewInvite}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Invite</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-400">
              <div className="flex items-center gap-2 mb-1">
                <ExternalLink className="h-4 w-4" />
                <span className="font-medium text-slate-300">GoHighLevel Integration</span>
              </div>
              <p>Contact will be created and communication handled through GoHighLevel workflows.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Player Name</Label>
              <Input
                id="name"
                placeholder="John Smith"
                value={newInvite.player_name}
                onChange={(e) => setNewInvite({ ...newInvite, player_name: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="player@example.com"
                value={newInvite.email}
                onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={newInvite.phone}
                onChange={(e) => setNewInvite({ ...newInvite, phone: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white"
              />
              <p className="text-xs text-slate-500">At least email or phone is required</p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Invite Type</Label>
              <Select
                value={newInvite.invite_type}
                onValueChange={(v) => setNewInvite({ ...newInvite, invite_type: v as InviteType })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="beta">Beta Access</SelectItem>
                  <SelectItem value="diagnostic">Free Diagnostic</SelectItem>
                  <SelectItem value="assessment">$37 Assessment</SelectItem>
                  <SelectItem value="membership">Membership</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewInvite(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createInviteMutation.mutate(newInvite)}
              disabled={
                createInviteMutation.isPending ||
                (!newInvite.email && !newInvite.phone)
              }
              className="btn-primary gap-2"
            >
              {createInviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Create Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}
