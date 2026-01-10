import { Link } from 'react-router-dom';
import { Check, X, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Single Swing Score™',
    price: 37,
    period: 'one-time',
    description: 'Perfect for a quick diagnosis',
    featured: false,
    features: [
      { text: '1 swing analyzed', included: true },
      { text: '4B Score Card', included: true },
      { text: 'Your #1 problem identified', included: true },
      { text: '1 drill prescription', included: true },
      { text: 'PDF report emailed', included: true },
      { text: 'Consistency analysis', included: false },
      { text: 'Age comparison', included: false },
      { text: '30-day improvement plan', included: false },
    ],
    cta: 'Get Single Swing Score',
    ctaLink: '/analyze?product=single',
  },
  {
    name: 'Complete Swing Review™',
    price: 97,
    period: 'one-time',
    description: 'The full diagnostic experience',
    featured: true,
    features: [
      { text: '5 swings analyzed', included: true },
      { text: '4B Score Card', included: true },
      { text: 'Your #1 problem identified', included: true },
      { text: 'Multiple drill prescriptions', included: true },
      { text: 'PDF report emailed', included: true },
      { text: 'Consistency analysis', included: true },
      { text: 'Age comparison percentile', included: true },
      { text: '30-day improvement plan', included: true },
    ],
    cta: 'Get Complete Review',
    ctaLink: '/analyze?product=complete',
  },
  {
    name: 'In-Person Assessment',
    price: 299,
    period: 'session',
    description: 'Train with Rick directly',
    featured: false,
    features: [
      { text: 'Full 4B assessment in person', included: true },
      { text: 'Live video analysis', included: true },
      { text: 'Hands-on drill instruction', included: true },
      { text: 'Personalized training plan', included: true },
      { text: 'Follow-up video review', included: true },
      { text: 'Direct communication with Rick', included: true },
      { text: '30-day support', included: true },
      { text: 'Priority scheduling', included: true },
    ],
    cta: 'Book Assessment',
    ctaLink: '/assessment',
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
            CHOOSE YOUR ANALYSIS
          </h2>
          <p className="text-xl text-gray-400">
            All plans include a 24-hour money-back guarantee
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`
                relative rounded-3xl p-8 text-center transition-all hover:-translate-y-2
                ${plan.featured 
                  ? 'bg-gradient-to-b from-navy-800 to-navy-800/50 border-2 border-accent' 
                  : 'bg-navy-800 border-2 border-transparent'
                }
              `}
            >
              {plan.featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" fill="currentColor" />
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
              <div className="text-5xl font-bold text-white mb-2">
                ${plan.price}
              </div>
              <p className="text-gray-500 mb-8">{plan.period}</p>

              <ul className="text-left space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li 
                    key={i} 
                    className={`flex items-center gap-3 py-2 border-b border-navy-700 ${
                      feature.included ? 'text-gray-300' : 'text-gray-600 opacity-50'
                    }`}
                  >
                    {feature.included ? (
                      <Check className="w-5 h-5 text-success flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-gray-600 flex-shrink-0" />
                    )}
                    {feature.text}
                  </li>
                ))}
              </ul>

              <Button 
                asChild 
                variant={plan.featured ? 'hero' : 'secondary'}
                size="lg"
                className="w-full"
              >
                <Link to={plan.ctaLink}>
                  {plan.featured && <Zap className="w-4 h-4 mr-2" />}
                  {plan.cta}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
