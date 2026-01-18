import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Video, Target, ClipboardList, Dna, Play, TrendingUp, Building2, Microscope, GraduationCap, Zap, Star, Clock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  title: string;
  price: string;
  priceLabel: string;
  features: { icon: React.ReactNode; text: string }[];
  timing: string;
  cta: string;
  ctaLink: string;
  bottomLabel: string;
  bottomLabelColor: string;
  isPopular?: boolean;
  variant: 'default' | 'popular' | 'premium';
}

function ProductCard({ 
  title, 
  price, 
  priceLabel, 
  features, 
  timing, 
  cta, 
  ctaLink, 
  bottomLabel,
  bottomLabelColor,
  isPopular,
  variant
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
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -top-3 right-4 bg-[#DC2626] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
          <Star className="w-3 h-3 fill-current" />
          MOST POPULAR
        </div>
      )}

      {/* Price */}
      <div className="text-center mb-6">
        <div className="text-4xl font-black text-[#1E3A8A]">{price}</div>
        <div className="text-sm text-muted-foreground">{priceLabel}</div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-[#1E3A8A] text-center mb-4 uppercase tracking-wide">
        {title}
      </h3>

      {/* Features */}
      <ul className="space-y-3 flex-1 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="text-[#1E3A8A] flex-shrink-0 mt-0.5">{feature.icon}</span>
            <span className="text-foreground">{feature.text}</span>
          </li>
        ))}
      </ul>

      {/* Timing Badge */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
        <Clock className="w-4 h-4" />
        <span>{timing}</span>
      </div>

      {/* CTA Button */}
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
        <Link to={ctaLink}>{cta}</Link>
      </Button>

      {/* Bottom Label */}
      <p 
        className="text-center text-xs italic mt-4"
        style={{ color: bottomLabelColor }}
      >
        {bottomLabel}
      </p>
    </div>
  );
}

export function ProductComparisonSection() {
  // New 3-tier pricing structure
  const products: ProductCardProps[] = [
    {
      title: "The Academy",
      price: "$99",
      priceLabel: "/month",
      features: [
        { icon: <TrendingUp className="w-4 h-4" />, text: "Ongoing data uploads" },
        { icon: <Target className="w-4 h-4" />, text: "Weekly AI-guided check-ins" },
        { icon: <ClipboardList className="w-4 h-4" />, text: "Trend tracking & benchmarks" },
        { icon: <Dna className="w-4 h-4" />, text: "Progress accountability" },
      ],
      timing: "Ongoing structure",
      cta: "JOIN THE ACADEMY →",
      ctaLink: "/pricing",
      bottomLabel: "Where clarity becomes consistency.",
      bottomLabelColor: "#6B7280",
      variant: 'default'
    },
    {
      title: "Private Coaching",
      price: "$199",
      priceLabel: "/month",
      features: [
        { icon: <Building2 className="w-4 h-4" />, text: "Direct access to Coach Rick" },
        { icon: <Microscope className="w-4 h-4" />, text: "1-on-1 video feedback" },
        { icon: <GraduationCap className="w-4 h-4" />, text: "Priority support" },
        { icon: <Play className="w-4 h-4" />, text: "Personalized training plans" },
        { icon: <Zap className="w-4 h-4" />, text: "VIP access" },
      ],
      timing: "Limited to 20 players",
      cta: "GET VIP ACCESS →",
      ctaLink: "/pricing",
      bottomLabel: "Work directly with Rick.",
      bottomLabelColor: "#DC2626",
      isPopular: true,
      variant: 'popular'
    }
  ];

  return (
    <section className="py-20 bg-surface">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-black text-center mb-12 uppercase text-[#1E3A8A]">
          Choose Your Analysis
        </h2>

        {/* Product Cards */}
        <div className="max-w-5xl mx-auto mb-10">
          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {products.map((product, i) => (
              <ProductCard key={i} {...product} />
            ))}
          </div>
        </div>

        {/* Free Diagnostic Banner */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#1E3A8A] text-white rounded-lg px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6" />
              <div>
                <span className="font-semibold">Not sure where to start?</span>
                <span className="mx-2">|</span>
                <span className="font-bold">ASK RICK — FREE DIAGNOSTIC</span>
              </div>
            </div>
            <Button 
              asChild 
              variant="outline" 
              className="bg-white text-[#1E3A8A] border-white hover:bg-gray-100 font-bold"
            >
              <Link to="/diagnostic">GET FREE DIAGNOSTIC →</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
