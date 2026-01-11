import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  BookOpen,
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  Users
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProgramBuilderModal } from "./ProgramBuilderModal";

interface Program {
  id: string;
  name: string;
  description: string | null;
  duration_weeks: number | null;
  difficulty: string | null;
  four_b_focus: string[] | null;
  is_template: boolean | null;
  is_active: boolean | null;
  created_at: string;
  schedule_count?: number;
}

export function ProgramsTab() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const { data: programsData, error } = await supabase
        .from('programs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get schedule counts for each program
      const programsWithCounts = await Promise.all(
        (programsData || []).map(async (program) => {
          const { count } = await supabase
            .from('program_schedule')
            .select('*', { count: 'exact', head: true })
            .eq('program_id', program.id);
          return { ...program, schedule_count: count || 0 };
        })
      );

      setPrograms(programsWithCounts);
    } catch (error) {
      console.error('Error fetching programs:', error);
      toast.error('Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this program? This will also remove all scheduled drills.')) return;
    
    try {
      const { error } = await supabase
        .from('programs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Program deleted');
      fetchPrograms();
    } catch (error) {
      console.error('Error deleting program:', error);
      toast.error('Failed to delete program');
    }
  };

  const handleDuplicate = async (program: Program) => {
    try {
      // Create new program
      const { data: newProgram, error: programError } = await supabase
        .from('programs')
        .insert({
          name: `${program.name} (Copy)`,
          description: program.description,
          duration_weeks: program.duration_weeks,
          difficulty: program.difficulty,
          four_b_focus: program.four_b_focus,
          is_template: true,
          is_active: true,
        })
        .select()
        .single();

      if (programError) throw programError;

      // Copy schedule items
      const { data: scheduleItems, error: scheduleError } = await supabase
        .from('program_schedule')
        .select('*')
        .eq('program_id', program.id);

      if (scheduleError) throw scheduleError;

      if (scheduleItems && scheduleItems.length > 0) {
        const newScheduleItems = scheduleItems.map(item => ({
          program_id: newProgram.id,
          drill_id: item.drill_id,
          week_number: item.week_number,
          day_of_week: item.day_of_week,
          order_index: item.order_index,
          sets_override: item.sets_override,
          reps_override: item.reps_override,
          notes: item.notes,
        }));

        await supabase.from('program_schedule').insert(newScheduleItems);
      }

      toast.success('Program duplicated');
      fetchPrograms();
    } catch (error) {
      console.error('Error duplicating program:', error);
      toast.error('Failed to duplicate program');
    }
  };

  const handleEdit = (program: Program) => {
    setEditingProgram(program);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingProgram(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingProgram(null);
    fetchPrograms();
  };

  const filteredPrograms = programs.filter(program =>
    program.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    program.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/20 text-green-400';
      case 'intermediate': return 'bg-yellow-500/20 text-yellow-400';
      case 'advanced': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white"
          />
        </div>
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Create Program
        </Button>
      </div>

      {/* Programs Grid */}
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
      ) : filteredPrograms.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No programs found.</p>
            <Button variant="link" className="text-primary mt-2" onClick={handleCreate}>
              Create your first program →
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrograms.map((program) => (
            <Card 
              key={program.id} 
              className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg">
                      {program.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      {program.is_template && (
                        <Badge variant="outline" className="border-slate-700 text-slate-400">
                          Template
                        </Badge>
                      )}
                      {program.difficulty && (
                        <Badge className={`${getDifficultyColor(program.difficulty)} border-0 capitalize`}>
                          {program.difficulty}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                      <DropdownMenuItem 
                        onClick={() => handleEdit(program)}
                        className="text-slate-300 focus:text-white focus:bg-slate-800"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDuplicate(program)}
                        className="text-slate-300 focus:text-white focus:bg-slate-800"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(program.id)}
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
                {program.description && (
                  <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                    {program.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {program.duration_weeks} weeks
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {program.schedule_count} drills
                  </span>
                </div>
                {program.four_b_focus && program.four_b_focus.length > 0 && (
                  <div className="flex gap-1 mt-3">
                    {program.four_b_focus.map((focus) => (
                      <Badge key={focus} variant="outline" className="border-slate-700 text-slate-400 text-xs capitalize">
                        {focus}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Program Builder Modal */}
      <ProgramBuilderModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        program={editingProgram}
      />
    </div>
  );
}
