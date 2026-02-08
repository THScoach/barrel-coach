import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionHeaderProps {
  playerName: string | null;
  playerId: string | null;
  sessionDate: string | null;
  rebootSessionId: string | null;
  grade: string | null;
  compositeScore: number | null;
  swingCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function SessionHeader({
  playerName,
  playerId,
  sessionDate,
  rebootSessionId,
  grade,
  compositeScore,
  swingCount,
  isRefreshing,
  onRefresh,
}: SessionHeaderProps) {
  const formattedDate = sessionDate
    ? new Date(sessionDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="mb-8">
      <Link
        to={playerId ? `/athletes/${playerId}` : "/athletes"}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {playerId ? `Back to ${playerName || "Athlete"}` : "Back to Athletes"}
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">
            {playerName || "Session Details"}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-400">{formattedDate}</p>
            {swingCount > 0 && (
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                {swingCount} swing{swingCount !== 1 ? "s" : ""}
              </span>
            )}
            {grade && (
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                {grade}
              </span>
            )}
            {compositeScore != null && (
              <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full font-mono">
                {compositeScore.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="border-slate-700 text-slate-300 hover:text-white"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Refresh
          </Button>

          {rebootSessionId && (
            <a
              href={`https://dashboard.rebootmotion.com/sessions/${rebootSessionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View in Reboot
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
