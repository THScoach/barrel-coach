import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Search, Plus, Users, Building, MapPin, 
  Phone, Mail, ChevronRight, Loader2
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";

interface PlayerProfile {
  id: string;
  first_name: string;
  last_name: string | null;
  organization: string | null;
  current_team: string | null;
  level: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  total_sessions: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminPlayers() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const { data: players, isLoading, error } = useQuery({
    queryKey: ['player-profiles', searchQuery, orgFilter, levelFilter],
    queryFn: async () => {
      let query = supabase
        .from('player_profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (searchQuery) {
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`);
      }
      
      if (orgFilter && orgFilter !== 'all') {
        query = query.eq('organization', orgFilter);
      }
      
      if (levelFilter && levelFilter !== 'all') {
        query = query.eq('level', levelFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PlayerProfile[];
    }
  });

  // Get unique organizations and levels for filters
  const { data: filterOptions } = useQuery({
    queryKey: ['player-filter-options'],
    queryFn: async () => {
      const { data } = await supabase
        .from('player_profiles')
        .select('organization, level')
        .eq('is_active', true);
      
      const organizations = [...new Set(data?.map(p => p.organization).filter(Boolean) || [])];
      const levels = [...new Set(data?.map(p => p.level).filter(Boolean) || [])];
      
      return { organizations, levels };
    }
  });

  const formatPhone = (phone: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  if (error) {
    toast.error('Failed to load players');
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <main className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Players
            </h1>
            <p className="text-muted-foreground">Manage your player database</p>
          </div>
          <Button onClick={() => navigate('/admin/players/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Player
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="w-[180px]">
                  <Building className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {filterOptions?.organizations.map(org => (
                    <SelectItem key={org} value={org!}>{org}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[150px]">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {filterOptions?.levels.map(level => (
                    <SelectItem key={level} value={level!}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Players Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : players && players.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-center">Sessions</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((player) => (
                    <TableRow 
                      key={player.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/players/${player.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {player.first_name} {player.last_name || ''}
                          </div>
                          {player.position && (
                            <Badge variant="outline" className="mt-1">
                              {player.position}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {player.organization || '-'}
                          {player.current_team && (
                            <div className="text-muted-foreground">
                              {player.current_team}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {player.level ? (
                          <Badge variant="secondary">{player.level}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {player.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {formatPhone(player.phone)}
                            </div>
                          )}
                          {player.email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {player.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={player.total_sessions > 0 ? "default" : "outline"}>
                          {player.total_sessions}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-1">No players yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first player to get started
                </p>
                <Button onClick={() => navigate('/admin/players/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Player
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
