import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  Clock,
  Instagram,
  Twitter,
  Youtube,
  Loader2,
  Sparkles,
  BarChart3,
  Target,
  Zap,
  Check,
  ArrowRight,
  Flame,
  Calendar,
  CalendarDays
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isFuture, differenceInDays, startOfWeek, endOfWeek, addDays, isWithinInterval, subDays } from "date-fns";
import { toast } from "sonner";

interface ScheduledPost {
  id: string;
  platform: string;
  formatted_content: string;
  scheduled_for: string;
  status: string;
  content_item_id: string;
  hook?: string;
}

interface TopicGap {
  name: string;
  display_name: string;
  daysSincePosted: number | null;
  contentCount: number;
  priority: 'high' | 'medium' | 'low';
}

interface ContentSuggestion {
  topic: string;
  display_name: string;
  reason: string;
  type: 'trending' | 'seasonal' | 'gap' | 'ai';
  icon: React.ReactNode;
  prompt?: string;
}

interface TrendingTopic {
  topic: string;
  display_name: string;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
  tiktok: <span className="text-xs font-bold">TT</span>,
  youtube: <Youtube className="h-4 w-4" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  twitter: 'bg-blue-500',
  tiktok: 'bg-black',
  youtube: 'bg-red-500',
};

const SEASONAL_TOPICS: Record<string, { months: number[]; topics: string[]; reason: string }> = {
  spring_training: {
    months: [2, 3],
    topics: ['motor_profile', 'biomechanics', 'drills'],
    reason: 'Spring training season - players working on mechanics'
  },
  season_start: {
    months: [3, 4],
    topics: ['tempo', 'mindset', '4b_framework'],
    reason: 'Season starting - mental prep and timing focus'
  },
  mid_season: {
    months: [5, 6, 7],
    topics: ['transfer_ratio', 'data_critique', 'player_story'],
    reason: 'Mid-season adjustments and performance analysis'
  },
  late_season: {
    months: [8, 9],
    topics: ['mindset', 'tempo', 'biomechanics'],
    reason: 'Playoff push - mental fortitude and peak performance'
  },
  off_season: {
    months: [10, 11, 12, 1],
    topics: ['drills', 'biomechanics', 'unlock_vs_add'],
    reason: 'Off-season development and fundamental work'
  },
};

