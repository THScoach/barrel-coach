import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import productComparisonImg from '@/assets/product-comparison.png';

export function ProductComparisonSection() {
  return (
    <section className="py-20 bg-surface">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 uppercase">
          Choose Your Analysis
        </h2>

        {/* Product Comparison Table */}
        <div className="max-w-5xl mx-auto mb-10">
          <img 
            src={productComparisonImg} 
            alt="Product Comparison: Single Swing Score $37, Complete Review $97, In-Person Assessment $299" 
            className="w-full h-auto"
          />
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Button asChild variant="hero" size="lg">
            <Link to="/analyze">GET MY SWING SCORE — $37</Link>
          </Button>
          <Button asChild variant="accent-outline" size="lg">
            <Link to="/assessment">BOOK IN-PERSON ASSESSMENT — $299</Link>
          </Button>
        </div>

        {/* Inner Circle Banner */}
        <div className="max-w-3xl mx-auto border-t border-border pt-8">
          <p className="text-center text-muted-foreground mb-4">
            Want ongoing coaching from Rick?
          </p>
          <div className="flex justify-center">
            <Button asChild variant="accent-outline" size="lg">
              <Link to="/inner-circle">JOIN RICK'S INNER CIRCLE — $297/month →</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
