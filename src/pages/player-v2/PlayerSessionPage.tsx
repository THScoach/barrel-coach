/**
 * Today's Session — drill sequence from prescriptions (4B brand)
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerTopBar } from "@/components/player-v2/PlayerTopBar";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { EmptyState } from "@/components/player-v2/EmptyState";
import { TagPill } from "@/components/player-v2/TagPill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Dumbbell, Play, Check, X, Upload, Plus } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface DrillAssignment {
  id: string;
  drill_id: string;
  assigned_reason: string | null;
  leak_type_at_assignment: string | null;
  status: string;
  drill: {
    name: string;
    video_url: string | null;
    instructions: string | null;
    sets: number | null;
    reps: number | null;
    cues: string[] | null;
    equipment: string[] | null;
  } | null;
}

export default function PlayerSession() {
  const { player, loading } = usePlayerData();
  const [drills, setDrills] = useState<DrillAssignment[]>([]);
  const [loadingDrills, setLoadingDrills] = useState(true);
  const [videoModal, setVideoModal] = useState<{ url: string | null; name: string } | null>(null);
  const drillRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!player?.id) return;
    const fetchDrills = async () => {
      setLoadingDrills(true);
      const { data } = await supabase
        .from("player_drill_assignments")
        .select("id, drill_id, assigned_reason, leak_type_at_assignment, status, drills(name, video_url, instructions, sets, reps, cues, equipment)")
        .eq("player_id", player.id)
        .order("assigned_at", { ascending: true })
        .limit(20);

      if (data) {
        setDrills(data.map(d => ({
          ...d,
          drill: (d as any).drills || null,
        })));
      }
      setLoadingDrills(false);
    };
    fetchDrills();
  }, [player?.id]);

  const markComplete = async (assignmentId: string) => {
    await supabase.from("player_drill_assignments").update({ status: 'completed', completed_at: new Date().toISOString() }).eq("id", assignmentId);
    setDrills(prev => prev.map(d => d.id === assignmentId ? { ...d, status: 'completed' } : d));

    const nextIdx = drills.findIndex(d => d.id === assignmentId) + 1;
    for (let i = nextIdx; i < drills.length; i++) {
      if (drills[i].status !== 'completed') {
        drillRefs.current[drills[i].id]?.scrollIntoView({ behavior: 'smooth' });
        break;
      }
    }
    toast.success("Drill completed! 💪");
  };

  if (loading || loadingDrills) {
    return (
      <div style={{ background: '#000', minHeight: '100vh' }}>
        <Skeleton className="h-14 w-full" style={{ background: '#111' }} />
        <div className="p-4 space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" style={{ background: '#111' }} />)}
        </div>
      </div>
    );
  }

  const today = format(new Date(), 'EEEE, MMM d');

  return (
    <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <PlayerTopBar playerName={player?.name ?? null} motorProfile={player?.motor_profile_sensor ?? null} />

      <main className="px-4 pb-24 pt-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold" style={{ color: '#fff' }}>Today's Session</h1>
          <div className="flex items-center gap-2 mt-1">
            <TagPill label={today} color="#a0a0a0" />
            <TagPill label={`${drills.length} drills`} color="#4ecdc4" />
          </div>
        </div>

        {/* New Session CTA */}
        <Link
          to="/player/session/new"
          className="flex items-center gap-3 rounded-xl p-4 mb-4 transition-all hover:opacity-90"
          style={{ background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.25)' }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#E63946' }}>
            <Plus className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-bold" style={{ color: '#fff' }}>Start New Session</p>
            <p className="text-[12px]" style={{ color: '#a0a0a0' }}>Record & upload your swings for analysis</p>
          </div>
        </Link>

        {drills.length === 0 ? (
          <EmptyState icon={<Dumbbell className="h-12 w-12" />} title="No drills assigned" description="Complete an assessment session to get your personalized drill plan" ctaLabel="Upload Session" ctaTo="/player/data" />
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase" style={{ color: '#555' }}>Drill Sequence</p>
            {drills.map((d, i) => {
              const isComplete = d.status === 'completed';
              const name = d.drill?.name || 'Drill';
              const isSynapse = name.toLowerCase().includes('synapse');
              const isTowel = name.toLowerCase().includes('towel') && i === drills.length - 1;

              return (
                <div
                  key={d.id}
                  ref={(el) => { drillRefs.current[d.id] = el; }}
                  className="rounded-xl p-4 transition-all"
                  style={{
                    background: '#111',
                    border: `1px solid ${isSynapse ? 'rgba(230,57,70,0.3)' : isTowel ? 'rgba(78,205,196,0.3)' : '#222'}`,
                    opacity: isComplete ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: isTowel ? '#4ecdc4' : '#E63946', color: '#fff' }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[15px] font-bold" style={{ color: '#fff', textDecoration: isComplete ? 'line-through' : 'none' }}>{name}</p>
                        {isSynapse && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(230,57,70,0.15)', color: '#E63946' }}>KEY DRILL</span>}
                        {isTowel && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(78,205,196,0.15)', color: '#4ecdc4' }}>DIAGNOSTIC</span>}
                      </div>

                      {d.drill?.equipment && d.drill.equipment.length > 0 && (
                        <p className="text-[12px] mt-1" style={{ color: '#777' }}>
                          {d.drill.equipment.join(' · ')} · {d.drill?.sets || 3}×{d.drill?.reps || 10}
                        </p>
                      )}

                      {d.drill?.cues && d.drill.cues.length > 0 && (
                        <div className="mt-2 rounded-lg p-2.5" style={{ background: '#0a0a0a' }}>
                          <p className="text-[12px] leading-relaxed" style={{ color: '#a0a0a0' }}>{d.drill.cues[0]}</p>
                        </div>
                      )}

                      <div className="flex gap-1.5 mt-2">
                        {d.leak_type_at_assignment && <TagPill label={d.leak_type_at_assignment.replace(/_/g, ' ')} color="#ffa500" />}
                      </div>

                      {!isComplete && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setVideoModal({ url: d.drill?.video_url || null, name })}
                            className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                            style={{ background: '#222', border: '1px solid #333', color: '#a0a0a0' }}
                          >
                            <Play className="h-3.5 w-3.5" /> Watch
                          </button>

                          {isTowel ? (
                            <>
                              <button
                                onClick={() => markComplete(d.id)}
                                className="flex-1 py-2 rounded-lg text-xs font-bold"
                                style={{ background: '#4ecdc4', color: '#000' }}
                              >
                                Cracked ✓
                              </button>
                              <button
                                onClick={() => {
                                  const drill2 = drills[1];
                                  if (drill2) drillRefs.current[drill2.id]?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="flex-1 py-2 rounded-lg text-xs font-bold"
                                style={{ background: '#E63946', color: '#fff' }}
                              >
                                No crack
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => markComplete(d.id)}
                              className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                              style={{ background: '#E63946', color: '#fff' }}
                            >
                              <Check className="h-3.5 w-3.5" /> Done
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Reboot Upload Card */}
            <div className="rounded-xl p-4" style={{ background: '#111', border: '1px solid rgba(68,136,255,0.3)' }}>
              <div className="flex items-center gap-3 mb-3">
                <Upload className="h-5 w-5" style={{ color: '#4488ff' }} />
                <p className="font-bold" style={{ color: '#fff' }}>Upload post-session Reboot file</p>
              </div>
              <button
                className="w-full py-3 rounded-lg text-sm font-bold"
                style={{ background: '#4488ff', color: '#fff' }}
                onClick={() => toast.info("Use the upload flow from your Data page")}
              >
                Upload Reboot File
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Video Modal */}
      {videoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.95)' }}>
          <button onClick={() => setVideoModal(null)} className="absolute top-4 right-4 p-2">
            <X className="h-6 w-6" style={{ color: '#fff' }} />
          </button>
          <div className="w-full max-w-2xl px-4">
            {videoModal.url ? (
              <video src={videoModal.url} controls autoPlay className="w-full rounded-xl" style={{ maxHeight: '70vh' }} />
            ) : (
              <div className="text-center py-20">
                <Play className="h-16 w-16 mx-auto mb-4" style={{ color: '#555' }} />
                <p className="text-lg font-bold" style={{ color: '#fff' }}>Video coming soon</p>
                <p className="text-sm mt-2" style={{ color: '#a0a0a0' }}>{videoModal.name}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <PlayerBottomNav />
    </div>
  );
}
