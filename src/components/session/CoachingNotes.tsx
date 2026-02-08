import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

interface CoachingNotesProps {
  sessionId: string; // internal reboot_sessions.id
  initialNotes: string | null;
}

export function CoachingNotes({ sessionId, initialNotes }: CoachingNotesProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setNotes(initialNotes || "");
    setHasChanges(false);
  }, [initialNotes]);

  const handleChange = (value: string) => {
    setNotes(value);
    setHasChanges(value !== (initialNotes || ""));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("reboot_sessions")
        .update({ notes })
        .eq("id", sessionId);

      if (error) throw error;
      toast.success("Notes saved");
      setHasChanges(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg">📝 Coaching Notes</CardTitle>
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Session observations, drill recommendations, cues to reinforce..."
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          className="bg-slate-800 border-slate-700 text-white min-h-[120px] placeholder:text-slate-500"
        />
      </CardContent>
    </Card>
  );
}
