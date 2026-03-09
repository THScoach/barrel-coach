import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DKFieldsSectionProps {
  playersId: string;
}

export function DKFieldsSection({ playersId }: DKFieldsSectionProps) {
  const [dkUuid, setDkUuid] = useState("");
  const [dkEmail, setDkEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("players")
        .select("dk_user_uuid, email")
        .eq("id", playersId)
        .maybeSingle();

      if (data) {
        setDkUuid(data.dk_user_uuid || "");
        setDkEmail(data.email || "");
      }
      setIsLoaded(true);
    };
    load();
  }, [playersId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("players")
        .update({
          dk_user_uuid: dkUuid || null,
          email: dkEmail || null,
        })
        .eq("id", playersId);

      if (error) throw error;
      toast.success("DK fields saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Diamond Kinetics
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving}
          className="text-slate-400 hover:text-white h-7 px-2"
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          <span className="ml-1 text-xs">Save DK</span>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">DK User UUID</Label>
          <Input
            value={dkUuid}
            onChange={(e) => setDkUuid(e.target.value)}
            placeholder="Manual override if auto-match fails"
            className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">DK Email</Label>
          <Input
            type="email"
            value={dkEmail}
            onChange={(e) => setDkEmail(e.target.value)}
            placeholder="Email to match DK account"
            className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Set the DK User UUID manually to match Diamond Kinetics swing data to this player.
        The email is used for automatic matching during sync.
      </p>
    </div>
  );
}
