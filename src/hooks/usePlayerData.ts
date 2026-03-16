import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlayerInfo {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  level: string | null;
  team: string | null;
  position: string | null;
  handedness: string | null;
  throws: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  motor_profile_sensor: string | null;
  latest_composite_score: number | null;
  latest_body_score: number | null;
  latest_brain_score: number | null;
  latest_bat_score: number | null;
  latest_ball_score: number | null;
  account_status: string | null;
}

export function usePlayerData() {
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { setLoading(false); return; }

      const { data } = await supabase
        .from("players")
        .select("id, name, email, phone, level, team, position, handedness, throws, height_inches, weight_lbs, motor_profile_sensor, latest_composite_score, latest_body_score, latest_brain_score, latest_bat_score, latest_ball_score, account_status")
        .eq("email", user.email)
        .single();

      if (data) setPlayer(data as PlayerInfo);
      setLoading(false);
    };
    load();
  }, []);

  return { player, loading };
}
