import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Home, MessageSquare, Dumbbell, User, LogOut, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/player/NotificationBell";
import { useEffect, useState } from "react";

export function PlayerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const getPlayerId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: player } = await supabase
        .from("players")
        .select("id")
        .eq("email", user.email)
        .single();

      if (player) {
        setPlayerId(player.id);
      }
    };

    getPlayerId();
  }, []);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // 4B-first navigation: Dashboard (4B), Data, Messages, Drills, Profile
  // Dashboard now contains all 4B performance data
  const navItems = [
    { to: '/player', icon: Home, label: 'Dashboard', end: true },
    { to: '/player/data', icon: Database, label: 'My Data', end: false },
    { to: '/player/messages', icon: MessageSquare, label: 'Coach', end: false },
    { to: '/player/drills', icon: Dumbbell, label: 'Drills', end: false },
    { to: '/player/profile', icon: User, label: 'Profile', end: false },
  ];

  // Check if we're on the main dashboard (which has its own bottom nav)
  const isMainDashboard = location.pathname === '/player';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <NavLink to="/player" className="flex items-center gap-2">
              <Logo size="sm" />
              <span className="font-bold text-lg hidden sm:inline">My Swing Lab</span>
            </NavLink>
            <div className="flex items-center gap-2">
              {playerId && <NotificationBell playerId={playerId} />}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* Bottom Navigation (Mobile-First) - Hidden on main dashboard since it has its own */}
      {!isMainDashboard && (
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t md:hidden z-50">
          <div className="flex items-center justify-around py-2">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex fixed left-0 top-[57px] bottom-0 w-56 bg-muted/30 border-r flex-col p-4 gap-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
