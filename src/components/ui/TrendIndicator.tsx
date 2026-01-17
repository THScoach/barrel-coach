import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendIndicatorProps {
  value: number; // positive = up, negative = down, 0 = neutral
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TrendIndicator({ value, showValue = true, size = "md", className }: TrendIndicatorProps) {
  const isUp = value > 0;
  const isDown = value < 0;
  const isNeutral = value === 0;

  const sizeClasses = {
    sm: "text-xs gap-0.5",
    md: "text-sm gap-1",
    lg: "text-base gap-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        isUp && "text-green-400",
        isDown && "text-red-400",
        isNeutral && "text-slate-400",
        sizeClasses[size],
        className
      )}
    >
      {isUp && <TrendingUp className={iconSizes[size]} />}
      {isDown && <TrendingDown className={iconSizes[size]} />}
      {isNeutral && <Minus className={iconSizes[size]} />}
      {showValue && (
        <span>
          {isUp && "+"}
          {value}
        </span>
      )}
    </span>
  );
}
