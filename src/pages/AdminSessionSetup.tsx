import { useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { MobileBottomNav } from "@/components/admin/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { SessionSetupCard, SessionContext } from "@/components/session";
import { useSessionContext } from "@/hooks/useSessionContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, RotateCcw, CheckCircle2, Zap } from "lucide-react";
import { toast } from "sonner";

export default function AdminSessionSetup() {
  const isMobile = useIsMobile();
  const { context, resetContext, isReady, updateContext } = useSessionContext();
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  const handleSetupComplete = (sessionContext: SessionContext) => {
    updateContext(sessionContext);
    setIsSetupComplete(true);
    toast.success("Session ready! Start recording swings.");
  };

  const handleReset = () => {
    resetContext();
    setIsSetupComplete(false);
  };

  const getEnvironmentLabel = (env: string | null) => {
    const labels: Record<string, string> = {
      tee: "Tee Work",
      front_toss: "Front Toss",
      machine: "Machine",
      live_pitch: "Live Pitch",
    };
    return env ? labels[env] || env : "Not selected";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AdminHeader />

      <main className={`container mx-auto px-4 py-6 max-w-lg ${isMobile ? "pb-24" : ""}`}>
        {/* Page Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            New Training Session
          </h1>
          <p className="text-slate-400">
            Set up your session before recording swings
          </p>
        </div>

        {!isSetupComplete ? (
          <SessionSetupCard onComplete={handleSetupComplete} />
        ) : (
          <div className="space-y-4">
            {/* Session Ready Card */}
            <Card className="bg-slate-900 border-green-600/30 overflow-hidden">
              <div className="bg-green-600/10 border-b border-green-600/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-600/20">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Session Ready</h2>
                    <p className="text-sm text-green-400">
                      Your hitting context is set
                    </p>
                  </div>
                </div>
              </div>

              <CardContent className="p-4 space-y-4">
                {/* Session Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Environment</p>
                    <p className="text-lg font-bold text-white">
                      {getEnvironmentLabel(context.environment)}
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Pitch Speed</p>
                    <p className="text-lg font-bold text-white">
                      {context.estimatedPitchSpeed
                        ? `${context.estimatedPitchSpeed} mph`
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Context Badge */}
                <div className="flex items-center gap-2 p-3 bg-red-600/10 rounded-lg border border-red-600/20">
                  <Zap className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-slate-300">
                    Analysis will adjust for{" "}
                    <span className="text-white font-medium">
                      {getEnvironmentLabel(context.environment)}
                    </span>{" "}
                    conditions
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12"
                  >
                    <Video className="h-5 w-5 mr-2" />
                    Start Recording
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Debug: Current Context */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                    Debug
                  </Badge>
                  <span className="text-xs text-slate-500">current_session_context</span>
                </div>
                <pre className="text-xs text-slate-400 bg-slate-800 rounded p-3 overflow-x-auto">
                  {JSON.stringify(context, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}
