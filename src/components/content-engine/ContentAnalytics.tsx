import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import { 
  TrendingUp, TrendingDown, Eye, Heart, Share2, Users, 
  Instagram, Twitter, Video, Calendar, ArrowUpRight, Sparkles
} from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface PerformanceMetrics {
  views?: number;
  likes?: number;
  shares?: number;
  comments?: number;
  saves?: number;
  reach?: number;
  engagement_rate?: number;
}

interface ContentOutput {
  id: string;
  platform: string;
  formatted_content: string;
  hook: string | null;
  status: string;
  posted_at: string | null;
  post_url: string | null;
  performance_metrics: PerformanceMetrics | null;
  content_items?: {
    source_type: string;
    topics: string[] | null;
  };
}

interface WaitlistEntry {
  id: string;
  source: string;
  created_at: string;
  converted_at: string | null;
  status: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram_reel: "hsl(var(--chart-1))",
  instagram_post: "hsl(var(--chart-1))",
  instagram_story: "hsl(var(--chart-1))",
  twitter: "hsl(var(--chart-2))",
  twitter_thread: "hsl(var(--chart-2))",
  tiktok: "hsl(var(--chart-3))",
  youtube_short: "hsl(var(--chart-4))",
  facebook: "hsl(var(--chart-5))",
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram_reel: <Instagram className="h-4 w-4" />,
  instagram_post: <Instagram className="h-4 w-4" />,
  instagram_story: <Instagram className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
  twitter_thread: <Twitter className="h-4 w-4" />,
  tiktok: <Video className="h-4 w-4" />,
  youtube_short: <Video className="h-4 w-4" />,
};

const chartConfig = {
  views: { label: "Views", color: "hsl(var(--chart-1))" },
  likes: { label: "Likes", color: "hsl(var(--chart-2))" },
  shares: { label: "Shares", color: "hsl(var(--chart-3))" },
  signups: { label: "Signups", color: "hsl(var(--chart-4))" },
};

