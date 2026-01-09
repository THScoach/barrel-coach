import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Logo & Tagline */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Logo size="sm" linkTo="/" />
            </div>
            <p className="text-sm text-primary-foreground/70">
              Unlock Your Swing DNA
            </p>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-semibold mb-4">Products</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li>
                <Link to="/analyze" className="hover:text-accent transition-colors">
                  Single Swing Score™
                </Link>
              </li>
              <li>
                <Link to="/analyze" className="hover:text-accent transition-colors">
                  Complete Review
                </Link>
              </li>
              <li>
                <Link to="/inner-circle" className="hover:text-accent transition-colors">
                  Inner Circle
                </Link>
              </li>
              <li>
                <Link to="/assessment" className="hover:text-accent transition-colors">
                  In-Person Assessment
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li>
                <Link to="/about" className="hover:text-accent transition-colors">
                  About Rick
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li>
                <a 
                  href="mailto:support@catchingbarrels.com" 
                  className="hover:text-accent transition-colors"
                >
                  support@catchingbarrels.com
                </a>
              </li>
              <li>
                <a 
                  href="https://twitter.com/catchingbarrels" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  @catchingbarrels
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-primary-foreground/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary-foreground/50">
            © 2025 Catching Barrels. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-primary-foreground/50">
            <a href="#" className="hover:text-accent transition-colors">Terms</a>
            <a href="#" className="hover:text-accent transition-colors">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
