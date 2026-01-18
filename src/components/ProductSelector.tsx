import { Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Product, PRODUCTS, PRIVATE_COACHING } from '@/types/analysis';
import { cn } from '@/lib/utils';

interface ProductSelectorProps {
  onSelect: (product: Product) => void;
}

export function ProductSelector({ onSelect }: ProductSelectorProps) {
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">
          GET YOUR SWING ANALYZED
        </h1>
        <p className="text-lg text-muted-foreground">
          by an MLB Hitting Coach
        </p>
      </div>

      {/* Main Products Grid */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
        {PRODUCTS.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            popular={index === 1}
            onSelect={() => onSelect(product)}
          />
        ))}
      </div>

      {/* Private Coaching Card */}
      <div className="max-w-md mx-auto mb-10">
        <Card className="relative p-6 border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-orange-500/5">
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold">
            VIP ACCESS
          </Badge>
          
          <div className="text-center mb-4 pt-2">
            <h3 className="text-xl font-bold mb-1">{PRIVATE_COACHING.name}</h3>
            <p className="text-sm text-muted-foreground">Direct access to Coach Rick</p>
          </div>

          <ul className="space-y-2 mb-4">
            {PRIVATE_COACHING.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground text-center mb-4 border-t border-yellow-500/20 pt-3">
            Perfect for: {PRIVATE_COACHING.perfectFor}
          </p>

          <div className="text-center mb-4">
            <span className="text-3xl font-bold">${PRIVATE_COACHING.price}</span>
            <span className="text-muted-foreground">/mo</span>
          </div>

          <Button 
            variant="outline"
            className="w-full border-yellow-500/50 hover:bg-yellow-500/10"
            onClick={() => window.location.href = '/pricing'}
          >
            Join Private Coaching
          </Button>
        </Card>
      </div>

      {/* Not Sure Note */}
      <div className="text-center mb-12">
        <p className="text-slate-400 text-sm">
          Not sure which to pick?{' '}
          <a href="/diagnostic" className="text-red-400 hover:text-red-300 font-medium underline">
            Start with the FREE diagnostic
          </a>
          . See your first leak in 60 seconds.
        </p>
      </div>

      {/* Social Proof */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border">
          <span className="text-sm text-muted-foreground">
            Trusted by <span className="font-semibold text-foreground">400+</span> college commits and{' '}
            <span className="font-semibold text-foreground">78+</span> pro players
          </span>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-6">
          {['Pete Crow-Armstrong', 'Andrew Benintendi', 'Cedric Mullins'].map((name) => (
            <div 
              key={name}
              className="flex items-center gap-3 px-4 py-2 rounded-lg bg-surface"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">
                  {name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <span className="text-sm font-medium">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  popular?: boolean;
  onSelect: () => void;
}

function ProductCard({ product, popular, onSelect }: ProductCardProps) {
  const isMembership = product.id === 'academy';

  return (
    <Card 
      className={cn(
        'product-card relative p-6 md:p-8 border-2 transition-all cursor-pointer',
        popular ? 'border-accent shadow-card-hover' : 'border-border hover:border-accent/50'
      )}
      onClick={onSelect}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-bold">
            MOST POPULAR
          </span>
        </div>
      )}

      <div className="text-center mb-4">
        <h3 className="text-xl font-bold mb-1">{product.name}</h3>
        {isMembership ? (
          <p className="text-xs text-muted-foreground">Monthly membership</p>
        ) : (
          <p className="text-xs text-muted-foreground">One-time purchase</p>
        )}
      </div>

      {/* Membership Headline */}
      {isMembership && (
        <div className="text-center mb-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
          <p className="text-sm font-bold text-accent">YOU BRING THE DATA. WE SCORE IT.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your 4B Score gets stronger with every data source you connect.
          </p>
        </div>
      )}

      <ul className="space-y-3 mb-4">
        {product.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {product.perfectFor && (
        <p className="text-xs text-muted-foreground text-center mb-4 border-t border-border pt-3">
          Perfect for: {product.perfectFor}
        </p>
      )}

      <div className="text-center mb-6">
        <span className="text-4xl font-bold">${product.price}</span>
        {isMembership && <span className="text-muted-foreground">/mo</span>}
      </div>

      <Button 
        variant={popular ? 'accent' : 'default'}
        size="lg"
        className="w-full"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {isMembership ? 'JOIN NOW' : 'GET STARTED'}
      </Button>
    </Card>
  );
}
