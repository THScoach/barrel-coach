import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LogOut, User, Plus, BookOpen, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerPickerModal } from "@/components/admin/PlayerPickerModal";

export function AdminHeader() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  // Removed "Videos" from nav - now lives inside Library
  const navLinks = [
    { to: "/admin", label: "Dashboard" },
    { to: "/admin/players", label: "Players" },
    { to: "/admin/validation-queue", label: "Validation" },
    { to: "/admin/invites", label: "Invites" },
    { to: "/admin/library", label: "Library" },
    { to: "/admin/vault", label: "Vault", icon: BookOpen },
    { to: "/admin/clawdbot", label: "ClawdBot", icon: Bot },
    { to: "/admin/knowledge-base", label: "KB", icon: BookOpen },
  ];

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900 backdrop-blur-lg supports-[backdrop-filter]:bg-slate-900/98">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/admin" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <Logo size="md" />
            <span className="hidden md:inline font-bold text-slate-50 text-lg tracking-tight">Rick Lab</span>
          </Link>
          
          {/* Desktop Nav - high contrast text */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] flex items-center gap-1.5",
                  isActive(link.to)
                    ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-900/30"
                    : "text-slate-200 hover:text-white hover:bg-slate-800"
                )}
              >
                {link.icon && <link.icon className="w-4 h-4" />}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* New Session - opens player picker first */}
          <Button 
            size="sm" 
            onClick={() => setShowPlayerPicker(true)}
            className="gap-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-semibold min-h-[44px] px-4 shadow-lg shadow-red-900/30"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Session</span>
          </Button>
          
          {/* User info - cleaner, moved to dropdown on mobile */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-slate-300 px-3 py-2 bg-slate-800/70 rounded-lg border border-slate-700">
            <User className="h-4 w-4 text-slate-400" />
            <span className="max-w-[120px] truncate font-medium">{user?.email}</span>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 min-h-[44px]"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
      
      {/* Player Picker Modal for New Session */}
      <PlayerPickerModal 
        open={showPlayerPicker} 
        onOpenChange={setShowPlayerPicker} 
      />
    </header>
  );
}