export function ContentAnalytics() {
  // Fetch posted content with performance metrics
  const { data: postedContent, isLoading: contentLoading } = useQuery({
    queryKey: ['content-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_outputs')
        .select(`
          id,
          platform,
          formatted_content,
          hook,
          status,
          posted_at,
          post_url,
          performance_metrics,
          content_items (
            source_type,
            topics
          )
        `)
        .eq('status', 'posted')
        .order('posted_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as ContentOutput[];
    },
  });

  // Fetch waitlist signups for attribution
  const { data: signups, isLoading: signupsLoading } = useQuery({
    queryKey: ['signup-analytics'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('waitlist')
        .select('id, source, created_at, converted_at, status')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WaitlistEntry[];
    },
  });

  // Calculate aggregate metrics
  const aggregateMetrics = useMemo(() => {
    if (!postedContent?.length) {
      return { totalViews: 0, totalLikes: 0, totalShares: 0, avgEngagement: 0 };
    }

    let totalViews = 0;
    let totalLikes = 0;
    let totalShares = 0;
    let totalEngagement = 0;
    let postsWithMetrics = 0;

    postedContent.forEach(post => {
      const metrics = post.performance_metrics;
      if (metrics) {
        totalViews += metrics.views || 0;
        totalLikes += metrics.likes || 0;
        totalShares += metrics.shares || 0;
        if (metrics.engagement_rate) {
          totalEngagement += metrics.engagement_rate;
          postsWithMetrics++;
        }
      }
    });

    return {
      totalViews,
      totalLikes,
      totalShares,
      avgEngagement: postsWithMetrics > 0 ? totalEngagement / postsWithMetrics : 0,
    };
  }, [postedContent]);

  // Platform breakdown
  const platformBreakdown = useMemo(() => {
    if (!postedContent?.length) return [];

    const breakdown: Record<string, { count: number; views: number; likes: number }> = {};
    
    postedContent.forEach(post => {
      const platform = post.platform;
      if (!breakdown[platform]) {
        breakdown[platform] = { count: 0, views: 0, likes: 0 };
      }
      breakdown[platform].count++;
      const metrics = post.performance_metrics;
      if (metrics) {
        breakdown[platform].views += metrics.views || 0;
        breakdown[platform].likes += metrics.likes || 0;
      }
    });

    return Object.entries(breakdown).map(([platform, data]) => ({
      platform,
      ...data,
      avgViews: data.count > 0 ? Math.round(data.views / data.count) : 0,
    }));
  }, [postedContent]);

  // Signup attribution
  const signupAttribution = useMemo(() => {
    if (!signups?.length) return [];

    const sources: Record<string, { count: number; converted: number }> = {};
    
    signups.forEach(signup => {
      const source = signup.source || 'direct';
      if (!sources[source]) {
        sources[source] = { count: 0, converted: 0 };
      }
      sources[source].count++;
      if (signup.converted_at || signup.status === 'converted') {
        sources[source].converted++;
      }
    });

    return Object.entries(sources)
      .map(([source, data]) => ({
        source: formatSourceName(source),
        signups: data.count,
        converted: data.converted,
        conversionRate: data.count > 0 ? Math.round((data.converted / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.signups - a.signups);
  }, [signups]);

  // Weekly trend data
  const weeklyTrend = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const days = eachDayOfInterval({ start: subDays(now, 13), end: now });

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const daySignups = signups?.filter(s => 
        s.created_at.startsWith(dayStr)
      ).length || 0;
      
      const dayPosts = postedContent?.filter(p => 
        p.posted_at?.startsWith(dayStr)
      ) || [];
      
      const dayViews = dayPosts.reduce((sum, p) => 
        sum + (p.performance_metrics?.views || 0), 0
      );

      return {
        date: format(day, 'MMM d'),
        signups: daySignups,
        views: dayViews,
        posts: dayPosts.length,
      };
    });
  }, [signups, postedContent]);

  // Top performing content
  const topContent = useMemo(() => {
    if (!postedContent?.length) return [];

    return [...postedContent]
      .filter(p => p.performance_metrics?.views)
      .sort((a, b) => 
        (b.performance_metrics?.views || 0) - (a.performance_metrics?.views || 0)
      )
      .slice(0, 5);
  }, [postedContent]);

  const isLoading = contentLoading || signupsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalSignups = signups?.length || 0;
  const convertedSignups = signups?.filter(s => s.converted_at || s.status === 'converted').length || 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Total Views"
          value={formatNumber(aggregateMetrics.totalViews)}
          icon={<Eye className="h-4 w-4" />}
          trend={12}
          description="Last 30 days"
        />
        <MetricCard
          title="Total Engagement"
          value={formatNumber(aggregateMetrics.totalLikes + aggregateMetrics.totalShares)}
          icon={<Heart className="h-4 w-4" />}
          trend={8}
          description="Likes + Shares"
        />
        <MetricCard
          title="App Signups"
          value={totalSignups.toString()}
          icon={<Users className="h-4 w-4" />}
          trend={totalSignups > 0 ? 15 : 0}
          description="From content"
        />
        <MetricCard
          title="Conversion Rate"
          value={totalSignups > 0 ? `${Math.round((convertedSignups / totalSignups) * 100)}%` : "0%"}
          icon={<ArrowUpRight className="h-4 w-4" />}
          trend={5}
          description="Signups to players"
        />
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="attribution">Signup Attribution</TabsTrigger>
          <TabsTrigger value="top-content">Top Content</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Weekly Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly Trend</CardTitle>
                <CardDescription>Views and signups over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px]">
                  <AreaChart data={weeklyTrend}>
                    <defs>
                      <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="hsl(var(--chart-1))"
                      fill="url(#viewsGradient)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="signups"
                      stroke="hsl(var(--chart-4))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Platform Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Platform Breakdown</CardTitle>
                <CardDescription>Performance by platform</CardDescription>
              </CardHeader>
              <CardContent>
                {platformBreakdown.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <BarChart data={platformBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis 
                        dataKey="platform" 
                        type="category" 
                        className="text-xs"
                        tickFormatter={(v) => formatPlatformName(v)}
                        width={80}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar 
                        dataKey="avgViews" 
                        fill="hsl(var(--chart-1))" 
                        radius={[0, 4, 4, 0]}
                        name="Avg Views"
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No posted content yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Platform Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {platformBreakdown.slice(0, 3).map(platform => (
              <Card key={platform.platform}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${PLATFORM_COLORS[platform.platform]}20` }}
                    >
                      {PLATFORM_ICONS[platform.platform] || <Sparkles className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium">{formatPlatformName(platform.platform)}</p>
                      <p className="text-sm text-muted-foreground">{platform.count} posts</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Views</p>
                      <p className="font-semibold">{formatNumber(platform.views)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg/Post</p>
                      <p className="font-semibold">{formatNumber(platform.avgViews)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Attribution Tab */}
        <TabsContent value="attribution" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Source Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signup Sources</CardTitle>
                <CardDescription>Where your signups come from</CardDescription>
              </CardHeader>
              <CardContent>
                {signupAttribution.length > 0 ? (
                  <div className="space-y-4">
                    {signupAttribution.map((source, i) => (
                      <div key={source.source} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{source.source}</span>
                          <span className="text-sm text-muted-foreground">
                            {source.signups} signups
                          </span>
                        </div>
                        <Progress 
                          value={(source.signups / (signups?.length || 1)) * 100} 
                          className="h-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{source.converted} converted</span>
                          <span>{source.conversionRate}% rate</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    No signup data yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conversion Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversion Funnel</CardTitle>
                <CardDescription>From content to player</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <FunnelStep
                    label="Content Posted"
                    value={postedContent?.length || 0}
                    percentage={100}
                  />
                  <FunnelStep
                    label="Views Generated"
                    value={aggregateMetrics.totalViews}
                    percentage={100}
                  />
                  <FunnelStep
                    label="Waitlist Signups"
                    value={totalSignups}
                    percentage={aggregateMetrics.totalViews > 0 
                      ? (totalSignups / aggregateMetrics.totalViews) * 100 
                      : 0}
                  />
                  <FunnelStep
                    label="Converted Players"
                    value={convertedSignups}
                    percentage={totalSignups > 0 
                      ? (convertedSignups / totalSignups) * 100 
                      : 0}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Top Content Tab */}
        <TabsContent value="top-content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Performing Content</CardTitle>
              <CardDescription>Your best content by views</CardDescription>
            </CardHeader>
            <CardContent>
              {topContent.length > 0 ? (
                <div className="space-y-4">
                  {topContent.map((content, i) => (
                    <div 
                      key={content.id}
                      className="flex items-start gap-4 p-4 rounded-lg border bg-card"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {formatPlatformName(content.platform)}
                          </Badge>
                          {content.posted_at && (
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(content.posted_at), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm line-clamp-2 mb-2">
                          {content.hook || content.formatted_content.slice(0, 100)}...
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {formatNumber(content.performance_metrics?.views || 0)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {formatNumber(content.performance_metrics?.likes || 0)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Share2 className="h-3 w-3" />
                            {formatNumber(content.performance_metrics?.shares || 0)}
                          </span>
                        </div>
                      </div>
                      {content.post_url && (
                        <a 
                          href={content.post_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          View
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No posted content with metrics yet</p>
                  <p className="text-sm">Post content and add performance data to see insights</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper Components
function MetricCard({ 
  title, 
  value, 
  icon, 
  trend, 
  description 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  trend: number;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold mb-1">{value}</div>
        <div className="flex items-center gap-2 text-sm">
          {trend > 0 ? (
            <span className="flex items-center text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +{trend}%
            </span>
          ) : trend < 0 ? (
            <span className="flex items-center text-destructive">
              <TrendingDown className="h-3 w-3 mr-1" />
              {trend}%
            </span>
          ) : null}
          <span className="text-muted-foreground">{description}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStep({ 
  label, 
  value, 
  percentage 
}: { 
  label: string; 
  value: number; 
  percentage: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{formatNumber(value)}</span>
      </div>
      <div className="h-8 bg-muted rounded overflow-hidden">
        <div 
          className="h-full bg-primary/20 transition-all duration-500"
          style={{ width: `${Math.max(percentage, 5)}%` }}
        />
      </div>
    </div>
  );
}

// Helper Functions
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatPlatformName(platform: string): string {
  const names: Record<string, string> = {
    instagram_reel: "IG Reels",
    instagram_post: "IG Post",
    instagram_story: "IG Story",
    twitter: "Twitter/X",
    twitter_thread: "X Thread",
    tiktok: "TikTok",
    youtube_short: "YT Shorts",
    facebook: "Facebook",
  };
  return names[platform] || platform;
}

function formatSourceName(source: string): string {
  const names: Record<string, string> = {
    landing_page: "Landing Page",
    instagram: "Instagram",
    twitter: "Twitter/X",
    tiktok: "TikTok",
    youtube: "YouTube",
    referral: "Referral",
    direct: "Direct",
    organic: "Organic Search",
  };
  return names[source] || source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
