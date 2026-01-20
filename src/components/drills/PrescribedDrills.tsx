import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DrillCard } from "./DrillCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Dumbbell, ChevronRight } from "lucide-react";

interface Assignment {
  id: string;
  drill_id: string;
  assigned_reason: string | null;
  status: string;
  drill: {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    four_b_category: string | null;
    focus_area: string | null;
    video_thumbnail_url: string | null;
    sets: number | null;
    reps: number | null;
    is_premium: boolean | null;
    skill_levels: string[] | null;
  };
}

interface PrescribedDrillsProps {
  playerId: string;
}

export function PrescribedDrills({ playerId }: PrescribedDrillsProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, [playerId]);

  async function loadAssignments() {
    try {
      const { data, error } = await supabase
        .from('player_drill_assignments')
        .select(`
          id,
          drill_id,
          assigned_reason,
          status,
          drill:drills(
            id,
            name,
            slug,
            description,
            four_b_category,
            focus_area,
            video_thumbnail_url,
            sets,
            reps,
            is_premium,
            skill_levels
          )
        `)
        .eq('player_id', playerId)
        .neq('status', 'completed')
        .order('assigned_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      
      // Filter out any null drills and cast properly
      const validAssignments = (data || []).filter(a => a.drill !== null) as Assignment[];
      setAssignments(validAssignments);
    } catch (err) {
      console.error('Error loading assignments:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markComplete(assignmentId: string) {
    try {
      await supabase
        .from('player_drill_assignments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', assignmentId);
      
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (err) {
      console.error('Error marking complete:', err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-gray-900" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 bg-gray-900 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-[#111113] rounded-xl p-8 text-center border border-gray-800/50">
        <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-4">
          <Dumbbell className="h-8 w-8 text-gray-600" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">No Drills Assigned Yet</h3>
        <p className="text-gray-500 text-sm mb-6">
          Complete an analysis to get personalized drill recommendations based on your swing.
        </p>
        <Button asChild className="bg-[#DC2626] hover:bg-[#B91C1C]">
          <Link to="/analyze">Upload a Swing</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-[#DC2626] rounded-full" />
            Prescribed Drills
          </h2>
          <p className="text-sm text-gray-500 ml-4">Based on your analysis, work on these:</p>
        </div>
        <Button asChild variant="ghost" className="text-gray-400 hover:text-white">
          <Link to="/drills">
            View All <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="relative">
            <DrillCard 
              drill={assignment.drill} 
              showAssignedReason={assignment.assigned_reason}
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                markComplete(assignment.id);
              }}
              className="absolute top-2 left-2 p-2 bg-black/70 rounded-lg hover:bg-emerald-600 transition-colors group"
              title="Mark as complete"
            >
              <CheckCircle className="h-5 w-5 text-gray-400 group-hover:text-white" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}