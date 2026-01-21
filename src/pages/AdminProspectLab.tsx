import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/AdminHeader";
import { MobileBottomNav } from "@/components/admin/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Loader2,
  Brain,
  Activity,
  Zap,
  Target,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Database,
  FlaskConical,
  Sparkles,
  ExternalLink,
  User,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Types for research data
interface StatcastData {
  exitVELO?: number;
  maxEV?: number;
  avgEV?: number;
  launch_angle?: number;
  barrel_rate?: number;
  hard_hit_rate?: number;
  sweet_spot_rate?: number;
  avg_distance?: number;
  sprint_speed?: number;
  xBA?: number;
  xSLG?: number;
  xwOBA?: number;
}

interface PlayerResearch {
  name: string;
  organization?: string;
  current_team?: string;
  level?: string;
  position?: string;
  bats?: string;
  throws?: string;
  age?: number;
  height?: string;
  weight?: number;
  stats?: {
    avg?: string;
    hr?: number;
    rbi?: number;
    sb?: number;
    ops?: string;
    year?: string;
  };
  scouting_grades?: {
    hit?: number;
    power?: number;
    speed?: number;
    field?: number;
    arm?: number;
  };
  scouting_reports?: string[];
  known_issues?: string[];
  sources?: string[];
}

interface FourBOverlay {
  brainScore: number | null;
  bodyScore: number | null;
  batScore: number | null;
  ballScore: number | null;
  composite: number | null;
  weakestCategory: string | null;
  predictions: {
    projectedEV?: number;
    evUpside?: number;
    kineticLeaks?: string[];
  };
}

interface ResearchBrief {
  id: string;
  player_name: string;
  raw_statcast_data: StatcastData | null;
  validated_data: StatcastData | null;
  data_status: string;
  missing_fields: string[] | null;
  scouting_notes: string | null;
  four_b_overlay: FourBOverlay | null;
  created_at: string;
}

// Type guard for casting DB response
function castBrief(data: unknown): ResearchBrief {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    player_name: d.player_name as string,
    raw_statcast_data: d.raw_statcast_data as StatcastData | null,
    validated_data: d.validated_data as StatcastData | null,
    data_status: d.data_status as string,
    missing_fields: d.missing_fields as string[] | null,
    scouting_notes: d.scouting_notes as string | null,
    four_b_overlay: d.four_b_overlay as FourBOverlay | null,
    created_at: d.created_at as string,
  };
}

// Helper functions
function getScoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 70) return "text-green-500";
  if (score >= 55) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function getGradeColor(grade: number): string {
  if (grade >= 60) return "text-green-500";
  if (grade >= 50) return "text-yellow-500";
  if (grade >= 40) return "text-orange-500";
  return "text-red-500";
}

function formatScore(score: number | null): string {
  if (score === null) return "—";
  return Math.round(score).toString();
}

// 4B Category Config
const categoryConfig = {
  brain: {
    label: "BRAIN",
    subtitle: "Repeatability",
    icon: Brain,
    color: "text-blue-400",
    bg: "bg-blue-500/20",
  },
  body: {
    label: "BODY",
    subtitle: "Ground Force",
    icon: Activity,
    color: "text-green-400",
    bg: "bg-green-500/20",
  },
  bat: {
    label: "BAT",
    subtitle: "Energy Transfer",
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/20",
  },
  ball: {
    label: "BALL",
    subtitle: "Contact Quality",
    icon: Target,
    color: "text-orange-400",
    bg: "bg-orange-500/20",
  },
};

