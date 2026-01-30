import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageSquare, Plus, Search, Pencil, Trash2, ArrowLeft, User, Bot } from "lucide-react";
import { Link } from "react-router-dom";

interface Scenario {
  id: string;
  player_input: string;
  ideal_response: string;
  context: Record<string, unknown> | null;
  tags: string[];
  category: string | null;
  is_active: boolean;
  use_count: number;
  created_at: string;
}

const CATEGORIES = [
  { value: "greeting", label: "Greeting" },
  { value: "technical", label: "Technical" },
  { value: "motivational", label: "Motivational" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "drill_recommendation", label: "Drill Recommendation" },
  { value: "general", label: "General" },
];

export default function ScenarioTrainer() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    player_input: "",
    ideal_response: "",
    context: "",
    tags: "",
    category: "",
    is_active: true,
  });

  const { data: scenarios = [], isLoading } = useQuery({
    queryKey: ["coach-rick-scenarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clawdbot_scenarios")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Scenario[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        player_input: data.player_input,
        ideal_response: data.ideal_response,
        context: data.context ? JSON.parse(data.context) : null,
        tags: data.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
        category: data.category || null,
        is_active: data.is_active,
      };

      if (editingScenario) {
        const { error } = await supabase
          .from("clawdbot_scenarios")
          .update(payload)
          .eq("id", editingScenario.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clawdbot_scenarios").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-rick-scenarios"] });
      setIsDialogOpen(false);
      setEditingScenario(null);
      resetForm();
      toast.success(editingScenario ? "Scenario updated" : "Scenario created");
    },
    onError: (err) => {
      toast.error("Failed to save: " + (err as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clawdbot_scenarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-rick-scenarios"] });
      setDeleteConfirmId(null);
      toast.success("Scenario deleted");
    },
    onError: (err) => {
      toast.error("Failed to delete: " + (err as Error).message);
    },
  });

  const resetForm = () => {
    setFormData({
      player_input: "",
      ideal_response: "",
      context: "",
      tags: "",
      category: "",
      is_active: true,
    });
  };

  const openEditDialog = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setFormData({
      player_input: scenario.player_input,
      ideal_response: scenario.ideal_response,
      context: scenario.context ? JSON.stringify(scenario.context, null, 2) : "",
      tags: scenario.tags?.join(", ") || "",
      category: scenario.category || "",
      is_active: scenario.is_active,
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingScenario(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.player_input || !formData.ideal_response) {
      toast.error("Player input and ideal response are required");
      return;
    }
    if (formData.context) {
      try {
        JSON.parse(formData.context);
      } catch {
        toast.error("Context must be valid JSON");
        return;
      }
    }
    saveMutation.mutate(formData);
  };

  const filteredScenarios = scenarios.filter((s) => {
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
    if (search) {
      return (
        s.player_input.toLowerCase().includes(search.toLowerCase()) ||
        s.ideal_response.toLowerCase().includes(search.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0B" }}>
      <AdminHeader />

      <main className="container py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/admin/coach-rick-ai">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="p-3 rounded-xl bg-accent/20">
              <MessageSquare className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Scenario Trainer</h1>
              <p className="text-slate-400 text-sm">{scenarios.length} Q&A pairs</p>
            </div>
          </div>
          <Button onClick={openNewDialog} className="bg-accent hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Scenario
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>

        {/* Scenarios List */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : (
          <div className="space-y-4">
            {filteredScenarios.map((scenario) => (
              <Card
                key={scenario.id}
                style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}
                className="group"
              >
                <CardContent className="p-4 space-y-3">
                  {/* Player message */}
                  <div className="flex gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-300 font-medium">Player:</p>
                      <p className="text-white">{scenario.player_input}</p>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-700" />
                  
                  {/* Coach Rick AI response */}
                  <div className="flex gap-3">
                    <div className="p-2 rounded-lg bg-accent/10 shrink-0">
                      <Bot className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-300 font-medium">Coach Rick:</p>
                      <p className="text-white whitespace-pre-wrap">{scenario.ideal_response}</p>
                    </div>
                  </div>

                  {/* Tags and actions */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex flex-wrap gap-2">
                      {scenario.category && (
                        <Badge variant="secondary" className="capitalize">{scenario.category}</Badge>
                      )}
                      {scenario.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                      {!scenario.is_active && (
                        <Badge variant="secondary" className="bg-slate-700">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-white"
                        onClick={() => openEditDialog(scenario)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                        onClick={() => setDeleteConfirmId(scenario.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredScenarios.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                No scenarios found. Add some training data!
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingScenario ? "Edit Scenario" : "Add New Scenario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Player Says *</Label>
              <Textarea
                value={formData.player_input}
                onChange={(e) => setFormData({ ...formData, player_input: e.target.value })}
                placeholder="What the player might say..."
                rows={2}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>Coach Rick Should Say *</Label>
              <Textarea
                value={formData.ideal_response}
                onChange={(e) => setFormData({ ...formData, ideal_response: e.target.value })}
                placeholder="The ideal response..."
                rows={4}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="tag1, tag2, tag3"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Context (optional JSON)</Label>
              <Textarea
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                placeholder='{"motor_profile": "spinner", "body_score": 60}'
                rows={3}
                className="bg-slate-800 border-slate-700 font-mono text-sm"
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
            <DialogTitle>Delete Scenario?</DialogTitle>
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
