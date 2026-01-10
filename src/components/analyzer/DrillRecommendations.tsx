import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play } from "lucide-react";

interface DrillVideo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  four_b_category: string | null;
  problems_addressed: string[] | null;
  duration_seconds: number | null;
}

interface DrillRecommendationsProps {
  selectedDrillIds: string[];
  onSelectionChange: (ids: string[]) => void;
  weakestCategory?: string;
  primaryProblem?: string;
  maxDrills?: number;
  disabled?: boolean;
}

export function DrillRecommendations({
  selectedDrillIds,
  onSelectionChange,
  weakestCategory,
  primaryProblem,
  maxDrills = 5,
  disabled
}: DrillRecommendationsProps) {
  const [drills, setDrills] = useState<DrillVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDrills() {
      let query = supabase
        .from('drill_videos')
        .select('id, title, description, thumbnail_url, four_b_category, problems_addressed, duration_seconds')
        .eq('status', 'published')
        .limit(20);

      // Prioritize drills matching weakest category
      if (weakestCategory) {
        query = query.order('four_b_category', { ascending: false });
      }

      const { data } = await query;
      
      // Sort to prioritize matching drills
      const sorted = (data || []).sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        
        if (a.four_b_category === weakestCategory) scoreA += 10;
        if (b.four_b_category === weakestCategory) scoreB += 10;
        
        if (primaryProblem && a.problems_addressed?.includes(primaryProblem)) scoreA += 5;
        if (primaryProblem && b.problems_addressed?.includes(primaryProblem)) scoreB += 5;
        
        return scoreB - scoreA;
      });
      
      setDrills(sorted);
      setLoading(false);
    }
    fetchDrills();
  }, [weakestCategory, primaryProblem]);

  const toggleDrill = (id: string) => {
    if (selectedDrillIds.includes(id)) {
      onSelectionChange(selectedDrillIds.filter(d => d !== id));
    } else if (selectedDrillIds.length < maxDrills) {
      onSelectionChange([...selectedDrillIds, id]);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-medium">Recommended Drills</Label>
        <span className="text-xs text-muted-foreground">
          {selectedDrillIds.length} / {maxDrills} selected
        </span>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Auto-sorted by relevance to {weakestCategory ? `${weakestCategory} (weakest)` : 'player'} 
        {primaryProblem && ` and ${primaryProblem.replace(/_/g, ' ')}`}
      </p>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {drills.map(drill => {
          const isSelected = selectedDrillIds.includes(drill.id);
          const isRelevant = drill.four_b_category === weakestCategory || 
                            drill.problems_addressed?.includes(primaryProblem || '');
          
          return (
            <label
              key={drill.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                ${isSelected 
                  ? 'bg-primary/10 border-primary' 
                  : isRelevant 
                    ? 'bg-amber-500/5 border-amber-500/30 hover:bg-amber-500/10'
                    : 'hover:bg-muted'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleDrill(drill.id)}
                disabled={disabled || (!isSelected && selectedDrillIds.length >= maxDrills)}
                className="mt-1"
              />
              
              <div className="relative w-16 h-10 bg-muted rounded overflow-hidden flex-shrink-0">
                {drill.thumbnail_url ? (
                  <img 
                    src={drill.thumbnail_url} 
                    alt={drill.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{drill.title}</span>
                  {isRelevant && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {drill.four_b_category && (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {drill.four_b_category}
                    </Badge>
                  )}
                  {drill.duration_seconds && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatDuration(drill.duration_seconds)}
                    </span>
                  )}
                </div>
              </div>
            </label>
          );
        })}
        
        {drills.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            No published drills available
          </p>
        )}
      </div>
    </div>
  );
}
