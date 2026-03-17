import { Link } from "react-router-dom";
import { getGreeting, getInitials, motorProfileColor } from "@/lib/player-utils";

interface PlayerTopBarProps {
  playerName: string | null;
  motorProfile: string | null;
  statusBadge?: string | null;
}

export function PlayerTopBar({ playerName, motorProfile, statusBadge }: PlayerTopBarProps) {
  const firstName = playerName?.split(' ')[0] || 'Player';

  return (
    <header className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between" style={{ background: '#0a0a0a', borderBottom: '1px solid #222' }}>
      <div>
        <p className="text-xs" style={{ color: '#a0a0a0' }}>{getGreeting()}</p>
        <p className="text-xl font-bold" style={{ color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{firstName}</p>
      </div>
      <div className="flex items-center gap-3">
        {statusBadge && (
          <span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{ color: '#ffa500', background: 'rgba(255,165,0,0.12)' }}>
            {statusBadge}
          </span>
        )}
        {motorProfile && (
          <span
            className="text-[11px] font-semibold rounded-md px-2 py-0.5"
            style={{
              color: motorProfileColor(motorProfile),
              background: `${motorProfileColor(motorProfile)}1f`,
            }}
          >
            {motorProfile}
          </span>
        )}
        <Link to="/player/profile">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: '#222', color: '#fff' }}
          >
            {getInitials(playerName)}
          </div>
        </Link>
      </div>
    </header>
  );
}
