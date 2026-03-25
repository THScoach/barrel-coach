import { NavLink } from "react-router-dom";
import { Home, Database, Dumbbell, TrendingUp, MessageSquare } from "lucide-react";

const navItems = [
  { to: '/player', icon: Home, label: 'Home', end: true },
  { to: '/player/data', icon: Database, label: 'My Data', end: false },
  { to: '/player/session', icon: Dumbbell, label: 'Session', end: false },
  { to: '/player/progress', icon: TrendingUp, label: 'Progress', end: false },
  { to: '/player/messages', icon: MessageSquare, label: 'Coach', end: false },
];

export function PlayerBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #1a1a1a' }}>
      <div className="flex items-center justify-around py-1.5 px-1 max-w-lg mx-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all duration-200"
          >
            {({ isActive }) => (
              <>
                <div
                  className="relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200"
                  style={{
                    background: isActive ? 'rgba(230,57,70,0.12)' : 'transparent',
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  <item.icon
                    className="h-[18px] w-[18px] transition-colors duration-200"
                    style={{ color: isActive ? '#E63946' : '#555' }}
                  />
                </div>
                <span
                  className="text-[9px] font-bold tracking-wide transition-colors duration-200"
                  style={{ color: isActive ? '#E63946' : '#555' }}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
