import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Play, Loader2, ArrowLeft, Brain, User, Phone, Mail, 
  FileText, Send, CheckCircle2, Clock, Video, ChevronRight,
  Target, Activity, Zap
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { format } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Session {
  id: string;
  player_name: string;
  player_email: string;
  player_phone: string | null;
  player_age: number;
  player_level: string;
  product_type: string;
  environment: string;
  status: string;
  created_at: string;
  swings_required: number;
  composite_score: number | null;
  four_b_brain: number | null;
  four_b_body: number | null;
  four_b_bat: number | null;
  four_b_ball: number | null;
  problems_identified: string[] | null;
  grade: string | null;
  analyzed_at: string | null;
}

interface Swing {
  id: string;
  session_id: string;
  swing_index: number;
  video_url: string | null;
  video_storage_path: string | null;
  status: string;
  composite_score: number | null;
  four_b_brain: number | null;
  four_b_body: number | null;
  four_b_bat: number | null;
  four_b_ball: number | null;
}

const PROBLEMS_LIST = [
  'spinning_out', 'casting', 'late_timing', 'early_timing', 'drifting',
  'rolling_over', 'ground_balls', 'no_power', 'chasing_pitches',
  'collapsing_back_side', 'long_swing', 'weak_rotation', 'poor_balance',
  'head_movement', 'bat_drag', 'uppercut', 'chopping'
];

const statusColors: Record<string, string> = {
  pending_upload: 'bg-gray-500',
  uploading: 'bg-yellow-500',
  pending_payment: 'bg-orange-500',
  paid: 'bg-blue-500',
  analyzing: 'bg-purple-500',
  complete: 'bg-green-500',
  failed: 'bg-red-500'
};

