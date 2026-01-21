import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from "recharts";
import { Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MOTOR_PROFILE_INFO } from "@/components/ui/MotorProfileBadge";

const PROFILE_COLORS: Record<string, string> = {
  SPINNER: "#8b5cf6",
  WHIPPER: "#3b82f6",
  SLINGSHOTTER: "#22c55e",
  TITAN: "#f97316",
  UNKNOWN: "#64748b",
};

interface MotorProfileChartProps {
  onProfileClick?: (profile: string) => void;
  interactive?: boolean;
}

export function MotorProfileChart({ onProfileClick, interactive = true }: MotorProfileChartProps) {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["motor-profile-distribution"],
    queryFn: async () => {
      // Fetch actual motor profile distribution from reboot_uploads
      const { data, error } = await supabase
        .from("reboot_uploads")
        .select("motor_profile")
        .not("motor_profile", "is", null);

      if (error) throw error;

      // Count profiles
      const counts: Record<string, number> = {
        SPINNER: 0,
        WHIPPER: 0,
        SLINGSHOTTER: 0,
        TITAN: 0,
      };

      data?.forEach((row) => {
        const profile = row.motor_profile?.toUpperCase();
        if (profile && profile in counts) {
          counts[profile]++;
        }
      });

      // Only include profiles with counts > 0
      return Object.entries(counts)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({
          name,
          value,
          color: PROFILE_COLORS[name] || PROFILE_COLORS.UNKNOWN,
        }));
    },
  });

  const handleClick = useCallback((data: any, index: number) => {
    if (!interactive) return;
    
    const profileName = data.name;
    if (onProfileClick) {
      onProfileClick(profileName);
    } else {
      // Default behavior: navigate to players filtered by motor profile
      navigate(`/admin/players?motor_profile=${profileName.toLowerCase()}`);
    }
  }, [interactive, onProfileClick, navigate]);

  const onPieEnter = useCallback((_: any, index: number) => {
    if (interactive) {
      setActiveIndex(index);
    }
  }, [interactive]);

  const onPieLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  // Custom active shape for hover effect
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
    
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 2}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{ 
            filter: `drop-shadow(0 0 10px ${fill})`,
            cursor: interactive ? 'pointer' : 'default',
          }}
        />
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fill="#fff"
          className="text-sm font-bold"
        >
          {payload.name}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill="#94a3b8"
          className="text-xs"
        >
          {payload.value} players
        </text>
      </g>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!profileData || profileData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500">
        <p className="text-sm">No motor profile data yet</p>
        <p className="text-xs mt-1">Analyze swings to classify profiles</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={profileData}
            cx="50%"
            cy="45%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
            activeIndex={activeIndex !== null ? activeIndex : undefined}
            activeShape={renderActiveShape}
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
            onClick={handleClick}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          >
            {profileData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                style={{ 
                  transition: 'all 0.2s ease',
                  opacity: activeIndex !== null && activeIndex !== index ? 0.5 : 1,
                }}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #DC2626",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#f1f5f9" }}
            formatter={(value: number, name: string) => [
              `${value} players`,
              name
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={40}
            formatter={(value) => (
              <span 
                className="text-xs text-slate-300 cursor-pointer hover:text-white transition-colors"
                style={{ color: PROFILE_COLORS[value] }}
              >
                {value}
              </span>
            )}
            onClick={(e) => {
              if (interactive && e.value) {
                handleClick({ name: e.value }, 0);
              }
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {interactive && (
        <p className="text-center text-xs text-slate-500 mt-1">
          Click a segment to filter players
        </p>
      )}
    </div>
  );
}
