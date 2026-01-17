import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Loader2 } from "lucide-react";

const LEAK_COLORS: Record<string, string> = {
  EARLY_ARMS: "#ef4444",
  CAST: "#f97316",
  LUNGE: "#ef4444",
  COLLAPSE: "#ef4444",
  DISCONNECTION: "#f97316",
  SPIN_OUT: "#f97316",
  POOR_SEPARATION: "#f97316",
  ENERGY_LEAK: "#ef4444",
  CLEAN_TRANSFER: "#22c55e",
};

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
      // Get leak distribution from reboot_uploads
      const { data, error } = await supabase
        .from("reboot_uploads")
        .select("weakest_link")
        .not("weakest_link", "is", null)
        .limit(500);

      if (error) throw error;

      // Count occurrences
      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        const leak = row.weakest_link || "UNKNOWN";
        counts[leak] = (counts[leak] || 0) + 1;
      });

      // Convert to chart data
      return Object.entries(counts)
        .map(([name, count]) => ({
          name,
          label: LEAK_LABELS[name] || name,
          count,
          color: LEAK_COLORS[name] || "#64748b",
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6); // Top 6 leaks
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!leakData || leakData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
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
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#f1f5f9" }}
          formatter={(value: number) => [`${value} players`, "Count"]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {leakData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
