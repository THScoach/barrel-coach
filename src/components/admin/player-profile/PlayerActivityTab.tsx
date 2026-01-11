import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { BarChart3, Target, Activity, Video, MessageSquare, FileText } from "lucide-react";

interface PlayerActivityTabProps {
  playerId: string;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
  scores?: {
    brain?: number;
    body?: number;
    bat?: number;
    ball?: number;
  };
}

export function PlayerActivityTab({ playerId }: PlayerActivityTabProps) {
  const [filter, setFilter] = useState("all");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSessions: 0,
    lastAssessment: null as Date | null,
    recentScore: null as { brain?: number; body?: number; bat?: number; ball?: number } | null,
  });

  useEffect(() => {
    loadActivities();
  }, [playerId, filter]);

  const loadActivities = async () => {
    setLoading(true);
    
    const [sessionsRes, launchRes, rebootRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('player_id', playerId).order('created_at', { ascending: false }).limit(20),
      supabase.from('launch_monitor_sessions').select('*').eq('player_id', playerId).order('session_date', { ascending: false }).limit(20),
      supabase.from('reboot_uploads').select('*').eq('player_id', playerId).order('created_at', { ascending: false }).limit(20),
    ]);

    const allActivities: ActivityItem[] = [
      ...(sessionsRes.data || []).map(s => ({
        id: s.id,
        type: 'analyzer',
        title: 'Swing Analysis',
        description: s.product_type || 'Video analysis completed',
        date: new Date(s.created_at || new Date()),
        scores: { brain: s.four_b_brain, body: s.four_b_body, bat: s.four_b_bat },
      })),
      ...(launchRes.data || []).map(s => ({
        id: s.id,
        type: 'hittrax',
        title: `${s.source || 'HitTrax'} Session`,
        description: `${s.total_swings || 0} swings`,
        date: new Date(s.session_date),
        scores: { ball: s.ball_score },
      })),
      ...(rebootRes.data || []).map(s => ({
        id: s.id,
        type: 'reboot',
        title: 'Reboot Session',
        description: s.ik_file_uploaded && s.me_file_uploaded ? 'IK & ME Data' : s.ik_file_uploaded ? 'IK Data' : 'ME Data',
        date: new Date(s.created_at || new Date()),
        scores: { brain: s.brain_score, body: s.body_score, bat: s.bat_score },
      })),
    ];

    allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());

    const filtered = filter === 'all' 
      ? allActivities 
      : allActivities.filter(a => a.type === filter);

    setActivities(filtered);
    
    setStats({
      totalSessions: allActivities.length,
      lastAssessment: allActivities[0]?.date || null,
      recentScore: allActivities[0]?.scores || null,
    });
    
    setLoading(false);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'analyzer': return <BarChart3 className="h-4 w-4 text-primary" />;
      case 'hittrax': return <Target className="h-4 w-4 text-emerald-500" />;
      case 'reboot': return <Activity className="h-4 w-4 text-blue-500" />;
      case 'video': return <Video className="h-4 w-4 text-purple-500" />;
      case 'message': return <MessageSquare className="h-4 w-4 text-amber-500" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: Activity Feed (2 cols) */}
      <div className="col-span-2 space-y-4">
        {/* Filter */}
        <div className="flex items-center justify-between">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48 bg-slate-800/50 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              <SelectItem value="all">All Activity</SelectItem>
              <SelectItem value="analyzer">Analyzer</SelectItem>
              <SelectItem value="hittrax">HitTrax</SelectItem>
              <SelectItem value="reboot">Reboot</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="bg-slate-800 text-slate-300">
            {activities.length} items
          </Badge>
        </div>

        {/* Activity List */}
        <div className="space-y-3">
          {loading ? (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-8 text-center">
                <p className="text-slate-400">Loading activities...</p>
              </CardContent>
            </Card>
          ) : activities.length === 0 ? (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="py-8 text-center">
                <p className="text-slate-400">No activity yet for this player.</p>
              </CardContent>
            </Card>
          ) : (
            activities.map(activity => (
              <Card key={activity.id} className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getActivityIcon(activity.type)}
                      <div>
                        <p className="font-medium text-white">{activity.title}</p>
                        <p className="text-sm text-slate-400">{activity.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {activity.scores && (
                        <div className="flex gap-2 text-xs">
                          {activity.scores.brain !== undefined && activity.scores.brain !== null && (
                            <Badge variant="outline" className="border-slate-700 text-slate-300">B:{activity.scores.brain}</Badge>
                          )}
                          {activity.scores.body !== undefined && activity.scores.body !== null && (
                            <Badge variant="outline" className="border-slate-700 text-slate-300">Bo:{activity.scores.body}</Badge>
                          )}
                          {activity.scores.bat !== undefined && activity.scores.bat !== null && (
                            <Badge variant="outline" className="border-slate-700 text-slate-300">Ba:{activity.scores.bat}</Badge>
                          )}
                          {activity.scores.ball !== undefined && activity.scores.ball !== null && (
                            <Badge variant="outline" className="border-slate-700 text-slate-300">Ball:{activity.scores.ball}</Badge>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(activity.date, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Right: Widgets (1 col) */}
      <div className="space-y-4">
        {/* Latest Scores */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300">Latest 4B Scores</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentScore ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 bg-slate-800/50 rounded">
                  <p className="text-2xl font-bold text-white">{stats.recentScore.brain ?? '--'}</p>
                  <p className="text-xs text-slate-400">Brain</p>
                </div>
                <div className="text-center p-2 bg-slate-800/50 rounded">
                  <p className="text-2xl font-bold text-white">{stats.recentScore.body ?? '--'}</p>
                  <p className="text-xs text-slate-400">Body</p>
                </div>
                <div className="text-center p-2 bg-slate-800/50 rounded">
                  <p className="text-2xl font-bold text-white">{stats.recentScore.bat ?? '--'}</p>
                  <p className="text-xs text-slate-400">Bat</p>
                </div>
                <div className="text-center p-2 bg-slate-800/50 rounded">
                  <p className="text-2xl font-bold text-white">{stats.recentScore.ball ?? '--'}</p>
                  <p className="text-xs text-slate-400">Ball</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-500 text-sm">No scores yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assessment Status */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300">Assessment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lastAssessment ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Last Assessment</span>
                  <span className="text-sm text-white">{format(stats.lastAssessment, 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Total Sessions</span>
                  <span className="text-sm text-white">{stats.totalSessions}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-500 text-sm">No assessments yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
