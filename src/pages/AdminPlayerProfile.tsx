import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  ArrowLeft, Save, User, Phone, Building, 
  FileText, Plus, Loader2, Calendar, Sparkles, Target, Eye, Activity, Database
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { PlayerResearchModal } from "@/components/PlayerResearchModal";
import { UnifiedDataUploadModal } from "@/components/UnifiedDataUploadModal";
import { LaunchMonitorSessionDetail } from "@/components/LaunchMonitorSessionDetail";
import { RebootSessionDetail } from "@/components/RebootSessionDetail";
import { getBrandDisplayName } from "@/lib/csv-detector";

const LEVELS = ['Youth', 'High School', 'Travel Ball', 'College', 'Independent', 'MiLB', 'MLB'];
const POSITIONS = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'OF', 'DH', 'P', 'Utility'];
const BATS = ['Right', 'Left', 'Switch'];
const THROWS = ['Right', 'Left'];

export default function AdminPlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    organization: '',
    current_team: '',
    level: '',
    position: '',
    bats: '',
    throws: '',
    age: '',
    height: '',
    weight: '',
    hometown: '',
    email: '',
    phone: '',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    coach_notes: '',
    training_history: '',
    current_focus: '',
  });

  const [showResearchModal, setShowResearchModal] = useState(false);
  const [showDataUpload, setShowDataUpload] = useState(false);
  const [selectedLaunchMonitorSession, setSelectedLaunchMonitorSession] = useState<any>(null);
  const [selectedRebootSession, setSelectedRebootSession] = useState<any>(null);

  const { data: player, isLoading } = useQuery({
    queryKey: ['player-profile', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('player_profiles')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  // Populate form when player data loads
  if (player && formData.first_name === '' && !isNew) {
    setFormData({
      first_name: player.first_name || '',
      last_name: player.last_name || '',
      organization: player.organization || '',
      current_team: player.current_team || '',
      level: player.level || '',
      position: player.position || '',
      bats: player.bats || '',
      throws: player.throws || '',
      age: player.age?.toString() || '',
      height: player.height || '',
      weight: player.weight?.toString() || '',
      hometown: player.hometown || '',
      email: player.email || '',
      phone: player.phone || '',
      parent_name: player.parent_name || '',
      parent_phone: player.parent_phone || '',
      parent_email: player.parent_email || '',
      coach_notes: player.coach_notes || '',
      training_history: player.training_history || '',
      current_focus: player.current_focus || '',
    });
  }

  // Fetch player's sessions
  const { data: sessions } = useQuery({
    queryKey: ['player-sessions', id],
    queryFn: async () => {
      if (isNew) return [];
      const { data, error } = await supabase
        .from('sessions')
        .select('id, product_type, status, composite_score, grade, created_at')
        .eq('player_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  // Fetch player's Launch Monitor sessions
  const { data: launchMonitorSessions, refetch: refetchLaunchMonitor } = useQuery({
    queryKey: ['player-launch-monitor-sessions', id],
    queryFn: async () => {
      if (isNew) return [];
      const { data, error } = await supabase
        .from('launch_monitor_sessions')
        .select('*')
        .eq('player_id', id)
        .order('session_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  // Fetch player's Reboot uploads
  const { data: rebootUploads, refetch: refetchReboot } = useQuery({
    queryKey: ['player-reboot-uploads', id],
    queryFn: async () => {
      if (isNew) return [];
      const { data, error } = await supabase
        .from('reboot_uploads')
        .select('*')
        .eq('player_id', id)
        .order('session_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const refetchDataSessions = () => {
    refetchLaunchMonitor();
    refetchReboot();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name || null,
        organization: formData.organization || null,
        current_team: formData.current_team || null,
        level: formData.level || null,
        position: formData.position || null,
        bats: formData.bats || null,
        throws: formData.throws || null,
        age: formData.age ? parseInt(formData.age) : null,
        height: formData.height || null,
        weight: formData.weight ? parseInt(formData.weight) : null,
        hometown: formData.hometown || null,
        email: formData.email || null,
        phone: formData.phone || null,
        parent_name: formData.parent_name || null,
        parent_phone: formData.parent_phone || null,
        parent_email: formData.parent_email || null,
        coach_notes: formData.coach_notes || null,
        training_history: formData.training_history || null,
        current_focus: formData.current_focus || null,
      };

      if (isNew) {
        const { data, error } = await supabase
          .from('player_profiles')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('player_profiles')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['player-profiles'] });
      toast.success(isNew ? 'Player created!' : 'Player updated!');
      if (isNew) {
        navigate(`/admin/players/${data.id}`);
      }
    },
    onError: (error) => {
      toast.error('Failed to save player');
      console.error(error);
    }
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.first_name.trim()) {
      toast.error('First name is required');
      return;
    }
    saveMutation.mutate();
  };

  const handleResearchData = (data: any) => {
    // Parse the name
    const nameParts = data.name?.split(' ') || [];
    const firstName = nameParts[0] || formData.first_name;
    const lastName = nameParts.slice(1).join(' ') || formData.last_name;
    
    setFormData(prev => ({
      ...prev,
      first_name: firstName || prev.first_name,
      last_name: lastName || prev.last_name,
      organization: data.organization || prev.organization,
      current_team: data.current_team || prev.current_team,
      level: data.level || prev.level,
      position: data.position || prev.position,
      bats: data.bats || prev.bats,
      throws: data.throws || prev.throws,
      age: data.age?.toString() || prev.age,
      height: data.height || prev.height,
      weight: data.weight?.toString() || prev.weight,
      coach_notes: data.scouting_reports?.join('\n\n') || prev.coach_notes,
    }));
    
    toast.success('Player data imported from research!');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <main className="container py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin/players')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isNew ? 'Add New Player' : `${formData.first_name} ${formData.last_name || ''}`}
              </h1>
              {!isNew && player && (
                <p className="text-muted-foreground text-sm">
                  Added {formatDate(player.created_at)}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isNew && (
              <Button variant="outline" onClick={() => setShowResearchModal(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Research
              </Button>
            )}
            {!isNew && (
              <Button onClick={() => navigate(`/admin/new-session?player=${id}`)}>
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>
            )}
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>

        <Tabs defaultValue="info" className="space-y-6">
          <TabsList>
            <TabsTrigger value="info">Player Info</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="notes">Coach Notes</TabsTrigger>
            {!isNew && <TabsTrigger value="sessions">Sessions ({sessions?.length || 0})</TabsTrigger>}
            {!isNew && <TabsTrigger value="data">Data Sessions ({(launchMonitorSessions?.length || 0) + (rebootUploads?.length || 0)})</TabsTrigger>}
          </TabsList>

          <TabsContent value="info" className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => handleChange('first_name', e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => handleChange('last_name', e.target.value)}
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Age</Label>
                    <Input
                      type="number"
                      value={formData.age}
                      onChange={(e) => handleChange('age', e.target.value)}
                      placeholder="14"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Height</Label>
                    <Input
                      value={formData.height}
                      onChange={(e) => handleChange('height', e.target.value)}
                      placeholder='5&apos;10"'
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (lbs)</Label>
                    <Input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => handleChange('weight', e.target.value)}
                      placeholder="165"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Hometown</Label>
                  <Input
                    value={formData.hometown}
                    onChange={(e) => handleChange('hometown', e.target.value)}
                    placeholder="Dallas, TX"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Baseball Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Baseball Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <Input
                      value={formData.organization}
                      onChange={(e) => handleChange('organization', e.target.value)}
                      placeholder="Boston Red Sox"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Team</Label>
                    <Input
                      value={formData.current_team}
                      onChange={(e) => handleChange('current_team', e.target.value)}
                      placeholder="High-A Greenville"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={formData.level} onValueChange={(v) => handleChange('level', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map(level => (
                          <SelectItem key={level} value={level}>{level}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Select value={formData.position} onValueChange={(v) => handleChange('position', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {POSITIONS.map(pos => (
                          <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bats</Label>
                    <Select value={formData.bats} onValueChange={(v) => handleChange('bats', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {BATS.map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Throws</Label>
                    <Select value={formData.throws} onValueChange={(v) => handleChange('throws', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {THROWS.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="space-y-6">
            {/* Player Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Player Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="player@email.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parent Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Parent/Guardian Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Parent Name</Label>
                  <Input
                    value={formData.parent_name}
                    onChange={(e) => handleChange('parent_name', e.target.value)}
                    placeholder="John Smith Sr."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Parent Phone</Label>
                    <Input
                      value={formData.parent_phone}
                      onChange={(e) => handleChange('parent_phone', e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Parent Email</Label>
                    <Input
                      type="email"
                      value={formData.parent_email}
                      onChange={(e) => handleChange('parent_email', e.target.value)}
                      placeholder="parent@email.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Coach Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Focus</Label>
                  <Input
                    value={formData.current_focus}
                    onChange={(e) => handleChange('current_focus', e.target.value)}
                    placeholder="What are they working on right now?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Training History</Label>
                  <Textarea
                    value={formData.training_history}
                    onChange={(e) => handleChange('training_history', e.target.value)}
                    placeholder="Previous coaches, programs, camps..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>General Notes</Label>
                  <Textarea
                    value={formData.coach_notes}
                    onChange={(e) => handleChange('coach_notes', e.target.value)}
                    placeholder="Observations, personality, goals..."
                    rows={5}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {!isNew && (
            <TabsContent value="sessions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Session History
                    </span>
                    <Button onClick={() => navigate(`/admin/new-session?player=${id}`)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Session
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sessions && sessions.length > 0 ? (
                    <div className="space-y-2">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate(`/admin/analyzer?session=${session.id}`)}
                        >
                          <div>
                            <div className="font-medium">{session.product_type}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(session.created_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {session.composite_score && (
                              <Badge>{session.composite_score.toFixed(1)}</Badge>
                            )}
                            <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                              {session.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No sessions yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
          
          {/* Data Sessions Tab */}
          {!isNew && (
            <TabsContent value="data" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Data Sessions
                    </span>
                    <Button onClick={() => setShowDataUpload(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Upload Data
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(launchMonitorSessions && launchMonitorSessions.length > 0) || (rebootUploads && rebootUploads.length > 0) ? (
                    <div className="space-y-2">
                      {/* Launch Monitor Sessions */}
                      {launchMonitorSessions?.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedLaunchMonitorSession(session)}
                        >
                          <div className="flex items-center gap-3">
                            <Target className="h-5 w-5 text-blue-500" />
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {new Date(session.session_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                                <Badge variant="outline" className="text-xs">{getBrandDisplayName(session.source as any)}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {session.total_swings} swings • {session.contact_rate}% contact • {session.avg_exit_velo} avg velo
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Ball Score</div>
                              <div className={`text-xl font-bold ${
                                session.ball_score >= 60 ? 'text-green-500' :
                                session.ball_score >= 50 ? 'text-yellow-500' :
                                session.ball_score >= 40 ? 'text-orange-500' : 'text-red-500'
                              }`}>
                                {session.ball_score}
                              </div>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                      
                      {/* Reboot Uploads */}
                      {rebootUploads?.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedRebootSession(session)}
                        >
                          <div className="flex items-center gap-3">
                            <Activity className="h-5 w-5 text-purple-500" />
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {new Date(session.session_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                                <Badge variant="outline" className="text-xs">Reboot Motion</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Brain: {session.brain_score} • Body: {session.body_score} • Bat: {session.bat_score}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Composite</div>
                              <div className={`text-xl font-bold ${
                                session.composite_score >= 60 ? 'text-green-500' :
                                session.composite_score >= 50 ? 'text-yellow-500' :
                                session.composite_score >= 40 ? 'text-orange-500' : 'text-red-500'
                              }`}>
                                {session.composite_score}
                              </div>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Database className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground mb-4">No data sessions yet</p>
                      <Button onClick={() => setShowDataUpload(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Upload CSV Data
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* AI Research Modal */}
      <PlayerResearchModal
        open={showResearchModal}
        onOpenChange={setShowResearchModal}
        onPlayerFound={handleResearchData}
        initialName={`${formData.first_name} ${formData.last_name}`.trim()}
      />
      
      {/* Unified Data Upload Modal */}
      {id && !isNew && (
        <UnifiedDataUploadModal
          open={showDataUpload}
          onOpenChange={setShowDataUpload}
          playerId={id}
          playerName={`${formData.first_name} ${formData.last_name}`.trim()}
          onSuccess={refetchDataSessions}
        />
      )}
      
      {/* Launch Monitor Session Detail Modal */}
      <LaunchMonitorSessionDetail
        open={!!selectedLaunchMonitorSession}
        onOpenChange={(open) => !open && setSelectedLaunchMonitorSession(null)}
        session={selectedLaunchMonitorSession}
        onDelete={refetchDataSessions}
      />
      
      {/* Reboot Session Detail Modal */}
      <RebootSessionDetail
        open={!!selectedRebootSession}
        onOpenChange={(open) => !open && setSelectedRebootSession(null)}
        session={selectedRebootSession}
        onDelete={refetchDataSessions}
      />
    </div>
  );
}
