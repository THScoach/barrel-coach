import { Link } from 'react-router-dom';
import { Check, Zap, Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const tiers = [
  {
    name: 'The Barrels App',
    price: '$47',
    period: '/month',
    annual: '$397/year (save $167)',
    tagline: 'The System. No Guesswork.',
    label: 'Self-Guided',
    labelColor: 'text-slate-400',
    borderColor: 'border-slate-700',
    checkColor: 'text-teal-400',
    features: [
      'Just video. No sensors.',
      '4-Pillar Swing Scoring on every upload',
      'Energy Archetype Classification',
      'AI Drill Prescriptions',
      'PCE Model — predicted bat speed & exit velo',
      '24/7 Coach Barrels AI',
    ],
    cta: 'Start Training',
    ctaLink: '/pricing',
    ctaStyle: 'bg-slate-700 hover:bg-slate-600',
  },
  {
    name: 'The Pro Academy',
    price: '$149',
    period: '/month',
    annual: '$1,297/year (save $491)',
    tagline: 'Data + Coaching. The combination that develops hitters.',
    label: 'Most Popular',
    labelColor: 'text-red-400',
    borderColor: 'border-red-500/50',
    checkColor: 'text-red-400',
    featured: true,
    features: [
      'Everything in Barrels App',
      'Weekly Live Film Room with Coach Rick',
      'Monthly Biomechanics Deep Dive',
      '48-Hour Priority Reports',
      'Advanced Session Tracking',
      'The Barrels Playbook — monthly breakdown',
    ],
    cta: 'Join The Academy',
    ctaLink: '/pricing',
    ctaStyle: 'bg-red-600 hover:bg-red-700',
    valueAnchor: 'One private lesson costs $150–$200. This is weekly access.',
  },
  {
    name: 'Big League Blueprint',
    price: '$750',
    period: '/month',
    annual: '$1,997 for 3-month block',
    tagline: 'Direct 1:1 access to Coach Strickland.',
    label: 'Application Only',
    labelColor: 'text-amber-400',
    borderColor: 'border-amber-500/40',
    checkColor: 'text-amber-400',
    features: [
      'Everything in Pro Academy',
      'Bi-weekly 1:1 Zoom (45 min each)',
      'Priority WhatsApp/Text Access',
      'Custom Advance Scouting',
      'Unlimited biomechanics reports',
      'Quarterly Recruitment Strategy',
    ],
    cta: 'Apply Now',
    ctaLink: 'mailto:rick@catchingbarrels.io?subject=Big League Blueprint Application',
    ctaStyle: 'bg-amber-600 hover:bg-amber-700',
    note: 'Capped at 15 players',
    isExternal: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="bg-primary py-20 sm:py-24">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="inline-block bg-accent text-white text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            PICK YOUR PATH
          </h2>
          <p className="text-lg sm:text-xl text-gray-400 max-w-xl mx-auto">
            Start with a free audit. Go deeper when you're ready.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-3 gap-5 sm:gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`
                relative rounded-2xl p-6 flex flex-col transition-all hover:-translate-y-1
                bg-slate-900/80 border-2 ${tier.borderColor}
                ${tier.featured ? 'ring-2 ring-red-500/30 md:-translate-y-2' : ''}
              `}
            >
              {tier.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <div className="mb-4">
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${tier.labelColor}`}>
                  {tier.label}
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{tier.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">{tier.price}</span>
                  <span className="text-sm text-slate-400">{tier.period}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{tier.annual}</p>
              </div>

              <p className="text-gray-400 text-sm mb-4">{tier.tagline}</p>

              <ul className="text-left space-y-2 mb-5 flex-grow">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${tier.checkColor}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {tier.note && (
                <div className="flex items-center justify-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 text-xs font-semibold">{tier.note}</span>
                </div>
              )}

              {'valueAnchor' in tier && tier.valueAnchor && (
                <p className="text-xs text-slate-400 text-center italic mb-4">{tier.valueAnchor}</p>
              )}

              <Button asChild className={`w-full font-bold ${tier.ctaStyle}`}>
                {tier.isExternal ? (
                  <a href={tier.ctaLink}>{tier.cta}</a>
                ) : (
                  <Link to={tier.ctaLink}>{tier.cta}</Link>
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* Coaches License Teaser */}
        <div className="max-w-5xl mx-auto mt-8">
          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
            <Users className="w-8 h-8 text-slate-400 flex-shrink-0" />
            <div className="flex-grow text-center sm:text-left">
              <h4 className="text-white font-bold">Coaches & Organizations</h4>
              <p className="text-slate-400 text-sm">Starting at $499/mo for up to 10 players. Coach Dashboard, bulk processing, monthly strategy calls.</p>
            </div>
            <Button asChild variant="outline" className="border-slate-600 hover:bg-slate-800 text-white font-bold flex-shrink-0">
              <a href="mailto:rick@catchingbarrels.io?subject=Coaches License Inquiry">Learn More →</a>
            </Button>
          </div>
        </div>

        {/* Ascension */}
        <div className="mt-10 max-w-3xl mx-auto text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-sm">
            <span className="text-teal-400 font-medium">Free Audit</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600 rotate-90 sm:rotate-0" />
            <span className="text-white font-medium">$47 App</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600 rotate-90 sm:rotate-0" />
            <span className="text-red-400 font-medium">$149 Academy</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600 rotate-90 sm:rotate-0" />
            <span className="text-amber-400 font-medium">$750 Blueprint</span>
          </div>
        </div>
      </div>
    </section>
  );
}
