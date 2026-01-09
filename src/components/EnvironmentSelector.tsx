import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Environment, ENVIRONMENTS } from '@/types/analysis';

interface EnvironmentSelectorProps {
  onSelect: (environment: Environment) => void;
  initialValue?: Environment;
}

export function EnvironmentSelector({ onSelect, initialValue }: EnvironmentSelectorProps) {
  const [selected, setSelected] = useState<Environment | ''>(initialValue || '');
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!selected) {
      setError('Please select an environment');
      return;
    }
    onSelect(selected);
  };

  return (
    <div className="animate-fade-in max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          WHAT TYPE OF SWINGS ARE THESE?
        </h1>
      </div>

      {/* Warning */}
      <Alert className="mb-6 border-warning/50 bg-warning/5">
        <AlertDescription className="flex items-start gap-2">
          <span className="text-warning font-medium">⚠️</span>
          <span>All swings must be from the <strong>SAME</strong> environment</span>
        </AlertDescription>
      </Alert>

      {/* Environment Selection */}
      <RadioGroup 
        value={selected} 
        onValueChange={(value) => {
          setSelected(value as Environment);
          setError('');
        }}
        className="space-y-2"
      >
        {ENVIRONMENTS.map((env) => (
          <label
            key={env.value}
            className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              selected === env.value 
                ? 'border-accent bg-accent/5' 
                : 'border-border hover:border-accent/50'
            }`}
          >
            <RadioGroupItem value={env.value} id={env.value} />
            <span className="font-medium">{env.label}</span>
          </label>
        ))}
      </RadioGroup>

      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 rounded-lg bg-surface border border-border">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">Why does this matter?</p>
            <p className="text-sm text-muted-foreground">
              We adjust scoring based on difficulty:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• Tee is easier — we expect higher contact rates</li>
              <li>• Live pitching is harder — we adjust expectations</li>
            </ul>
          </div>
        </div>
      </div>

      <Button 
        variant="accent" 
        size="lg" 
        className="w-full mt-8"
        onClick={handleContinue}
      >
        CONTINUE →
      </Button>
    </div>
  );
}
