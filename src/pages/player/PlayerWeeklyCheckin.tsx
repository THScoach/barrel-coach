import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WeeklyCheckinChat } from '@/components/WeeklyCheckinChat';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  status: string;
  games: number | null;
  hits: number | null;
  ab: number | null;
  completed_at: string | null;
}

export default function PlayerWeeklyCheckin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [isInSeason, setIsInSeason] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentReports, setRecentReports] = useState<WeeklyReport[]>([]);
  const [showCheckin, setShowCheckin] = useState(false);
  const [thisWeekComplete, setThisWeekComplete] = useState(false);

  useEffect(() => {
    fetchPlayerData();
  }, [user]);

  const fetchPlayerData = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      // Find player by email
      const { data: player } = await supabase
        .from('players')
        .select('id, name, is_in_season')
        .eq('email', user.email)
        .single();

      if (player) {
        setPlayerId(player.id);
        setPlayerName(player.name);
        setIsInSeason(player.is_in_season || false);

        // Get recent weekly reports
        const { data: reports } = await supabase
          .from('game_weekly_reports')
          .select('id, week_start, week_end, status, games, hits, ab, completed_at')
          .eq('player_id', player.id)
          .order('week_start', { ascending: false })
          .limit(4);

        setRecentReports(reports || []);

        // Check if this week's report is complete
        const today = new Date();
        const dayOfWeek = today.getDay();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek);
        const weekStartStr = weekStart.toISOString().split('T')[0];

        const thisWeekReport = reports?.find(r => r.week_start === weekStartStr);
        setThisWeekComplete(thisWeekReport?.status === 'completed');
      }
    } catch (error) {
      console.error('Failed to fetch player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setThisWeekComplete(true);
    setShowCheckin(false);
    toast.success('Weekly check-in complete!');
    fetchPlayerData(); // Refresh reports
  };

  const formatWeekRange = (weekStart: string, weekEnd: string) => {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!playerId) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Player profile not found.</p>
          <Button variant="outline" onClick={() => navigate('/player')} className="mt-4">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  if (!isInSeason) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/player')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <Card className="p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2">Not In Season</h2>
          <p className="text-muted-foreground mb-4">
            Weekly check-ins are available during your season. 
            Contact your coach to enable in-season mode.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/player')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Weekly Check-In</h1>
        <p className="text-muted-foreground">
          Quick update on your week with Coach Rick
        </p>
      </div>

      {/* Show Check-in Chat or Start Button */}
      {showCheckin ? (
        <Card className="overflow-hidden">
          <WeeklyCheckinChat 
            playerId={playerId} 
            playerName={playerName}
            onComplete={handleComplete}
          />
        </Card>
      ) : (
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {thisWeekComplete ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">This Week Complete</h3>
                    <p className="text-sm text-muted-foreground">You've already checked in this week</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Ready for Check-In</h3>
                    <p className="text-sm text-muted-foreground">Takes about 3-5 minutes</p>
                  </div>
                </>
              )}
            </div>
            
            <Button 
              onClick={() => setShowCheckin(true)}
              disabled={thisWeekComplete}
            >
              {thisWeekComplete ? 'Complete' : 'Start Check-In'}
            </Button>
          </div>
        </Card>
      )}

      {/* Recent Reports */}
      {recentReports.length > 0 && !showCheckin && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Weeks</h2>
          <div className="space-y-2">
            {recentReports.map((report) => (
              <Card key={report.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {formatWeekRange(report.week_start, report.week_end)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {report.status === 'completed' && report.ab && report.ab > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {report.games} G • {((report.hits || 0) / report.ab).toFixed(3).slice(1)} AVG
                      </span>
                    )}
                    
                    {report.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-xs text-muted-foreground">In Progress</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
