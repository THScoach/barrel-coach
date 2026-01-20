import { AlertTriangle, CheckCircle, HelpCircle, RotateCcw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type LeakType = 'clean_transfer' | 'late_legs' | 'early_arms' | 'torso_bypass' | 'no_bat_delivery' | 'unknown' | 'brain' | 'body' | 'bat' | 'ball';

interface LeakAlertProps {
  type: LeakType | string | null;
  caption: string | null;
  training: string | null;
}

const leakConfig: Record<string, { icon: typeof AlertTriangle; color: string; bgColor: string; label: string }> = {
  clean_transfer: {
    icon: CheckCircle,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    label: "Clean Transfer"
  },
  late_legs: {
    icon: Zap,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    label: "Late Legs"
  },
  early_arms: {
    icon: Zap,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    label: "Early Arms"
  },
  torso_bypass: {
    icon: RotateCcw,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    label: "Torso Bypass"
  },
  no_bat_delivery: {
    icon: AlertTriangle,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    label: "No Bat Delivery"
  },
  brain: {
    icon: AlertTriangle,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    label: "Brain - Pattern Recognition"
  },
  body: {
    icon: AlertTriangle,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    label: "Body - Energy Production"
  },
  bat: {
    icon: AlertTriangle,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    label: "Bat - Energy Delivery"
  },
  ball: {
    icon: AlertTriangle,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    label: "Ball - Output Quality"
  },
  unknown: {
    icon: HelpCircle,
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    label: "Analysis Pending"
  }
};

export function LeakAlert({ type, caption, training }: LeakAlertProps) {
  if (!type && !caption) return null;

  const normalizedType = type?.toLowerCase() || 'unknown';
  const config = leakConfig[normalizedType] || leakConfig.unknown;
  const Icon = config.icon;
  const isClean = normalizedType === 'clean_transfer';

  return (
    <div
      className={cn(
        "bg-[#111113] rounded-xl p-6 border-l-4",
        isClean ? "border-emerald-500" : "border-[#DC2626]"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn(
          "p-3 rounded-xl flex-shrink-0",
          config.bgColor
        )}>
          <Icon className={cn("h-6 w-6", config.color)} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Type Badge */}
          <span className={cn(
            "inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider mb-3",
            config.bgColor,
            config.color
          )}>
            {config.label}
          </span>

          {/* Caption */}
          {caption && (
            <p className="text-lg text-white font-semibold mb-3 leading-relaxed">
              {caption}
            </p>
          )}

          {/* Training Recommendation */}
          {training && (
            <div className="flex items-start gap-2 p-3 bg-gray-900/50 rounded-lg">
              <span className="text-[#DC2626] text-xs font-bold uppercase tracking-wider mt-0.5">
                Fix:
              </span>
              <p className="text-sm text-gray-400 leading-relaxed">
                {training}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}