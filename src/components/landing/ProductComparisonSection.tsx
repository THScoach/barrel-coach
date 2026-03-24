import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Video, Target, ClipboardList, TrendingUp, Building2, Microscope, Zap, Star, Clock, Brain, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  title: string;
  price: string;
  priceLabel: string;
  annualNote?: string;
  headline: string;
  description: string;
  features: { icon: React.ReactNode; text: string }[];
  timing: string;
  cta: string;
  ctaLink: string;
  bottomLabel: string;
  bottomLabelColor: string;
  isPopular?: boolean;
  variant: 'default' | 'popular' | 'premium';
  isExternal?: boolean;
}

function ProductCard({ 
  title, price, priceLabel, annualNote, headline, description, features, timing, cta, ctaLink, 
  bottomLabel, bottomLabelColor, isPopular, variant, isExternal
}: ProductCardProps) {
  return (
    <div 
      className={cn(
        "relative rounded-lg p-6 flex flex-col h-full transition-all duration-300",
        variant === 'popular' && "bg-white border-2 border-[#DC2626] shadow-xl md:-translate-y-3",
        variant === 'default' && "bg-gray-50 shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        variant === 'premium' && "bg-gray-50 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      )}
    >
      {isPopular && (
        <div className="absolute -top-3 right-4 bg-[#DC2626] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
          <Star className="w-3 h-3 fill-current" />
          MOST POPULAR
        </div>
      )}

      <div className="text-center mb-4">
        <div className="text-4xl font-black text-[#1E3A8A]">{price}</div>
        <div className="text-sm text-muted-foreground">{priceLabel}</div>
        {annualNote && <div className="text-xs text-muted-foreground mt-1">{annualNote}</div>}
      </div>

      <h3 className="text-lg font-bold text-[#1E3A8A] text-center mb-2 uppercase tracking-wide">
        {title}
      </h3>
      <p className="text-xs text-center text-muted-foreground mb-4 font-medium">{headline}</p>

      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{description}</p>

      <ul className="space-y-3 flex-1 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="text-[#1E3A8A] flex-shrink-0 mt-0.5">{feature.icon}</span>
            <span className="text-foreground">{feature.text}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
        <Clock className="w-4 h-4" />
        <span>{timing}</span>
      </div>

      <Button 
        asChild 
        className={cn(
          "w-full font-bold",
          variant === 'popular' 
            ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white" 
            : "bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white"
        )}
        size="lg"
      >
        {isExternal ? (
          <a href={ctaLink}>{cta}</a>
        ) : (
          <Link to={ctaLink}>{cta}</Link>
        )}
      </Button>

      <p className="text-center text-xs italic mt-4" style={{ color: bottomLabelColor }}>
        {bottomLabel}
      </p>
    </div>
  );
}

export function ProductComparisonSection() {
  const products: ProductCardProps[] = [
    {
      title: "The Barrels App",
      price: "$47",
      priceLabel: "/month",
      annualNote: "$397/year (save $167)",
      headline: "The System. No Guesswork.",
      description: "Record your swing on your phone. Our system processes it into biomechanics data automatically and scores it across four pillars. No more guessing what to work on.",
      features: [
        { icon: <Video className="w-4 h-4" />, text: "Just video. No sensors." },
        { icon: <BarChart3 className="w-4 h-4" />, text: "4-Pillar Swing Scoring on every upload" },
        { icon: <Brain className="w-4 h-4" />, text: "Energy Archetype Classification" },
        { icon: <ClipboardList className="w-4 h-4" />, text: "AI Drill Prescriptions based on motor profile" },
      ],
      timing: "Self-guided training",
      cta: "START TRAINING →",
      ctaLink: "/pricing",
      bottomLabel: "Pro-level truth about your swing, delivered instantly.",
      bottomLabelColor: "#6B7280",
      variant: 'default'
    },
    {
      title: "The Pro Academy",
      price: "$149",
      priceLabel: "/month",
      annualNote: "$1,297/year (save $491)",
      headline: "Data + Coaching. The Combination That Develops Hitters.",
      description: "The App tells you what's wrong. The Academy tells you how to fix it — with a real coach in the room, every week.",
      features: [
        { icon: <Zap className="w-4 h-4" />, text: "Everything in Barrels App" },
        { icon: <Building2 className="w-4 h-4" />, text: "Weekly Live Film Room with Coach Rick" },
        { icon: <Microscope className="w-4 h-4" />, text: "Monthly Biomechanics Deep Dive" },
        { icon: <TrendingUp className="w-4 h-4" />, text: "48-Hour Priority Reports" },
        { icon: <ClipboardList className="w-4 h-4" />, text: "The Barrels Playbook — monthly breakdown" },
      ],
      timing: "Weekly coaching access",
      cta: "JOIN THE ACADEMY →",
      ctaLink: "/pricing",
      bottomLabel: "One private lesson costs $150–$200. This is weekly access.",
      bottomLabelColor: "#6B7280",
      isPopular: true,
      variant: 'popular'
    },
    {
      title: "Big League Blueprint",
      price: "$750",
      priceLabel: "/month",
      annualNote: "$1,997 for 3-month block",
      headline: "For the Player Serious About the Next Level.",
      description: "Direct, personalized access to Coach Strickland. Not a program — a partnership. Capped at 15 players.",
      features: [
        { icon: <Zap className="w-4 h-4" />, text: "Everything in Pro Academy" },
        { icon: <Video className="w-4 h-4" />, text: "Bi-weekly 1:1 Zoom with Coach Rick" },
        { icon: <Target className="w-4 h-4" />, text: "Priority WhatsApp/Text Access" },
        { icon: <ClipboardList className="w-4 h-4" />, text: "Custom Advance Scouting & Attack Plans" },
      ],
      timing: "Capped at 15 players",
      cta: "APPLY NOW →",
      ctaLink: "mailto:rick@catchingbarrels.io?subject=Big League Blueprint Application",
      bottomLabel: "Application only. Not everyone is accepted.",
      bottomLabelColor: "#DC2626",
      variant: 'premium',
      isExternal: true,
    }
  ];

  return (
    <section className="py-20 bg-surface">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-black text-center mb-12 uppercase text-[#1E3A8A]">
          Pick Your Path
        </h2>

        <div className="max-w-5xl mx-auto mb-10">
          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {products.map((product, i) => (
              <ProductCard key={i} {...product} />
            ))}
          </div>
        </div>

        {/* Free Audit Banner */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#1E3A8A] text-white rounded-lg px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6" />
              <div>
                <span className="font-semibold">Not sure where to start?</span>
                <span className="mx-2">|</span>
                <span className="font-bold">FREE SWING FLAW AUDIT</span>
              </div>
            </div>
            <Button 
              asChild 
              variant="outline" 
              className="bg-white text-[#1E3A8A] border-white hover:bg-gray-100 font-bold"
            >
              <Link to="/diagnostic">GET FREE AUDIT →</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
