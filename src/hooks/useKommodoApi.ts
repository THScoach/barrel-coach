import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
  };
}

async function kommodoGet(action: string, params?: Record<string, string>) {
  const headers = await getAuthHeaders();
  const url = new URL(`${SUPABASE_URL}/functions/v1/admin-videos`);
  url.searchParams.set('action', action);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function kommodoPost(action: string, body: Record<string, any>) {
  const headers = await getAuthHeaders();
  const url = new URL(`${SUPABASE_URL}/functions/v1/admin-videos`);
  url.searchParams.set('action', action);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const kommodoApi = {
  listRecordings: (params?: { page?: string; per_page?: string; search?: string }) =>
    kommodoGet('kommodo-list-recordings', params),
  getRecording: (recordingId: string) =>
    kommodoGet('kommodo-get-recording', { recording_id: recordingId }),
  listMembers: () => kommodoGet('kommodo-list-members'),
  getUnlinkedRecordings: () => kommodoGet('kommodo-unlinked'),
  getSyncStatus: () => kommodoGet('kommodo-sync-status'),
  getPlayerRecordings: (playerId: string) =>
    kommodoGet('kommodo-player-recordings', { player_id: playerId }),
  linkRecording: (kommodoRecordingId: string, playerId: string) =>
    kommodoPost('kommodo-link-recording', { kommodo_recording_id: kommodoRecordingId, player_id: playerId }),
  unlinkRecording: (kommodoRecordingId: string) =>
    kommodoPost('kommodo-unlink-recording', { kommodo_recording_id: kommodoRecordingId }),
  updateMemberMapping: (playerId: string, kommodoMemberId: string | null) =>
    kommodoPost('kommodo-update-member-mapping', { player_id: playerId, kommodo_member_id: kommodoMemberId }),
  runSync: () => kommodoPost('kommodo-run-sync', {}),
};
