import { Link } from 'react-router-dom';
import { Check, Users, Zap, Crown, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Free Diagnostic',
    price: 0,
    period: 'one-time',
    description: 'Identify your #1 swing leak',
    featured: false,
    icon: MessageCircle,
    iconColor: 'text-slate-400',
    borderColor: 'border-slate-700',
    checkColor: 'text-green-400',
    features: [
      { text: 'One response from Rick\'s system', included: true },
      { text: 'Primary leak identified', included: true },
      { text: 'No credit card required', included: true },
      { text: 'Ongoing coaching', included: false },
      { text: 'Drill prescriptions', included: false },
    ],
    cta: 'Get Free Diagnostic',
    ctaLink: '/analyze',
    ctaStyle: 'bg-slate-700 hover:bg-slate-600',
  },
  {
    name: 'Catching Barrels Live',
    price: 99,
    period: 'per month',
    description: 'Stay sharp, accountable, and learning',
    featured: false,
    icon: Users,
    iconColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    checkColor: 'text-blue-400',
    features: [
      { text: 'Weekly live group call (Monday nights)', included: true },
      { text: 'Group Q&A with Rick', included: true },
      { text: 'Ongoing education', included: true },
      { text: 'Community access', included: true },
      { text: 'Individual transformation', included: false },
    ],
    cta: 'Join Live',
    ctaLink: '/apply?tier=live',
    ctaStyle: 'bg-blue-600 hover:bg-blue-700',
    note: 'Not a transformation program',
  },
  {
    name: '90-Day Small Group',
    price: 1299,
    period: '90-day program',
    description: 'Real change. Max 3 players.',
    featured: true,
    icon: Zap,
    iconColor: 'text-red-400',
    borderColor: 'border-red-500/50',
    checkColor: 'text-red-400',
    features: [
      { text: '90-day structured curriculum', included: true },
      { text: 'Max 3 players per group', included: true },
      { text: 'Group coaching environment', included: true },
      { text: 'Outcome-focused development', included: true },
      { text: 'Direct 1-on-1 access', included: false },
    ],
    cta: 'Apply Now',
    ctaLink: '/apply?tier=group',
    ctaStyle: 'bg-red-600 hover:bg-red-700',
    note: 'Limited seats',
  },
  {
    name: '1-on-1 Coaching',
    price: 2997,
    period: '90-day program',
    description: 'Direct access. Fastest results.',
    featured: false,
    icon: Crown,
    iconColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    checkColor: 'text-yellow-400',
    features: [
      { text: 'Direct access to Rick Strickland', included: true },
      { text: 'Personalized feedback + iteration', included: true },
      { text: '90-day personalized program', included: true },
      { text: 'Fastest results. Highest access.', included: true },
      { text: 'Scarcity-based enrollment', included: true },
    ],
    cta: 'Apply Now',
    ctaLink: '/apply?tier=1on1',
    ctaStyle: 'bg-yellow-500 hover:bg-yellow-600 text-black',
    note: 'Limited availability',
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
            Four ways to work with me. Start free. Go deeper when you're ready.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
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
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full">
                    Core Program
                  </div>
                )}

                <div className="mb-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full mb-3`}>
                    <IconComponent className={`w-4 h-4 ${plan.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold text-white mb-1">
                    ${plan.price.toLocaleString()}
                  </div>
                  <p className="text-gray-500 text-sm">{plan.period}</p>
                </div>

                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>

                <ul className="text-left space-y-2 mb-6 flex-grow">
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

                <Button asChild className={`w-full font-bold ${plan.ctaStyle}`}>
                  <Link to={plan.ctaLink}>{plan.cta}</Link>
                </Button>
                
                {plan.note && (
                  <p className="text-xs text-gray-500 mt-3">{plan.note}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Ascension Logic */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"What's wrong?"</div>
              <div className="text-white font-bold">Free Diagnostic</div>
            </div>
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"Stay sharp"</div>
              <div className="text-white font-bold">$99 Live</div>
            </div>
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"I want change"</div>
              <div className="text-white font-bold">$1,299 Group</div>
            </div>
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"I want Rick"</div>
              <div className="text-white font-bold">$2,997 1-on-1</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}