import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import howItWorksImg from '@/assets/how-it-works.png';

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 bg-surface">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 uppercase">
          How It Works
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Professional swing analysis in three simple steps
        </p>

        {/* How It Works Infographic */}
        <div className="max-w-4xl mx-auto mb-10">
          <img 
            src={howItWorksImg} 
            alt="How It Works: 1. Upload your swing video 2. Get your 4B analysis 3. Fix your swing with personalized drills" 
            className="w-full h-auto"
          />
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button asChild variant="hero" size="lg">
            <Link to="/analyze">GET MY SWING SCORE — $37</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
