import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Get Analyzed', href: '/analyze' },
  { name: 'Video Vault', href: '/library' },
  { name: 'About Rick', href: '/about' },
  { name: 'Inner Circle', href: '/inner-circle' },
];

interface HeaderProps {
  showLogin?: boolean;
}

export function Header({ showLogin = true }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Logo size="md" />
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`text-sm font-medium transition-colors hover:text-accent ${
                location.pathname === item.href 
                  ? 'text-accent' 
                  : 'text-muted-foreground'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {showLogin && (
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link to="/login">Login</Link>
            </Button>
          )}
          
          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container py-4 flex flex-col gap-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`py-2 text-sm font-medium transition-colors hover:text-accent ${
                  location.pathname === item.href 
                    ? 'text-accent' 
                    : 'text-muted-foreground'
                }`}
              >
                {item.name}
              </Link>
            ))}
            {showLogin && (
              <Button asChild variant="ghost" size="sm" className="justify-start mt-2">
                <Link to="/login">Login</Link>
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