export function ContentCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeView, setActiveView] = useState<'calendar' | 'gaps' | 'suggestions' | 'health'>('calendar');
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
  const [generatingForTopic, setGeneratingForTopic] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch scheduled posts
  const { data: scheduledPosts, isLoading: postsLoading } = useQuery({
    queryKey: ['scheduled-posts', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      const { data, error } = await supabase
        .from('content_outputs')
        .select(`
          id,
          platform,
          formatted_content,
          scheduled_for,
          status,
          content_item_id,
          hook
        `)
        .not('scheduled_for', 'is', null)
        .gte('scheduled_for', start.toISOString())
        .lte('scheduled_for', end.toISOString())
        .order('scheduled_for', { ascending: true });
      
      if (error) throw error;
      return (data || []) as ScheduledPost[];
    },
  });

  // Fetch all posts for metrics
  const { data: allPosts } = useQuery({
    queryKey: ['all-content-outputs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_outputs')
        .select('id, platform, status, scheduled_for, posted_at')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch topics for gap analysis
  const { data: topics, isLoading: topicsLoading } = useQuery({
    queryKey: ['content-topics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_topics')
        .select('*')
        .order('last_posted_at', { ascending: true, nullsFirst: true });
      
      if (error) throw error;
      return data;
    },
  });

  // AI-powered trending suggestions
  const { data: trendingSuggestions, isLoading: trendingLoading, refetch: refetchTrending } = useQuery({
    queryKey: ['trending-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('suggest-trending-topics', {
        body: { 
          topics: topics?.map(t => ({ name: t.name, display_name: t.display_name, last_posted_at: t.last_posted_at })),
          currentMonth: new Date().getMonth() + 1
        }
      });
      
      if (error) throw error;
      return (data?.suggestions || []) as TrendingTopic[];
    },
    enabled: !!topics && topics.length > 0,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  // Generate content mutation
  const generateMutation = useMutation({
    mutationFn: async ({ topic, prompt }: { topic: string; prompt: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-content-suggestion', {
        body: { topic, prompt }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      toast.success('Content generated! Check the Queue tab.');
    },
    onError: (error) => {
      console.error('Generate error:', error);
      toast.error('Failed to generate content');
    },
    onSettled: () => {
      setGeneratingForTopic(null);
    }
  });

  // Calculate topic gaps
  const topicGaps = useMemo<TopicGap[]>(() => {
    if (!topics) return [];
    
    return topics.map(topic => {
      const daysSincePosted = topic.last_posted_at 
        ? differenceInDays(new Date(), new Date(topic.last_posted_at))
        : null;
      
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (daysSincePosted === null || daysSincePosted > 14) {
        priority = 'high';
      } else if (daysSincePosted > 7) {
        priority = 'medium';
      }
      
      return {
        name: topic.name,
        display_name: topic.display_name,
        daysSincePosted,
        contentCount: topic.content_count || 0,
        priority,
      };
    }).sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return (b.daysSincePosted ?? 999) - (a.daysSincePosted ?? 999);
    });
  }, [topics]);

  // Content health metrics
  const healthMetrics = useMemo(() => {
    const now = new Date();
    const last7Days = subDays(now, 7);
    const next7Days = addDays(now, 7);
    
    const scheduledNextWeek = scheduledPosts?.filter(p => {
      const date = new Date(p.scheduled_for);
      return isWithinInterval(date, { start: now, end: next7Days });
    }).length || 0;
    
    const postedLastWeek = allPosts?.filter(p => {
      if (!p.posted_at) return false;
      const date = new Date(p.posted_at);
      return isWithinInterval(date, { start: last7Days, end: now });
    }).length || 0;
    
    const platformDistribution = allPosts?.reduce((acc, p) => {
      acc[p.platform] = (acc[p.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    const highPriorityGaps = topicGaps.filter(g => g.priority === 'high').length;
    const mediumPriorityGaps = topicGaps.filter(g => g.priority === 'medium').length;
    
    const coverageScore = Math.max(0, 100 - (highPriorityGaps * 15) - (mediumPriorityGaps * 5));
    
    return {
      scheduledNextWeek,
      postedLastWeek,
      platformDistribution,
      highPriorityGaps,
      mediumPriorityGaps,
      coverageScore,
      totalTopics: topics?.length || 0,
    };
  }, [scheduledPosts, allPosts, topicGaps, topics]);

  // Generate content suggestions
  const suggestions = useMemo<ContentSuggestion[]>(() => {
    const currentMonthNum = new Date().getMonth() + 1;
    const results: ContentSuggestion[] = [];

    // Add AI trending suggestions first
    trendingSuggestions?.slice(0, 3).forEach(trend => {
      results.push({
        topic: trend.topic,
        display_name: trend.display_name,
        reason: trend.reason,
        type: 'ai',
        icon: <Zap className="h-4 w-4 text-yellow-500" />,
        prompt: `Create content about ${trend.display_name}: ${trend.reason}`
      });
    });

    // Add seasonal suggestions
    Object.entries(SEASONAL_TOPICS).forEach(([key, config]) => {
      if (config.months.includes(currentMonthNum)) {
        config.topics.forEach(topic => {
          const topicData = topics?.find(t => t.name === topic);
          if (topicData && !results.find(r => r.topic === topic)) {
            results.push({
              topic: topicData.name,
              display_name: topicData.display_name,
              reason: config.reason,
              type: 'seasonal',
              icon: <CalendarIcon className="h-4 w-4 text-primary" />,
              prompt: `Create seasonal content about ${topicData.display_name} for ${key.replace('_', ' ')}`
            });
          }
        });
      }
    });

    // Add gap-based suggestions
    topicGaps
      .filter(gap => gap.priority === 'high')
      .slice(0, 3)
      .forEach(gap => {
        if (!results.find(r => r.topic === gap.name)) {
          results.push({
            topic: gap.name,
            display_name: gap.display_name,
            reason: gap.daysSincePosted 
              ? `Not posted in ${gap.daysSincePosted} days`
              : 'Never posted about this topic',
            type: 'gap',
            icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
            prompt: `Create content about ${gap.display_name} - it hasn't been covered recently`
          });
        }
      });

    // Add evergreen suggestions
    const evergreen = [
      { topic: 'motor_profile', reason: 'Always high engagement - helps players identify their type' },
      { topic: 'transfer_ratio', reason: 'Core metric - establishes expertise' },
      { topic: 'unlock_vs_add', reason: 'Differentiating philosophy - builds brand' },
    ];
    
    evergreen.forEach(item => {
      const topicData = topics?.find(t => t.name === item.topic);
      if (topicData && !results.find(r => r.topic === item.topic)) {
        results.push({
          topic: topicData.name,
          display_name: topicData.display_name,
          reason: item.reason,
          type: 'trending',
          icon: <TrendingUp className="h-4 w-4 text-green-500" />,
          prompt: `Create evergreen content about ${topicData.display_name}`
        });
      }
    });

    return results.slice(0, 10);
  }, [topics, topicGaps, trendingSuggestions]);

  // Calendar days
  const calendarDays = useMemo(() => {
    if (calendarMode === 'week') {
      const start = startOfWeek(currentMonth);
      const end = endOfWeek(currentMonth);
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth, calendarMode]);

  const getPostsForDate = (date: Date) => {
    return scheduledPosts?.filter(post => 
      post.scheduled_for && isSameDay(new Date(post.scheduled_for), date)
    ) || [];
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (calendarMode === 'week') {
      setCurrentMonth(prev => direction === 'prev' ? addDays(prev, -7) : addDays(prev, 7));
    } else {
      setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
    }
    setSelectedDate(null);
  };

  const handleGenerateContent = (suggestion: ContentSuggestion) => {
    setGeneratingForTopic(suggestion.topic);
    generateMutation.mutate({ 
      topic: suggestion.topic, 
      prompt: suggestion.prompt || `Create content about ${suggestion.display_name}` 
    });
  };

  const isLoading = postsLoading || topicsLoading;

  return (
    <div className="space-y-6">
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Health
          </TabsTrigger>
          <TabsTrigger value="gaps" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Gaps
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Ideas
          </TabsTrigger>
        </TabsList>

        {/* Content Health Dashboard */}
        <TabsContent value="health" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Coverage Score</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {healthMetrics.coverageScore}%
                  {healthMetrics.coverageScore >= 80 && <Check className="h-5 w-5 text-green-500" />}
                  {healthMetrics.coverageScore < 60 && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={healthMetrics.coverageScore} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Topic coverage across all pillars
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Scheduled (Next 7 Days)</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {healthMetrics.scheduledNextWeek}
                  <Calendar className="h-5 w-5 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {healthMetrics.scheduledNextWeek === 0 
                    ? '⚠️ No content scheduled' 
                    : healthMetrics.scheduledNextWeek >= 7 
                      ? '✅ Great posting cadence' 
                      : '📅 Room for more posts'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Posted (Last 7 Days)</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {healthMetrics.postedLastWeek}
                  <Flame className="h-5 w-5 text-orange-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {healthMetrics.postedLastWeek >= 5 
                    ? '🔥 Consistent posting!' 
                    : 'Keep the momentum going'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Topic Gaps</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {healthMetrics.highPriorityGaps}
                  <Target className="h-5 w-5 text-red-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {healthMetrics.highPriorityGaps} high priority, {healthMetrics.mediumPriorityGaps} medium
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Platform Distribution */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Platform Distribution</CardTitle>
              <CardDescription>Posts by platform (last 100 posts)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {Object.entries(healthMetrics.platformDistribution).map(([platform, count]) => (
                  <div key={platform} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <div className={`w-10 h-10 rounded-full ${PLATFORM_COLORS[platform] || 'bg-gray-500'} flex items-center justify-center text-white`}>
                      {PLATFORM_ICONS[platform]}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{platform}</p>
                      <p className="text-sm text-muted-foreground">{count} posts</p>
                    </div>
                  </div>
                ))}
                {Object.keys(healthMetrics.platformDistribution).length === 0 && (
                  <p className="text-muted-foreground">No posts yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {topicGaps.filter(g => g.priority === 'high').slice(0, 3).map(gap => (
                  <Button 
                    key={gap.name}
                    variant="outline" 
                    size="sm"
                    onClick={() => handleGenerateContent({
                      topic: gap.name,
                      display_name: gap.display_name,
                      reason: 'Fill content gap',
                      type: 'gap',
                      icon: <AlertTriangle className="h-4 w-4" />,
                      prompt: `Create content about ${gap.display_name}`
                    })}
                    disabled={generatingForTopic === gap.name}
                  >
                    {generatingForTopic === gap.name ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Generate {gap.display_name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-lg">
                    {calendarMode === 'week' 
                      ? `Week of ${format(startOfWeek(currentMonth), 'MMM d, yyyy')}`
                      : format(currentMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex gap-1 border rounded-lg p-1">
                    <Button 
                      variant={calendarMode === 'week' ? 'secondary' : 'ghost'} 
                      size="sm"
                      onClick={() => setCalendarMode('week')}
                    >
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant={calendarMode === 'month' ? 'secondary' : 'ghost'} 
                      size="sm"
                      onClick={() => setCalendarMode('month')}
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar days */}
                  {calendarDays.map(day => {
                    const posts = getPostsForDate(day);
                    const isCurrentMonth = calendarMode === 'week' || day.getMonth() === currentMonth.getMonth();
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const hasGap = isFuture(day) && posts.length === 0 && isCurrentMonth;
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          relative p-2 rounded-md border text-left transition-colors
                          ${calendarMode === 'week' ? 'min-h-[120px]' : 'min-h-[80px]'}
                          ${!isCurrentMonth ? 'opacity-40' : ''}
                          ${isToday(day) ? 'border-primary bg-primary/5' : 'border-border'}
                          ${isSelected ? 'ring-2 ring-primary' : ''}
                          ${hasGap ? 'border-dashed border-amber-500/50' : ''}
                          hover:bg-accent
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`
                            text-sm font-medium
                            ${isToday(day) ? 'text-primary' : ''}
                          `}>
                            {format(day, 'd')}
                          </span>
                          {hasGap && (
                            <span className="text-xs text-amber-500">gap</span>
                          )}
                        </div>
                        
                        {posts.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {posts.slice(0, calendarMode === 'week' ? 5 : 3).map(post => (
                              <div 
                                key={post.id}
                                className={`flex items-center gap-1 text-xs rounded px-1 py-0.5 text-white ${PLATFORM_COLORS[post.platform] || 'bg-gray-500'}`}
                              >
                                {PLATFORM_ICONS[post.platform]}
                                <span className="truncate">
                                  {calendarMode === 'week' 
                                    ? (post.hook?.slice(0, 20) || post.formatted_content.slice(0, 20)) + '...'
                                    : format(new Date(post.scheduled_for), 'h:mm a')}
                                </span>
                              </div>
                            ))}
                            {posts.length > (calendarMode === 'week' ? 5 : 3) && (
                              <div className="text-xs text-muted-foreground">
                                +{posts.length - (calendarMode === 'week' ? 5 : 3)} more
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected date details */}
          {selectedDate && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </CardTitle>
                <CardDescription>
                  {getPostsForDate(selectedDate).length === 0 
                    ? 'No posts scheduled' 
                    : `${getPostsForDate(selectedDate).length} post(s) scheduled`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {getPostsForDate(selectedDate).length > 0 ? (
                  <div className="space-y-3">
                    {getPostsForDate(selectedDate).map(post => (
                      <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg border">
                        <div className={`w-10 h-10 rounded-full ${PLATFORM_COLORS[post.platform] || 'bg-gray-500'} flex items-center justify-center text-white`}>
                          {PLATFORM_ICONS[post.platform]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium capitalize">{post.platform}</span>
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(post.scheduled_for), 'h:mm a')}
                            </Badge>
                            <Badge 
                              variant={post.status === 'scheduled' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {post.status}
                            </Badge>
                          </div>
                          {post.hook && (
                            <p className="text-sm font-medium text-primary mb-1">{post.hook}</p>
                          )}
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {post.formatted_content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No content scheduled for this day</p>
                    <Button variant="outline" size="sm" className="mt-3">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Schedule Content
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Topic Gaps View */}
        <TabsContent value="gaps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Topic Coverage Gaps
              </CardTitle>
              <CardDescription>
                Topics that need attention - click to generate content
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {topicGaps.map(gap => (
                      <div 
                        key={gap.name}
                        className={`
                          flex items-center justify-between p-4 rounded-lg border transition-colors
                          ${gap.priority === 'high' ? 'border-red-500/30 bg-red-500/5' : ''}
                          ${gap.priority === 'medium' ? 'border-amber-500/30 bg-amber-500/5' : ''}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-3 h-3 rounded-full
                            ${gap.priority === 'high' ? 'bg-red-500' : ''}
                            ${gap.priority === 'medium' ? 'bg-amber-500' : ''}
                            ${gap.priority === 'low' ? 'bg-green-500' : ''}
                          `} />
                          <div>
                            <p className="font-medium">{gap.display_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {gap.daysSincePosted === null 
                                ? '⚠️ Never posted'
                                : gap.daysSincePosted === 0
                                  ? '✅ Posted today'
                                  : `Last posted ${gap.daysSincePosted} days ago`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">
                            {gap.contentCount} posts
                          </Badge>
                          <Button 
                            size="sm" 
                            variant={gap.priority === 'high' ? 'default' : 'outline'}
                            onClick={() => handleGenerateContent({
                              topic: gap.name,
                              display_name: gap.display_name,
                              reason: 'Fill gap',
                              type: 'gap',
                              icon: <AlertTriangle className="h-4 w-4" />,
                              prompt: `Create content about ${gap.display_name}`
                            })}
                            disabled={generatingForTopic === gap.name}
                          >
                            {generatingForTopic === gap.name ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-1" />
                                Generate
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suggestions View */}
        <TabsContent value="suggestions" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-400" />
                Content Ideas
              </h3>
              <p className="text-sm text-muted-foreground">
                AI-powered recommendations based on trends, gaps, and seasonality
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchTrending()}
              disabled={trendingLoading}
            >
              {trendingLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Refresh AI Ideas
            </Button>
          </div>

          {isLoading || trendingLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No suggestions available</p>
                  <p className="text-sm">Import more content to get personalized recommendations</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {suggestions.map((suggestion, idx) => (
                <Card 
                  key={`${suggestion.topic}-${idx}`} 
                  className={`
                    transition-all hover:shadow-md
                    ${suggestion.type === 'ai' ? 'border-yellow-500/30 bg-yellow-500/5' : ''}
                    ${suggestion.type === 'gap' ? 'border-red-500/30' : ''}
                  `}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {suggestion.icon}
                        <CardTitle className="text-base">{suggestion.display_name}</CardTitle>
                      </div>
                      <Badge 
                        variant={
                          suggestion.type === 'ai' ? 'default' :
                          suggestion.type === 'seasonal' ? 'secondary' : 
                          suggestion.type === 'gap' ? 'destructive' : 
                          'outline'
                        }
                        className={suggestion.type === 'ai' ? 'bg-yellow-500' : ''}
                      >
                        {suggestion.type === 'ai' ? '✨ AI Pick' : suggestion.type}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {suggestion.reason}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full group"
                      onClick={() => handleGenerateContent(suggestion)}
                      disabled={generatingForTopic === suggestion.topic}
                    >
                      {generatingForTopic === suggestion.topic ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Generate Content
                      <ArrowRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
