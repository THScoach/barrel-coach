import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
}

interface DrillFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  drill: Drill | null;
}

export function DrillFormModal({ isOpen, onClose, drill }: DrillFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    four_b_category: '',
    equipment: '',
    duration_minutes: 15,
    sets: 3,
    reps: 10,
    video_url: '',
    instructions: '',
    cues: '',
    difficulty: 'beginner',
  });

  useEffect(() => {
    if (drill) {
      setFormData({
        name: drill.name || '',
        description: drill.description || '',
        four_b_category: drill.four_b_category || '',
        equipment: drill.equipment?.join(', ') || '',
        duration_minutes: drill.duration_minutes || 15,
        sets: drill.sets || 3,
        reps: drill.reps || 10,
        video_url: drill.video_url || '',
        instructions: drill.instructions || '',
        cues: drill.cues?.join('\n') || '',
        difficulty: drill.difficulty || 'beginner',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        four_b_category: '',
        equipment: '',
        duration_minutes: 15,
        sets: 3,
        reps: 10,
        video_url: '',
        instructions: '',
        cues: '',
        difficulty: 'beginner',
      });
    }
  }, [drill, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Drill name is required');
      return;
    }

    setLoading(true);
    try {
      const drillData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        four_b_category: formData.four_b_category || null,
        equipment: formData.equipment ? formData.equipment.split(',').map(s => s.trim()).filter(Boolean) : null,
        duration_minutes: formData.duration_minutes,
        sets: formData.sets,
        reps: formData.reps,
        video_url: formData.video_url.trim() || null,
        instructions: formData.instructions.trim() || null,
        cues: formData.cues ? formData.cues.split('\n').map(s => s.trim()).filter(Boolean) : null,
        difficulty: formData.difficulty,
        is_active: true,
      };

      if (drill) {
        const { error } = await supabase
          .from('drills')
          .update(drillData)
          .eq('id', drill.id);
        if (error) throw error;
        toast.success('Drill updated');
      } else {
        const { error } = await supabase
          .from('drills')
          .insert(drillData);
        if (error) throw error;
        toast.success('Drill created');
      }
      onClose();
    } catch (error) {
      console.error('Error saving drill:', error);
      toast.error('Failed to save drill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{drill ? 'Edit Drill' : 'Create New Drill'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name">Drill Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-800 border-slate-700 mt-1"
                placeholder="e.g., Tee Work - Middle"
              />
            </div>

            <div>
              <Label htmlFor="category">4B Category</Label>
              <Select
                value={formData.four_b_category}
                onValueChange={(v) => setFormData({ ...formData, four_b_category: v })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="brain">Brain</SelectItem>
                  <SelectItem value="body">Body</SelectItem>
                  <SelectItem value="bat">Bat</SelectItem>
                  <SelectItem value="ball">Ball</SelectItem>
                </SelectContent>
              </Select>
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

            <div>
              <Label htmlFor="sets">Sets</Label>
              <Input
                id="sets"
                type="number"
                min={1}
                value={formData.sets}
                onChange={(e) => setFormData({ ...formData, sets: parseInt(e.target.value) || 1 })}
                className="bg-slate-800 border-slate-700 mt-1"
              />
            </div>

            <div>
              <Label htmlFor="reps">Reps</Label>
              <Input
                id="reps"
                type="number"
                min={1}
                value={formData.reps}
                onChange={(e) => setFormData({ ...formData, reps: parseInt(e.target.value) || 1 })}
                className="bg-slate-800 border-slate-700 mt-1"
              />
            </div>

            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 15 })}
                className="bg-slate-800 border-slate-700 mt-1"
              />
            </div>

            <div>
              <Label htmlFor="equipment">Equipment (comma separated)</Label>
              <Input
                id="equipment"
                value={formData.equipment}
                onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                className="bg-slate-800 border-slate-700 mt-1"
                placeholder="e.g., Tee, Bat, Baseballs"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="video_url">Video URL</Label>
              <Input
                id="video_url"
                value={formData.video_url}
                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                className="bg-slate-800 border-slate-700 mt-1"
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-slate-800 border-slate-700 mt-1 min-h-[80px]"
                placeholder="Brief description of the drill..."
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                className="bg-slate-800 border-slate-700 mt-1 min-h-[100px]"
                placeholder="Step-by-step instructions..."
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="cues">Coaching Cues (one per line)</Label>
              <Textarea
                id="cues"
                value={formData.cues}
                onChange={(e) => setFormData({ ...formData, cues: e.target.value })}
                className="bg-slate-800 border-slate-700 mt-1 min-h-[80px]"
                placeholder="Stay connected&#10;Drive through the ball&#10;Finish high"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-700">
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : drill ? 'Update Drill' : 'Create Drill'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
