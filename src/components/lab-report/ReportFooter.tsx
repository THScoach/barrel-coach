/**
 * Lab Report Footer - Branding and philosophy
 */

import { Card, CardContent } from '@/components/ui/card';

export function ReportFooter() {
  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
      
      <CardContent className="py-6 px-5 text-center space-y-4">
        <blockquote className="text-lg italic text-slate-300">
          "We don't change, we unlock."
        </blockquote>
        
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Your body has a Kinetic Fingerprint — a unique way it generates and transfers power. 
          We measured it. Now we unlock it.
        </p>
        
        <div className="pt-4 border-t border-slate-800">
          <div className="text-lg font-bold text-red-500">CATCHING BARRELS</div>
          <div className="text-sm text-slate-400">Coach Rick Strickland</div>
          <div className="text-xs text-slate-600 mt-1">catchingbarrels.io</div>
        </div>
        
        <div className="text-xs text-slate-600">
          Lab Report v2.0 • Kinetic Fingerprint Analysis
        </div>
      </CardContent>
    </Card>
  );
}
