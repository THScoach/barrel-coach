import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingScreenProps {
  swingsCount: number;
  sessionId?: string | null;
  onComplete: () => void;
}

export function ProcessingScreen({ swingsCount, sessionId, onComplete }: ProcessingScreenProps) {
  const [currentSwing, setCurrentSwing] = useState(1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Poll for session status if sessionId provided
    if (sessionId) {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-session?sessionId=${sessionId}`,
            {
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
            }
          );
          const data = await response.json();
          if (data.session?.status === 'complete') {
            clearInterval(pollInterval);
            onComplete();
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 3000);

      // Fallback timeout
      const timeout = setTimeout(() => {
        clearInterval(pollInterval);
        onComplete();
      }, 60000);

      return () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    }

    // Simulate progress for demo
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

    const swingInterval = setInterval(() => {
      setCurrentSwing(prev => (prev < swingsCount ? prev + 1 : prev));
    }, (5000 / swingsCount));

    return () => {
      clearInterval(progressInterval);
      clearInterval(swingInterval);
    };
  }, [swingsCount, sessionId, onComplete]);

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
          Rick Strickland is the MLB Hitting Coach for the Baltimore Orioles. 
          He's trained Pete Crow-Armstrong, Andrew Benintendi, and Devin Williams.
        </p>
      </div>
    </div>
  );
}
