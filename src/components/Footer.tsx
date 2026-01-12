import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { Mail, Twitter, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800/50">
      {/* CTA Bar */}
      <div className="bg-slate-900/50 border-b border-slate-800/50">
        <div className="container py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-white font-semibold">Ready to stop guessing?</p>
              <p className="text-slate-400 text-sm">Start with the Free Diagnostic.</p>
            </div>
            <Button asChild className="bg-red-600 hover:bg-red-700 text-white font-bold">
              <Link to="/diagnostic">
                Start with the Free Diagnostic
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-16">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Logo & Tagline */}
          <div className="md:col-span-1">
            <Logo size="sm" linkTo="/" />
            <p className="text-slate-400 mt-4 text-sm">Stop guessing. Start catching barrels.</p>
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
                href="mailto:rick@catchingbarrels.com" 
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
                <Link to="/diagnostic" className="text-slate-400 hover:text-red-500 transition-colors text-sm">Free Diagnostic — $0</Link>
              </li>
              <li>
                <Link to="/live" className="text-slate-400 hover:text-red-500 transition-colors text-sm">Catching Barrels Live — $99/mo</Link>
              </li>
              <li>
                <Link to="/apply?tier=group" className="text-slate-400 hover:text-red-500 transition-colors text-sm">90-Day Small Group — $1,299</Link>
              </li>
              <li>
                <Link to="/apply?tier=1on1" className="text-slate-400 hover:text-red-500 transition-colors text-sm">1-on-1 Coaching — $2,997</Link>
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
                <Link to="/pricing" className="text-slate-400 hover:text-red-500 transition-colors text-sm">Pricing</Link>
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
                <a href="mailto:rick@catchingbarrels.com" className="text-slate-400 hover:text-red-500 transition-colors text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4" /> rick@catchingbarrels.com
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
