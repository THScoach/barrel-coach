import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, ChevronRight, CheckCircle } from "lucide-react";

interface PlayerOnboardingProps {
  onComplete: () => void;
  playerName?: string;
}

export function PlayerOnboarding({ onComplete, playerName }: PlayerOnboardingProps) {
  const [step, setStep] = useState(1);
  const [smsConsent, setSmsConsent] = useState(true);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border-border">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Step Indicators */}
          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-12 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold">You're in.</h1>
              <p className="text-muted-foreground text-lg leading-relaxed">
                This app is my second brain.
                <br />
                It sees what I see.
                <br />
                It tells you what I'd tell you in the cage.
              </p>
              <Button size="lg" className="w-full mt-4" onClick={handleNext}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Your First Swing
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Expectations */}
          {step === 2 && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-center">Here's how this works</h1>
              <div className="space-y-3 py-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <span className="text-primary text-sm font-bold">1</span>
                  </div>
                  <p className="text-foreground">Upload swings anytime</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <span className="text-primary text-sm font-bold">2</span>
                  </div>
                  <p className="text-foreground">I'll tell you the truth</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <span className="text-primary text-sm font-bold">3</span>
                  </div>
                  <p className="text-foreground">Fix one thing at a time</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <span className="text-primary text-sm font-bold">4</span>
                  </div>
                  <p className="text-foreground">Consistency beats talent</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm text-center border-t border-border pt-4">
                If you're looking for drills, YouTube has plenty.
                <br />
                If you want results, you're in the right place.
              </p>
              <Button size="lg" className="w-full" onClick={handleNext}>
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 3: Communication */}
          {step === 3 && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-center">How I'll talk to you</h1>
              <p className="text-muted-foreground text-center">
                Most of our communication happens by text.
                <br />
                Short. Direct. Actionable.
              </p>
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border bg-muted/50">
                <Checkbox
                  id="sms-consent"
                  checked={smsConsent}
                  onCheckedChange={(checked) => setSmsConsent(checked as boolean)}
                />
                <label
                  htmlFor="sms-consent"
                  className="text-sm text-foreground cursor-pointer leading-relaxed"
                >
                  I agree to receive SMS coaching messages from Coach Rick
                </label>
              </div>
              <Button size="lg" className="w-full" onClick={handleNext} disabled={!smsConsent}>
                Finish Setup
                <CheckCircle className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
