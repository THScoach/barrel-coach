import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LogOut, User } from "lucide-react";

export function AdminHeader() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo size="md" />
          
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <Link to="/admin/videos" className="text-muted-foreground hover:text-foreground transition-colors">
              Videos
            </Link>
            <Link to="/admin/analyzer" className="text-muted-foreground hover:text-foreground transition-colors">
              Analyzer
            </Link>
            <Link to="/admin/messages" className="text-muted-foreground hover:text-foreground transition-colors">
              Messages
            </Link>
            <Link to="/admin/sms" className="text-muted-foreground hover:text-foreground transition-colors">
              SMS
            </Link>
            <Link to="/admin/import-kommodo" className="text-muted-foreground hover:text-foreground transition-colors">
              Import
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{user?.email}</span>
          </div>
          
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
