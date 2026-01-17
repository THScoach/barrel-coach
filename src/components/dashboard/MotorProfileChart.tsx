import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Loader2 } from "lucide-react";

const PROFILE_COLORS: Record<string, string> = {
  SPINNER: "#8b5cf6",
  WHIPPER: "#3b82f6",
  SLINGSHOTTER: "#22c55e",
  TITAN: "#f97316",
};

export function MotorProfileChart() {
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["motor-profile-distribution"],
    queryFn: async () => {
      // This would ideally come from a view or aggregated query
      // For now, we'll use players table with motor profile data
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .limit(100);

      if (error) throw error;

      // Mock distribution since motor_profile isn't on players table yet
      // In production, this would query actual motor profile data
      return [
        { name: "SPINNER", value: 12, color: PROFILE_COLORS.SPINNER },
        { name: "WHIPPER", value: 28, color: PROFILE_COLORS.WHIPPER },
        { name: "SLINGSHOTTER", value: 18, color: PROFILE_COLORS.SLINGSHOTTER },
        { name: "TITAN", value: 8, color: PROFILE_COLORS.TITAN },
      ];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!profileData || profileData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        No profile data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={profileData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={70}
          paddingAngle={3}
          dataKey="value"
        >
          {profileData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#f1f5f9" }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => (
            <span className="text-xs text-slate-300">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
