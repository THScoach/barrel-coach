import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Target, 
  Activity,
  BarChart3,
  Calendar,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PlayerTransferTabProps {
  playerId: string;
}

interface PracticeSummary {
  total_events: number;
  avg_ev: number;
  avg_la: number;
  hard_hit_pct: number;
  sweet_spot_pct: number;
  barrel_pct: number;
  avg_contact_score: number;
  gb_pct: number;
  ld_pct: number;
  fb_pct: number;
}

interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  games: number;
  pa: number;
  ab: number;
  hits: number;
  xbh: number;
  bb: number;
  k: number;
  trend_label: string;
  status: string;
}

type TransferLabel = 'transfer_win' | 'execution_gap' | 'noise' | 'unknown';

export function PlayerTransferTab({ playerId }: PlayerTransferTabProps) {
  const [practiceData, setPracticeData] = useState<PracticeSummary | null>(null);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferLabel, setTransferLabel] = useState<TransferLabel>('unknown');

  useEffect(() => {
    loadData();
  }, [playerId]);

  const loadData = async () => {
    setLoading(true);
    
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];
    
    const [practiceRes, reportsRes] = await Promise.all([
      // Get practice data from batted_ball_events
      supabase
        .from('batted_ball_events')
        .select('exit_velocity, launch_angle, is_hard_hit, is_sweet_spot, is_barrel, bb_type, contact_score')
        .eq('player_id', playerId)
        .gte('event_date', thirtyDaysAgo),
      // Get weekly reports
      supabase
        .from('game_weekly_reports')
        .select('*')
        .eq('player_id', playerId)
        .order('week_start', { ascending: false })
        .limit(4)
    ]);

    // Calculate practice summary manually since the view might not work with RLS
    if (practiceRes.data && practiceRes.data.length > 0) {
      const events = practiceRes.data;
      const total = events.length;
      const summary: PracticeSummary = {
        total_events: total,
        avg_ev: Math.round((events.reduce((sum, e) => sum + (Number(e.exit_velocity) || 0), 0) / total) * 10) / 10,
        avg_la: Math.round((events.reduce((sum, e) => sum + (Number(e.launch_angle) || 0), 0) / total) * 10) / 10,
        hard_hit_pct: Math.round((events.filter(e => e.is_hard_hit).length / total) * 1000) / 10,
        sweet_spot_pct: Math.round((events.filter(e => e.is_sweet_spot).length / total) * 1000) / 10,
        barrel_pct: Math.round((events.filter(e => e.is_barrel).length / total) * 1000) / 10,
        avg_contact_score: Math.round((events.reduce((sum, e) => sum + (Number(e.contact_score) || 0), 0) / total) * 10) / 10,
        gb_pct: Math.round((events.filter(e => e.bb_type === 'GB').length / total) * 1000) / 10,
        ld_pct: Math.round((events.filter(e => e.bb_type === 'LD').length / total) * 1000) / 10,
        fb_pct: Math.round((events.filter(e => e.bb_type === 'FB').length / total) * 1000) / 10,
      };
      setPracticeData(summary);
    } else {
      setPracticeData(null);
    }

    if (reportsRes.data) {
      setWeeklyReports(reportsRes.data as WeeklyReport[]);
    }

    // Calculate transfer label
    calculateTransferLabel(practiceRes.data || [], reportsRes.data || []);
    
    setLoading(false);
  };

  const calculateTransferLabel = (practice: any[], reports: any[]) => {
    if (practice.length < 10 || reports.length < 2) {
      setTransferLabel('unknown');
      return;
    }

    // Compare practice quality to game production
    const hardHitPct = practice.filter(e => e.is_hard_hit).length / practice.length;
    const barrelPct = practice.filter(e => e.is_barrel).length / practice.length;
    
    const recentReports = reports.slice(0, 2);
    const totalAB = recentReports.reduce((sum, r) => sum + (r.ab || 0), 0);
    const totalHits = recentReports.reduce((sum, r) => sum + (r.hits || 0), 0);
    const avgReal = totalAB > 0 ? totalHits / totalAB : 0;
    
    // High practice quality + high game results = Transfer Win
    // High practice quality + low game results = Execution Gap
    // Everything else = Noise (not enough signal)
    
    if (hardHitPct >= 0.35 && barrelPct >= 0.08) {
      if (avgReal >= 0.280) {
        setTransferLabel('transfer_win');
      } else if (avgReal < 0.220) {
        setTransferLabel('execution_gap');
      } else {
        setTransferLabel('noise');
      }
    } else {
      setTransferLabel('noise');
    }
  };

  const getTransferBadge = () => {
    switch (transferLabel) {
      case 'transfer_win':
        return (
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            <TrendingUp className="h-3 w-3 mr-1" />
            Transfer Win
          </Badge>
        );
      case 'execution_gap':
        return (
          <Badge className="bg-red-600/20 text-red-400 border-red-600/30">
            <TrendingDown className="h-3 w-3 mr-1" />
            Execution Gap
          </Badge>
        );
      case 'noise':
        return (
          <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
            <Minus className="h-3 w-3 mr-1" />
            Noise
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-600/20 text-slate-400 border-slate-600/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Need More Data
          </Badge>
        );
    }
  };

  const StatCard = ({ label, value, suffix = "", trend }: { label: string; value: number | string; suffix?: string; trend?: 'up' | 'down' | 'flat' }) => (
    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-xl font-bold text-white flex items-center justify-center gap-1">
        {value}{suffix}
        {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
        {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transfer Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Practice vs Actual</h2>
          {getTransferBadge()}
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={loadData}
          className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Practice Side */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Practice (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {practiceData ? (
              <div className="space-y-4">
                {/* Key Quality Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Hard Hit %" value={practiceData.hard_hit_pct} suffix="%" />
                  <StatCard label="Sweet Spot %" value={practiceData.sweet_spot_pct} suffix="%" />
                  <StatCard label="Barrel %" value={practiceData.barrel_pct} suffix="%" />
                </div>
                
                {/* Averages */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Avg EV" value={practiceData.avg_ev} suffix=" mph" />
                  <StatCard label="Avg LA" value={practiceData.avg_la} suffix="°" />
                </div>

                {/* Batted Ball Distribution */}
                <div>
                  <div className="text-xs text-slate-400 mb-2">Batted Ball Distribution</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-800/50 rounded p-2 text-center">
                      <div className="text-xs text-slate-500">GB%</div>
                      <div className="text-sm font-medium text-white">{practiceData.gb_pct}%</div>
                    </div>
                    <div className="bg-slate-800/50 rounded p-2 text-center">
                      <div className="text-xs text-slate-500">LD%</div>
                      <div className="text-sm font-medium text-green-400">{practiceData.ld_pct}%</div>
                    </div>
                    <div className="bg-slate-800/50 rounded p-2 text-center">
                      <div className="text-xs text-slate-500">FB%</div>
                      <div className="text-sm font-medium text-white">{practiceData.fb_pct}%</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500 text-center">
                  Based on {practiceData.total_events} batted ball events
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No practice data available</p>
                <p className="text-slate-500 text-sm mt-1">Upload launch monitor data to populate</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actual Side */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-500" />
              Game Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyReports.length > 0 ? (
              <div className="space-y-4">
                {weeklyReports.slice(0, 3).map((report) => {
                  const avg = report.ab > 0 ? (report.hits / report.ab).toFixed(3).slice(1) : '.000';
                  const obp = report.pa > 0 ? ((report.hits + report.bb) / report.pa).toFixed(3).slice(1) : '.000';
                  
                  return (
                    <div key={report.id} className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-300">
                            Week of {format(new Date(report.week_start), 'MMM d')}
                          </span>
                        </div>
                        {report.trend_label && (
                          <Badge 
                            variant="outline" 
                            className={
                              report.trend_label === 'up' 
                                ? 'border-green-600/50 text-green-400' 
                                : report.trend_label === 'down'
                                ? 'border-red-600/50 text-red-400'
                                : 'border-slate-600/50 text-slate-400'
                            }
                          >
                            {report.trend_label === 'up' && <TrendingUp className="h-3 w-3 mr-1" />}
                            {report.trend_label === 'down' && <TrendingDown className="h-3 w-3 mr-1" />}
                            {report.trend_label}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-2 text-center text-xs">
                        <div>
                          <div className="text-slate-500">G</div>
                          <div className="text-white font-medium">{report.games || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">AB</div>
                          <div className="text-white font-medium">{report.ab || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">H</div>
                          <div className="text-white font-medium">{report.hits || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">AVG</div>
                          <div className="text-white font-medium">{avg}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">OBP</div>
                          <div className="text-white font-medium">{obp}</div>
                        </div>
                      </div>
                      {(report.xbh > 0 || report.bb > 0 || report.k > 0) && (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2 pt-2 border-t border-slate-700/50">
                          <div>
                            <div className="text-slate-500">XBH</div>
                            <div className="text-green-400 font-medium">{report.xbh || 0}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">BB</div>
                            <div className="text-blue-400 font-medium">{report.bb || 0}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">K</div>
                            <div className="text-red-400 font-medium">{report.k || 0}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No game data available</p>
                <p className="text-slate-500 text-sm mt-1">Weekly check-ins will populate this</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transfer Analysis Card */}
      {(practiceData || weeklyReports.length > 0) && (
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              Transfer Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transferLabel === 'transfer_win' && (
                <p className="text-slate-300">
                  <span className="text-green-400 font-medium">Great transfer!</span> Practice quality is translating to game results. 
                  The hard hit rate and barrel percentage in practice are reflected in the batting average.
                </p>
              )}
              {transferLabel === 'execution_gap' && (
                <p className="text-slate-300">
                  <span className="text-red-400 font-medium">Execution gap detected.</span> Practice metrics look strong but game results 
                  aren't reflecting that. Focus on pitch recognition, timing adjustments, or mental approach.
                </p>
              )}
              {transferLabel === 'noise' && (
                <p className="text-slate-300">
                  <span className="text-yellow-400 font-medium">Results are noisy.</span> Small sample size or inconsistent practice quality. 
                  Keep collecting data for a clearer picture.
                </p>
              )}
              {transferLabel === 'unknown' && (
                <p className="text-slate-300">
                  <span className="text-slate-400 font-medium">Need more data.</span> Upload more practice sessions and complete 
                  weekly check-ins to enable transfer analysis.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
