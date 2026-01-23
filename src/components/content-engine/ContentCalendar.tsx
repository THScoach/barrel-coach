import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Sparkles
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isFuture, differenceInDays, startOfWeek, endOfWeek, addDays } from "date-fns";

interface ScheduledPost {
  id: string;
  platform: string;
  formatted_content: string;
  scheduled_for: string;
  status: string;
  content_item_id: string;
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
  type: 'trending' | 'seasonal' | 'gap';
  icon: React.ReactNode;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
  tiktok: <span className="text-xs font-bold">TT</span>,
  youtube: <Youtube className="h-4 w-4" />,
};

const SEASONAL_TOPICS: Record<string, { months: number[]; topics: string[]; reason: string }> = {
  spring_training: {
    months: [2, 3], // Feb, March
    topics: ['motor_profile', 'biomechanics', 'drills'],
    reason: 'Spring training season - players working on mechanics'
  },
  season_start: {
    months: [3, 4], // March, April
    topics: ['tempo', 'mindset', '4b_framework'],
    reason: 'Season starting - mental prep and timing focus'
  },
  mid_season: {
    months: [5, 6, 7], // May-July
    topics: ['transfer_ratio', 'data_critique', 'player_story'],
    reason: 'Mid-season adjustments and performance analysis'
  },
  late_season: {
    months: [8, 9], // Aug, Sept
    topics: ['mindset', 'tempo', 'biomechanics'],
    reason: 'Playoff push - mental fortitude and peak performance'
  },
  off_season: {
    months: [10, 11, 12, 1], // Oct-Jan
    topics: ['drills', 'biomechanics', 'unlock_vs_add'],
    reason: 'Off-season development and fundamental work'
  },
};

export function ContentCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeView, setActiveView] = useState<'calendar' | 'gaps' | 'suggestions'>('calendar');

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
          content_item_id
        `)
        .not('scheduled_for', 'is', null)
        .gte('scheduled_for', start.toISOString())
        .lte('scheduled_for', end.toISOString())
        .order('scheduled_for', { ascending: true });
      
      if (error) throw error;
      return (data || []) as ScheduledPost[];
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
      // Sort by priority (high first), then by days since posted
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return (b.daysSincePosted ?? 999) - (a.daysSincePosted ?? 999);
    });
  }, [topics]);

  // Generate content suggestions
  const suggestions = useMemo<ContentSuggestion[]>(() => {
    const currentMonthNum = new Date().getMonth() + 1;
    const results: ContentSuggestion[] = [];

    // Add seasonal suggestions
    Object.entries(SEASONAL_TOPICS).forEach(([key, config]) => {
      if (config.months.includes(currentMonthNum)) {
        config.topics.forEach(topic => {
          const topicData = topics?.find(t => t.name === topic);
          if (topicData) {
            results.push({
              topic: topicData.name,
              display_name: topicData.display_name,
              reason: config.reason,
              type: 'seasonal',
              icon: <CalendarIcon className="h-4 w-4 text-primary" />,
            });
          }
        });
      }
    });

    // Add gap-based suggestions (topics not posted recently)
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
          });
        }
      });

    // Add evergreen/trending suggestions
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
        });
      }
    });

    return results.slice(0, 8);
  }, [topics, topicGaps]);

  // Calendar days
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get posts for a specific date
  const getPostsForDate = (date: Date) => {
    return scheduledPosts?.filter(post => 
      post.scheduled_for && isSameDay(new Date(post.scheduled_for), date)
    ) || [];
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
    setSelectedDate(null);
  };

  const isLoading = postsLoading || topicsLoading;

  return (
    <div className="space-y-6">
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="gaps" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Topic Gaps
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Suggestions
          </TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                    <ChevronLeft className="h-4 w-4" />
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
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          relative p-2 min-h-[80px] rounded-md border text-left transition-colors
                          ${!isCurrentMonth ? 'opacity-40' : ''}
                          ${isToday(day) ? 'border-primary bg-primary/5' : 'border-border'}
                          ${isSelected ? 'ring-2 ring-primary' : ''}
                          hover:bg-accent
                        `}
                      >
                        <span className={`
                          text-sm font-medium
                          ${isToday(day) ? 'text-primary' : ''}
                        `}>
                          {format(day, 'd')}
                        </span>
                        
                        {posts.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {posts.slice(0, 3).map(post => (
                              <div 
                                key={post.id}
                                className="flex items-center gap-1 text-xs bg-primary/10 rounded px-1 py-0.5"
                              >
                                {PLATFORM_ICONS[post.platform]}
                                <span className="truncate">
                                  {format(new Date(post.scheduled_for), 'h:mm a')}
                                </span>
                              </div>
                            ))}
                            {posts.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{posts.length - 3} more
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
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
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
                Identify topics that haven't been covered recently to maintain balanced content.
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
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-2 h-2 rounded-full
                            ${gap.priority === 'high' ? 'bg-destructive' : ''}
                            ${gap.priority === 'medium' ? 'bg-amber-500' : ''}
                            ${gap.priority === 'low' ? 'bg-green-500' : ''}
                          `} />
                          <div>
                            <p className="font-medium">{gap.display_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {gap.daysSincePosted === null 
                                ? 'Never posted'
                                : gap.daysSincePosted === 0
                                  ? 'Posted today'
                                  : `Last posted ${gap.daysSincePosted} days ago`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">
                            {gap.contentCount} posts
                          </Badge>
                          <Badge 
                            variant={gap.priority === 'high' ? 'destructive' : gap.priority === 'medium' ? 'secondary' : 'outline'}
                          >
                            {gap.priority} priority
                          </Badge>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-400" />
                Content Suggestions
              </CardTitle>
              <CardDescription>
                Smart recommendations based on seasonal trends, topic gaps, and engagement patterns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No suggestions available</p>
                  <p className="text-sm">Import more content to get personalized recommendations</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {suggestions.map((suggestion, idx) => (
                    <Card key={`${suggestion.topic}-${idx}`} className="border-dashed">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {suggestion.icon}
                            <CardTitle className="text-base">{suggestion.display_name}</CardTitle>
                          </div>
                          <Badge 
                            variant={
                              suggestion.type === 'seasonal' ? 'default' : 
                              suggestion.type === 'gap' ? 'destructive' : 
                              'secondary'
                            }
                          >
                            {suggestion.type}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          {suggestion.reason}
                        </p>
                        <Button variant="outline" size="sm" className="w-full">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Content
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
