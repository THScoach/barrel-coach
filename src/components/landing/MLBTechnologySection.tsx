import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import mlbTechnologyImg from '@/assets/mlb-technology.png';

export function MLBTechnologySection() {
  return (
    <section className="py-20 bg-background">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 uppercase">
          Why Coach Rick?
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          He helped build the technology. Now he uses it to analyze your swing.
        </p>

        {/* MLB Technology Infographic */}
        <div className="max-w-4xl mx-auto mb-10">
          <img 
            src={mlbTechnologyImg} 
            alt="MLB-Level Technology: Biomechanics (3D Motion Capture, Blast Motion, HitTrax), Brain Vision (S2 Cognition, Timing & Pattern Recognition), Data Analysis (Rapsodo, Diamond Kinetics, Uplift Performance)" 
            className="w-full h-auto rounded-lg shadow-lg"
          />
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button asChild variant="accent-outline" size="lg">
            <Link to="/about">LEARN MORE ABOUT RICK →</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
