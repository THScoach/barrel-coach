import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Target, Plus, Pencil, Trash2, ArrowLeft, Sparkles, Wrench, Hand, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

interface Cue {
  id: string;
  cue_type: string;
  cue_text: string;
  context_hint: string | null;
  is_active: boolean;
  use_count: number;
  created_at: string;
}

const CUE_TYPES = [
  { value: "encouragement", label: "Encouragement", icon: Sparkles, color: "bg-green-500/20 text-green-500" },
  { value: "correction", label: "Correction", icon: Wrench, color: "bg-yellow-500/20 text-yellow-500" },
  { value: "greeting", label: "Greeting", icon: Hand, color: "bg-blue-500/20 text-blue-500" },
  { value: "closing", label: "Closing", icon: Hand, color: "bg-purple-500/20 text-purple-500" },
  { value: "profile_spinner", label: "Profile: Spinner", icon: RotateCcw, color: "bg-accent/20 text-accent" },
  { value: "profile_whipper", label: "Profile: Whipper", icon: RotateCcw, color: "bg-accent/20 text-accent" },
  { value: "profile_slingshotter", label: "Profile: Slingshotter", icon: RotateCcw, color: "bg-accent/20 text-accent" },
];

export default function CueBankManager() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCue, setEditingCue] = useState<Cue | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cue_type: "",
    cue_text: "",
    context_hint: "",
    is_active: true,
  });

  const { data: cues = [], isLoading } = useQuery({
    queryKey: ["clawdbot-cues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clawdbot_cues")
        .select("*")
        .order("cue_type")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Cue[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        cue_type: data.cue_type,
        cue_text: data.cue_text,
        context_hint: data.context_hint || null,
        is_active: data.is_active,
      };

      if (editingCue) {
        const { error } = await supabase.from("clawdbot_cues").update(payload).eq("id", editingCue.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clawdbot_cues").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clawdbot-cues"] });
      setIsDialogOpen(false);
      setEditingCue(null);
      resetForm();
      toast.success(editingCue ? "Cue updated" : "Cue created");
    },
    onError: (err) => {
      toast.error("Failed to save: " + (err as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clawdbot_cues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clawdbot-cues"] });
      setDeleteConfirmId(null);
      toast.success("Cue deleted");
    },
    onError: (err) => {
      toast.error("Failed to delete: " + (err as Error).message);
    },
  });

  const resetForm = () => {
    setFormData({
      cue_type: "",
      cue_text: "",
      context_hint: "",
      is_active: true,
    });
  };

  const openEditDialog = (cue: Cue) => {
    setEditingCue(cue);
    setFormData({
      cue_type: cue.cue_type,
      cue_text: cue.cue_text,
      context_hint: cue.context_hint || "",
      is_active: cue.is_active,
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingCue(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.cue_type || !formData.cue_text) {
      toast.error("Cue type and text are required");
      return;
    }
    saveMutation.mutate(formData);
  };

  // Group cues by type
  const groupedCues = cues.reduce((acc, cue) => {
    if (!acc[cue.cue_type]) acc[cue.cue_type] = [];
    acc[cue.cue_type].push(cue);
    return acc;
  }, {} as Record<string, Cue[]>);

  const filteredGroups =
    typeFilter === "all"
      ? Object.entries(groupedCues)
      : Object.entries(groupedCues).filter(([type]) => type === typeFilter);

  const getCueTypeInfo = (type: string) => CUE_TYPES.find((t) => t.value === type);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0B" }}>
      <AdminHeader />

      <main className="container py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/admin/clawdbot">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="p-3 rounded-xl bg-accent/20">
              <Target className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Cue Bank</h1>
              <p className="text-slate-400 text-sm">{cues.length} coaching cues</p>
            </div>
          </div>
          <Button onClick={openNewDialog} className="bg-accent hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Cue
          </Button>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {CUE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cues by Type */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : (
          <div className="space-y-6">
            {filteredGroups.map(([type, typeCues]) => {
              const typeInfo = getCueTypeInfo(type);
              const Icon = typeInfo?.icon || Target;

              return (
                <Card key={type} style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-white text-lg">
                      <div className={`p-2 rounded-lg ${typeInfo?.color || "bg-slate-700"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {typeInfo?.label || type}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {typeCues.map((cue) => (
                      <div
                        key={cue.id}
                        className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg group"
                      >
                        <div className="flex-1">
                          <p className="text-white font-medium">"{cue.cue_text}"</p>
                          {cue.context_hint && (
                            <p className="text-xs text-slate-400 mt-1">When: {cue.context_hint}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!cue.is_active && (
                            <Badge variant="secondary" className="bg-slate-700">Inactive</Badge>
                          )}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-white"
                              onClick={() => openEditDialog(cue)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500"
                              onClick={() => setDeleteConfirmId(cue.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}

            {filteredGroups.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                No cues found. Add some coaching phrases!
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingCue ? "Edit Cue" : "Add New Cue"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cue Type *</Label>
              <Select value={formData.cue_type} onValueChange={(v) => setFormData({ ...formData, cue_type: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CUE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cue Text *</Label>
              <Input
                value={formData.cue_text}
                onChange={(e) => setFormData({ ...formData, cue_text: e.target.value })}
                placeholder="The coaching phrase..."
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>When to Use (context hint)</Label>
              <Input
                value={formData.context_hint}
                onChange={(e) => setFormData({ ...formData, context_hint: e.target.value })}
                placeholder="e.g., After good execution"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-accent hover:bg-accent/90">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete Cue?</DialogTitle>
          </DialogHeader>
          <p className="text-slate-400">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
