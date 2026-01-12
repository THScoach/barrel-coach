import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Users, Plus, BookOpen, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerPickerModal } from "@/components/admin/PlayerPickerModal";

const navItems = [
  { to: "/admin", icon: Home, label: "Home", end: true },
  { to: "/admin/players", icon: Users, label: "Players", end: false },
  { to: "#new-session", icon: Plus, label: "New", end: true, isAction: true },
  { to: "/admin/library", icon: BookOpen, label: "Library", end: false },
  { to: "/admin/ask-rick", icon: MessageCircle, label: "Ask Rick", end: true },
];

export function MobileBottomNav() {
  const location = useLocation();
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);

  const isActive = (path: string, end: boolean) => {
    if (end) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-slate-900/98 backdrop-blur-xl border-t border-slate-700/80 safe-area-bottom">
      <div className="flex items-center justify-around" style={{ minHeight: '72px' }}>
        {navItems.map((item) => {
          const active = isActive(item.to, item.end);
          
          // Special styling for the center "New" action button - opens player picker
          if (item.isAction) {
            return (
              <button
                key={item.to}
                onClick={() => setShowPlayerPicker(true)}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-xl shadow-red-900/40 border-4 border-slate-900">
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-[11px] font-medium text-slate-400 mt-1">{item.label}</span>
              </button>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="flex flex-col items-center justify-center touch-target-lg"
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                active ? "bg-red-600/20" : "bg-transparent"
              )}>
                <item.icon 
                  className={cn(
                    "h-6 w-6 transition-colors",
                    active ? "text-red-500" : "text-slate-400"
                  )} 
                />
              </div>
              <span 
                className={cn(
                  "text-[11px] font-medium mt-0.5 transition-colors",
                  active ? "text-red-500" : "text-slate-400"
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
      
      {/* Player Picker Modal for New Session */}
      <PlayerPickerModal 
        open={showPlayerPicker} 
        onOpenChange={setShowPlayerPicker} 
      />
    </nav>
  );
}