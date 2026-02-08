import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, Dumbbell, Swords, Target } from "lucide-react";
import { predictBallFlight, confidenceLabel } from "@/lib/ballFlightPredictor";
import { SessionHeader } from "@/components/session/SessionHeader";
import { ProcessingBanner } from "@/components/session/ProcessingBanner";
import { FourBCard } from "@/components/session/FourBCard";
import { CoachingNotes } from "@/components/session/CoachingNotes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch session from local DB by reboot_session_id
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["reboot-session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reboot_sessions")
        .select(
          `
          *,
          players (
            id,
            name
          )
        `
        )
        .eq("reboot_session_id", sessionId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  // Fetch uploads (swings) for this session with 4B scores
  const { data: uploads = [] } = useQuery({
    queryKey: ["reboot-uploads", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reboot_uploads")
        .select("*")
        .eq("reboot_session_id", sessionId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId,
  });

  // Aggregate scores from completed uploads
  const completedUploads = uploads.filter(
    (u) => u.processing_status === "complete"
  );
  const hasData = completedUploads.length > 0;

  const avg = (field: keyof (typeof completedUploads)[0]) => {
    const vals = completedUploads
      .map((u) => u[field] as number | null)
      .filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const brainScore = avg("brain_score");
  const bodyScore = avg("body_score");
  const batScore = avg("bat_score");
  const compositeScore = avg("composite_score");

  // Pick most common values for string fields
  const pick = (field: keyof (typeof completedUploads)[0]) => {
    const vals = completedUploads
      .map((u) => u[field] as string | null)
      .filter((v): v is string => v != null);
    return vals[0] || null;
  };

  const grade = pick("grade");
  const weakestLink = pick("weakest_link");
  const consistencyGrade = pick("consistency_grade");
  const motorProfile = pick("motor_profile");
  const leakDetected = pick("leak_detected");
  const priorityDrill = pick("priority_drill");

  // Determine session status
  const anyProcessing = uploads.some(
    (u) => u.processing_status === "processing" || u.processing_status === "pending"
  );
  const anyFailed = uploads.some((u) => u.processing_status === "failed");
  const sessionStatus = hasData
    ? "complete"
    : anyFailed
    ? "failed"
    : anyProcessing
    ? "processing"
    : session?.status || "processing";

  // Refresh from Reboot API
  const handleRefresh = async () => {
    if (!sessionId) return;
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "fetch-reboot-session-data",
        { body: { reboot_session_id: sessionId } }
      );

      if (error) throw error;

      toast.success(
        `Session status: ${data?.session_status || "unknown"}. ${
          data?.movement_count || 0
        } movements found.`
      );

      // Refresh local data
      queryClient.invalidateQueries({ queryKey: ["reboot-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["reboot-uploads", sessionId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Header />
        <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full flex items-center justify-center">
          <p className="text-slate-400">Loading session…</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header />
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <SessionHeader
          playerName={session?.players?.name || null}
          sessionDate={session?.session_date || completedUploads[0]?.session_date || null}
          rebootSessionId={sessionId || null}
          grade={grade}
          compositeScore={compositeScore}
          swingCount={uploads.length}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />

        <ProcessingBanner status={sessionStatus} />

        {/* 4B Framework Cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <FourBCard
            icon={<Brain className="w-7 h-7" />}
            title="Brain"
            score={brainScore != null ? Math.round(brainScore) : null}
            iconColor="text-blue-400"
            metrics={[
              {
                label: "Kinematic Sequence",
                value: consistencyGrade,
              },
              {
                label: "Transfer Efficiency",
                value: avg("transfer_efficiency"),
                unit: "%",
              },
              {
                label: "Motor Profile",
                value: motorProfile,
              },
            ]}
          />

          <FourBCard
            icon={<Dumbbell className="w-7 h-7" />}
            title="Body"
            score={bodyScore != null ? Math.round(bodyScore) : null}
            iconColor="text-green-400"
            metrics={[
              {
                label: "Pelvis Velocity",
                value: avg("pelvis_velocity"),
                unit: "°/s",
              },
              {
                label: "Torso Velocity",
                value: avg("torso_velocity"),
                unit: "°/s",
              },
              {
                label: "X-Factor (Separation)",
                value: avg("x_factor"),
                unit: "°",
              },
              {
                label: "Ground Flow",
                value: avg("ground_flow_score"),
              },
              {
                label: "Core Flow",
                value: avg("core_flow_score"),
              },
            ]}
          />

          <FourBCard
            icon={<Swords className="w-7 h-7" />}
            title="Bat"
            score={batScore != null ? Math.round(batScore) : null}
            iconColor="text-yellow-400"
            metrics={[
              {
                label: "Bat KE",
                value: avg("bat_ke"),
                unit: "J",
              },
              {
                label: "Upper Flow",
                value: avg("upper_flow_score"),
              },
              {
                label: "Leak Detected",
                value: leakDetected || "None",
              },
            ]}
          />

          {(() => {
            const ballPrediction = predictBallFlight({
              bat_ke: avg("bat_ke"),
              pelvis_velocity: avg("pelvis_velocity"),
              torso_velocity: avg("torso_velocity"),
              transfer_efficiency: avg("transfer_efficiency"),
              x_factor: avg("x_factor"),
              brain_score: brainScore,
              body_score: bodyScore,
              motor_profile: motorProfile,
            });

            return (
              <FourBCard
                icon={<Target className="w-7 h-7" />}
                title="Ball"
                score={ballPrediction.kinetic_potential}
                iconColor="text-red-400"
                metrics={[
                  {
                    label: "Predicted Exit Velo",
                    value: ballPrediction.exit_velocity,
                    unit: "mph",
                  },
                  {
                    label: "Predicted Launch Angle",
                    value: ballPrediction.launch_angle,
                    unit: "°",
                  },
                  {
                    label: "Kinetic Potential",
                    value: ballPrediction.kinetic_potential,
                  },
                  {
                    label: "Confidence",
                    value: confidenceLabel(ballPrediction.confidence),
                  },
                ]}
                footer="Predictions based on biomechanics. Add Trackman for actual results."
              />
            );
          })()}
        </div>

        {/* Session Summary */}
        {hasData && (
          <Card className="bg-slate-900/80 border-slate-800 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Session Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Weakest Link</p>
                  <p className="text-white font-semibold capitalize">
                    {weakestLink || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Priority Drill</p>
                  <p className="text-white font-semibold">
                    {priorityDrill || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Consistency</p>
                  <p className="text-white font-semibold">
                    {consistencyGrade || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Motor Profile</p>
                  <p className="text-white font-semibold">
                    {motorProfile || "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coaching Notes */}
        {session && (
          <CoachingNotes
            sessionId={session.id}
            initialNotes={session.notes}
          />
        )}

        {/* Session Info (collapsed details) */}
        <Card className="bg-slate-900/80 border-slate-800 mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm text-slate-400">
              Session Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Reboot Session ID</p>
                <p className="text-white font-mono text-xs truncate">
                  {sessionId || "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <p
                  className={`font-medium ${
                    sessionStatus === "complete"
                      ? "text-green-400"
                      : sessionStatus === "failed"
                      ? "text-red-400"
                      : "text-yellow-400"
                  }`}
                >
                  {sessionStatus === "complete"
                    ? "✅ Complete"
                    : sessionStatus === "failed"
                    ? "❌ Failed"
                    : "⏳ Processing"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Swings Analyzed</p>
                <p className="text-white">{completedUploads.length}</p>
              </div>
              <div>
                <p className="text-slate-500">Total Uploads</p>
                <p className="text-white">{uploads.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
