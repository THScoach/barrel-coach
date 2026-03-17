import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Loader2 } from "lucide-react";

const LEAK_LABELS: Record<string, string> = {
  EARLY_ARMS: "Early Arms",
  CAST: "Cast",
  LUNGE: "Lunge",
  COLLAPSE: "Collapse",
  DISCONNECTION: "Disconnection",
  SPIN_OUT: "Spin Out",
  POOR_SEPARATION: "Poor Sep.",
  ENERGY_LEAK: "Energy Leak",
  CLEAN_TRANSFER: "Clean",
};

export function LeakFrequencyChart() {
  const { data: leakData, isLoading } = useQuery({
    queryKey: ["leak-frequency"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reboot_uploads")
        .select("weakest_link")
        .not("weakest_link", "is", null)
        .limit(500);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        const leak = row.weakest_link || "UNKNOWN";
        counts[leak] = (counts[leak] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([name, count]) => ({
          name,
          label: LEAK_LABELS[name] || name,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!leakData || leakData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No leak data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={leakData} layout="vertical" margin={{ left: 10, right: 20 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#6B7A8F", fontSize: 11 }}
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#111827",
            border: "1px solid #1E2535",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#fff" }}
          formatter={(value: number) => [`${value} players`, "Count"]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#FF3B30" />
      </BarChart>
    </ResponsiveContainer>
  );
}
