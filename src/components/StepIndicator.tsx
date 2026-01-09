import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  showBack?: boolean;
}

export function StepIndicator({ 
  currentStep, 
  totalSteps, 
  onBack,
  showBack = true 
}: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between py-4">
      {showBack && onBack ? (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
      ) : (
        <div />
      )}
      
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Step {currentStep} of {totalSteps}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                i < currentStep ? 'bg-accent' : 'bg-border'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
