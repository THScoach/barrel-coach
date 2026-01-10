import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Loader2, User, AlertTriangle, ExternalLink, Sparkles } from "lucide-react";

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

interface PlayerResearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayerFound: (data: PlayerResearch) => void;
  initialName?: string;
}

export function PlayerResearchModal({ 
  open, 
  onOpenChange, 
  onPlayerFound,
  initialName = ""
}: PlayerResearchModalProps) {
  const [searchName, setSearchName] = useState(initialName);
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<PlayerResearch | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (!searchName.trim()) {
      toast.error("Enter a player name to search");
      return;
    }

    setIsSearching(true);
    setResult(null);
    setNotFound(false);

    try {
      const { data, error } = await supabase.functions.invoke("research-player", {
        body: { player_name: searchName.trim() },
      });

      if (error) throw error;

      if (data.success && data.player) {
        setResult(data.player);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error("Research error:", error);
      toast.error("Failed to research player. Try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseData = () => {
    if (result) {
      onPlayerFound(result);
      onOpenChange(false);
      setResult(null);
      setSearchName("");
    }
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 60) return "text-green-600";
    if (grade >= 50) return "text-yellow-600";
    if (grade >= 40) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Coach Rick AI - Player Research
          </DialogTitle>
          <DialogDescription>
            Search baseball databases for player information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Enter player name (e.g., Nazeem Zinatelo)"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Loading State */}
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                Searching FanGraphs, MiLB, Baseball Reference...
              </p>
            </div>
          )}

          {/* Not Found State */}
          {notFound && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
              <CardContent className="pt-4 text-center">
                <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="font-medium">No data found for "{searchName}"</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This might be a youth or amateur player not in pro databases.
                  You can still add them manually.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && (
            <Card>
              <CardContent className="pt-4 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{result.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {result.organization && (
                        <Badge variant="secondary">{result.organization}</Badge>
                      )}
                      {result.position && <Badge>{result.position}</Badge>}
                      {result.level && (
                        <Badge variant="outline">{result.level}</Badge>
                      )}
                    </div>
                  </div>
                  <User className="h-10 w-10 text-muted-foreground" />
                </div>

                {/* Basic Info */}
                {(result.current_team || result.age || result.bats) && (
                  <div className="text-sm text-muted-foreground">
                    {result.current_team && <span>{result.current_team}</span>}
                    {result.age && <span> • Age {result.age}</span>}
                    {result.height && <span> • {result.height}</span>}
                    {result.weight && <span> • {result.weight} lbs</span>}
                    {result.bats && <span> • B: {result.bats}</span>}
                    {result.throws && <span> • T: {result.throws}</span>}
                  </div>
                )}

                {/* Stats */}
                {result.stats && Object.keys(result.stats).length > 0 && (
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      {result.stats.year || "Recent"} Stats
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm font-mono">
                      {result.stats.avg && (
                        <span><strong>{result.stats.avg}</strong> AVG</span>
                      )}
                      {result.stats.hr !== undefined && (
                        <span><strong>{result.stats.hr}</strong> HR</span>
                      )}
                      {result.stats.rbi !== undefined && (
                        <span><strong>{result.stats.rbi}</strong> RBI</span>
                      )}
                      {result.stats.sb !== undefined && (
                        <span><strong>{result.stats.sb}</strong> SB</span>
                      )}
                      {result.stats.ops && (
                        <span><strong>{result.stats.ops}</strong> OPS</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Scouting Grades */}
                {result.scouting_grades && Object.keys(result.scouting_grades).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Scouting Grades (20-80)</p>
                    <div className="flex flex-wrap gap-3">
                      {result.scouting_grades.hit && (
                        <div className="text-center">
                          <span className={`text-lg font-bold ${getGradeColor(result.scouting_grades.hit)}`}>
                            {result.scouting_grades.hit}
                          </span>
                          <p className="text-xs text-muted-foreground">Hit</p>
                        </div>
                      )}
                      {result.scouting_grades.power && (
                        <div className="text-center">
                          <span className={`text-lg font-bold ${getGradeColor(result.scouting_grades.power)}`}>
                            {result.scouting_grades.power}
                          </span>
                          <p className="text-xs text-muted-foreground">Power</p>
                        </div>
                      )}
                      {result.scouting_grades.speed && (
                        <div className="text-center">
                          <span className={`text-lg font-bold ${getGradeColor(result.scouting_grades.speed)}`}>
                            {result.scouting_grades.speed}
                          </span>
                          <p className="text-xs text-muted-foreground">Speed</p>
                        </div>
                      )}
                      {result.scouting_grades.field && (
                        <div className="text-center">
                          <span className={`text-lg font-bold ${getGradeColor(result.scouting_grades.field)}`}>
                            {result.scouting_grades.field}
                          </span>
                          <p className="text-xs text-muted-foreground">Field</p>
                        </div>
                      )}
                      {result.scouting_grades.arm && (
                        <div className="text-center">
                          <span className={`text-lg font-bold ${getGradeColor(result.scouting_grades.arm)}`}>
                            {result.scouting_grades.arm}
                          </span>
                          <p className="text-xs text-muted-foreground">Arm</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Scouting Reports */}
                {result.scouting_reports && result.scouting_reports.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Scouting Notes</p>
                    <div className="space-y-2">
                      {result.scouting_reports.map((report, i) => (
                        <p key={i} className="text-sm italic text-muted-foreground">
                          "{report}"
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Known Issues */}
                {result.known_issues && result.known_issues.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                    <p className="text-xs text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Issues to Watch
                    </p>
                    <ul className="text-sm space-y-1">
                      {result.known_issues.map((issue, i) => (
                        <li key={i}>• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sources */}
                {result.sources && result.sources.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {result.sources.map((url, i) => {
                        const domain = new URL(url).hostname.replace("www.", "");
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {domain}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleUseData} className="flex-1">
                    Use This Data
                  </Button>
                  <Button variant="outline" onClick={() => setResult(null)}>
                    Search Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
