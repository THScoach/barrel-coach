import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Video, Target, ClipboardList, Dna, Clock, Building2, Microscope, User, Zap, PlayCircle, TrendingUp } from 'lucide-react';

const products = [
  {
    name: 'Single Swing Score',
    price: '$37',
    priceSubtext: 'Per swing',
    features: [
      { icon: Video, text: '1 swing analyzed' },
      { icon: Target, text: '#1 problem identified' },
      { icon: ClipboardList, text: '1 drill to fix it' },
      { icon: Dna, text: '4B Score Card' },
    ],
    timing: 'Under 48 hours',
    cta: 'GET MY SWING SCORE →',
    ctaVariant: 'default' as const,
    ctaLink: '/analyze',
    label: 'Quick Fix Solution',
    labelColor: 'text-muted-foreground',
    elevated: false,
    badge: null,
  },
  {
    name: 'Complete Review',
    price: '$67',
    priceSubtext: 'Complete analysis',
    features: [
      { icon: Video, text: '5 swings analyzed' },
      { icon: Dna, text: 'Full 4B breakdown' },
      { icon: ClipboardList, text: '30-day drill plan' },
      { icon: PlayCircle, text: 'Video library access' },
      { icon: TrendingUp, text: 'Progress tracking' },
    ],
    timing: 'Under 48 hours',
    cta: 'GET COMPLETE REVIEW →',
    ctaVariant: 'hero' as const,
    ctaLink: '/analyze',
    label: 'Full Analysis Program',
    labelColor: 'text-accent',
    elevated: true,
    badge: '⭐ MOST POPULAR',
  },
  {
    name: 'In-Person Assessment',
    price: '$299',
    priceSubtext: 'Full session',
    features: [
      { icon: Building2, text: 'Full biomechanical assessment' },
      { icon: Microscope, text: 'All technology included' },
      { icon: User, text: 'Live coaching with Rick' },
      { icon: ClipboardList, text: 'Custom program' },
      { icon: Zap, text: 'Same-day results' },
    ],
    timing: 'Same day',
    cta: 'BOOK SESSION →',
    ctaVariant: 'default' as const,
    ctaLink: '/assessment',
    label: 'Elite Athlete Program',
    labelColor: 'text-warning',
    elevated: false,
    badge: null,
  },
];

export function ProductComparisonSection() {
  return (
    <section className="py-20 bg-surface">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 uppercase">
          Choose Your Analysis
        </h2>

        {/* Product Cards */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-end mb-12">
          {products.map((product) => (
            <div
              key={product.name}
              className={`
                relative rounded-lg p-6 transition-all duration-300
                ${product.elevated 
                  ? 'bg-card shadow-[0_4px_20px_rgba(0,0,0,0.12)] border-2 border-accent md:-mt-4 md:pb-8' 
                  : 'bg-muted/50 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                }
              `}
            >
              {/* Badge */}
              {product.badge && (
                <div className="absolute -top-3 right-4">
                  <span className="inline-block bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
                    {product.badge}
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-[hsl(222,47%,11%)]">{product.price}</div>
                <div className="text-sm text-muted-foreground">{product.priceSubtext}</div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {product.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-3 text-sm">
                    <feature.icon className="w-5 h-5 text-accent flex-shrink-0" strokeWidth={2} />
                    <span className="text-foreground/80">{feature.text}</span>
                  </li>
                ))}
              </ul>

              {/* Timing */}
              <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{product.timing}</span>
              </div>

              {/* CTA Button */}
              <Button 
                asChild 
                variant={product.ctaVariant}
                className={`w-full ${product.ctaVariant === 'default' ? 'bg-[hsl(222,47%,11%)] hover:bg-[hsl(222,47%,18%)] text-white' : ''}`}
              >
                <Link to={product.ctaLink}>{product.cta}</Link>
              </Button>

              {/* Label */}
              <p className={`text-center text-xs italic mt-4 ${product.labelColor}`}>
                {product.label}
              </p>
            </div>
          ))}
        </div>

        {/* Inner Circle Banner */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-accent rounded-lg p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-white">
              <span className="text-xl">🔥</span>
              <div>
                <span className="font-bold">Want Ongoing Coaching?</span>
                <span className="hidden md:inline"> INNER CIRCLE: $297/month</span>
                <span className="md:hidden block text-sm opacity-90">INNER CIRCLE: $297/month</span>
              </div>
            </div>
            <Button asChild variant="secondary" size="sm" className="whitespace-nowrap">
              <Link to="/inner-circle">JOIN NOW →</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
