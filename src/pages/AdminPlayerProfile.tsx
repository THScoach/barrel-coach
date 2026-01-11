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
      <div className="min-h-screen bg-slate-950">
        <AdminHeader />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      
      <main className="container py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/admin/players')}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {isNew ? 'Add New Player' : `${formData.first_name} ${formData.last_name || ''}`}
              </h1>
              {!isNew && player && (
                <p className="text-slate-400 text-sm">
                  Added {formatDate(player.created_at)}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isNew && (
              <Button 
                variant="outline" 
                onClick={() => setShowResearchModal(true)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI Research
              </Button>
            )}
            {!isNew && (
              <Button 
                onClick={() => navigate(`/admin/new-session?player=${id}`)}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>
            )}
            <Button 
              onClick={handleSave} 
              disabled={saveMutation.isPending}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
            >
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
          <TabsList className="bg-slate-900/80 border border-slate-800">
            <TabsTrigger value="info" className="data-[state=active]:bg-slate-800">Player Info</TabsTrigger>
            <TabsTrigger value="contact" className="data-[state=active]:bg-slate-800">Contact</TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-slate-800">Coach Notes</TabsTrigger>
            {!isNew && <TabsTrigger value="sessions" className="data-[state=active]:bg-slate-800">Sessions ({sessions?.length || 0})</TabsTrigger>}
            {!isNew && <TabsTrigger value="data" className="data-[state=active]:bg-slate-800">Data Sessions ({(launchMonitorSessions?.length || 0) + (rebootUploads?.length || 0)})</TabsTrigger>}
          </TabsList>

          <TabsContent value="info" className="space-y-6">
            {/* Basic Info */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">First Name *</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => handleChange('first_name', e.target.value)}
                      placeholder="John"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Last Name</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => handleChange('last_name', e.target.value)}
                      placeholder="Smith"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Age</Label>
                    <Input
                      type="number"
                      value={formData.age}
                      onChange={(e) => handleChange('age', e.target.value)}
                      placeholder="14"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Height</Label>
                    <Input
                      value={formData.height}
                      onChange={(e) => handleChange('height', e.target.value)}
                      placeholder='5&apos;10"'
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Weight (lbs)</Label>
                    <Input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => handleChange('weight', e.target.value)}
                      placeholder="165"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Hometown</Label>
                  <Input
                    value={formData.hometown}
                    onChange={(e) => handleChange('hometown', e.target.value)}
                    placeholder="Dallas, TX"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Baseball Info */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Building className="h-5 w-5" />
                  Baseball Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Organization</Label>
                    <Input
                      value={formData.organization}
                      onChange={(e) => handleChange('organization', e.target.value)}
                      placeholder="Boston Red Sox"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Current Team</Label>
                    <Input
                      value={formData.current_team}
                      onChange={(e) => handleChange('current_team', e.target.value)}
                      placeholder="High-A Greenville"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Level</Label>
                    <Select value={formData.level} onValueChange={(v) => handleChange('level', v)}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {LEVELS.map(level => (
                          <SelectItem key={level} value={level}>{level}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Position</Label>
                    <Select value={formData.position} onValueChange={(v) => handleChange('position', v)}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {POSITIONS.map(pos => (
                          <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Bats</Label>
                    <Select value={formData.bats} onValueChange={(v) => handleChange('bats', v)}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {BATS.map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Throws</Label>
                    <Select value={formData.throws} onValueChange={(v) => handleChange('throws', v)}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
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
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Phone className="h-5 w-5" />
                  Player Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="player@email.com"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parent/Guardian Contact */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Parent/Guardian Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Parent Name</Label>
                  <Input
                    value={formData.parent_name}
                    onChange={(e) => handleChange('parent_name', e.target.value)}
                    placeholder="Jane Smith"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Parent Phone</Label>
                    <Input
                      value={formData.parent_phone}
                      onChange={(e) => handleChange('parent_phone', e.target.value)}
                      placeholder="(555) 123-4567"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Parent Email</Label>
                    <Input
                      type="email"
                      value={formData.parent_email}
                      onChange={(e) => handleChange('parent_email', e.target.value)}
                      placeholder="parent@email.com"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="h-5 w-5" />
                  Coach Notes & Training
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Current Focus</Label>
                  <Input
                    value={formData.current_focus}
                    onChange={(e) => handleChange('current_focus', e.target.value)}
                    placeholder="e.g., Hip rotation, load timing"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Training History</Label>
                  <Textarea
                    value={formData.training_history}
                    onChange={(e) => handleChange('training_history', e.target.value)}
                    placeholder="Previous training, coaches, facilities..."
                    rows={3}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Coach Notes</Label>
                  <Textarea
                    value={formData.coach_notes}
                    onChange={(e) => handleChange('coach_notes', e.target.value)}
                    placeholder="Observations, progress notes, scouting reports..."
                    rows={6}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {!isNew && (
            <TabsContent value="sessions">
              <Card className="bg-slate-900/80 border-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Calendar className="h-5 w-5" />
                    Assessment Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sessions && sessions.length > 0 ? (
                    <div className="space-y-3">
                      {sessions.map((session) => (
                        <div 
                          key={session.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
                          onClick={() => navigate(`/admin/analyzer?session=${session.id}`)}
                        >
                          <div className="flex items-center gap-3">
                            <Target className="h-5 w-5 text-red-400" />
                            <div>
                              <p className="font-medium text-white">{session.product_type.replace(/_/g, ' ')}</p>
                              <p className="text-sm text-slate-400">{formatDate(session.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {session.composite_score && (
                              <div className="text-right">
                                <p className="text-2xl font-bold text-white">{session.composite_score}</p>
                                <Badge variant="outline" className="border-slate-700 text-slate-300">{session.grade}</Badge>
                              </div>
                            )}
                            <Badge 
                              className={
                                session.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                                session.status === 'paid' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-slate-500/20 text-slate-400'
                              }
                            >
                              {session.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <p>No sessions yet</p>
                      <Button 
                        onClick={() => navigate(`/admin/new-session?player=${id}`)}
                        className="mt-4 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Session
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {!isNew && (
            <TabsContent value="data">
              <div className="space-y-6">
                <div className="flex justify-end">
                  <Button 
                    onClick={() => setShowDataUpload(true)}
                    className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Upload Data
                  </Button>
                </div>

                {/* Launch Monitor Sessions */}
                {launchMonitorSessions && launchMonitorSessions.length > 0 && (
                  <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Activity className="h-5 w-5" />
                        Launch Monitor Sessions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {launchMonitorSessions.map((session) => (
                          <div 
                            key={session.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
                            onClick={() => setSelectedLaunchMonitorSession(session)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-orange-500/20">
                                <Target className="h-4 w-4 text-orange-400" />
                              </div>
                              <div>
                                <p className="font-medium text-white">{getBrandDisplayName(session.source)}</p>
                                <p className="text-sm text-slate-400">{formatDate(session.session_date)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm text-slate-400">Swings</p>
                                <p className="font-bold text-white">{session.total_swings}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-slate-400">Avg EV</p>
                                <p className="font-bold text-white">{session.avg_exit_velo?.toFixed(1) || '-'}</p>
                              </div>
                              {session.ball_score && (
                                <div className="text-right">
                                  <p className="text-sm text-slate-400">Ball Score</p>
                                  <p className="font-bold text-orange-400">{session.ball_score}</p>
                                </div>
                              )}
                              <Eye className="h-4 w-4 text-slate-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Reboot Sessions */}
                {rebootUploads && rebootUploads.length > 0 && (
                  <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Activity className="h-5 w-5" />
                        Reboot Motion Sessions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {rebootUploads.map((session) => (
                          <div 
                            key={session.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
                            onClick={() => setSelectedRebootSession(session)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-500/20">
                                <Activity className="h-4 w-4 text-blue-400" />
                              </div>
                              <div>
                                <p className="font-medium text-white">Reboot Motion</p>
                                <p className="text-sm text-slate-400">{formatDate(session.session_date)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {session.composite_score && (
                                <div className="text-right">
                                  <p className="text-sm text-slate-400">Composite</p>
                                  <p className="font-bold text-white">{session.composite_score}</p>
                                </div>
                              )}
                              {session.body_score && (
                                <div className="text-right">
                                  <p className="text-sm text-slate-400">Body</p>
                                  <p className="font-bold text-green-400">{session.body_score}</p>
                                </div>
                              )}
                              <Badge variant="outline" className="border-slate-700 text-slate-300">{session.grade || '-'}</Badge>
                              <Eye className="h-4 w-4 text-slate-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(!launchMonitorSessions || launchMonitorSessions.length === 0) && 
                 (!rebootUploads || rebootUploads.length === 0) && (
                  <Card className="bg-slate-900/80 border-slate-800">
                    <CardContent className="py-8 text-center text-slate-400">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No data sessions yet</p>
                      <Button 
                        onClick={() => setShowDataUpload(true)}
                        className="mt-4 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Upload First Data Session
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Modals */}
      <PlayerResearchModal 
        open={showResearchModal}
        onClose={() => setShowResearchModal(false)}
        onDataReceived={handleResearchData}
      />

      {showDataUpload && id && (
        <UnifiedDataUploadModal
          open={showDataUpload}
          onClose={() => setShowDataUpload(false)}
          playerId={id}
          onSuccess={refetchDataSessions}
        />
      )}

      {selectedLaunchMonitorSession && (
        <LaunchMonitorSessionDetail
          session={selectedLaunchMonitorSession}
          onClose={() => setSelectedLaunchMonitorSession(null)}
        />
      )}

      {selectedRebootSession && (
        <RebootSessionDetail
          session={selectedRebootSession}
          onClose={() => setSelectedRebootSession(null)}
        />
      )}
    </div>
  );
}
