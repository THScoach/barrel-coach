import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Brain, 
  Dumbbell, 
  Target, 
  CircleDot,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  Video
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DrillFormModal } from "./DrillFormModal";

interface Drill {
  id: string;
  name: string;
  description: string | null;
  four_b_category: string | null;
  equipment: string[] | null;
  duration_minutes: number | null;
  sets: number | null;
  reps: number | null;
  video_url: string | null;
  instructions: string | null;
  cues: string[] | null;
  difficulty: string | null;
  is_active: boolean | null;
  created_at: string;
}

const categoryInfo: Record<string, { color: string; bgColor: string; icon: JSX.Element; label: string }> = {
  brain: { color: 'text-purple-400', bgColor: 'bg-purple-500/20', icon: <Brain className="w-4 h-4" />, label: 'Brain' },
  body: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: <Dumbbell className="w-4 h-4" />, label: 'Body' },
  bat: { color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: <Target className="w-4 h-4" />, label: 'Bat' },
  ball: { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: <CircleDot className="w-4 h-4" />, label: 'Ball' }
};

export function DrillsTab() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);

  useEffect(() => {
    fetchDrills();
  }, [categoryFilter]);

  const fetchDrills = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('drills')
        .select('*')
        .order('created_at', { ascending: false });

      if (categoryFilter) {
        query = query.eq('four_b_category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDrills(data || []);
    } catch (error) {
      console.error('Error fetching drills:', error);
      toast.error('Failed to load drills');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this drill?')) return;
    
    try {
      const { error } = await supabase
        .from('drills')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Drill deleted');
      fetchDrills();
    } catch (error) {
      console.error('Error deleting drill:', error);
      toast.error('Failed to delete drill');
    }
  };

  const handleEdit = (drill: Drill) => {
    setEditingDrill(drill);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingDrill(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingDrill(null);
    fetchDrills();
  };

  const filteredDrills = drills.filter(drill =>
    drill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    drill.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search drills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white"
          />
        </div>
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Drill
        </Button>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={categoryFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter(null)}
          className={categoryFilter === null ? "" : "border-slate-700 text-slate-300 hover:bg-slate-800"}
        >
          All
        </Button>
        {Object.entries(categoryInfo).map(([key, info]) => (
          <Button
            key={key}
            variant={categoryFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(key)}
            className={categoryFilter === key ? "" : "border-slate-700 text-slate-300 hover:bg-slate-800"}
          >
            {info.icon}
            <span className="ml-2">{info.label}</span>
          </Button>
        ))}
      </div>

      {/* Drills Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800 animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-slate-800 rounded w-3/4 mb-4" />
                <div className="h-4 bg-slate-800 rounded w-1/2 mb-2" />
                <div className="h-4 bg-slate-800 rounded w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDrills.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <Dumbbell className="h-12 w-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No drills found.</p>
            <Button variant="link" className="text-primary mt-2" onClick={handleCreate}>
              Create your first drill →
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrills.map((drill) => {
            const catInfo = drill.four_b_category ? categoryInfo[drill.four_b_category] : null;
            
            return (
              <Card 
                key={drill.id} 
                className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg flex items-center gap-2">
                        {drill.name}
                        {drill.video_url && (
                          <Video className="h-4 w-4 text-slate-500" />
                        )}
                      </CardTitle>
                      {catInfo && (
                        <Badge className={`${catInfo.bgColor} ${catInfo.color} border-0 mt-2`}>
                          {catInfo.icon}
                          <span className="ml-1">{catInfo.label}</span>
                        </Badge>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                        <DropdownMenuItem 
                          onClick={() => handleEdit(drill)}
                          className="text-slate-300 focus:text-white focus:bg-slate-800"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(drill.id)}
                          className="text-red-400 focus:text-red-300 focus:bg-slate-800"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {drill.description && (
                    <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                      {drill.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    {drill.sets && drill.reps && (
                      <span>{drill.sets} × {drill.reps}</span>
                    )}
                    {drill.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {drill.duration_minutes} min
                      </span>
                    )}
                    {drill.difficulty && (
                      <Badge variant="outline" className="border-slate-700 text-slate-400 capitalize">
                        {drill.difficulty}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Drill Form Modal */}
      <DrillFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        drill={editingDrill}
      />
    </div>
  );
}
