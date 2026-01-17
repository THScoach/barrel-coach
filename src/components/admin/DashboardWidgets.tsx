import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Users,
  Activity,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";

export function DashboardWidgets() {
  const navigate = useNavigate();

  // Assessment Health Widget
  const { data: assessmentHealth, isLoading: loadingHealth } = useQuery({
    queryKey: ['assessment-health'],
    queryFn: async () => {
      const { data: players } = await supabase
        .from('players')
        .select('id, name, updated_at, latest_composite_score')
        .not('latest_composite_score', 'is', null);

      const now = new Date();
      let needsData = 0;
      let dueSoon = 0;
      let current = 0;

      players?.forEach(p => {
        const daysSince = differenceInDays(now, new Date(p.updated_at || now));
        if (daysSince > 30) needsData++;
        else if (daysSince > 21) dueSoon++;
        else current++;
      });

      return { needsData, dueSoon, current };
    },
  });

  // Players with unseen activity
  const { data: unseenActivity = [], isLoading: loadingUnseen } = useQuery({
    queryKey: ['unseen-activity'],
    queryFn: async () => {
      // Get recent sessions that haven't been reviewed
      const { data: sessions } = await supabase
        .from('sessions')
        .select('player_name, player_id, status')
        .eq('status', 'uploaded')
        .order('created_at', { ascending: false })
        .limit(5);

      const playerCounts: Record<string, { name: string; count: number; id: string }> = {};
      sessions?.forEach(s => {
        const key = s.player_id || s.player_name;
        if (!playerCounts[key]) {
          playerCounts[key] = { name: s.player_name, count: 0, id: s.player_id || '' };
        }
        playerCounts[key].count++;
      });

      return Object.values(playerCounts).slice(0, 4);
    },
  });

  // Inactive players
  const { data: inactivePlayers = [], isLoading: loadingInactive } = useQuery({
    queryKey: ['inactive-players'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data } = await supabase
        .from('player_profiles')
        .select('id, first_name, last_name, updated_at')
        .eq('is_active', true)
        .lt('updated_at', thirtyDaysAgo.toISOString())
        .order('updated_at', { ascending: true })
        .limit(4);

      return data?.map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name || ''}`.trim(),
        daysSince: differenceInDays(new Date(), new Date(p.updated_at || new Date())),
      })) || [];
    },
  });

  // Player counts
  const { data: playerCounts, isLoading: loadingCounts } = useQuery({
    queryKey: ['player-counts'],
    queryFn: async () => {
      const { count: active } = await supabase
        .from('player_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: inactive } = await supabase
        .from('player_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false);

      return { active: active || 0, inactive: inactive || 0 };
    },
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {/* Assessment Health Widget */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            Assessment Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHealth ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <span className="text-xs text-red-400">Needs Data</span>
                  </div>
                  <p className="text-2xl font-bold text-red-400">{assessmentHealth?.needsData || 0}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs text-yellow-400">Due Soon</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">{assessmentHealth?.dueSoon || 0}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/10">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-xs text-green-400">Current</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400">{assessmentHealth?.current || 0}</p>
                </div>
              </div>
              <Button 
                variant="link" 
                className="text-red-400 p-0 h-auto text-xs"
                onClick={() => navigate('/admin/players?filter=needs-assessment')}
              >
                View breakdown →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unseen Activity Widget */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            Unseen Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUnseen ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : unseenActivity.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">All caught up! 🎉</p>
          ) : (
            <div className="space-y-2">
              {unseenActivity.map((player, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => player.id && navigate(`/admin/players/${player.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-slate-700 text-slate-300 text-xs">
                        {getInitials(player.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-white">{player.name}</span>
                  </div>
                  <span className="text-sm font-medium text-red-400">{player.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Needs Attention Widget */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            Needs Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingInactive ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : inactivePlayers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">All players engaged!</p>
          ) : (
            <div className="space-y-2">
              {inactivePlayers.map((player) => (
                <div 
                  key={player.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/players/${player.id}`)}
                >
                  <span className="text-sm text-white">{player.name}</span>
                  <span className="text-xs text-slate-400">
                    Inactive {player.daysSince} days
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Players Widget */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            My Players
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCounts ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{playerCounts?.active || 0}</p>
                <p className="text-xs text-slate-400">Active</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-400">{playerCounts?.inactive || 0}</p>
                <p className="text-xs text-slate-400">Inactive</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