export default function AdminProspectLab() {
  const isMobile = useIsMobile();
  const [searchName, setSearchName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBrief, setSelectedBrief] = useState<ResearchBrief | null>(null);
  const [activePlayerData, setActivePlayerData] = useState<PlayerResearch | null>(null);

  // Fetch existing research briefs
  const { data: briefs = [], isLoading: loadingBriefs, refetch } = useQuery({
    queryKey: ["research-briefs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("final_research_briefs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []).map(castBrief);
    },
  });

  // Search for player
  const handleSearch = async () => {
    if (!searchName.trim()) {
      toast.error("Enter a player name to search");
      return;
    }

    setIsSearching(true);
    setActivePlayerData(null);

    try {
      // First try the research-player function
      const { data, error } = await supabase.functions.invoke("research-player", {
        body: { player_name: searchName.trim() },
      });

      if (error) throw error;

      if (data.success && data.player) {
        setActivePlayerData(data.player);
        toast.success(`Found data for ${data.player.name}`);
      } else {
        toast.error("No data found for this player");
      }
    } catch (error) {
      console.error("Research error:", error);
      toast.error("Failed to research player");
    } finally {
      setIsSearching(false);
    }
  };

  // Run full pipeline
  const handleRunPipeline = async () => {
    if (!searchName.trim()) {
      toast.error("Enter a player name first");
      return;
    }

    setIsSearching(true);

    try {
      const { data, error } = await supabase.functions.invoke("prospect-research-pipeline", {
        body: { player_name: searchName.trim() },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Research brief created!");
        refetch();
      } else {
        toast.error(data.error || "Pipeline failed");
      }
    } catch (error) {
      console.error("Pipeline error:", error);
      toast.error("Failed to run research pipeline");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AdminHeader />

      <main className={`container mx-auto px-4 py-6 ${isMobile ? "pb-24" : ""}`}>
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-red-600/20 border border-red-600/30">
              <FlaskConical className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Prospect Research Lab</h1>
              <p className="text-sm text-slate-400">
                Public Statcast data + 4B kinetic overlay
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <Card className="bg-slate-900 border-slate-800 mb-6">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search player (e.g., Gunnar Henderson)"
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
              <Button
                onClick={handleRunPipeline}
                disabled={isSearching}
                variant="outline"
                className="border-red-600/50 text-red-400 hover:bg-red-600/10"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Full Pipeline
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Split Screen Layout */}
        <div className={`grid ${isMobile ? "grid-cols-1 gap-4" : "grid-cols-2 gap-6"}`}>
          {/* LEFT PANEL - Statcast Data */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold text-white">Public Statcast Data</h2>
            </div>

            {activePlayerData ? (
              <StatcastPanel playerData={activePlayerData} />
            ) : selectedBrief ? (
              <StatcastPanelFromBrief brief={selectedBrief} />
            ) : (
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-8 text-center">
                  <Database className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">
                    Search for a player or select from recent briefs
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Recent Briefs List */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Recent Research Briefs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[200px]">
                  {loadingBriefs ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : briefs.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                      No research briefs yet
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {briefs.map((brief) => (
                        <button
                          key={brief.id}
                          onClick={() => {
                            setSelectedBrief(brief);
                            setActivePlayerData(null);
                          }}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedBrief?.id === brief.id
                              ? "bg-red-600/20 border border-red-600/30"
                              : "hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white">
                              {brief.player_name}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                brief.data_status === "complete"
                                  ? "border-green-500/50 text-green-400"
                                  : brief.data_status === "incomplete"
                                  ? "border-yellow-500/50 text-yellow-400"
                                  : "border-slate-500/50 text-slate-400"
                              }
                            >
                              {brief.data_status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(brief.created_at).toLocaleDateString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL - 4B Overlay */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold text-white">4B Kinetic Overlay</h2>
            </div>

            {selectedBrief?.four_b_overlay || activePlayerData ? (
              <FourBOverlayPanel
                overlay={selectedBrief?.four_b_overlay || null}
                playerData={activePlayerData}
                statcastData={selectedBrief?.validated_data || null}
              />
            ) : (
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-8 text-center">
                  <FlaskConical className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">
                    4B overlay will appear when data is loaded
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}

// Statcast Panel Component
function StatcastPanel({ playerData }: { playerData: PlayerResearch }) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4 space-y-4">
        {/* Player Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">{playerData.name}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {playerData.organization && (
                <Badge className="bg-red-600/20 text-red-400 border-red-600/30">
                  {playerData.organization}
                </Badge>
              )}
              {playerData.position && (
                <Badge variant="outline" className="border-slate-600 text-slate-300">
                  {playerData.position}
                </Badge>
              )}
              {playerData.level && (
                <Badge variant="outline" className="border-slate-600 text-slate-300">
                  {playerData.level}
                </Badge>
              )}
            </div>
          </div>
          <User className="h-10 w-10 text-slate-600" />
        </div>

        {/* Basic Info */}
        {(playerData.current_team || playerData.age) && (
          <div className="text-sm text-slate-400">
            {playerData.current_team && <span>{playerData.current_team}</span>}
            {playerData.age && <span> • Age {playerData.age}</span>}
            {playerData.height && <span> • {playerData.height}</span>}
            {playerData.weight && <span> • {playerData.weight} lbs</span>}
            {playerData.bats && <span> • B: {playerData.bats}</span>}
            {playerData.throws && <span> • T: {playerData.throws}</span>}
          </div>
        )}

        <Separator className="bg-slate-700" />

        {/* Stats */}
        {playerData.stats && Object.keys(playerData.stats).length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-3 font-medium">
              {playerData.stats.year || "Recent"} BATTING STATS
            </p>
            <div className="grid grid-cols-5 gap-4">
              {playerData.stats.avg && (
                <StatBlock label="AVG" value={playerData.stats.avg} />
              )}
              {playerData.stats.hr !== undefined && (
                <StatBlock label="HR" value={playerData.stats.hr.toString()} />
              )}
              {playerData.stats.rbi !== undefined && (
                <StatBlock label="RBI" value={playerData.stats.rbi.toString()} />
              )}
              {playerData.stats.sb !== undefined && (
                <StatBlock label="SB" value={playerData.stats.sb.toString()} />
              )}
              {playerData.stats.ops && (
                <StatBlock label="OPS" value={playerData.stats.ops} />
              )}
            </div>
          </div>
        )}

        {/* Scouting Grades */}
        {playerData.scouting_grades && Object.keys(playerData.scouting_grades).length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-3 font-medium">SCOUTING GRADES (20-80)</p>
            <div className="flex flex-wrap gap-4">
              {playerData.scouting_grades.hit && (
                <GradeCircle label="Hit" grade={playerData.scouting_grades.hit} />
              )}
              {playerData.scouting_grades.power && (
                <GradeCircle label="Power" grade={playerData.scouting_grades.power} />
              )}
              {playerData.scouting_grades.speed && (
                <GradeCircle label="Speed" grade={playerData.scouting_grades.speed} />
              )}
              {playerData.scouting_grades.field && (
                <GradeCircle label="Field" grade={playerData.scouting_grades.field} />
              )}
              {playerData.scouting_grades.arm && (
                <GradeCircle label="Arm" grade={playerData.scouting_grades.arm} />
              )}
            </div>
          </div>
        )}

        {/* Scouting Reports */}
        {playerData.scouting_reports && playerData.scouting_reports.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2 font-medium">SCOUTING NOTES</p>
            <div className="space-y-2">
              {playerData.scouting_reports.slice(0, 3).map((report, i) => (
                <p key={i} className="text-sm text-slate-300 italic border-l-2 border-red-600 pl-3">
                  "{report}"
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Known Issues */}
        {playerData.known_issues && playerData.known_issues.length > 0 && (
          <div className="bg-red-900/20 rounded-lg p-3 border border-red-600/20">
            <p className="text-xs text-red-400 mb-2 flex items-center gap-1 font-medium">
              <AlertTriangle className="h-3 w-3" />
              AREAS TO WATCH
            </p>
            <ul className="text-sm text-red-300 space-y-1">
              {playerData.known_issues.map((issue, i) => (
                <li key={i}>• {issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Sources */}
        {playerData.sources && playerData.sources.length > 0 && (
          <div className="pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-1">Sources</p>
            <div className="flex flex-wrap gap-2">
              {playerData.sources.map((url, i) => {
                try {
                  const domain = new URL(url).hostname.replace("www.", "");
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      {domain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  );
                } catch {
                  return null;
                }
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Statcast Panel from Brief
function StatcastPanelFromBrief({ brief }: { brief: ResearchBrief }) {
  const data = brief.validated_data || brief.raw_statcast_data;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">{brief.player_name}</h3>
            <Badge
              variant="outline"
              className={
                brief.data_status === "complete"
                  ? "border-green-500/50 text-green-400 mt-2"
                  : "border-yellow-500/50 text-yellow-400 mt-2"
              }
            >
              {brief.data_status}
            </Badge>
          </div>
          <Database className="h-8 w-8 text-slate-600" />
        </div>

        {brief.missing_fields && brief.missing_fields.length > 0 && (
          <div className="bg-yellow-900/20 rounded-lg p-3 border border-yellow-600/20">
            <p className="text-xs text-yellow-400 mb-1 font-medium">Missing Fields</p>
            <p className="text-sm text-yellow-300">
              {brief.missing_fields.join(", ")}
            </p>
          </div>
        )}

        <Separator className="bg-slate-700" />

        {data && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-3 font-medium">STATCAST METRICS</p>
            <div className="grid grid-cols-3 gap-4">
              {data.exitVELO && <StatBlock label="Exit Velo" value={`${data.exitVELO}`} unit="mph" />}
              {data.maxEV && <StatBlock label="Max EV" value={`${data.maxEV}`} unit="mph" />}
              {data.avgEV && <StatBlock label="Avg EV" value={`${data.avgEV}`} unit="mph" />}
              {data.launch_angle && <StatBlock label="LA" value={`${data.launch_angle}`} unit="°" />}
              {data.barrel_rate && <StatBlock label="Barrel%" value={`${data.barrel_rate}`} unit="%" />}
              {data.hard_hit_rate && <StatBlock label="Hard Hit" value={`${data.hard_hit_rate}`} unit="%" />}
              {data.sweet_spot_rate && <StatBlock label="Sweet Spot" value={`${data.sweet_spot_rate}`} unit="%" />}
              {data.sprint_speed && <StatBlock label="Sprint" value={`${data.sprint_speed}`} unit="ft/s" />}
            </div>
          </div>
        )}

        {brief.scouting_notes && (
          <div>
            <p className="text-xs text-slate-400 mb-2 font-medium">AI SCOUTING NOTES</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {brief.scouting_notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 4B Overlay Panel
function FourBOverlayPanel({
  overlay,
  playerData,
  statcastData,
}: {
  overlay: FourBOverlay | null;
  playerData: PlayerResearch | null;
  statcastData: StatcastData | null;
}) {
  // Generate synthetic 4B scores from scouting data if no overlay
  const scores = overlay || generateSynthetic4B(playerData, statcastData);

  return (
    <TooltipProvider>
      <Card className="bg-slate-900 border-red-600/30 overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 p-4 text-center">
          <h3 className="text-lg font-bold text-white">4B KINETIC ANALYSIS</h3>
          <p className="text-sm text-red-100/70">The 4B Hitting System™</p>
        </div>

        <CardContent className="p-0">
          {/* 4B Score Grid */}
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-700">
            {(["brain", "body", "bat", "ball"] as const).map((category) => {
              const config = categoryConfig[category];
              const score = scores[`${category}Score` as keyof typeof scores] as number | null;
              const isWeakest = scores.weakestCategory?.toLowerCase() === category;

              return (
                <Tooltip key={category}>
                  <TooltipTrigger asChild>
                    <div
                      className={`p-6 text-center cursor-help transition-colors ${
                        isWeakest
                          ? "bg-amber-500/10 ring-2 ring-inset ring-amber-500"
                          : "hover:bg-slate-800/50"
                      }`}
                    >
                      <div
                        className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${config.bg}`}
                      >
                        <config.icon className={`h-6 w-6 ${config.color}`} />
                      </div>
                      <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                        {config.label}
                      </div>
                      <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
                        {formatScore(score)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{config.subtitle}</div>
                      {isWeakest && (
                        <Badge className="mt-2 bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                          ⚠️ Focus
                        </Badge>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-slate-800 border-slate-700">
                    <p className="text-sm text-white">{config.subtitle}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Composite Score */}
          <div className="p-6 bg-slate-800/50 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">Composite Score</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Overall kinetic efficiency
                </div>
              </div>
              <div className="text-right">
                <span className={`text-4xl font-bold ${getScoreColor(scores.composite)}`}>
                  {formatScore(scores.composite)}
                </span>
                <span className="text-slate-500 text-lg">/80</span>
              </div>
            </div>
          </div>

          {/* Predictions Section */}
          {overlay?.predictions && (
            <div className="p-4 border-t border-slate-700 space-y-3">
              <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-500" />
                KINETIC PREDICTIONS
              </p>

              <div className="grid grid-cols-2 gap-3">
                {overlay.predictions.projectedEV && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-400">
                      {overlay.predictions.projectedEV}
                      <span className="text-sm text-slate-400 ml-1">mph</span>
                    </div>
                    <div className="text-xs text-slate-400">Projected Max EV</div>
                  </div>
                )}
                {overlay.predictions.evUpside && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-2xl font-bold text-amber-400">
                      +{overlay.predictions.evUpside}
                      <span className="text-sm text-slate-400 ml-1">mph</span>
                    </div>
                    <div className="text-xs text-slate-400">EV Upside</div>
                  </div>
                )}
              </div>

              {overlay.predictions.kineticLeaks && overlay.predictions.kineticLeaks.length > 0 && (
                <div className="bg-red-900/20 rounded-lg p-3 border border-red-600/20">
                  <p className="text-xs text-red-400 mb-2 font-medium">KINETIC LEAKS</p>
                  <div className="flex flex-wrap gap-2">
                    {overlay.predictions.kineticLeaks.map((leak, i) => (
                      <Badge key={i} className="bg-red-600/20 text-red-300 border-red-600/30">
                        {leak}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Translation Section */}
          <div className="p-4 bg-red-600/10 border-t border-red-600/20">
            <p className="text-xs text-red-400 mb-2 font-medium">
              🔬 THE LAB TRANSLATION
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {generateLabTranslation(scores, playerData)}
            </p>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// Helper Components
function StatBlock({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-white">
        {value}
        {unit && <span className="text-xs text-slate-400 ml-0.5">{unit}</span>}
      </div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function GradeCircle({ label, grade }: { label: string; grade: number }) {
  return (
    <div className="text-center">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${getGradeColor(
          grade
        )} bg-slate-800 border-2 ${
          grade >= 60
            ? "border-green-500/50"
            : grade >= 50
            ? "border-yellow-500/50"
            : grade >= 40
            ? "border-orange-500/50"
            : "border-red-500/50"
        }`}
      >
        {grade}
      </div>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

// Generate synthetic 4B scores from scouting grades
function generateSynthetic4B(
  playerData: PlayerResearch | null,
  statcastData: StatcastData | null
): FourBOverlay {
  if (!playerData?.scouting_grades) {
    return {
      brainScore: null,
      bodyScore: null,
      batScore: null,
      ballScore: null,
      composite: null,
      weakestCategory: null,
      predictions: {},
    };
  }

  const grades = playerData.scouting_grades;

  // Map scouting grades to 4B scores (rough approximation)
  const brainScore = grades.hit ? Math.min(80, grades.hit * 1.1) : null;
  const bodyScore = grades.speed ? Math.min(80, grades.speed * 1.0) : null;
  const batScore = grades.power ? Math.min(80, grades.power * 1.0) : null;
  const ballScore = statcastData?.hard_hit_rate
    ? Math.min(80, statcastData.hard_hit_rate * 1.5)
    : grades.power
    ? Math.min(80, grades.power * 0.9)
    : null;

  const scores = [brainScore, bodyScore, batScore, ballScore].filter(
    (s) => s !== null
  ) as number[];
  const composite = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  // Find weakest
  const categoryScores = { brain: brainScore, body: bodyScore, bat: batScore, ball: ballScore };
  let weakestCategory: string | null = null;
  let minScore = Infinity;

  Object.entries(categoryScores).forEach(([cat, score]) => {
    if (score !== null && score < minScore) {
      minScore = score;
      weakestCategory = cat;
    }
  });

  return {
    brainScore,
    bodyScore,
    batScore,
    ballScore,
    composite,
    weakestCategory,
    predictions: {
      projectedEV: statcastData?.maxEV || (grades.power ? 85 + grades.power * 0.3 : undefined),
      evUpside: grades.power ? Math.round(grades.power * 0.15) : undefined,
    },
  };
}

// Generate lab translation text
function generateLabTranslation(scores: FourBOverlay, playerData: PlayerResearch | null): string {
  if (!scores.composite) {
    return "Load player data to see 4B analysis.";
  }

  const weak = scores.weakestCategory;
  const composite = Math.round(scores.composite);

  const translations: Record<string, string> = {
    brain: `This hitter has ${composite >= 60 ? "solid" : "inconsistent"} mechanics. The Brain score suggests ${composite >= 55 ? "good repeatability" : "variance in the swing pattern"}. Work on groove-building drills.`,
    body: `Ground force is the limiting factor. The Body score indicates ${scores.bodyScore && scores.bodyScore >= 55 ? "adequate" : "underdeveloped"} lower-half mechanics. Focus on the Anchor Drill.`,
    bat: `Energy is leaking before it reaches the barrel. The Bat score shows ${scores.batScore && scores.batScore >= 55 ? "decent" : "poor"} transfer efficiency. Sequencing work needed.`,
    ball: `Contact quality is the bottleneck. The Ball score reflects ${scores.ballScore && scores.ballScore >= 55 ? "solid" : "inconsistent"} barrel accuracy. More tee work at the right angle.`,
  };

  return weak
    ? translations[weak]
    : `Composite score of ${composite} indicates ${composite >= 60 ? "high-level" : composite >= 50 ? "developing" : "foundational"} swing mechanics across all 4B categories.`;
}
