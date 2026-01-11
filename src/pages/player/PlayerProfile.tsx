import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Plus, Check } from "lucide-react";
import { toast } from "sonner";

interface PlayerData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  handedness: string | null;
  level: string | null;
  team: string | null;
}

export default function PlayerProfile() {
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    bats: 'R',
    throws: 'R',
    level: '',
    team: '',
  });

  useEffect(() => {
    loadPlayer();
  }, []);

  const loadPlayer = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();

    if (data) {
      setPlayer(data);
      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        bats: data.handedness?.charAt(0) || 'R',
        throws: 'R', // Players table doesn't have throws yet
        level: data.level || '',
        team: data.team || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!player) return;
    setSaving(true);

    const { error } = await supabase
      .from('players')
      .update({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        handedness: formData.bats,
        level: formData.level,
        team: formData.team,
      })
      .eq('id', player.id);

    if (error) {
      toast.error('Failed to save changes');
    } else {
      toast.success('Profile updated!');
    }
    setSaving(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 md:ml-56">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 md:ml-56 max-w-2xl">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardContent className="pt-6">
          {/* Avatar */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src="" />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {formData.name ? getInitials(formData.name) : '??'}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 rounded-full h-8 w-8"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Bats</Label>
                <Select
                  value={formData.bats}
                  onValueChange={(v) => setFormData({ ...formData, bats: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R">Right</SelectItem>
                    <SelectItem value="L">Left</SelectItem>
                    <SelectItem value="S">Switch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Throws</Label>
                <Select
                  value={formData.throws}
                  onValueChange={(v) => setFormData({ ...formData, throws: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R">Right</SelectItem>
                    <SelectItem value="L">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Select
                  value={formData.level}
                  onValueChange={(v) => setFormData({ ...formData, level: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youth">Youth</SelectItem>
                    <SelectItem value="middle-school">Middle School</SelectItem>
                    <SelectItem value="hs-jv">HS JV</SelectItem>
                    <SelectItem value="hs-varsity">HS Varsity</SelectItem>
                    <SelectItem value="college">College</SelectItem>
                    <SelectItem value="pro">Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Team / Organization</Label>
              <Input
                value={formData.team}
                onChange={(e) => setFormData({ ...formData, team: e.target.value })}
              />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Goals Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">My Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">Increase exit velocity to 90+ mph</span>
              <Badge variant="secondary">In Progress</Badge>
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">Improve bat speed consistency</span>
              <Badge variant="secondary">In Progress</Badge>
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">Complete pre-season program</span>
              <Badge variant="default" className="bg-green-600">
                <Check className="h-3 w-3 mr-1" /> Achieved
              </Badge>
            </div>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Goal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
