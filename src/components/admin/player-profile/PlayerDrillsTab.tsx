import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, PlayCircle, BookOpen } from "lucide-react";

interface PlayerDrillsTabProps {
  playerId: string;
}

export function PlayerDrillsTab({ playerId }: PlayerDrillsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <PlayCircle className="h-5 w-5" />
          Assigned Programs
        </h3>
        <Button 
          variant="outline" 
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <Plus className="h-4 w-4 mr-2" /> Assign Program
        </Button>
      </div>
      
      <Card className="bg-slate-900/80 border-slate-800">
        <CardContent className="py-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-slate-500 mb-3" />
          <p className="text-slate-400">No drill programs assigned yet.</p>
          <p className="text-slate-500 text-sm mt-1">
            Assign programs from the library to track player progress.
          </p>
          <Button 
            variant="link" 
            className="text-primary mt-3"
          >
            Browse Library →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
