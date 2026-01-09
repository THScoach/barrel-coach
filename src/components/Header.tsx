import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  showLogin?: boolean;
}

export function Header({ showLogin = true }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/analyze" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">
            CATCHING <span className="text-accent">BARRELS</span>
          </span>
        </Link>
        
        {showLogin && (
          <Button variant="ghost" size="sm">
            Login
          </Button>
        )}
      </div>
    </header>
  );
}
