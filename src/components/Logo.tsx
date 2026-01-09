import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';

interface LogoProps {
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  linkTo?: string;
}

export function Logo({ showTagline = false, size = 'md', linkTo = '/' }: LogoProps) {
  const sizeClasses = {
    sm: {
      icon: 'w-6 h-6',
      name: 'text-lg',
      tagline: 'text-[10px]',
    },
    md: {
      icon: 'w-8 h-8',
      name: 'text-xl',
      tagline: 'text-xs',
    },
    lg: {
      icon: 'w-12 h-12',
      name: 'text-3xl',
      tagline: 'text-sm',
    },
  };

  const logoContent = (
    <div className="flex items-center gap-2">
      {/* Brain Icon */}
      <div className="relative">
        <Brain className={`${sizeClasses[size].icon} text-accent`} strokeWidth={2.5} />
      </div>
      
      {/* Text */}
      <div className="flex flex-col">
        <span className={`${sizeClasses[size].name} font-bold tracking-tight leading-none`}>
          CATCHING <span className="text-accent">BARRELS</span>
        </span>
        {showTagline && (
          <span className={`${sizeClasses[size].tagline} text-muted-foreground tracking-wide`}>
            Unlock Your Swing DNA
          </span>
        )}
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="flex items-center hover:opacity-90 transition-opacity">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}
