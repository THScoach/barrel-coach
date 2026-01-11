import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  X, 
  GripVertical,
  Brain,
  Dumbbell,
  Target,
  CircleDot,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Program {
  id: string;
  name: string;
  description: string | null;
  duration_weeks: number | null;
  difficulty: string | null;
  four_b_focus: string[] | null;
}

interface Drill {
  id: string;
  name: string;
  four_b_category: string | null;
  sets: number | null;
  reps: number | null;
}

interface ScheduleItem {
  id?: string;
  drill_id: string;
  drill?: Drill;
  week_number: number;
  day_of_week: number;
  order_index: number;
  sets_override: number | null;
  reps_override: number | null;
}

interface ProgramBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  program: Program | null;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const categoryInfo: Record<string, { color: string; icon: JSX.Element }> = {
  brain: { color: 'text-purple-400', icon: <Brain className="w-3 h-3" /> },
  body: { color: 'text-blue-400', icon: <Dumbbell className="w-3 h-3" /> },
  bat: { color: 'text-orange-400', icon: <Target className="w-3 h-3" /> },
  ball: { color: 'text-red-400', icon: <CircleDot className="w-3 h-3" /> }
};

export function ProgramBuilderModal({ isOpen, onClose, program }: ProgramBuilderModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [currentWeek, setCurrentWeek] = useState(1);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_weeks: 4,
    difficulty: 'beginner',
    four_b_focus: [] as string[],
  });

  useEffect(() => {
    if (isOpen) {
      fetchDrills();
      if (program) {
        setFormData({
          name: program.name || '',
          description: program.description || '',
          duration_weeks: program.duration_weeks || 4,
          difficulty: program.difficulty || 'beginner',
          four_b_focus: program.four_b_focus || [],
        });
        fetchSchedule(program.id);
      } else {
        setFormData({
          name: '',
          description: '',
          duration_weeks: 4,
          difficulty: 'beginner',
          four_b_focus: [],
        });
        setSchedule([]);
      }
      setCurrentWeek(1);
      setActiveTab("details");
    }
  }, [program, isOpen]);

  const fetchDrills = async () => {
    const { data, error } = await supabase
      .from('drills')
      .select('id, name, four_b_category, sets, reps')
      .eq('is_active', true)
      .order('name');
    
    if (!error && data) {
      setDrills(data);
    }
  };

  const fetchSchedule = async (programId: string) => {
    const { data, error } = await supabase
      .from('program_schedule')
      .select(`
        id,
        drill_id,
        week_number,
        day_of_week,
        order_index,
        sets_override,
        reps_override,
        drills (id, name, four_b_category, sets, reps)
      `)
      .eq('program_id', programId)
      .order('order_index');
    
    if (!error && data) {
      setSchedule(data.map(item => ({
        ...item,
        drill: item.drills as unknown as Drill
      })));
    }
  };

  const toggleFocus = (category: string) => {
    setFormData(prev => ({
      ...prev,
      four_b_focus: prev.four_b_focus.includes(category)
        ? prev.four_b_focus.filter(c => c !== category)
        : [...prev.four_b_focus, category]
    }));
  };

  const addDrillToDay = (drill: Drill, dayOfWeek: number) => {
    const existingItems = schedule.filter(
      s => s.week_number === currentWeek && s.day_of_week === dayOfWeek
    );
    
    const newItem: ScheduleItem = {
      drill_id: drill.id,
      drill,
      week_number: currentWeek,
      day_of_week: dayOfWeek,
      order_index: existingItems.length,
      sets_override: null,
      reps_override: null,
    };
    
    setSchedule([...schedule, newItem]);
  };

  const removeFromSchedule = (item: ScheduleItem) => {
    setSchedule(schedule.filter(s => 
      !(s.drill_id === item.drill_id && 
        s.week_number === item.week_number && 
        s.day_of_week === item.day_of_week)
    ));
  };

  const getScheduleForDay = (weekNumber: number, dayOfWeek: number) => {
    return schedule
      .filter(s => s.week_number === weekNumber && s.day_of_week === dayOfWeek)
      .sort((a, b) => a.order_index - b.order_index);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Program name is required');
      return;
    }

    setLoading(true);
    try {
      let programId = program?.id;

      const programData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        duration_weeks: formData.duration_weeks,
        difficulty: formData.difficulty,
        four_b_focus: formData.four_b_focus.length > 0 ? formData.four_b_focus : null,
        is_template: true,
        is_active: true,
      };

      if (program) {
        const { error } = await supabase
          .from('programs')
          .update(programData)
          .eq('id', program.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('programs')
          .insert(programData)
          .select()
          .single();
        if (error) throw error;
        programId = data.id;
      }

      // Clear existing schedule and insert new
      if (programId) {
        await supabase
          .from('program_schedule')
          .delete()
          .eq('program_id', programId);

        if (schedule.length > 0) {
          const scheduleData = schedule.map(item => ({
            program_id: programId,
            drill_id: item.drill_id,
            week_number: item.week_number,
            day_of_week: item.day_of_week,
            order_index: item.order_index,
            sets_override: item.sets_override,
            reps_override: item.reps_override,
          }));

          const { error } = await supabase
            .from('program_schedule')
            .insert(scheduleData);
          if (error) throw error;
        }
      }

      toast.success(program ? 'Program updated' : 'Program created');
      onClose();
    } catch (error) {
      console.error('Error saving program:', error);
      toast.error('Failed to save program');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{program ? 'Edit Program' : 'Create New Program'}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="schedule">Schedule ({schedule.length} drills)</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-auto mt-4">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="name">Program Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-800 border-slate-700 mt-1"
                    placeholder="e.g., Pre-Season Hitting Program"
                  />
                </div>

                <div>
                  <Label htmlFor="duration">Duration (weeks)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    max={12}
                    value={formData.duration_weeks}
                    onChange={(e) => setFormData({ ...formData, duration_weeks: parseInt(e.target.value) || 4 })}
                    className="bg-slate-800 border-slate-700 mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select
                    value={formData.difficulty}
                    onValueChange={(v) => setFormData({ ...formData, difficulty: v })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label>4B Focus Areas</Label>
                  <div className="flex gap-2 mt-2">
                    {Object.entries(categoryInfo).map(([key, info]) => (
                      <Button
                        key={key}
                        type="button"
                        variant={formData.four_b_focus.includes(key) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleFocus(key)}
                        className={formData.four_b_focus.includes(key) ? "" : "border-slate-700"}
                      >
                        {info.icon}
                        <span className="ml-1 capitalize">{key}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-slate-800 border-slate-700 mt-1 min-h-[100px]"
                    placeholder="Program description and goals..."
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="flex-1 overflow-hidden mt-4 flex flex-col">
            {/* Week Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                disabled={currentWeek === 1}
                className="border-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold">Week {currentWeek} of {formData.duration_weeks}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(Math.min(formData.duration_weeks, currentWeek + 1))}
                disabled={currentWeek === formData.duration_weeks}
                className="border-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-hidden flex gap-4">
              {/* Drill Library */}
              <div className="w-64 flex-shrink-0 flex flex-col">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Drill Library</h4>
                <ScrollArea className="flex-1 border border-slate-800 rounded-lg p-2">
                  <div className="space-y-1">
                    {drills.map(drill => {
                      const cat = drill.four_b_category ? categoryInfo[drill.four_b_category] : null;
                      return (
                        <div
                          key={drill.id}
                          className="p-2 bg-slate-800 rounded text-sm hover:bg-slate-700 cursor-grab flex items-center gap-2 group"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('drill', JSON.stringify(drill))}
                        >
                          <GripVertical className="h-3 w-3 text-slate-600 group-hover:text-slate-400" />
                          {cat && <span className={cat.color}>{cat.icon}</span>}
                          <span className="flex-1 truncate">{drill.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Week Grid */}
              <div className="flex-1 overflow-x-auto">
                <div className="grid grid-cols-7 gap-2 min-w-[700px]">
                  {DAYS.map((day, dayIndex) => (
                    <div key={day} className="flex flex-col">
                      <div className="text-center text-sm font-medium text-slate-400 pb-2 border-b border-slate-800">
                        {day}
                      </div>
                      <div
                        className="flex-1 min-h-[200px] bg-slate-800/50 rounded-lg p-2 mt-2 border-2 border-dashed border-slate-700 hover:border-slate-600 transition-colors"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const drillData = e.dataTransfer.getData('drill');
                          if (drillData) {
                            addDrillToDay(JSON.parse(drillData), dayIndex + 1);
                          }
                        }}
                      >
                        <div className="space-y-1">
                          {getScheduleForDay(currentWeek, dayIndex + 1).map((item, idx) => {
                            const cat = item.drill?.four_b_category ? categoryInfo[item.drill.four_b_category] : null;
                            return (
                              <div
                                key={`${item.drill_id}-${idx}`}
                                className="p-2 bg-slate-900 rounded text-xs group flex items-start gap-1"
                              >
                                {cat && <span className={`${cat.color} mt-0.5`}>{cat.icon}</span>}
                                <span className="flex-1 truncate">{item.drill?.name}</span>
                                <button
                                  onClick={() => removeFromSchedule(item)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                          {getScheduleForDay(currentWeek, dayIndex + 1).length === 0 && (
                            <div className="text-xs text-slate-600 text-center py-4">
                              Drop drills here
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700 mt-4">
          <Button type="button" variant="outline" onClick={onClose} className="border-slate-700">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : program ? 'Update Program' : 'Create Program'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
