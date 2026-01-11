import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Video,
  Upload,
  MessageSquare,
  Activity,
  Target,
  FileText,
  CheckCircle,
  Loader2,
  Filter,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type ActivityType = 'video_upload' | 'analyzer_complete' | 'hittrax_import' | 'reboot_import' | 'message_received' | 'data_upload';
type FilterType = 'all' | 'needs_review' | 'new_data' | 'videos' | 'messages';

interface ActivityItem {
  id: string;
  type: ActivityType;
  playerId: string;
  playerName: string;
  description: string;
  timestamp: string;
  read: boolean;
  tab?: string;
}

const activityIcons: Record<ActivityType, React.ReactNode> = {
  video_upload: <Video className="h-4 w-4" />,
  analyzer_complete: <CheckCircle className="h-4 w-4" />,
  hittrax_import: <Target className="h-4 w-4" />,
  reboot_import: <Activity className="h-4 w-4" />,
  message_received: <MessageSquare className="h-4 w-4" />,
  data_upload: <Upload className="h-4 w-4" />,
};

const activityColors: Record<ActivityType, string> = {
  video_upload: 'bg-blue-500/20 text-blue-400',
  analyzer_complete: 'bg-green-500/20 text-green-400',
  hittrax_import: 'bg-orange-500/20 text-orange-400',
  reboot_import: 'bg-purple-500/20 text-purple-400',
  message_received: 'bg-cyan-500/20 text-cyan-400',
  data_upload: 'bg-yellow-500/20 text-yellow-400',
};

export function ActivityFeed() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Fetch recent activity from multiple sources
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch recent sessions (video uploads)
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, player_name, player_id, status, created_at, product_type')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch recent launch monitor sessions
      const { data: launchMonitor } = await supabase
        .from('launch_monitor_sessions')
        .select('id, player_id, session_date, source, created_at, players!inner(name)')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent reboot uploads
      const { data: rebootUploads } = await supabase
        .from('reboot_uploads')
        .select('id, player_id, session_date, created_at, players!inner(name)')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      // Combine and sort all activities
      const allActivities: ActivityItem[] = [];

      sessions?.forEach(s => {
        const type: ActivityType = s.status === 'analyzed' ? 'analyzer_complete' : 'video_upload';
        allActivities.push({
          id: `session-${s.id}`,
          type,
          playerId: s.player_id || '',
          playerName: s.player_name,
          description: type === 'analyzer_complete' 
            ? `Analysis completed for ${s.product_type}` 
            : `New ${s.product_type} video uploaded`,
          timestamp: s.created_at,
          read: s.status === 'analyzed',
          tab: 'data',
        });
      });

      launchMonitor?.forEach(lm => {
        allActivities.push({
          id: `lm-${lm.id}`,
          type: 'hittrax_import',
          playerId: lm.player_id || '',
          playerName: (lm.players as any)?.name || 'Unknown',
          description: `${lm.source} data imported`,
          timestamp: lm.created_at || '',
          read: false,
          tab: 'data',
        });
      });

      rebootUploads?.forEach(rb => {
        allActivities.push({
          id: `reboot-${rb.id}`,
          type: 'reboot_import',
          playerId: rb.player_id || '',
          playerName: (rb.players as any)?.name || 'Unknown',
          description: 'Reboot Motion data imported',
          timestamp: rb.created_at || '',
          read: false,
          tab: 'data',
        });
      });

      // Sort by timestamp
      return allActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },
  });

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'needs_review') return !activity.read;
    if (filter === 'new_data') return ['hittrax_import', 'reboot_import', 'data_upload'].includes(activity.type);
    if (filter === 'videos') return activity.type === 'video_upload';
    if (filter === 'messages') return activity.type === 'message_received';
    return true;
  });

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const handleActivityClick = (activity: ActivityItem) => {
    if (activity.playerId) {
      navigate(`/admin/players/${activity.playerId}?tab=${activity.tab || 'activity'}`);
    }
  };

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All Activity' },
    { key: 'needs_review', label: 'Needs Review' },
    { key: 'new_data', label: 'New Data' },
    { key: 'videos', label: 'Videos' },
    { key: 'messages', label: 'Messages' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {filterButtons.map(btn => (
            <Button
              key={btn.key}
              variant={filter === btn.key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter(btn.key)}
              className={cn(
                filter === btn.key 
                  ? "bg-slate-800 text-white" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              )}
            >
              {btn.label}
            </Button>
          ))}
        </div>
        <span className="text-sm text-slate-500">Last 7 days</span>
      </div>

      {/* Activity List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No activity to show</p>
          </div>
        ) : (
          filteredActivities.map(activity => (
            <div
              key={activity.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer",
                activity.read 
                  ? "bg-slate-900/30 hover:bg-slate-900/50" 
                  : "bg-slate-900/80 hover:bg-slate-800"
              )}
              onClick={() => handleActivityClick(activity)}
            >
              <Checkbox
                checked={selectedItems.has(activity.id)}
                onCheckedChange={() => toggleSelect(activity.id)}
                onClick={(e) => e.stopPropagation()}
                className="border-slate-600"
              />
              
              <div className={cn("p-2 rounded-lg", activityColors[activity.type])}>
                {activityIcons[activity.type]}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium truncate",
                  activity.read ? "text-slate-400" : "text-white"
                )}>
                  {activity.playerName}
                </p>
                <p className="text-sm text-slate-500 truncate">{activity.description}</p>
              </div>
              
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </p>
                {!activity.read && (
                  <Badge className="mt-1 bg-red-500/20 text-red-400 border-0">New</Badge>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Mark as Read Button */}
      {selectedItems.size > 0 && (
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm"
            className="border-slate-700 text-slate-300"
            onClick={() => setSelectedItems(new Set())}
          >
            Mark {selectedItems.size} as Read
          </Button>
        </div>
      )}
    </div>
  );
}
