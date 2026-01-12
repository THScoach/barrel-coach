import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LogOut, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminHeader() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const navLinks = [
    { to: "/admin", label: "Dashboard" },
    { to: "/admin/players", label: "Players" },
    { to: "/admin/library", label: "Library" },
    { to: "/admin/videos", label: "Videos" },
  ];

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/95 backdrop-blur-lg supports-[backdrop-filter]:bg-slate-900/80">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo size="md" />
          
          {/* Desktop Nav - hidden on mobile */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] flex items-center",
                  isActive(link.to)
                    ? "bg-gradient-to-r from-red-600/90 to-orange-500/90 text-white shadow-lg shadow-red-900/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* New Session - always visible */}
          <Link to="/admin/new-session">
            <Button 
              size="sm" 
              className="gap-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-semibold min-h-[44px] px-4 shadow-lg shadow-red-900/30"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Session</span>
            </Button>
          </Link>
          
          {/* User info - hidden on small screens */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <User className="h-4 w-4" />
            <span className="max-w-[120px] truncate">{user?.email}</span>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/50 min-h-[44px]"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}