export default function AdminAnalyzer() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [swings, setSwings] = useState<Swing[]>([]);
  const [loadingSwings, setLoadingSwings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('queue');
  
  // Analysis form state
  const [scores, setScores] = useState({
    brain: 5,
    body: 5,
    bat: 5,
    ball: 5
  });
  const [problems, setProblems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [currentSwingIndex, setCurrentSwingIndex] = useState(0);

  const fetchSessions = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Fetch pending/paid sessions (queue)
      const { data: queueData, error: queueError } = await supabase
        .from('sessions')
        .select('*')
        .in('status', ['pending_upload', 'uploading', 'pending_payment', 'paid', 'analyzing'])
        .order('created_at', { ascending: false });
      
      if (queueError) throw queueError;
      setSessions(queueData || []);
      
      // Fetch completed sessions
      const { data: completedData, error: completedError } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'complete')
        .order('analyzed_at', { ascending: false })
        .limit(50);
      
      if (completedError) throw completedError;
      setCompletedSessions(completedData || []);
      
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const selectSession = async (session: Session) => {
    setSelectedSession(session);
    setLoadingSwings(true);
    setCurrentSwingIndex(0);
    
    // Initialize scores from session if available
    if (session.four_b_brain !== null) {
      setScores({
        brain: session.four_b_brain,
        body: session.four_b_body || 5,
        bat: session.four_b_bat || 5,
        ball: session.four_b_ball || 5
      });
    } else {
      setScores({ brain: 5, body: 5, bat: 5, ball: 5 });
    }
    
    setProblems(session.problems_identified || []);
    setNotes('');
    
    try {
      // Fetch swings with signed URLs
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-session?sessionId=${session.id}`, {
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setSwings(data.swings || []);
      } else {
        // Fallback to direct query
        const { data: swingsData } = await supabase
          .from('swings')
          .select('*')
          .eq('session_id', session.id)
          .order('swing_index', { ascending: true });
        setSwings(swingsData || []);
      }
    } catch (error) {
      console.error('Failed to load swings:', error);
    } finally {
      setLoadingSwings(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedSession) return;
    
    setSaving(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      // Calculate composite score (average of 4B scores * 10 for 0-100 scale)
      const compositeScore = ((scores.brain + scores.body + scores.bat + scores.ball) / 4) * 10;
      
      // Determine grade
      let grade = 'Needs Work';
      if (compositeScore >= 80) grade = 'Elite';
      else if (compositeScore >= 70) grade = 'Excellent';
      else if (compositeScore >= 60) grade = 'Above Avg';
      else if (compositeScore >= 50) grade = 'Average';
      else if (compositeScore >= 40) grade = 'Below Avg';
      
      // Determine weakest category
      const categoryScores = { brain: scores.brain, body: scores.body, bat: scores.bat, ball: scores.ball };
      const weakest = Object.entries(categoryScores).reduce((min, [key, val]) => 
        val < min[1] ? [key, val] : min, ['brain', 10])[0];
      
      // Update session with analysis
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-analyzer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'analyze',
          sessionId: selectedSession.id,
          scores: {
            four_b_brain: scores.brain * 10,
            four_b_body: scores.body * 10,
            four_b_bat: scores.bat * 10,
            four_b_ball: scores.ball * 10,
            composite_score: compositeScore,
            grade,
            weakest_category: weakest,
            problems_identified: problems
          },
          notes
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save analysis');
      }
      
      toast.success('Analysis saved! Report generated.');
      await fetchSessions();
      
      // Refresh the selected session
      const { data: updatedSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', selectedSession.id)
        .maybeSingle();
      
      if (updatedSession) {
        setSelectedSession(updatedSession);
      }
      
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate report');
    } finally {
      setSaving(false);
    }
  };

  const handleSendResults = async () => {
    if (!selectedSession) return;
    
    setSending(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-analyzer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'sendResults',
          sessionId: selectedSession.id
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send results');
      }
      
      toast.success('Results sent to player!');
      
    } catch (error) {
      console.error('Failed to send results:', error);
      toast.error('Failed to send results');
    } finally {
      setSending(false);
    }
  };

  const toggleProblem = (problem: string) => {
    setProblems(prev => 
      prev.includes(problem) 
        ? prev.filter(p => p !== problem)
        : [...prev, problem]
    );
  };

  const currentSwing = swings[currentSwingIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <main className="container py-6">
        {selectedSession ? (
          // Analyzer View
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setSelectedSession(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Queue
              </Button>
              <h1 className="text-2xl font-bold">Analyzing: {selectedSession.player_name}</h1>
              <Badge className={statusColors[selectedSession.status] || 'bg-gray-500'}>
                {selectedSession.status.replace('_', ' ')}
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Video Player */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardContent className="p-4">
                    {loadingSwings ? (
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : currentSwing?.video_url ? (
                      <video
                        key={currentSwing.id}
                        src={currentSwing.video_url}
                        controls
                        className="w-full aspect-video bg-black rounded-lg"
                      />
                    ) : (
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No video uploaded yet</p>
                        </div>
                      </div>
                    )}
                    
                    {swings.length > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        {swings.map((_, idx) => (
                          <Button
                            key={idx}
                            size="sm"
                            variant={idx === currentSwingIndex ? "default" : "outline"}
                            onClick={() => setCurrentSwingIndex(idx)}
                          >
                            Swing {idx + 1}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 4B Score Inputs */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      4B Scores (1-10)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {[
                      { key: 'brain', label: 'Brain (Timing/Sequencing)', icon: Brain, color: 'text-blue-500' },
                      { key: 'body', label: 'Body (Legs/Hips)', icon: Activity, color: 'text-green-500' },
                      { key: 'bat', label: 'Bat (Mechanics)', icon: Zap, color: 'text-red-500' },
                      { key: 'ball', label: 'Ball (Impact)', icon: Target, color: 'text-orange-500' }
                    ].map(({ key, label, icon: Icon, color }) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${color}`} />
                            {label}
                          </Label>
                          <span className="text-lg font-bold">{scores[key as keyof typeof scores]}</span>
                        </div>
                        <Slider
                          value={[scores[key as keyof typeof scores]]}
                          onValueChange={([val]) => setScores(prev => ({ ...prev, [key]: val }))}
                          min={1}
                          max={10}
                          step={0.5}
                          className="w-full"
                        />
                      </div>
                    ))}
                    
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Composite Score</span>
                        <span className="text-2xl font-bold text-primary">
                          {((scores.brain + scores.body + scores.bat + scores.ball) / 4 * 10).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Player Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Player Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">{selectedSession.player_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {selectedSession.player_email}
                      </p>
                    </div>
                    {selectedSession.player_phone && (
                      <div>
                        <Label className="text-muted-foreground">Phone</Label>
                        <p className="font-medium flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedSession.player_phone}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-muted-foreground">Age</Label>
                        <p className="font-medium">{selectedSession.player_age}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Level</Label>
                        <p className="font-medium capitalize">{selectedSession.player_level}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Product</Label>
                      <Badge variant="secondary" className="mt-1">
                        {selectedSession.product_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Environment</Label>
                      <p className="font-medium capitalize">{selectedSession.environment}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Problem Identifier */}
                <Card>
                  <CardHeader>
                    <CardTitle>Problems Identified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {PROBLEMS_LIST.map(problem => (
                        <Badge
                          key={problem}
                          variant={problems.includes(problem) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleProblem(problem)}
                        >
                          {problem.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Coach Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes about this swing..."
                      rows={4}
                    />
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={handleGenerateReport}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Generate Report
                  </Button>
                  
                  <Button 
                    variant="secondary" 
                    className="w-full"
                    onClick={handleSendResults}
                    disabled={sending || selectedSession.status !== 'complete'}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Results
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Queue/Completed View
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Swing Analyzer</h1>
              <TabsList>
                <TabsTrigger value="queue" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Queue ({sessions.filter(s => s.status === 'paid').length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Completed ({completedSessions.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="queue">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No pending sessions
                          </TableCell>
                        </TableRow>
                      ) : (
                        sessions.map(session => (
                          <TableRow key={session.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{session.player_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {session.player_level}, Age {session.player_age}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{session.player_email}</p>
                                {session.player_phone && (
                                  <p className="text-muted-foreground">{session.player_phone}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {session.product_type.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[session.status] || 'bg-gray-500'}>
                                {session.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(session.created_at), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => selectSession(session)}
                                disabled={session.status !== 'paid' && session.status !== 'complete'}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Analyze
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="completed">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Weakest</TableHead>
                        <TableHead>Analyzed</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedSessions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No completed analyses
                          </TableCell>
                        </TableRow>
                      ) : (
                        completedSessions.map(session => (
                          <TableRow key={session.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{session.player_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {session.player_email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-lg font-bold">
                                {session.composite_score?.toFixed(0) || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{session.grade || '—'}</Badge>
                            </TableCell>
                            <TableCell className="capitalize">
                              {session.problems_identified?.slice(0, 2).join(', ').replace(/_/g, ' ') || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {session.analyzed_at 
                                ? format(new Date(session.analyzed_at), 'MMM d, yyyy')
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => selectSession(session)}
                              >
                                View
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
