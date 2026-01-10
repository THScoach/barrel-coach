import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface ProblemTag {
  id: string;
  name: string;
  display_name: string;
  category: string;
  description: string | null;
}

interface ProblemSelectorProps {
  primaryProblem: string;
  secondaryProblems: string[];
  onPrimaryChange: (problem: string) => void;
  onSecondaryChange: (problems: string[]) => void;
  weakestCategory?: string;
  maxSecondary?: number;
  disabled?: boolean;
}

export function ProblemSelector({
  primaryProblem,
  secondaryProblems,
  onPrimaryChange,
  onSecondaryChange,
  weakestCategory,
  maxSecondary = 3,
  disabled
}: ProblemSelectorProps) {
  const [problemTags, setProblemTags] = useState<ProblemTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProblems() {
      const { data } = await supabase
        .from('problem_tags')
        .select('*')
        .order('category', { ascending: true });
      
      setProblemTags(data || []);
      setLoading(false);
    }
    fetchProblems();
  }, []);

  const groupedProblems = problemTags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, ProblemTag[]>);

  const categoryOrder = ['brain', 'body', 'bat', 'ball'];
  const sortedCategories = Object.keys(groupedProblems).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  const toggleSecondary = (name: string) => {
    if (secondaryProblems.includes(name)) {
      onSecondaryChange(secondaryProblems.filter(p => p !== name));
    } else if (secondaryProblems.length < maxSecondary) {
      onSecondaryChange([...secondaryProblems, name]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedProblem = problemTags.find(p => p.name === primaryProblem);

  return (
    <div className="space-y-4">
      {/* Primary Problem */}
      <div className="space-y-2">
        <Label className="font-medium">Primary Problem *</Label>
        <Select value={primaryProblem} onValueChange={onPrimaryChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select the main issue..." />
          </SelectTrigger>
          <SelectContent>
            {sortedCategories.map(category => (
              <SelectGroup key={category}>
                <SelectLabel className="uppercase text-xs font-bold tracking-wider">
                  {category} {weakestCategory === category && '⚠️'}
                </SelectLabel>
                {groupedProblems[category].map(tag => (
                  <SelectItem key={tag.name} value={tag.name}>
                    {tag.display_name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {selectedProblem && (
          <p className="text-sm text-muted-foreground">{selectedProblem.description}</p>
        )}
      </div>

      {/* Secondary Problems */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="font-medium">Secondary Problems</Label>
          <span className="text-xs text-muted-foreground">
            {secondaryProblems.length} / {maxSecondary} selected
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
          {problemTags
            .filter(tag => tag.name !== primaryProblem)
            .map(tag => (
              <label
                key={tag.name}
                className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors
                  ${secondaryProblems.includes(tag.name) 
                    ? 'bg-primary/10 border-primary' 
                    : 'hover:bg-muted'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <Checkbox
                  checked={secondaryProblems.includes(tag.name)}
                  onCheckedChange={() => toggleSecondary(tag.name)}
                  disabled={disabled || (!secondaryProblems.includes(tag.name) && secondaryProblems.length >= maxSecondary)}
                />
                <span className="text-sm">{tag.display_name}</span>
                <Badge variant="outline" className="text-[10px] ml-auto capitalize">
                  {tag.category}
                </Badge>
              </label>
            ))}
        </div>
      </div>
    </div>
  );
}
