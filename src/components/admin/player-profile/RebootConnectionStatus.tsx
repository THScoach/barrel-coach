import { CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RebootConnectionStatusProps {
  rebootPlayerId: string | null | undefined;
}

export function RebootConnectionStatus({ rebootPlayerId }: RebootConnectionStatusProps) {
  if (rebootPlayerId) {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
        <CheckCircle className="h-3 w-3 mr-1" />
        Connected to Reboot: {rebootPlayerId}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
      <AlertCircle className="h-3 w-3 mr-1" />
      3D Analysis Ready
    </Badge>
  );
}
