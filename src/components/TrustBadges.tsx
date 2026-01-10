import { Shield, CreditCard, Target, GraduationCap, Users, RefreshCcw } from "lucide-react";

const stats = [
  { icon: Target, value: '1,000+', label: 'Swings Analyzed' },
  { icon: GraduationCap, value: '400+', label: 'College Commits' },
  { icon: Users, value: '78+', label: 'Professional Players' },
];

export function TrustBadges() {
  return (
    <section className="py-12 bg-surface border-t border-border">
      <div className="container">
        {/* Stats Row */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <stat.icon className="h-5 w-5 text-accent" />
                <span className="text-2xl md:text-3xl font-bold">{stat.value}</span>
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {/* Money-Back Guarantee */}
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2">
            <RefreshCcw className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              30-Day Money-Back Guarantee
            </span>
          </div>

          {/* Secure Payment */}
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
              Secure Payment
            </span>
            <svg viewBox="0 0 60 25" className="h-5 w-auto" aria-label="Powered by Stripe">
              <path 
                fill="currentColor" 
                className="text-blue-600"
                d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.02 1.04-.06 1.48zm-6.3-5.93c-1.25 0-2.17.92-2.29 2.66h4.47c-.06-1.67-.82-2.66-2.18-2.66zM41.64 20.6c-2.02 0-3.55-.73-4.33-1.47v5.86l-4.22.88V5.57h3.63l.25 1.36c.98-1.08 2.52-1.67 4.32-1.67 3.59 0 5.87 3.34 5.87 7.5 0 4.6-2.57 7.84-5.52 7.84zm-.77-11.6c-1.13 0-2.1.54-2.78 1.3v5.57c.58.58 1.48 1.06 2.52 1.06 1.87 0 3.07-1.87 3.07-4.02 0-2.33-1.14-3.91-2.81-3.91zM28.33 4.66c0-1.38 1.11-2.5 2.5-2.5s2.5 1.12 2.5 2.5a2.5 2.5 0 0 1-5 0zm.27.91h4.22v15.03h-4.22V5.57zM19.7 5.3v.29h2.6v3.59h-2.59v11.42h-4.23V9.18h-1.69V5.7l1.69-.11V4.67c0-3.03 1.86-4.65 5.24-4.65.96 0 1.69.11 2.18.22v3.49c-.33-.06-.73-.11-1.19-.11-1.27 0-2.01.58-2.01 1.68zM8.24 20.29c-2.23 0-3.68-.91-3.68-3.34V9.18H2.61V5.7l2.16-.11.31-3.28h3.7v3.26h3.28v3.61h-3.28v7.19c0 .86.48 1.2 1.27 1.2.4 0 .93-.11 1.27-.26v3.32c-.58.27-1.58.46-3.08.46z"
              />
            </svg>
          </div>

          {/* SSL Encrypted */}
          <div className="inline-flex items-center gap-2 bg-muted/50 border border-border rounded-full px-4 py-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              SSL Encrypted
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}