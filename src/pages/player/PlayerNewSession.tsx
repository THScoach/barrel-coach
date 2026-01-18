import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VideoUploader } from "@/components/VideoUploader";
import { Environment, ENVIRONMENTS } from "@/types/analysis";
import { ArrowLeft, Video, CheckCircle, Loader2 } from "lucide-react";

type Step = "environment" | "upload";

export default function PlayerNewSession() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("environment");
  const [environment, setEnvironment] = useState<Environment>("tee");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [swingsRequired, setSwingsRequired] = useState(5);
  const [swingsMaxAllowed, setSwingsMaxAllowed] = useState(15);

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-player-session", {
        body: {
          productType: "academy",
          environment,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSessionId(data.sessionId);
      setSwingsRequired(data.swingsRequired || 5);
      setSwingsMaxAllowed(data.swingsMaxAllowed || 15);
      setStep("upload");
      toast.success("Session started! Upload your swings.");
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start session");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadComplete = async () => {
    if (!sessionId) return;

    try {
      // Create Stripe checkout
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { sessionId },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      toast.error("Failed to create checkout. Please try again.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 md:ml-56">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => step === "upload" ? setStep("environment") : navigate("/player")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Swing Session</h1>
          <p className="text-muted-foreground text-sm">
            {step === "environment" ? "Step 1: Select your environment" : "Step 2: Upload your swings"}
          </p>
        </div>
      </div>

      {/* Step 1: Environment Selection */}
      {step === "environment" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Where are you swinging?
            </CardTitle>
            <CardDescription>
              Select the environment where you recorded your swings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={environment}
              onValueChange={(val) => setEnvironment(val as Environment)}
              className="grid grid-cols-2 md:grid-cols-3 gap-3"
            >
              {ENVIRONMENTS.map((env) => (
                <Label
                  key={env.value}
                  htmlFor={env.value}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    environment === env.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value={env.value} id={env.value} />
                  <span className="font-medium">{env.label}</span>
                </Label>
              ))}
            </RadioGroup>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">🔥 Coach Rick says:</p>
              <p className="text-sm text-muted-foreground">
                "I want 5+ swings so I can see your consistency. Same session, same day. 
                Upload your best 5–15 swings and I'll break 'em down."
              </p>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleCreateSession}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting session...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Start Session & Upload
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Video Upload */}
      {step === "upload" && sessionId && (
        <Card>
          <CardContent className="pt-6">
            <VideoUploader
              swingsRequired={swingsRequired}
              swingsMaxAllowed={swingsMaxAllowed}
              sessionId={sessionId}
              onComplete={handleUploadComplete}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
