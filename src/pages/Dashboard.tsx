import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScoreCard } from "@/components/dashboard/ScoreCard";
import { LeakAlert } from "@/components/dashboard/LeakAlert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, TrendingUp } from "lucide-react";

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

const B_DESCRIPTIONS = {
  brain: "Pattern Consistency",
  body: "Energy Production",
  bat: "Energy Delivery",
  ball: "Output Consistency",
  overall: "Catch Barrel Score"
};

export default function Dashboard() {
  const { user } = useAuth();
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      
      // First get the player_id for this user using direct REST call
      // to avoid type recursion issues with Supabase client
      const authSession = await supabase.auth.getSession();
      const token = authSession.data.session?.access_token;
      
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
      
      const playerId = players[0].id;

      // Fetch from player_sessions using REST API directly
      // This handles the case where table might not be in generated types yet
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/player_sessions?player_id=eq.${playerId}&order=session_date.desc&limit=1`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          setSession(data[0] as PlayerSession);
        }
      }
    } catch (err) {
      console.error("Error loading session:", err);
      // Don't show error, just show empty state
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-48 mb-8 bg-slate-800" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-36 bg-slate-800 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 w-full bg-slate-800 rounded-lg mb-6" />
          <Skeleton className="h-24 w-full bg-slate-800 rounded-lg" />
        </div>
      </div>
    );
  }

  // Empty state
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="bg-[#1F2937] rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <TrendingUp className="h-12 w-12 text-[#DC2626]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">No Analysis Data Yet</h2>
          <p className="text-gray-400 mb-6">
            Upload your first swing session to see your 4B scores and get personalized training recommendations.
          </p>
          <Button asChild className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
            <Link to="/analyze">
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First Swing
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your 4B Scores</h1>
          <p className="text-gray-400">
            Session from {new Date(session.session_date).toLocaleDateString()}
          </p>
        </div>

        {/* Main Overall Score Card */}
        <div className="mb-6">
          <ScoreCard
            label="OVERALL"
            description={B_DESCRIPTIONS.overall}
            score={session.overall_score}
            grade={session.overall_grade}
            isMain
          />
        </div>

        {/* 4B Score Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Energy Leak Analysis</h2>
          <LeakAlert
            type={session.leak_type}
            caption={session.leak_caption}
            training={session.leak_training}
          />
        </div>

        {/* Action Button */}
        <div className="text-center">
          <Button asChild variant="outline" className="border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626] hover:text-white">
            <Link to="/analyze">
              <Upload className="h-4 w-4 mr-2" />
              Upload New Session
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
