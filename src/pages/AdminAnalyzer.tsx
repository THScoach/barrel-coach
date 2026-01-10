import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { 
  Loader2, ArrowLeft, User, Mail, Phone, Play,
  FileText, Send, CheckCircle2, Clock, Video, ChevronRight,
  Save, RefreshCw
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { ScoreInput } from "@/components/analyzer/ScoreInput";
import { ProblemSelector } from "@/components/analyzer/ProblemSelector";
import { DrillRecommendations } from "@/components/analyzer/DrillRecommendations";
import { VideoPlayer } from "@/components/analyzer/VideoPlayer";
import { format, formatDistanceToNow } from "date-fns";

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
  price_cents: number;
}

interface Swing {
  id: string;
  session_id: string;
  swing_index: number;
  video_url: string | null;
  status: string;
}

interface Analysis {
  id: string;
  session_id: string;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  overall_score: number | null;
  weakest_category: string | null;
  primary_problem: string;
  secondary_problems: string[] | null;
  motor_profile: string | null;
  coach_notes: string | null;
  private_notes: string | null;
  recommended_drill_ids: string[] | null;
  report_generated_at: string | null;
  results_sent_at: string | null;
}

const statusColors: Record<string, string> = {
  pending_upload: 'bg-gray-500',
  uploading: 'bg-yellow-500',
  pending_payment: 'bg-orange-500',
  paid: 'bg-blue-500',
  analyzing: 'bg-purple-500',
  complete: 'bg-green-500',
  failed: 'bg-red-500'
};

const MOTOR_PROFILES = ['force', 'rhythm', 'timing', 'balance'];

