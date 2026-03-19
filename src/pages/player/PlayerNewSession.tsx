import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VideoUploader, UploadedSwingData } from "@/components/VideoUploader";
import { Environment, ENVIRONMENTS } from "@/types/analysis";
import { ArrowLeft, Video, CheckCircle, Loader2, Brain, Activity, Target, Zap, Link2 } from "lucide-react";
import { use2DAnalysisTrigger } from "@/hooks/use2DAnalysisTrigger";
import { usePlayerData } from "@/hooks/usePlayerData";

type Step = "environment" | "upload" | "analyzing" | "results";

export default function PlayerNewSession() {
  const navigate = useNavigate();
  const { player } = usePlayerData();
  const [step, setStep] = useState<Step>("environment");
  const [environment, setEnvironment] = useState<Environment>("tee");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [swingsRequired, setSwingsRequired] = useState(5);
  const [swingsMaxAllowed, setSwingsMaxAllowed] = useState(15);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<any>(null);
  const [onformUrls, setOnformUrls] = useState("");
  const [importingOnform, setImportingOnform] = useState(false);

  const { triggerAnalysis, progress: analysisProgress } = use2DAnalysisTrigger();

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  const handleOnformImport = async () => {
    const urlList = onformUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0 && u.includes('getonform.com'));

    if (urlList.length === 0) {
      toast.error('Paste valid OnForm URLs (one per line)');
      return;
    }

    if (!player?.id) {
      toast.error('Player profile not found');
      return;
    }

    setImportingOnform(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/import-onform-video`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          urls: urlList,
          playerId: player.id,
          forSwingAnalysis: true,
          playerSelfImport: true,
          source: 'player_onform',
          playerName: player.name || 'Player',
          playerLevel: player.level || 'youth',
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      if (data.videos && data.videos.length > 0) {
        const uploadedSwings: UploadedSwingData[] = data.videos.map((v: any, i: number) => ({
          file: new File([], v.filename),
          storagePath: v.storagePath,
          swingIndex: i,
        }));

        setOnformUrls('');
        toast.success(data.message || `Imported ${urlList.length} video(s)`);
        await handleUploadComplete(uploadedSwings);
      } else {
        throw new Error('No videos were imported successfully');
      }
    } catch (error) {
      console.error('OnForm import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImportingOnform(false);
    }
  };

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

  const handleUploadComplete = async (uploadedSwings?: UploadedSwingData[]) => {
    if (!player?.id || !uploadedSwings || uploadedSwings.length === 0) {
      toast.success("Swings uploaded!");
      navigate("/player/data?tab=sessions");
      return;
    }

    // Transition to analyzing step
    setStep("analyzing");

    // Pass reboot_player_id so the hook can fire 3D analysis automatically
    const rebootId = player.reboot_player_id || player.reboot_athlete_id || null;
    const resultBatchId = await triggerAnalysis(player.id, uploadedSwings, rebootId);
    setBatchId(resultBatchId);

    if (resultBatchId) {
      // Fetch batch results
      const { data } = await supabase
        .from("video_2d_batch_sessions")
        .select("*")
        .eq("id", resultBatchId)
        .single();
      
      setBatchResults(data);
    }

    setStep("results");
  };

  const analysisTotal = analysisProgress.total;
  const analysisCompleted = analysisProgress.completed + analysisProgress.failed;
  const analysisPct = analysisTotal > 0 ? Math.round((analysisCompleted / analysisTotal) * 100) : 0;

  return (
    <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
    <div className="px-4 py-6 pb-24 space-y-6 max-w-lg mx-auto">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (step === "upload") setStep("environment");
            else if (step === "results") navigate("/player/data?tab=sessions");
            else navigate("/player");
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Swing Session</h1>
          <p className="text-muted-foreground text-sm">
            {step === "environment" ? "Step 1: Select your environment" 
             : step === "upload" ? "Step 2: Upload your swings"
             : step === "analyzing" ? "Step 3: Analyzing your swings..."
             : "Analysis Complete"}
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
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Upload Files
                </TabsTrigger>
                <TabsTrigger value="onform" className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  OnForm Links
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <VideoUploader
                  swingsRequired={swingsRequired}
                  swingsMaxAllowed={swingsMaxAllowed}
                  sessionId={sessionId}
                  onComplete={handleUploadComplete}
                />
              </TabsContent>

              <TabsContent value="onform" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Paste OnForm video links (one per line)</Label>
                  <Textarea
                    placeholder={"https://link.getonform.com/view?id=...\nhttps://link.getonform.com/view?id=...\nhttps://link.getonform.com/view?id=..."}
                    value={onformUrls}
                    onChange={(e) => setOnformUrls(e.target.value)}
                    rows={5}
                    className="text-sm font-mono"
                    disabled={importingOnform}
                  />
                  <p className="text-xs text-muted-foreground">
                    Open OnForm → select video → Share → Copy Link. Paste up to 15 links.
                  </p>
                </div>
                <Button
                  onClick={handleOnformImport}
                  disabled={importingOnform || !onformUrls.trim()}
                  className="w-full"
                >
                  {importingOnform ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing from OnForm...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Import & Analyze
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Analyzing */}
      {step === "analyzing" && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(230,57,70,0.1)' }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#E63946' }} />
              </div>
              <h2 className="text-xl font-bold mb-2">Coach Barrels is Analyzing</h2>
              <p className="text-muted-foreground text-sm">
                {analysisProgress.status === "extracting" && "Extracting frames from your videos..."}
                {analysisProgress.status === "analyzing" && `Analyzing swing ${analysisCompleted + 1} of ${analysisTotal}...`}
                {analysisProgress.status === "polling" && "Waiting for results..."}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{analysisCompleted} of {analysisTotal} swings</span>
                <span>{analysisPct}%</span>
              </div>
              <Progress value={analysisPct} className="h-2" />
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                "Give me a sec — I'm looking at your hip lead, hand path, sequence, and finish position across every swing."
              </p>
              <p className="text-xs text-muted-foreground mt-2">— Coach Barrels</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results Summary */}
      {step === "results" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: '#4ecdc4' }} />
                <h2 className="text-xl font-bold mb-1">Analysis Complete!</h2>
                <p className="text-muted-foreground text-sm">
                  {analysisProgress.completed} swing{analysisProgress.completed !== 1 ? 's' : ''} analyzed
                  {analysisProgress.failed > 0 ? ` · ${analysisProgress.failed} failed` : ''}
                </p>
              </div>

              {/* Batch scores summary */}
              {batchResults && (
                <>
                  {/* Composite */}
                  {batchResults.avg_composite != null && (
                    <div className="text-center rounded-xl p-4" style={{ background: '#111', border: '1px solid #222' }}>
                      <div className="text-4xl font-bold" style={{ color: '#fff' }}>
                        {Math.round(batchResults.avg_composite)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Composite Score (2D)</div>
                    </div>
                  )}

                  {/* 4B Breakdown */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'avg_body', label: 'Body', icon: Activity },
                      { key: 'avg_brain', label: 'Brain', icon: Brain },
                      { key: 'avg_bat', label: 'Bat', icon: Target },
                      { key: 'avg_ball', label: 'Ball', icon: Zap },
                    ].map(({ key, label, icon: Icon }) => {
                      const val = batchResults[key];
                      return (
                        <div key={key} className="flex flex-col items-center p-3 rounded-lg" style={{ background: '#111', border: '1px solid #222' }}>
                          <Icon className="h-4 w-4 mb-1" style={{ color: '#555' }} />
                          <span className="text-[10px] font-semibold uppercase" style={{ color: '#555' }}>{label}</span>
                          <span className="text-lg font-bold" style={{ color: '#fff' }}>
                            {val != null ? Math.round(val) : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Leak & Motor Profile */}
                  {(batchResults.primary_leak || batchResults.motor_profile) && (
                    <div className="rounded-xl p-4 space-y-2" style={{ background: '#111', border: '1px solid #222' }}>
                      {batchResults.primary_leak && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: '#555' }}>Primary Leak:</span>
                          <span className="text-sm font-semibold" style={{ color: '#E63946' }}>
                            {batchResults.primary_leak.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}
                      {batchResults.motor_profile && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: '#555' }}>Motor Profile:</span>
                          <span className="text-sm font-semibold" style={{ color: '#4ecdc4' }}>
                            {batchResults.motor_profile}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/player/data?tab=sessions")}
            >
              View All Sessions
            </Button>
            <Button
              className="flex-1"
              style={{ background: '#E63946' }}
              onClick={() => navigate("/player/session")}
            >
              See Prescribed Drills
            </Button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
