import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { 
  BookOpen, Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, 
  FolderOpen, ArrowLeft 
} from "lucide-react";
import { Link } from "react-router-dom";

interface KnowledgeEntry {
  id: string;
  category: string;
  subcategory: string | null;
  title: string;
  content: string;
  tags: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: "motor_profile", label: "Motor Profile" },
  { value: "4b_system", label: "4B System" },
  { value: "drill", label: "Drill" },
  { value: "cue", label: "Cue" },
  { value: "faq", label: "FAQ" },
  { value: "coaching_philosophy", label: "Coaching Philosophy" },
];

const SUBCATEGORIES: Record<string, { value: string; label: string }[]> = {
  motor_profile: [
    { value: "spinner", label: "Spinner" },
    { value: "whipper", label: "Whipper" },
    { value: "slingshotter", label: "Slingshotter" },
  ],
  "4b_system": [
    { value: "body", label: "Body" },
    { value: "brain", label: "Brain" },
    { value: "bat", label: "Bat" },
    { value: "ball", label: "Ball" },
  ],
};

export default function KnowledgeBaseEditor() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.value)));
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    category: "",
    subcategory: "",
    title: "",
    content: "",
    tags: "",
    priority: 5,
    is_active: true,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["coach-rick-knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clawdbot_knowledge")
        .select("*")
        .order("category")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data as KnowledgeEntry[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        category: data.category,
        subcategory: data.subcategory || null,
        title: data.title,
        content: data.content,
        tags: data.tags.split(",").map(t => t.trim()).filter(Boolean),
        priority: data.priority,
        is_active: data.is_active,
      };

      if (editingEntry) {
        const { error } = await supabase
          .from("clawdbot_knowledge")
          .update(payload)
          .eq("id", editingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clawdbot_knowledge")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-rick-knowledge"] });
      setIsDialogOpen(false);
      setEditingEntry(null);
      resetForm();
      toast.success(editingEntry ? "Entry updated" : "Entry created");
    },
    onError: (err) => {
      toast.error("Failed to save: " + (err as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clawdbot_knowledge").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-rick-knowledge"] });
      setDeleteConfirmId(null);
      toast.success("Entry deleted");
    },
    onError: (err) => {
      toast.error("Failed to delete: " + (err as Error).message);
    },
  });

  const resetForm = () => {
    setFormData({
      category: "",
      subcategory: "",
      title: "",
      content: "",
      tags: "",
      priority: 5,
      is_active: true,
    });
  };

  const openEditDialog = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setFormData({
      category: entry.category,
      subcategory: entry.subcategory || "",
      title: entry.title,
      content: entry.content,
      tags: entry.tags?.join(", ") || "",
      priority: entry.priority,
      is_active: entry.is_active,
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingEntry(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.category || !formData.title || !formData.content) {
      toast.error("Please fill in required fields");
      return;
    }
    saveMutation.mutate(formData);
  };

  const toggleCategory = (cat: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(cat)) {
      newSet.delete(cat);
    } else {
      newSet.add(cat);
    }
    setExpandedCategories(newSet);
  };

  // Group entries by category
  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = [];
    acc[entry.category].push(entry);
    return acc;
  }, {} as Record<string, KnowledgeEntry[]>);

  // Filter
  const filteredCategories = Object.entries(groupedEntries).filter(([cat, items]) => {
    if (categoryFilter !== "all" && cat !== categoryFilter) return false;
    if (search) {
      return items.some(
        item =>
          item.title.toLowerCase().includes(search.toLowerCase()) ||
          item.content.toLowerCase().includes(search.toLowerCase())
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
              <BookOpen className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Knowledge Base Editor</h1>
              <p className="text-slate-400 text-sm">{entries.length} entries</p>
            </div>
          </div>
          <Button onClick={openNewDialog} className="bg-accent hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
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
              {CATEGORIES.map(cat => (
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

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : (
          <div className="space-y-4">
            {filteredCategories.map(([category, items]) => {
              const catLabel = CATEGORIES.find(c => c.value === category)?.label || category;
              const isExpanded = expandedCategories.has(category);
              const filteredItems = search
                ? items.filter(
                    i =>
                      i.title.toLowerCase().includes(search.toLowerCase()) ||
                      i.content.toLowerCase().includes(search.toLowerCase())
                  )
                : items;

              return (
                <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                  <Card style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-slate-800/50 transition-colors">
                        <CardTitle className="flex items-center justify-between text-white">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-5 w-5 text-accent" />
                            {catLabel}
                            <Badge variant="secondary" className="ml-2">{filteredItems.length}</Badge>
                          </div>
                          {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-2">
                        {filteredItems.map(item => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white truncate">{item.title}</span>
                                {item.subcategory && (
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {item.subcategory}
                                  </Badge>
                                )}
                                {!item.is_active && (
                                  <Badge variant="secondary" className="text-xs bg-slate-700">Inactive</Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-400 truncate">{item.content.slice(0, 100)}...</p>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-white"
                                onClick={() => openEditDialog(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500"
                                onClick={() => setDeleteConfirmId(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}

            {filteredCategories.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                No entries found. Add some knowledge!
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Entry" : "Add New Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v, subcategory: "" })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {SUBCATEGORIES[formData.category] && (
                <div className="space-y-2">
                  <Label>Subcategory</Label>
                  <Select value={formData.subcategory} onValueChange={(v) => setFormData({ ...formData, subcategory: v })}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue placeholder="Select subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBCATEGORIES[formData.category].map(sub => (
                        <SelectItem key={sub.value} value={sub.value}>{sub.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Entry title"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Knowledge content (supports markdown)"
                rows={6}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="tag1, tag2, tag3"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority (1-10)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
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
            <DialogTitle>Delete Entry?</DialogTitle>
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
