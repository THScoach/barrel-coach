import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, BookOpen, MessageSquare, Target, FlaskConical, ThumbsUp, ThumbsDown, Video } from "lucide-react";

export default function CoachRickAIAdmin() {
  // Knowledge count
  const { data: knowledgeCount = 0 } = useQuery({
    queryKey: ["coach-rick-knowledge-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("clawdbot_knowledge")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Scenarios count
  const { data: scenariosCount = 0 } = useQuery({
    queryKey: ["coach-rick-scenarios-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("clawdbot_scenarios")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Cues count
  const { data: cuesCount = 0 } = useQuery({
    queryKey: ["coach-rick-cues-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("clawdbot_cues")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Ratings stats
  const { data: ratingsStats } = useQuery({
    queryKey: ["coach-rick-ratings-stats"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("clawdbot_ratings")
        .select("rating")
        .gte("created_at", thirtyDaysAgo);

      const good = data?.filter(r => r.rating === "good").length || 0;
      const bad = data?.filter(r => r.rating === "bad").length || 0;
      const total = good + bad;
      return { good, bad, total, goodPercent: total > 0 ? Math.round((good / total) * 100) : 0 };
    },
  });

  const stats = [
    { label: "Knowledge Entries", value: knowledgeCount, icon: BookOpen, href: "/admin/coach-rick-ai/knowledge" },
    { label: "Scenarios", value: scenariosCount, icon: MessageSquare, href: "/admin/coach-rick-ai/scenarios" },
    { label: "Cues", value: cuesCount, icon: Target, href: "/admin/coach-rick-ai/cues" },
  ];

  const quickLinks = [
    { label: "Knowledge Base", icon: BookOpen, href: "/admin/coach-rick-ai/knowledge" },
    { label: "Scenarios", icon: MessageSquare, href: "/admin/coach-rick-ai/scenarios" },
    { label: "Cues", icon: Target, href: "/admin/coach-rick-ai/cues" },
    { label: "Video Learning", icon: Video, href: "/admin/coach-rick-ai/videos" },
    { label: "Test Chat", icon: FlaskConical, href: "/admin/coach-rick-ai/test" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0B" }}>
      <AdminHeader />
      
      <main className="container py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <div className="p-3 rounded-xl bg-accent/20">
            <Bot className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Coach Rick AI</h1>
            <p className="text-slate-400 text-sm">Manage AI knowledge and training</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 md:mb-8">
          {stats.map((stat) => (
            <Link key={stat.label} to={stat.href}>
              <Card 
                className="border-2 hover:border-accent/50 transition-colors cursor-pointer"
                style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}
              >
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-4xl font-bold text-white">{stat.value}</p>
                      <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-accent/15">
                      <stat.icon className="h-6 w-6 text-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Ratings Overview */}
        <Card 
          className="mb-6 md:mb-8 border-2"
          style={{ backgroundColor: "#111113", borderColor: "rgba(220, 38, 38, 0.2)" }}
        >
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white">Recent Response Ratings (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <ThumbsUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{ratingsStats?.good || 0}</p>
                  <p className="text-xs text-slate-400">Good ({ratingsStats?.goodPercent || 0}%)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <ThumbsDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{ratingsStats?.bad || 0}</p>
                  <p className="text-xs text-slate-400">Bad ({100 - (ratingsStats?.goodPercent || 0)}%)</p>
                </div>
              </div>
              <div className="h-4 flex-1 bg-slate-800 rounded-full overflow-hidden max-w-xs">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${ratingsStats?.goodPercent || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {quickLinks.map((link) => (
              <Button
                key={link.label}
                asChild
                variant="outline"
                className="h-auto py-6 flex-col gap-2 border-accent/30 text-white hover:bg-accent/20 hover:border-accent/50"
              >
                <Link to={link.href}>
                  <link.icon className="h-6 w-6 text-accent" />
                  <span>{link.label}</span>
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
