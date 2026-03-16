import { NavLink } from "react-router-dom";
import { Home, Database, Dumbbell, TrendingUp, MessageSquare } from "lucide-react";

const navItems = [
  { to: '/player', icon: Home, label: 'Home', end: true },
  { to: '/player/data', icon: Database, label: 'My Data', end: false },
  { to: '/player/session', icon: Dumbbell, label: 'Session', end: false },
  { to: '/player/progress', icon: TrendingUp, label: 'Progress', end: false },
  { to: '/player/messages', icon: MessageSquare, label: 'Coach Rick', end: false },
];

export function PlayerBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: '#0a0a0a', borderTop: '1px solid #222' }}>
      <div className="flex items-center justify-around py-2 px-1 max-w-lg mx-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium transition-colors"
            style={({ isActive }) => ({ color: isActive ? '#E63946' : '#777777' })}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