export default function AdminAnalyzer() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [swings, setSwings] = useState<Swing[]>([]);
  const [existingAnalysis, setExistingAnalysis] = useState<Analysis | null>(null);
  const [loadingSwings, setLoadingSwings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [currentSwingIndex, setCurrentSwingIndex] = useState(0);
  
  // Analysis form state
  const [scores, setScores] = useState({ brain: 5, body: 5, bat: 5, ball: 5 });
  const [primaryProblem, setPrimaryProblem] = useState('');
  const [secondaryProblems, setSecondaryProblems] = useState<string[]>([]);
  const [motorProfile, setMotorProfile] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [selectedDrillIds, setSelectedDrillIds] = useState<string[]>([]);

  const fetchSessions = useCallback(async () => {
    try {
      // Fetch pending sessions (queue)
      const { data: queueData, error: queueError } = await supabase
        .from('sessions')
        .select('*')
        .in('status', ['pending_upload', 'uploading', 'pending_payment', 'paid', 'analyzing'])
        .order('created_at', { ascending: true });
      
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
    
    try {
      // Fetch swings with signed URLs
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-session?sessionId=${session.id}`, {
        headers: { 'Authorization': `Bearer ${authSession?.access_token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setSwings(data.swings || []);
      }
      
      // Fetch existing analysis if any
      const { data: analysisData } = await supabase
        .from('swing_analyses')
        .select('*')
        .eq('session_id', session.id)
        .maybeSingle();
      
      if (analysisData) {
        setExistingAnalysis(analysisData);
        setScores({
          brain: analysisData.brain_score || 5,
          body: analysisData.body_score || 5,
          bat: analysisData.bat_score || 5,
          ball: analysisData.ball_score || 5
        });
        setPrimaryProblem(analysisData.primary_problem || '');
        setSecondaryProblems(analysisData.secondary_problems || []);
        setMotorProfile(analysisData.motor_profile || '');
        setCoachNotes(analysisData.coach_notes || '');
        setPrivateNotes(analysisData.private_notes || '');
        setSelectedDrillIds(analysisData.recommended_drill_ids || []);
      } else {
        // Reset form for new analysis
        setExistingAnalysis(null);
        setScores({ brain: 5, body: 5, bat: 5, ball: 5 });
        setPrimaryProblem('');
        setSecondaryProblems([]);
        setMotorProfile('');
        setCoachNotes('');
        setPrivateNotes('');
        setSelectedDrillIds([]);
      }
      
    } catch (error) {
      console.error('Failed to load session details:', error);
    } finally {
      setLoadingSwings(false);
    }
  };

  const getWeakestCategory = () => {
    const entries = Object.entries(scores);
    return entries.reduce((min, [key, val]) => val < min.val ? { key, val } : min, { key: 'brain', val: 10 }).key;
  };

  const isCompleteReview = selectedSession?.product_type === 'complete_assessment';
  const maxDrills = isCompleteReview ? 5 : 1;
  const maxSecondaryProblems = isCompleteReview ? 3 : 0;

  const handleSaveDraft = async () => {
    if (!selectedSession || !primaryProblem) {
      toast.error('Please select a primary problem');
      return;
    }
    
    setSaving(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/save-analysis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: selectedSession.id,
          brain_score: scores.brain,
          body_score: scores.body,
          bat_score: scores.bat,
          ball_score: scores.ball,
          primary_problem: primaryProblem,
          secondary_problems: secondaryProblems,
          motor_profile: motorProfile || null,
          coach_notes: coachNotes,
          private_notes: privateNotes,
          recommended_drill_ids: selectedDrillIds,
          is_draft: true
        })
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      
      toast.success('Draft saved!');
      await fetchSessions();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedSession || !primaryProblem) {
      toast.error('Please select a primary problem');
      return;
    }
    
    if (selectedDrillIds.length === 0) {
      toast.error('Please select at least one drill');
      return;
    }
    
    setGenerating(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/save-analysis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: selectedSession.id,
          brain_score: scores.brain,
          body_score: scores.body,
          bat_score: scores.bat,
          ball_score: scores.ball,
          primary_problem: primaryProblem,
          secondary_problems: secondaryProblems,
          motor_profile: motorProfile || null,
          coach_notes: coachNotes,
          private_notes: privateNotes,
          recommended_drill_ids: selectedDrillIds,
          is_draft: false
        })
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate report');
      }
      
      toast.success('Report generated! Ready to send.');
      await fetchSessions();
      
      // Refresh session data
      const { data: updated } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', selectedSession.id)
        .maybeSingle();
      if (updated) setSelectedSession(updated);
      
    } catch (error) {
      console.error('Generate error:', error);
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendResults = async () => {
    if (!selectedSession) return;
    
    if (!selectedSession.player_phone) {
      toast.error('No phone number for this player');
      return;
    }
    
    setSending(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-results`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_id: selectedSession.id })
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send');
      }
      
      toast.success(`Results sent to ${selectedSession.player_phone}!`);
      
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send results');
    } finally {
      setSending(false);
    }
  };

  const currentSwing = swings[currentSwingIndex];
  const pendingCount = sessions.filter(s => s.status === 'paid').length;

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
          // Analyzer Detail View
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => setSelectedSession(null)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Queue
                </Button>
                <h1 className="text-2xl font-bold">{selectedSession.player_name}</h1>
                <Badge className={statusColors[selectedSession.status] || 'bg-gray-500'}>
                  {selectedSession.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save Draft
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Video & Scores */}
              <div className="lg:col-span-2 space-y-6">
                {/* Video Player */}
                <Card>
                  <CardContent className="p-4">
                    {loadingSwings ? (
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : currentSwing?.video_url ? (
                      <VideoPlayer key={currentSwing.id} src={currentSwing.video_url} />
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

                {/* 4B Scores */}
                <Card>
                  <CardHeader>
                    <CardTitle>4B Scores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScoreInput scores={scores} onChange={setScores} />
                  </CardContent>
                </Card>

                {/* Problems */}
                <Card>
                  <CardHeader>
                    <CardTitle>Problem Identification</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProblemSelector
                      primaryProblem={primaryProblem}
                      secondaryProblems={secondaryProblems}
                      onPrimaryChange={setPrimaryProblem}
                      onSecondaryChange={setSecondaryProblems}
                      weakestCategory={getWeakestCategory()}
                      maxSecondary={maxSecondaryProblems}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Player Info & Actions */}
              <div className="space-y-4">
                {/* Player Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Player Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <Label className="text-muted-foreground text-xs">Name</Label>
                      <p className="font-medium">{selectedSession.player_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Email</Label>
                      <p className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {selectedSession.player_email}
                      </p>
                    </div>
                    {selectedSession.player_phone && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Phone</Label>
                        <p className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedSession.player_phone}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-muted-foreground text-xs">Age</Label>
                        <p>{selectedSession.player_age}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Level</Label>
                        <p className="capitalize">{selectedSession.player_level}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Product</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">
                          {selectedSession.product_type.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-muted-foreground">
                          ${(selectedSession.price_cents / 100).toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Purchased</Label>
                      <p>{format(new Date(selectedSession.created_at), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Motor Profile (Complete Review only) */}
                {isCompleteReview && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Motor Profile</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup value={motorProfile} onValueChange={setMotorProfile}>
                        <div className="grid grid-cols-2 gap-2">
                          {MOTOR_PROFILES.map(profile => (
                            <label
                              key={profile}
                              className={`flex items-center gap-2 p-2 rounded border cursor-pointer capitalize
                                ${motorProfile === profile ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}
                              `}
                            >
                              <RadioGroupItem value={profile} />
                              {profile}
                            </label>
                          ))}
                        </div>
                      </RadioGroup>
                    </CardContent>
                  </Card>
                )}

                {/* Drill Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Drills ({isCompleteReview ? '3-5' : '1'})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DrillRecommendations
                      selectedDrillIds={selectedDrillIds}
                      onSelectionChange={setSelectedDrillIds}
                      weakestCategory={getWeakestCategory()}
                      primaryProblem={primaryProblem}
                      maxDrills={maxDrills}
                    />
                  </CardContent>
                </Card>

                {/* Coach Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Coach Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Shown to player</Label>
                      <Textarea
                        value={coachNotes}
                        onChange={(e) => setCoachNotes(e.target.value)}
                        placeholder="Your lower body is spinning open too early..."
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Private (internal only)</Label>
                      <Textarea
                        value={privateNotes}
                        onChange={(e) => setPrivateNotes(e.target.value)}
                        placeholder="Reminds me of player X..."
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={handleGenerateReport}
                    disabled={generating || !primaryProblem || selectedDrillIds.length === 0}
                  >
                    {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                    Generate Report
                  </Button>
                  
                  <Button 
                    variant="secondary" 
                    className="w-full"
                    onClick={handleSendResults}
                    disabled={sending || selectedSession.status !== 'complete' || !selectedSession.player_phone}
                  >
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Results to Player
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Queue/Completed List View
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Swing Analyzer</h1>
                <p className="text-muted-foreground">Review and analyze player swings</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  Queue: {pendingCount}
                </Badge>
                <Button variant="outline" size="sm" onClick={fetchSessions}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending ({pendingCount})
                </TabsTrigger>
                <TabsTrigger value="in_progress" className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4" />
                  In Progress ({sessions.filter(s => s.status === 'analyzing').length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Completed ({completedSessions.length})
                </TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let filtered: Session[] = [];
                        if (activeTab === 'pending') filtered = sessions.filter(s => s.status === 'paid');
                        else if (activeTab === 'in_progress') filtered = sessions.filter(s => s.status === 'analyzing');
                        else if (activeTab === 'completed') filtered = completedSessions;
                        else filtered = [...sessions, ...completedSessions];
                        
                        if (filtered.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No sessions in this category
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        return filtered.map(session => (
                          <TableRow key={session.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{session.player_name}</p>
                                <p className="text-sm text-muted-foreground">{session.player_email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant="secondary">
                                  {session.product_type.replace(/_/g, ' ')}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  ${(session.price_cents / 100).toFixed(0)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[session.status] || 'bg-gray-500'}>
                                {session.status.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant={session.status === 'paid' ? 'default' : 'ghost'}
                                onClick={() => selectSession(session)}
                                disabled={!['paid', 'analyzing', 'complete'].includes(session.status)}
                              >
                                {session.status === 'paid' ? (
                                  <>
                                    <Play className="h-4 w-4 mr-1" />
                                    Analyze
                                  </>
                                ) : (
                                  'View'
                                )}
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
