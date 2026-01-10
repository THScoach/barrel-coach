import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Product, PRODUCTS } from '@/types/analysis';
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

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {PRODUCTS.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            popular={index === 1}
            onSelect={() => onSelect(product)}
          />
        ))}
      </div>

      {/* Social Proof */}
      <div className="mt-16 text-center">
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

      <div className="text-center mb-6">
        <h3 className="text-xl font-bold mb-2">{product.name}</h3>
        <p className="text-muted-foreground">
          {product.swingsRequired} swing{product.swingsRequired > 1 ? 's' : ''}
        </p>
      </div>

      <ul className="space-y-3 mb-8">
        {product.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="text-center mb-6">
        <span className="text-4xl font-bold">${product.price}</span>
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
        GET STARTED
      </Button>
    </Card>
  );
}
