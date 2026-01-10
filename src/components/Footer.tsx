import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { Mail, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800/50">
      <div className="container py-16">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Logo & Tagline */}
          <div className="md:col-span-1">
            <Logo size="sm" linkTo="/" />
            <p className="text-slate-400 mt-4 text-sm">Unlock Your Swing DNA</p>
            <div className="flex gap-3 mt-6">
              <a 
                href="https://twitter.com/catchingbarrels" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-700 transition-all"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a 
                href="mailto:support@catchingbarrels.com" 
                className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-700 transition-all"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-semibold text-white mb-4">Products</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/analyze" className="text-slate-400 hover:text-red-500 transition-colors text-sm">Single Swing Score™</Link>
              </li>
              <li>
                <Link to="/analyze" className="text-slate-400 hover:text-red-500 transition-colors text-sm">Complete Review</Link>
              </li>
              <li>
                <Link to="/inner-circle" className="text-slate-400 hover:text-red-500 transition-colors text-sm">Inner Circle</Link>
              </li>
              <li>
                <Link to="/assessment" className="text-slate-400 hover:text-red-500 transition-colors text-sm">In-Person Assessment</Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/about" className="text-slate-400 hover:text-red-500 transition-colors text-sm">About Rick</Link>
              </li>
              <li>
                <Link to="/library" className="text-slate-400 hover:text-red-500 transition-colors text-sm">Video Vault</Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-3">
              <li>
                <a href="mailto:support@catchingbarrels.com" className="text-slate-400 hover:text-red-500 transition-colors text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4" /> support@catchingbarrels.com
                </a>
              </li>
              <li>
                <a 
                  href="https://twitter.com/catchingbarrels" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-red-500 transition-colors text-sm flex items-center gap-2"
                >
                  <Twitter className="w-4 h-4" /> @catchingbarrels
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">© 2025 Catching Barrels. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-red-500 transition-colors">Terms</a>
            <a href="#" className="hover:text-red-500 transition-colors">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
