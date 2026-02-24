import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScoreCard } from "@/components/dashboard/ScoreCard";
import { LeakAlert } from "@/components/dashboard/LeakAlert";
import { CoachRickChat } from "@/components/dashboard/CoachRickChat";
import { PrescribedDrills } from "@/components/drills/PrescribedDrills";
import { PrescribedVideos } from "@/components/player/PrescribedVideos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, TrendingUp, Activity, Target, Zap, Circle } from "lucide-react";

interface PlayerSession {
  id: string;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  overall_score: number | null;
  brain_grade: string | null;
  body_grade: string | null;
  bat_grade: string | null;
  ball_grade: string | null;
  overall_grade: string | null;
  leak_type: string | null;
  leak_caption: string | null;
  leak_training: string | null;
  session_date: string;
}

// Map reboot_uploads to PlayerSession format
interface RebootUpload {
  id: string;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  composite_score: number | null;
  grade: string | null;
  weakest_link: string | null;
  session_date: string;
}

const B_DESCRIPTIONS = {
  brain: "Pattern Recognition & Consistency",
  body: "Ground-Up Energy Production",
  bat: "Energy Delivery to Barrel",
  ball: "Exit Velocity & Output",
  overall: "Catch Barrel Score"
};

const B_ICONS = {
  brain: Target,
  body: Activity,
  bat: Zap,
  ball: Circle,
};

function getGrade(score: number | null): string {
  if (score === null) return "No Data";
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 45) return "Average";
  if (score >= 40) return "Below Avg";
  if (score >= 30) return "Fringe";
  return "Poor";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLatestSession();
    } else {
      setLoading(false);
    }
  }, [user]);

  async function loadLatestSession() {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      const authSession = await supabase.auth.getSession();
      const token = authSession.data.session?.access_token;
      
      // Get the player_id for this user
      const playerResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/players?user_id=eq.${user.id}&select=id&limit=1`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!playerResponse.ok) {
        setLoading(false);
        return;
      }
      
      const players = await playerResponse.json();
      if (!players || players.length === 0) {
        setLoading(false);
        return;
      }
      
      const fetchedPlayerId = players[0].id;
      setPlayerId(fetchedPlayerId);

      // Try player_sessions first, then fall back to reboot_uploads
      let sessionData: PlayerSession | null = null;
      
      // Try player_sessions
      const psResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/player_sessions?player_id=eq.${fetchedPlayerId}&order=session_date.desc&limit=1`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (psResponse.ok) {
        const data = await psResponse.json();
        if (data && data.length > 0) {
          sessionData = data[0] as PlayerSession;
        }
      }

      // Fall back to reboot_uploads if no player_sessions
      if (!sessionData) {
        const ruResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/reboot_uploads?player_id=eq.${fetchedPlayerId}&order=session_date.desc&limit=1`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${token}`,
            }
          }
        );

        if (ruResponse.ok) {
          const data = await ruResponse.json();
          if (data && data.length > 0) {
            const ru = data[0] as RebootUpload;
            // Map reboot_uploads to PlayerSession format
            sessionData = {
              id: ru.id,
              brain_score: ru.brain_score,
              body_score: ru.body_score,
              bat_score: ru.bat_score,
              ball_score: null, // reboot_uploads doesn't have ball_score
              overall_score: ru.composite_score,
              brain_grade: getGrade(ru.brain_score),
              body_grade: getGrade(ru.body_score),
              bat_grade: getGrade(ru.bat_score),
              ball_grade: null,
              overall_grade: ru.grade,
              leak_type: ru.weakest_link,
              leak_caption: ru.weakest_link ? `Your ${ru.weakest_link.toUpperCase()} score needs the most attention.` : null,
              leak_training: "Focus on drills targeting your weakest link for maximum improvement.",
              session_date: ru.session_date,
            };
          }
        }
      }

      if (sessionData) {
        setSession(sessionData);
      }
    } catch (err) {
      console.error("Error loading session:", err);
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#111113] p-6">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8 bg-gray-900" />
          <Skeleton className="h-48 w-full bg-gray-900 rounded-xl mb-6" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-44 bg-gray-900 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-32 w-full bg-gray-900 rounded-xl" />
        </div>
      </div>
    );
  }

  // Empty state
  if (!session) {
    return (
      <div className="min-h-screen bg-[#111113] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="bg-[#1a1a1c] rounded-2xl p-8 w-28 h-28 mx-auto mb-8 flex items-center justify-center border border-[#DC2626]/20">
            <TrendingUp className="h-14 w-14 text-[#DC2626]" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">
            No Analysis Data Yet
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Upload your first swing session to see your 4B scores and get personalized training recommendations from Coach Rick.
          </p>
          <Button asChild className="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold px-8 py-6 text-lg rounded-xl">
            <Link to="/analyze">
              <Upload className="h-5 w-5 mr-3" />
              Upload Your First Swing
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111113] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-8 bg-[#DC2626] rounded-full" />
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              4B Scorecard
            </h1>
          </div>
          <p className="text-gray-500 ml-5">
            Session from {new Date(session.session_date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Main Overall Score Card */}
        <div className="mb-8">
          <ScoreCard
            label="OVERALL"
            description={B_DESCRIPTIONS.overall}
            score={session.overall_score}
            grade={session.overall_grade}
            isMain
          />
        </div>

        {/* 4B Score Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <ScoreCard
            label="BRAIN"
            description={B_DESCRIPTIONS.brain}
            score={session.brain_score}
            grade={session.brain_grade}
          />
          <ScoreCard
            label="BODY"
            description={B_DESCRIPTIONS.body}
            score={session.body_score}
            grade={session.body_grade}
          />
          <ScoreCard
            label="BAT"
            description={B_DESCRIPTIONS.bat}
            score={session.bat_score}
            grade={session.bat_grade}
          />
          <ScoreCard
            label="BALL"
            description={B_DESCRIPTIONS.ball}
            score={session.ball_score}
            grade={session.ball_grade}
          />
        </div>

        {/* Leak Alert */}
        {session.leak_type && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-6 bg-[#DC2626] rounded-full" />
              <h2 className="text-xl font-bold text-white">Energy Leak Analysis</h2>
            </div>
            <LeakAlert
              type={session.leak_type}
              caption={session.leak_caption}
              training={session.leak_training}
            />
          </div>
        )}

        {/* Prescribed Videos Section */}
        {playerId && session.leak_type && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-6 bg-[#DC2626] rounded-full" />
              <h2 className="text-xl font-bold text-white">Watch & Learn</h2>
            </div>
            <PrescribedVideos 
              playerId={playerId} 
              weakestCategory={session.leak_type}
            />
          </div>
        )}

        {/* Prescribed Drills Section */}
        {playerId && (
          <div className="mb-10">
            <PrescribedDrills playerId={playerId} />
          </div>
        )}

        {/* Coach Rick Chat */}
        {playerId && (
          <div className="mb-10">
            <CoachRickChat playerId={playerId} priorityPillar={session.leak_type} />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 border-t border-gray-900">
          <Button 
            asChild 
            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold px-8 py-6 rounded-xl w-full sm:w-auto"
          >
            <Link to="/analyze">
              <Upload className="h-5 w-5 mr-2" />
              Upload New Session
            </Link>
          </Button>
          <Button 
            asChild 
            variant="outline" 
            className="border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 px-8 py-6 rounded-xl w-full sm:w-auto"
          >
            <Link to="/player/drills">
              <Target className="h-5 w-5 mr-2" />
              View Recommended Drills
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}