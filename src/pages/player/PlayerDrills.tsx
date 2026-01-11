import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { PlayCircle, CheckCircle2, Clock, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface Drill {
  id: string;
  name: string;
  sets: number;
  reps: number;
  completed: boolean;
  videoUrl: string;
}

interface Program {
  id: string;
  name: string;
  currentWeek: number;
  totalWeeks: number;
  completedDrills: number;
  totalDrills: number;
  completionPercent: number;
}

export default function PlayerDrills() {
  const [todaysDrills, setTodaysDrills] = useState<Drill[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    // Load drills - placeholder data for now
    setTodaysDrills([
      { id: '1', name: 'Tee Work - Middle', sets: 3, reps: 10, completed: false, videoUrl: '#' },
      { id: '2', name: 'Soft Toss - Inside', sets: 3, reps: 10, completed: true, videoUrl: '#' },
      { id: '3', name: 'Front Toss - Away', sets: 2, reps: 15, completed: false, videoUrl: '#' },
    ]);

    setPrograms([
      { 
        id: '1', 
        name: 'Pre-Season Hitting Program', 
        currentWeek: 2, 
        totalWeeks: 6,
        completedDrills: 12,
        totalDrills: 36,
        completionPercent: 33,
      },
    ]);
  }, []);

  const toggleDrillComplete = (drillId: string) => {
    setTodaysDrills(drills =>
      drills.map(d =>
        d.id === drillId ? { ...d, completed: !d.completed } : d
      )
    );
  };

  const completedCount = todaysDrills.filter(d => d.completed).length;
  const totalCount = todaysDrills.length;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 md:ml-56">
      <h1 className="text-2xl font-bold">My Drills</h1>

      {/* Today's Training */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Today's Training</CardTitle>
              <CardDescription>{format(new Date(), 'EEEE, MMMM d')}</CardDescription>
            </div>
            <Badge variant={completedCount === totalCount ? "default" : "secondary"}>
              {completedCount}/{totalCount} Complete
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {todaysDrills.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">No drills scheduled for today.</p>
              <p className="text-sm text-muted-foreground">Enjoy your rest day! 💪</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysDrills.map(drill => (
                <div
                  key={drill.id}
                  className={cn(
                    "flex items-center justify-between p-3 border rounded-lg transition-colors",
                    drill.completed && "bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={drill.completed}
                      onCheckedChange={() => toggleDrillComplete(drill.id)}
                    />
                    <div>
                      <p className={cn(
                        "font-medium text-sm",
                        drill.completed && "line-through text-muted-foreground"
                      )}>
                        {drill.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {drill.sets} sets × {drill.reps} reps
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <PlayCircle className="h-4 w-4 mr-1" /> Watch
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Programs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">My Programs</CardTitle>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <div className="text-center py-8">
              <Dumbbell className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No programs assigned yet. Check back with your coach!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {programs.map(program => (
                <div key={program.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{program.name}</h4>
                    <Badge variant="outline">
                      Week {program.currentWeek} of {program.totalWeeks}
                    </Badge>
                  </div>
                  <Progress value={program.completionPercent} className="mb-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{program.completedDrills}/{program.totalDrills} drills completed</span>
                    <span>{program.completionPercent}%</span>
                  </div>
                  <Button variant="outline" className="w-full mt-3">
                    View Program Details
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
