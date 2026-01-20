import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DrillCard } from "@/components/drills/DrillCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Brain, Activity, Zap, Circle, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface Drill {
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
}

const categories = [
  { id: "all", label: "All", icon: Dumbbell },
  { id: "brain", label: "Brain", icon: Brain, color: "text-purple-400" },
  { id: "body", label: "Body", icon: Activity, color: "text-blue-400" },
  { id: "bat", label: "Bat", icon: Zap, color: "text-orange-400" },
  { id: "ball", label: "Ball", icon: Circle, color: "text-green-400" },
];

const focusAreas = [
  { id: "all", label: "All Focus Areas" },
  { id: "ground_flow", label: "Ground Flow" },
  { id: "core_flow", label: "Core Flow" },
  { id: "upper_flow", label: "Upper Flow" },
  { id: "timing", label: "Timing" },
  { id: "consistency", label: "Consistency" },
];

export default function Drills() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedFocus, setSelectedFocus] = useState("all");

  useEffect(() => {
    loadDrills();
  }, [selectedCategory, selectedFocus]);

  async function loadDrills() {
    try {
      setLoading(true);
      let query = supabase
        .from('drills')
        .select('id, name, slug, description, four_b_category, focus_area, video_thumbnail_url, sets, reps, is_premium, skill_levels')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (selectedCategory !== "all") {
        query = query.eq('four_b_category', selectedCategory);
      }
      if (selectedFocus !== "all") {
        query = query.eq('focus_area', selectedFocus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDrills(data || []);
    } catch (err) {
      console.error('Error loading drills:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredDrills = drills.filter(drill =>
    drill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    drill.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#111113]">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-[#1a1a1c] to-[#111113] border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-10 bg-[#DC2626] rounded-full" />
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              Drill Library
            </h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl">
            Master your swing with targeted drills for every aspect of your mechanics.
            Each drill is designed to fix specific leaks and build elite patterns.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="space-y-6 mb-10">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <Input
              type="text"
              placeholder="Search drills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#1a1a1c] border-gray-800 text-white placeholder:text-gray-500 focus:border-[#DC2626]"
            />
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <Button
                  key={cat.id}
                  variant="outline"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "border-gray-800 text-gray-400 hover:text-white hover:border-[#DC2626]",
                    isActive && "bg-[#DC2626] border-[#DC2626] text-white hover:bg-[#B91C1C]"
                  )}
                >
                  <Icon className={cn("h-4 w-4 mr-2", !isActive && cat.color)} />
                  {cat.label}
                </Button>
              );
            })}
          </div>

          {/* Focus Area Filters */}
          <div className="flex flex-wrap gap-2">
            <Filter className="h-4 w-4 text-gray-500 mr-2 self-center" />
            {focusAreas.map((focus) => (
              <button
                key={focus.id}
                onClick={() => setSelectedFocus(focus.id)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-lg transition-colors",
                  selectedFocus === focus.id
                    ? "bg-gray-800 text-white"
                    : "text-gray-500 hover:text-gray-300"
                )}
              >
                {focus.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drills Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-72 bg-gray-900 rounded-xl" />
            ))}
          </div>
        ) : filteredDrills.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-6">
              <Dumbbell className="h-10 w-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Drills Found</h3>
            <p className="text-gray-500">
              {searchQuery
                ? "Try adjusting your search or filters"
                : "No drills available for this category yet"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrills.map((drill) => (
              <DrillCard key={drill.id} drill={drill} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}