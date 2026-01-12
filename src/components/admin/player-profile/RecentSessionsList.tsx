/**
 * Recent Sessions List for Rick Lab
 * ==================================
 * Compact list of the 5 most recent sessions with quick-open actions.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  BarChart3, 
  Target, 
  ChevronRight,
  Clock,
  Database
} from "lucide-react";
import { format } from "date-fns";

interface SessionItem {
  id: string;
  type: 'analyzer' | 'reboot' | 'hittrax';
  typeName: string;
  date: Date;
  scores?: {
    brain?: number;
    body?: number;
    bat?: number;
    ball?: number;
  };
  swingCount?: number;
}

interface RecentSessionsListProps {
  sessions: SessionItem[];
  loading?: boolean;
  onViewSession: (session: SessionItem) => void;
  onViewAll?: () => void;
  maxItems?: number;
}

const typeIcons = {
  analyzer: BarChart3,
  reboot: Activity,
  hittrax: Target,
};

const typeColors = {
  analyzer: "text-primary",
  reboot: "text-blue-400",
  hittrax: "text-emerald-400",
};

export function RecentSessionsList({ 
  sessions, 
  loading, 
  onViewSession, 
  onViewAll,
  maxItems = 5 
}: RecentSessionsListProps) {
  const recentSessions = sessions.slice(0, maxItems);

  if (loading) {
    return (
      <Card className="bg-slate-900/80 border-slate-700">
        <CardContent className="py-8 text-center">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-8 w-8 bg-slate-700 rounded-full" />
            <div className="h-4 w-32 bg-slate-700 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentSessions.length === 0) {
    return (
      <Card className="bg-slate-900/80 border-slate-700">
        <CardContent className="py-8 text-center">
          <Database className="h-10 w-10 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No sessions yet</p>
          <p className="text-xs text-slate-500 mt-1">Upload data to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/80 border-slate-700 overflow-hidden">
      <CardContent className="p-0">
        <div className="divide-y divide-slate-800">
          {recentSessions.map((session) => {
            const Icon = typeIcons[session.type] || Database;
            const colorClass = typeColors[session.type] || "text-slate-400";

            return (
              <button
                key={session.id}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors text-left group"
                onClick={() => onViewSession(session)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-800">
                    <Icon className={`h-4 w-4 ${colorClass}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-primary transition-colors">
                      {session.typeName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {format(session.date, 'MMM d, yyyy')}
                      {session.swingCount && (
                        <>
                          <span>•</span>
                          <span>{session.swingCount} swings</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Score Badges */}
                  {session.scores && (
                    <div className="hidden sm:flex gap-1">
                      {session.scores.brain !== undefined && (
                        <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
                          {session.scores.brain}
                        </Badge>
                      )}
                      {session.scores.body !== undefined && (
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
                          {session.scores.body}
                        </Badge>
                      )}
                      {session.scores.bat !== undefined && (
                        <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-400">
                          {session.scores.bat}
                        </Badge>
                      )}
                      {session.scores.ball !== undefined && (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                          {session.scores.ball}
                        </Badge>
                      )}
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
                </div>
              </button>
            );
          })}
        </div>

        {/* View All Button */}
        {onViewAll && sessions.length > maxItems && (
          <div className="border-t border-slate-800 p-3">
            <Button 
              variant="ghost" 
              className="w-full text-slate-400 hover:text-white"
              onClick={onViewAll}
            >
              View All {sessions.length} Sessions
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
