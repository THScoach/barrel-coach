import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LockerRoomMessages } from "@/components/player/LockerRoomMessages";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlayerMessages() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getPlayerId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setLoading(false);
        return;
      }

      const { data: player } = await supabase
        .from("players")
        .select("id")
        .eq("email", user.email)
        .single();

      if (player) {
        setPlayerId(player.id);
      }
      setLoading(false);
    };

    getPlayerId();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 md:ml-56">
        <h1 className="text-2xl font-bold mb-4">Messages</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!playerId) {
    return (
      <div className="container mx-auto px-4 py-6 md:ml-56">
        <h1 className="text-2xl font-bold mb-4">Messages</h1>
        <p className="text-muted-foreground">
          Unable to load messages. Please ensure you're logged in.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:ml-56">
      <h1 className="text-2xl font-bold mb-4">Messages</h1>
      <LockerRoomMessages playerId={playerId} maxMessages={50} />
    </div>
  );
}
