import { useState, useEffect } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, Save, User, Phone, Building, 
  FileText, Plus, Loader2, Sparkles, Settings,
  MessageSquare, MoreHorizontal, Zap
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { PlayerResearchModal } from "@/components/PlayerResearchModal";

// Import the new tab components
import {
  PlayerActivityTab,
  PlayerScheduleTab,
  PlayerDataTab,
  PlayerDrillsTab,
  PlayerCommunicationTab,
  PlayerScoresTab,
} from "@/components/admin/player-profile";

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSendingBetaInvite, setIsSendingBetaInvite] = useState(false);

  const handleSendBetaInvite = async () => {
    if (!id || isNew) return;
    
    setIsSendingBetaInvite(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Not authenticated");
        return;
      }

      const response = await supabase.functions.invoke("send-beta-invite", {
        body: { playerId: id, betaDays: 60 },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to send invite");
      }

      toast.success("🔥 Beta invite sent!");
      queryClient.invalidateQueries({ queryKey: ['player-profile', id] });
    } catch (error: any) {
      console.error("Beta invite error:", error);
      toast.error(error.message || "Failed to send beta invite");
    } finally {
      setIsSendingBetaInvite(false);
    }
  };

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
  useEffect(() => {
    if (player && !isNew) {
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
  }, [player, isNew]);

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
      queryClient.invalidateQueries({ queryKey: ['player-profile', id] });
      toast.success(isNew ? 'Player created!' : 'Player updated!');
      setShowEditModal(false);
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

  const getInitials = (firstName: string, lastName?: string) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase() || 'P';
  };

  const getPlayerName = () => {
    if (player) {
      return `${player.first_name} ${player.last_name || ''}`.trim();
    }
    return `${formData.first_name} ${formData.last_name || ''}`.trim() || 'New Player';
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

  // For new players, show the create form
  if (isNew) {
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
              <h1 className="text-2xl font-bold text-white">Add New Player</h1>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowResearchModal(true)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI Research
              </Button>
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
                Create Player
              </Button>
            </div>
          </div>

          {/* New Player Form */}
          <div className="space-y-6">
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
              </CardContent>
            </Card>

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

            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Phone className="h-5 w-5" />
                  Contact Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label className="text-slate-300">Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <PlayerResearchModal
            open={showResearchModal}
            onOpenChange={setShowResearchModal}
            onPlayerFound={handleResearchData}
            initialName={`${formData.first_name} ${formData.last_name}`.trim()}
          />
        </main>
      </div>
    );
  }

  // For existing players, show the new 5-tab layout
  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      
      <main className="container py-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin/players')}
          className="mb-4 text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Players
        </Button>

        {/* Player Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-slate-700">
              <AvatarFallback className="bg-gradient-to-br from-red-600 to-orange-500 text-white text-xl font-bold">
                {getInitials(player?.first_name || '', player?.last_name || '')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-white">{getPlayerName()}</h1>
              <p className="text-slate-400">
                {player?.level || 'No level'} • {player?.current_team || 'No team'} • 
                Bats: {player?.bats || 'R'} / Throws: {player?.throws || 'R'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowEditModal(true)}
              className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                <DropdownMenuItem 
                  onClick={() => setShowEditModal(true)}
                  className="text-slate-300 focus:bg-slate-800 focus:text-white"
                >
                  Edit Player
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigate(`/admin/new-session?player=${id}`)}
                  className="text-slate-300 focus:bg-slate-800 focus:text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Session
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleSendBetaInvite}
                  disabled={isSendingBetaInvite}
                  className="text-yellow-400 focus:bg-slate-800 focus:text-yellow-400"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {isSendingBetaInvite ? "Sending..." : "Invite to Beta (60 days)"}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-slate-300 focus:bg-slate-800 focus:text-white">
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-400 focus:bg-slate-800 focus:text-red-400">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 6-Tab Navigation */}
        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList className="bg-slate-900/80 border border-slate-800">
            <TabsTrigger value="activity" className="data-[state=active]:bg-slate-800 text-slate-400 data-[state=active]:text-white">
              Activity
            </TabsTrigger>
            <TabsTrigger value="scores" className="data-[state=active]:bg-slate-800 text-slate-400 data-[state=active]:text-white">
              Scores
            </TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-slate-800 text-slate-400 data-[state=active]:text-white">
              Schedule
            </TabsTrigger>
            <TabsTrigger value="data" className="data-[state=active]:bg-slate-800 text-slate-400 data-[state=active]:text-white">
              Data
            </TabsTrigger>
            <TabsTrigger value="drills" className="data-[state=active]:bg-slate-800 text-slate-400 data-[state=active]:text-white">
              Drills
            </TabsTrigger>
            <TabsTrigger value="communication" className="data-[state=active]:bg-slate-800 text-slate-400 data-[state=active]:text-white">
              Communication
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity">
            <PlayerActivityTab playerId={id!} />
          </TabsContent>

          <TabsContent value="scores">
            <PlayerScoresTab playerId={id!} />
          </TabsContent>

          <TabsContent value="schedule">
            <PlayerScheduleTab playerId={id!} />
          </TabsContent>

          <TabsContent value="data">
            <PlayerDataTab playerId={id!} playerName={getPlayerName()} />
          </TabsContent>

          <TabsContent value="drills">
            <PlayerDrillsTab playerId={id!} />
          </TabsContent>

          <TabsContent value="communication">
            <PlayerCommunicationTab playerId={id!} playerName={getPlayerName()} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Player Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Player</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Basic Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">First Name *</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => handleChange('first_name', e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Last Name</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => handleChange('last_name', e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
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
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Height</Label>
                  <Input
                    value={formData.height}
                    onChange={(e) => handleChange('height', e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Weight</Label>
                  <Input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Baseball Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Baseball Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Organization</Label>
                  <Input
                    value={formData.organization}
                    onChange={(e) => handleChange('organization', e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Team</Label>
                  <Input
                    value={formData.current_team}
                    onChange={(e) => handleChange('current_team', e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
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
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Coach Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Notes</h3>
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
                <Label className="text-slate-300">Coach Notes</Label>
                <Textarea
                  value={formData.coach_notes}
                  onChange={(e) => handleChange('coach_notes', e.target.value)}
                  rows={4}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditModal(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
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
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlayerResearchModal
        open={showResearchModal}
        onOpenChange={setShowResearchModal}
        onPlayerFound={handleResearchData}
        initialName={`${formData.first_name} ${formData.last_name}`.trim()}
      />
    </div>
  );
}
