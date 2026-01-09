import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingScreenProps {
  swingsCount: number;
  onComplete: () => void;
}

export function ProcessingScreen({ swingsCount, onComplete }: ProcessingScreenProps) {
  const [currentSwing, setCurrentSwing] = useState(1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate analysis progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    // Update current swing being analyzed
    const swingInterval = setInterval(() => {
      setCurrentSwing(prev => (prev < swingsCount ? prev + 1 : prev));
    }, (5000 / swingsCount));

    return () => {
      clearInterval(progressInterval);
      clearInterval(swingInterval);
    };
  }, [swingsCount, onComplete]);

  return (
    <div className="animate-fade-in min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="mb-8">
        <Loader2 className="w-16 h-16 text-accent animate-spin mx-auto" />
      </div>

      <h1 className="text-2xl md:text-3xl font-bold mb-2">
        ANALYZING YOUR SWING{swingsCount > 1 ? 'S' : ''}...
      </h1>

      <p className="text-muted-foreground mb-8">
        This usually takes 30-60 seconds
      </p>

      <div className="w-full max-w-md mx-auto mb-4">
        <div className="progress-bar">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {swingsCount > 1 
            ? `Analyzing swing ${currentSwing} of ${swingsCount}...`
            : 'Analyzing your swing...'
          }
        </p>
      </div>

      <div className="mt-12 p-6 rounded-xl bg-surface border border-border max-w-md">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">While you wait...</span>
          <br /><br />
          Rick Strickland is the AAA Hitting Coach for the Baltimore Orioles. 
          He's trained Pete Crow-Armstrong, Andrew Benintendi, and Devin Williams.
        </p>
      </div>
    </div>
  );
}
