import { Card, CardContent } from "@/components/ui/card";
import { TrendIndicator } from "@/components/ui/TrendIndicator";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { CSSProperties } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  loading?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function MetricCard({
  title,
  value,
  trend,
  icon: Icon,
  iconColor = "text-blue-500",
  iconBgColor = "bg-blue-500/15",
  loading = false,
  className,
  style,
}: MetricCardProps) {
  return (
    <Card className={cn("bg-slate-800 border-slate-700", className)} style={style}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">{title}</p>
            {loading ? (
              <div className="h-9 w-20 bg-slate-700 animate-pulse rounded" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white">{value}</p>
                {trend !== undefined && <TrendIndicator value={trend} size="sm" />}
              </div>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", iconBgColor)}>
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
