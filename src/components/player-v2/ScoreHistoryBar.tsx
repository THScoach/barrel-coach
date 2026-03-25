/**
 * Score history mini bar chart for player dashboard
 */
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { scoreColor } from "@/lib/player-utils";

interface SessionHistoryItem {
  id: string;
  overall_score: number | null;
  session_date: string;
  source?: string;
}

interface ScoreHistoryBarProps {
  sessions: SessionHistoryItem[];
}

export function ScoreHistoryBar({ sessions }: ScoreHistoryBarProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="rounded-xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#555' }}>Score History</span>
        <Link to="/player/progress" className="text-[11px] font-bold flex items-center gap-0.5 transition-colors hover:opacity-80" style={{ color: '#E63946' }}>
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex items-end gap-2 h-20">
        {sessions.map((s, i) => {
          const val = s.overall_score ?? 0;
          const maxH = 64;
          const h = (val / 100) * maxH;
          const barColor = s.source === '2d' ? '#3B82F6' : scoreColor(val);
          const opacity = 0.5 + (i / sessions.length) * 0.5;

          return (
            <Link
              key={s.id}
              to={`/player/session/${s.id}`}
              className="flex-1 flex flex-col items-center gap-1.5 hover:opacity-80 transition-all group"
            >
              <span className="text-[10px] font-bold transition-colors" style={{ color: barColor }}>
                {val}
              </span>
              <div
                className="w-full rounded-md transition-all duration-300 group-hover:scale-y-105"
                style={{
                  height: `${Math.max(h, 6)}px`,
                  background: `linear-gradient(180deg, ${barColor}, ${barColor}99)`,
                  opacity,
                }}
              />
              <span className="text-[8px] font-semibold uppercase" style={{ color: '#444' }}>
                {s.source === '2d' ? '2D' : '3D'}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
