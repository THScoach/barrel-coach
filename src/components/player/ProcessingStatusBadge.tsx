/**
 * Processing Status Badge - Shows real-time analysis status
 * Indicates when 4B Intelligence is being calculated
 */
import { Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProcessingStatus = 'pending' | 'processing' | 'complete' | 'error';

interface ProcessingStatusBadgeProps {
  status: ProcessingStatus;
  className?: string;
}

const STATUS_CONFIG: Record<ProcessingStatus, {
  icon: typeof Loader2;
  label: string;
  className: string;
}> = {
  pending: {
    icon: Clock,
    label: 'Queued',
    className: 'bg-slate-700 text-slate-300 border-slate-600',
  },
  processing: {
    icon: Loader2,
    label: 'Calculating 4B',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  complete: {
    icon: CheckCircle2,
    label: 'Ready',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    className: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
};

export function ProcessingStatusBadge({ status, className }: ProcessingStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const isAnimated = status === 'processing';

  return (
    <Badge 
      variant="outline"
      className={cn(
        "gap-1.5 font-medium",
        config.className,
        className
      )}
    >
      <Icon className={cn("h-3 w-3", isAnimated && "animate-spin")} />
      {config.label}
    </Badge>
  );
}
