/**
 * Player Profile & Settings (4B brand) — Polished
 */
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerData } from "@/hooks/usePlayerData";
import { PlayerBottomNav } from "@/components/player-v2/PlayerBottomNav";
import { TagPill } from "@/components/player-v2/TagPill";
import { getInitials, motorProfileColor } from "@/lib/player-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { LogOut, Download, Share2, ChevronRight } from "lucide-react";

export default function PlayerProfilePage() {
  const { player, loading } = usePlayerData();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleExportCSV = async () => {
    if (!player?.id) return;
    const { data } = await supabase
      .from("player_sessions")
      .select("session_date, overall_score, body_score, brain_score, bat_score, ball_score, leak_type, swing_count")
      .eq("player_id", player.id)
      .order("session_date", { ascending: true });

    if (!data || data.length === 0) {
      toast.info("No session data to export");
      return;
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(r => Object.values(r).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${player.name || 'player'}_sessions.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  if (loading) {
    return (
      <div style={{ background: '#000', minHeight: '100vh' }}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-20 w-20 rounded-full mx-auto" style={{ background: '#1a1a1a' }} />
          <Skeleton className="h-6 w-48 mx-auto" style={{ background: '#111' }} />
          <Skeleton className="h-48 w-full rounded-2xl" style={{ background: '#111' }} />
        </div>
      </div>
    );
  }

  const weightNum = player?.weight_lbs ? Number(player.weight_lbs) : 0;
  const heightFt = player?.height_inches ? Math.floor(Number(player.height_inches) / 12) : null;
  const heightIn = player?.height_inches ? Number(player.height_inches) % 12 : null;

  const injuryHistory: Array<{ name: string; status: string; date?: string; note?: string }> = (() => {
    try {
      const raw = (player as any)?.injury_history;
      if (Array.isArray(raw)) return raw;
      return [];
    } catch { return []; }
  })();

  return (
    <div style={{ background: '#000', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a' }}>
        <h1 className="text-lg font-black" style={{ color: '#fff' }}>Profile</h1>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-bold transition-all hover:opacity-70" style={{ color: '#555' }}>
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </header>

      <main className="px-4 pb-24 pt-6 space-y-3">
        {/* Avatar + Name */}
        <div className="text-center">
          <div
            className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center mx-auto text-xl font-black"
            style={{ background: 'linear-gradient(135deg, #1a1a1a, #222)', color: '#fff', border: '1px solid #333' }}
          >
            {getInitials(player?.name)}
          </div>
          <h2 className="text-xl font-black mt-3" style={{ color: '#fff' }}>{player?.name || 'Player'}</h2>
          <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
            {player?.team && <span className="text-[11px] font-semibold" style={{ color: '#555' }}>{player.team}</span>}
            {player?.position && <span className="text-[11px]" style={{ color: '#333' }}>·</span>}
            {player?.position && <span className="text-[11px] font-semibold" style={{ color: '#555' }}>{player.position}</span>}
            {player?.level && <span className="text-[11px]" style={{ color: '#333' }}>·</span>}
            {player?.level && <span className="text-[11px] font-semibold" style={{ color: '#555' }}>{player.level}</span>}
          </div>
          {player?.motor_profile_sensor && (
            <div className="mt-2">
              <TagPill label={player.motor_profile_sensor} color={motorProfileColor(player.motor_profile_sensor)} />
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
          {[
            { label: 'Height', value: heightFt ? `${heightFt}'${heightIn}"` : '—' },
            { label: 'Weight', value: player?.weight_lbs ? `${Math.round(Number(player.weight_lbs))} lbs` : '—' },
            { label: 'Bats', value: player?.handedness || '—' },
            { label: 'Level', value: player?.level || '—' },
          ].map((row, i) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: i < 3 ? '1px solid #1a1a1a' : 'none' }}>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#444' }}>{row.label}</span>
              <span className="text-sm font-black" style={{ color: '#fff' }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Injury History */}
        {injuryHistory.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#555' }}>Injury History</p>
            <p className="text-[10px] mb-3" style={{ color: '#444' }}>Informs flag interpretation</p>
            <div className="space-y-2">
              {injuryHistory.map((inj, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: '#fff' }}>{inj.name}</span>
                  <TagPill
                    label={inj.status === 'active' ? 'ACTIVE' : 'CLEARED'}
                    color={inj.status === 'active' ? '#E63946' : '#4ecdc4'}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Band Selection */}
        <div className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#555' }}>Recommended Band</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Red Band', range: 'Under 160 lbs', color: '#E63946', match: weightNum > 0 && weightNum < 160 },
              { label: 'Black Band', range: '160–250 lbs', color: '#fff', match: weightNum >= 160 && weightNum <= 250 },
            ].map(b => (
              <div
                key={b.label}
                className="rounded-xl p-3 text-center transition-all"
                style={{
                  background: b.match ? `${b.color === '#fff' ? '#ffffff' : b.color}08` : '#0a0a0a',
                  border: `1px solid ${b.match ? (b.color === '#fff' ? '#333' : `${b.color}30`) : '#1a1a1a'}`,
                  opacity: b.match ? 1 : 0.35,
                }}
              >
                <p className="text-sm font-black" style={{ color: b.color }}>{b.label}</p>
                <p className="text-[10px] mt-1" style={{ color: '#444' }}>{b.range}</p>
              </div>
            ))}
          </div>
          {weightNum > 250 && (
            <p className="text-center text-sm font-black mt-3" style={{ color: '#fff' }}>Double Black Band</p>
          )}
        </div>

        {/* Export & Share */}
        <div className="space-y-2">
          <button
            onClick={handleExportCSV}
            className="w-full rounded-2xl p-4 flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.98]"
            style={{ background: '#111', border: '1px solid #1a1a1a' }}
          >
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5" style={{ color: '#555' }} />
              <span className="text-sm font-bold" style={{ color: '#fff' }}>Download Session Data</span>
            </div>
            <ChevronRight className="h-4 w-4" style={{ color: '#333' }} />
          </button>

          <button
            onClick={() => toast.info("Coming soon")}
            className="w-full rounded-2xl p-4 flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.98]"
            style={{ background: '#111', border: '1px solid #1a1a1a' }}
          >
            <div className="flex items-center gap-3">
              <Share2 className="h-5 w-5" style={{ color: '#555' }} />
              <span className="text-sm font-bold" style={{ color: '#fff' }}>Share Progress</span>
            </div>
            <span className="text-[10px] font-bold" style={{ color: '#333' }}>Soon</span>
          </button>
        </div>
      </main>

      <PlayerBottomNav />
    </div>
  );
}
