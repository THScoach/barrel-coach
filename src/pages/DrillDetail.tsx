import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GumletVideoPlayer } from "@/components/video/GumletVideoPlayer";
import { 
  ArrowLeft, 
  Play, 
  CheckCircle, 
  Clock, 
  Target, 
  AlertTriangle,
  Lightbulb,
  Brain,
  Activity,
  Zap,
  Circle,
  Dumbbell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Drill {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  four_b_category: string | null;
  focus_area: string | null;
  video_url: string | null;
  video_thumbnail_url: string | null;
  instructions: string | null;
  sets: number | null;
  reps: number | null;
  rest_seconds: number | null;
  why_it_works: string | null;
  common_mistakes: string | null;
  progression_tip: string | null;
  equipment: string[] | null;
  skill_levels: string[] | null;
  is_premium: boolean | null;
}

interface Assignment {
  id: string;
  status: string;
  assigned_reason: string | null;
}

const categoryConfig: Record<string, { icon: typeof Brain; color: string; bgColor: string; label: string }> = {
  brain: { icon: Brain, color: "text-purple-400", bgColor: "bg-purple-500/20", label: "Brain" },
  body: { icon: Activity, color: "text-blue-400", bgColor: "bg-blue-500/20", label: "Body" },
  bat: { icon: Zap, color: "text-orange-400", bgColor: "bg-orange-500/20", label: "Bat" },
  ball: { icon: Circle, color: "text-green-400", bgColor: "bg-green-500/20", label: "Ball" },
  general: { icon: Target, color: "text-gray-400", bgColor: "bg-gray-500/20", label: "General" },
};

export default function DrillDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (slug) {
      loadDrill();
    }
  }, [slug, user]);

  async function loadDrill() {
    try {
      setLoading(true);
      
      // Try to find by slug first, then by ID
      let query = supabase
        .from('drills')
        .select('*')
        .eq('is_active', true);

      // Check if slug looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug || '');
      
      if (isUUID) {
        query = query.eq('id', slug);
      } else {
        query = query.eq('slug', slug);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      setDrill(data);

      // Check for assignment if user is logged in
      if (user && data) {
        const { data: players } = await supabase
          .from('players')
          .select('id')
          .eq('email', user.email)
          .limit(1);

        if (players && players.length > 0) {
          const { data: assignmentData } = await supabase
            .from('player_drill_assignments')
            .select('id, status, assigned_reason')
            .eq('player_id', players[0].id)
            .eq('drill_id', data.id)
            .neq('status', 'completed')
            .limit(1);

          if (assignmentData && assignmentData.length > 0) {
            setAssignment(assignmentData[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error loading drill:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markComplete() {
    if (!assignment) return;
    
    try {
      setCompleting(true);
      await supabase
        .from('player_drill_assignments')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', assignment.id);

      setAssignment(null);
      toast.success("Drill marked as complete! Great work! 💪");
    } catch (err) {
      console.error('Error completing drill:', err);
      toast.error("Failed to mark complete");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111113] p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-32 mb-6 bg-gray-900" />
          <Skeleton className="aspect-video w-full bg-gray-900 rounded-xl mb-8" />
          <Skeleton className="h-12 w-2/3 bg-gray-900 mb-4" />
          <Skeleton className="h-24 w-full bg-gray-900 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!drill) {
    return (
      <div className="min-h-screen bg-[#111113] flex items-center justify-center">
        <div className="text-center">
          <Dumbbell className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Drill Not Found</h2>
          <p className="text-gray-500 mb-6">This drill may have been removed or doesn't exist.</p>
          <Button asChild className="bg-[#DC2626] hover:bg-[#B91C1C]">
            <Link to="/drills">Browse All Drills</Link>
          </Button>
        </div>
      </div>
    );
  }

  const category = drill.four_b_category || "general";
  const config = categoryConfig[category] || categoryConfig.general;
  const Icon = config.icon;
  const instructions = drill.instructions?.split('\n').filter(line => line.trim()) || [];

  return (
    <div className="min-h-screen bg-[#111113]">
      {/* Back Link */}
      <div className="bg-[#1a1a1c] border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link 
            to="/drills" 
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Drill Library
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Assignment Banner */}
        {assignment && (
          <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <span className="text-[#DC2626] font-bold text-sm uppercase tracking-wider">
                Prescribed for You
              </span>
              {assignment.assigned_reason && (
                <p className="text-gray-400 text-sm mt-1">{assignment.assigned_reason}</p>
              )}
            </div>
            <Button
              onClick={markComplete}
              disabled={completing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Complete
            </Button>
          </div>
        )}

        {/* Video Player */}
        <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden mb-8">
          {drill.video_url ? (
            drill.video_url.includes('gumlet') || drill.video_url.includes('.m3u8') ? (
              <GumletVideoPlayer
                src={drill.video_url}
                poster={drill.video_thumbnail_url || undefined}
                className="w-full h-full"
              />
            ) : (
              <video
                src={drill.video_url}
                poster={drill.video_thumbnail_url || undefined}
                controls
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Play className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">Video coming soon</p>
              </div>
            </div>
          )}
        </div>

        {/* Title & Meta */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className={cn("text-xs font-bold uppercase tracking-wider", config.bgColor, config.color, "border-0")}>
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {drill.focus_area && (
              <Badge variant="outline" className="border-gray-700 text-gray-400">
                {drill.focus_area.replace('_', ' ')}
              </Badge>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
            {drill.name}
          </h1>

          {drill.description && (
            <p className="text-lg text-gray-400 leading-relaxed">
              {drill.description}
            </p>
          )}

          {/* Sets/Reps/Rest */}
          <div className="flex items-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#DC2626]" />
              <span className="text-white font-semibold">
                {drill.sets || 3} sets × {drill.reps || 10} reps
              </span>
            </div>
            {drill.rest_seconds && (
              <div className="text-gray-500">
                {drill.rest_seconds}s rest between sets
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        {instructions.length > 0 && (
          <div className="bg-[#1a1a1c] rounded-xl p-6 mb-6 border border-gray-800/50">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-[#DC2626]" />
              Step-by-Step Instructions
            </h2>
            <ol className="space-y-3">
              {instructions.map((step, i) => {
                // Remove leading numbers if present
                const cleanStep = step.replace(/^\d+\.\s*/, '');
                return (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#DC2626] text-white font-bold text-sm flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-gray-300 leading-relaxed pt-0.5">
                      {cleanStep}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Why It Works */}
        {drill.why_it_works && (
          <div className="bg-[#1a1a1c] rounded-xl p-6 mb-6 border border-gray-800/50">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-400" />
              Why It Works
            </h2>
            <p className="text-gray-400 leading-relaxed">
              {drill.why_it_works}
            </p>
          </div>
        )}

        {/* Common Mistakes */}
        {drill.common_mistakes && (
          <div className="bg-[#1a1a1c] rounded-xl p-6 mb-6 border border-gray-800/50">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Common Mistakes
            </h2>
            <p className="text-gray-400 leading-relaxed">
              {drill.common_mistakes}
            </p>
          </div>
        )}

        {/* Progression Tip */}
        {drill.progression_tip && (
          <div className="bg-emerald-900/20 rounded-xl p-6 mb-6 border border-emerald-700/30">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              Ready to Progress?
            </h2>
            <p className="text-gray-400 leading-relaxed">
              {drill.progression_tip}
            </p>
          </div>
        )}

        {/* Complete Button (if assigned) */}
        {assignment && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#111113] via-[#111113] to-transparent">
            <div className="max-w-4xl mx-auto">
              <Button
                onClick={markComplete}
                disabled={completing}
                className="w-full py-6 text-lg bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Mark Drill as Complete
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}