import { Link } from 'react-router-dom';
import { Check, Sparkles, Users, Crown, MapPin, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Kinetic DNA Diagnostic',
    price: 0,
    period: 'Free',
    description: 'Identify your #1 swing leak',
    featured: false,
    icon: Sparkles,
    iconColor: 'text-slate-400',
    borderColor: 'border-slate-700',
    checkColor: 'text-green-400',
    features: [
      { text: 'Upload your swing video', included: true },
      { text: 'Primary leak identified', included: true },
      { text: 'Direction on what to fix', included: true },
      { text: 'Smart Sensor Kit', included: false },
      { text: 'Weekly coaching calls', included: false },
    ],
    cta: 'Get Free Diagnostic',
    ctaLink: '/diagnostic',
    ctaStyle: 'bg-slate-700 hover:bg-slate-600',
  },
  {
    name: 'The Academy',
    price: 99,
    period: 'per month',
    description: 'Weekly coaching. Smart Sensor Kit included.',
    featured: true,
    badge: 'Most Popular',
    icon: Users,
    iconColor: 'text-red-400',
    borderColor: 'border-red-500/50',
    checkColor: 'text-red-400',
    features: [
      { text: 'Free Smart Sensor Kit included', included: true },
      { text: 'Weekly group coaching calls', included: true },
      { text: 'My Swing Lab access', included: true },
      { text: 'Rick AI for instant answers', included: true },
      { text: 'Clear direction — not drill overload', included: true },
    ],
    cta: 'Join The Academy',
    ctaLink: '/pricing',
    ctaStyle: 'bg-red-600 hover:bg-red-700',
  },
  {
    name: 'Private Coaching',
    price: 199,
    period: 'per month',
    description: '1-on-1 with Rick. Limited to 20 players.',
    featured: false,
    badge: 'VIP Access',
    icon: Crown,
    iconColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    checkColor: 'text-yellow-400',
    features: [
      { text: 'Everything in The Academy', included: true },
      { text: '1-on-1 monthly video call with Rick', included: true },
      { text: 'Priority swing reviews', included: true },
      { text: 'Direct text access to Rick', included: true },
      { text: 'Custom training plan', included: true },
    ],
    cta: 'Apply Now',
    ctaLink: '/pricing',
    ctaStyle: 'bg-yellow-600 hover:bg-yellow-700',
    note: 'Limited to 20 players',
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="bg-primary py-24">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block bg-accent text-white text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4">
            Pricing
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            PICK YOUR PATH
          </h2>
          <p className="text-xl text-gray-400">
            Start free. Go deeper when you're ready.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const IconComponent = plan.icon;
            return (
              <div
                key={plan.name}
                className={`
                  relative rounded-2xl p-6 text-center transition-all hover:-translate-y-2 flex flex-col
                  bg-slate-900/80 border-2 ${plan.borderColor}
                  ${plan.featured ? 'ring-2 ring-red-500/50' : ''}
                `}
              >
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${plan.featured ? 'bg-red-600' : 'bg-yellow-600'} text-white text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full`}>
                    {plan.badge}
                  </div>
                )}

                <div className="mb-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full mb-3`}>
                    <IconComponent className={`w-4 h-4 ${plan.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold text-white mb-1">
                    {plan.price === 0 ? 'FREE' : `$${plan.price}`}
                    {plan.period === 'per month' && <span className="text-lg text-slate-400">/mo</span>}
                  </div>
                  {plan.period !== 'per month' && plan.period !== 'Free' && (
                    <p className="text-gray-500 text-sm">{plan.period}</p>
                  )}
                </div>

                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>

                <ul className="text-left space-y-2 mb-4 flex-grow">
                  {plan.features.map((feature, i) => (
                    <li 
                      key={i} 
                      className={`flex items-center gap-2 text-sm ${
                        feature.included ? 'text-gray-300' : 'text-gray-600 opacity-50'
                      }`}
                    >
                      <Check className={`w-4 h-4 flex-shrink-0 ${feature.included ? plan.checkColor : 'text-gray-600'}`} />
                      {feature.text}
                    </li>
                  ))}
                </ul>

                {plan.note && (
                  <p className="text-xs text-gray-500 mb-4 border-t border-slate-800 pt-4">{plan.note}</p>
                )}

                <Button asChild className={`w-full font-bold ${plan.ctaStyle}`}>
                  <Link to={plan.ctaLink}>{plan.cta}</Link>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Additional Options Row */}
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mt-8">
          {/* In-Person Session */}
          <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <div className="flex-grow">
              <div className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">Limited Availability</div>
              <h3 className="text-lg font-bold text-white mb-1">In-Person Swing Session</h3>
              <div className="text-2xl font-black text-white mb-2">$399</div>
              <ul className="space-y-1 text-sm text-slate-300 mb-3">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  1 in-person swing session
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  High-speed video + breakdown
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  Clear correction priorities
                </li>
              </ul>
              <p className="text-xs text-amber-400/80 mb-4">
                Available seasonally (October–February) or limited dates during spring training.
              </p>
              <Button asChild variant="outline" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
                <a href="mailto:rick@catchingbarrels.io?subject=In-Person Session Request">Request In-Person Session</a>
              </Button>
            </div>
          </div>

          {/* 90-Day Transformation Program */}
          <div className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-purple-400 font-bold text-xs uppercase tracking-wider">Off-Season</span>
                  <span className="text-xs font-bold text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">October–February</span>
                </div>
                <h3 className="text-lg font-bold text-white">The 90-Day Swing Transformation</h3>
                <p className="text-sm text-slate-400 mt-1">This is where swings actually change.</p>
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-2xl font-black text-white">$1,299</span>
              <span className="text-slate-400 text-sm">· 90 Days</span>
            </div>

            <ul className="space-y-1 text-sm text-slate-300 mb-3">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                90-day structured swing rebuild
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                Multiple swing reviews + checkpoints
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                Clear correction priorities
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                Direct accountability, not endless options
              </li>
            </ul>

            <p className="text-xs text-purple-400/80 mb-4">
              Limited enrollment. Application required.
            </p>

            <Button asChild variant="outline" className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10 mb-2">
              <a href="mailto:rick@catchingbarrels.io?subject=90-Day Transformation Application">Apply for the Transformation Program</a>
            </Button>

            <p className="text-xs text-slate-600 text-center">
              Month-to-month? Start with The Academy. Want a rebuild? This is the path.
            </p>
          </div>
        </div>

        {/* Ascension Logic */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"What's wrong?"</div>
              <div className="text-white font-bold">Free Diagnostic</div>
            </div>
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"I want real coaching"</div>
              <div className="text-white font-bold">$99/mo Academy</div>
            </div>
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"I want Rick 1-on-1"</div>
              <div className="text-white font-bold">$199/mo Private</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
