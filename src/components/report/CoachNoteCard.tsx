import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CoachNote } from '@/lib/report-types';
import { MessageSquare, Play } from 'lucide-react';

interface CoachNoteCardProps {
  note: CoachNote;
}

export function CoachNoteCard({ note }: CoachNoteCardProps) {
  return (
    <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          From Coach Rick
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-slate-300 leading-relaxed">
          {note.text}
        </p>
        
        {note.audio_url && (
          <Button
            variant="outline"
            size="sm"
            className="border-primary/50 text-primary hover:bg-primary/10"
          >
            <Play className="h-4 w-4 mr-2" />
            Play Audio
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
