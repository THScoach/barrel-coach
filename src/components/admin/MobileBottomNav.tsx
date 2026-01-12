import { NavLink, useLocation } from "react-router-dom";
import { Home, Users, Plus, BookOpen, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", icon: Home, label: "Home", end: true },
  { to: "/admin/players", icon: Users, label: "Players", end: false },
  { to: "/admin/new-session", icon: Plus, label: "New", end: true, isAction: true },
  { to: "/admin/library", icon: BookOpen, label: "Library", end: false },
  { to: "/admin/ask-rick", icon: MessageCircle, label: "Ask Rick", end: true },
];

export function MobileBottomNav() {
  const location = useLocation();

  const isActive = (path: string, end: boolean) => {
    if (end) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.to, item.end);
          
          // Special styling for the center "New" action button
          if (item.isAction) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center -mt-4"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-red-900/30">
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-[10px] font-medium text-slate-400 mt-1">{item.label}</span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-3"
            >
              <item.icon 
                className={cn(
                  "h-6 w-6 transition-colors",
                  active ? "text-red-500" : "text-slate-500"
                )} 
              />
              <span 
                className={cn(
                  "text-[10px] font-medium mt-1 transition-colors",
                  active ? "text-red-500" : "text-slate-500"
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
