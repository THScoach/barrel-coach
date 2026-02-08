import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { Mail, Twitter, Instagram } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800/50">
      <div className="container py-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          {/* Logo & Tagline */}
          <div>
            <Logo size="sm" linkTo="/" />
            <p className="text-slate-400 mt-3 text-sm">Stop guessing. Start catching barrels.</p>
            <div className="flex gap-3 mt-4">
              <a
                href="https://twitter.com/swingrehab"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-700 transition-all"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com/theswingrehabcoach"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-700 transition-all"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="mailto:swingrehabcoach@gmail.com"
                className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-700 transition-all"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-3 text-sm">Contact</h4>
            <a href="mailto:swingrehabcoach@gmail.com" className="text-slate-400 hover:text-red-500 transition-colors text-sm">
              swingrehabcoach@gmail.com
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} Catching Barrels. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link to="/terms" className="hover:text-red-500 transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-red-500 transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
