import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PlayerInfo, PlayerLevel, LEVELS } from '@/types/analysis';

interface PlayerInfoFormProps {
  onSubmit: (info: PlayerInfo) => void;
  initialData?: Partial<PlayerInfo>;
}

export function PlayerInfoForm({ onSubmit, initialData }: PlayerInfoFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [age, setAge] = useState(initialData?.age?.toString() || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [level, setLevel] = useState<PlayerLevel | ''>(initialData?.level || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Player name is required';
    }

    const ageNum = parseInt(age);
    if (!age || isNaN(ageNum) || ageNum < 5 || ageNum > 50) {
      newErrors.age = 'Please enter a valid age (5-50)';
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!level) {
      newErrors.level = 'Please select a level';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validate()) {
      onSubmit({
        name: name.trim(),
        age: parseInt(age),
        email: email.trim(),
        level: level as PlayerLevel,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          TELL US ABOUT THE PLAYER
        </h1>
      </div>

      <div className="space-y-6">
        {/* Player Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Player Name *</Label>
          <Input
            id="name"
            type="text"
            placeholder="Enter player's name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Age & Email */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="age">Age *</Label>
            <Input
              id="age"
              type="number"
              min="5"
              max="50"
              placeholder="14"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={errors.age ? 'border-destructive' : ''}
            />
            {errors.age && (
              <p className="text-sm text-destructive">{errors.age}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="parent@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>
        </div>

        {/* Level Selection */}
        <div className="space-y-3">
          <Label>Level *</Label>
          <RadioGroup 
            value={level} 
            onValueChange={(value) => setLevel(value as PlayerLevel)}
            className="space-y-2"
          >
            {LEVELS.map((levelOption) => (
              <label
                key={levelOption.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  level === levelOption.value 
                    ? 'border-accent bg-accent/5' 
                    : 'border-border hover:border-accent/50'
                }`}
              >
                <RadioGroupItem value={levelOption.value} id={levelOption.value} />
                <span className="text-sm font-medium">{levelOption.label}</span>
              </label>
            ))}
          </RadioGroup>
          {errors.level && (
            <p className="text-sm text-destructive">{errors.level}</p>
          )}
        </div>

        <Button type="submit" variant="accent" size="lg" className="w-full mt-8">
          CONTINUE →
        </Button>
      </div>
    </form>
  );
}
