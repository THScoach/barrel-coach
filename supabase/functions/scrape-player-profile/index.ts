import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Baseball Savant search
async function searchSavant(playerName: string): Promise<any> {
  try {
    const searchUrl = `https://baseballsavant.mlb.com/player/search-all?search=${encodeURIComponent(playerName)}`;
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.length > 0) {
      const player = data[0];
      return {
        source: 'savant',
        external_player_id: player.id?.toString(),
        profile_url: `https://baseballsavant.mlb.com/savant-player/${player.id}`,
        raw_json: player,
        parsed_json: {
          name: player.name,
          mlb_id: player.id,
          team: player.team,
          position: player.position,
        }
      };
    }
    return null;
  } catch (error) {
    console.error('Savant search error:', error);
    return null;
  }
}

// FanGraphs search
async function searchFanGraphs(playerName: string): Promise<any> {
  try {
    const searchUrl = `https://www.fangraphs.com/api/players/search?searchstring=${encodeURIComponent(playerName)}`;
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.length > 0) {
      const player = data[0];
      return {
        source: 'fangraphs',
        external_player_id: player.playerid?.toString(),
        profile_url: `https://www.fangraphs.com/players/${player.name.toLowerCase().replace(/\s+/g, '-')}/${player.playerid}`,
        raw_json: player,
        parsed_json: {
          name: player.name,
          fangraphs_id: player.playerid,
          team: player.team,
        }
      };
    }
    return null;
  } catch (error) {
    console.error('FanGraphs search error:', error);
    return null;
  }
}

// Baseball Reference search (basic)
async function searchBBRef(playerName: string): Promise<any> {
  try {
    // BBRef doesn't have a public API, we'll construct a search URL
    const nameParts = playerName.split(' ');
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts[0];
    
    // Construct potential BBRef ID format (first 5 of last name + first 2 of first)
    const bbrefId = `${lastName.substring(0, 5).toLowerCase()}${firstName.substring(0, 2).toLowerCase()}01`;
    const profileUrl = `https://www.baseball-reference.com/players/${lastName[0].toLowerCase()}/${bbrefId}.shtml`;
    
    // We can't actually verify without scraping, so just return the constructed URL
    return {
      source: 'baseball_reference',
      external_player_id: bbrefId,
      profile_url: profileUrl,
      raw_json: { constructed: true },
      parsed_json: {
        name: playerName,
        bbref_id: bbrefId,
      }
    };
  } catch (error) {
    console.error('BBRef search error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { playerId, playerName, mlbId, fangraphsId, bbrefId } = await req.json();

    if (!playerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Player ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: any[] = [];
    const now = new Date().toISOString();

    // If we have specific IDs, use them directly
    if (mlbId) {
      results.push({
        source: 'savant',
        external_player_id: mlbId,
        profile_url: `https://baseballsavant.mlb.com/savant-player/${mlbId}`,
        raw_json: { mlb_id: mlbId },
        parsed_json: { mlb_id: mlbId }
      });
    }

    if (fangraphsId) {
      results.push({
        source: 'fangraphs',
        external_player_id: fangraphsId,
        profile_url: `https://www.fangraphs.com/players/player/${fangraphsId}`,
        raw_json: { fangraphs_id: fangraphsId },
        parsed_json: { fangraphs_id: fangraphsId }
      });
    }

    if (bbrefId) {
      const lastName = bbrefId.substring(0, 5);
      results.push({
        source: 'baseball_reference',
        external_player_id: bbrefId,
        profile_url: `https://www.baseball-reference.com/players/${lastName[0]}/${bbrefId}.shtml`,
        raw_json: { bbref_id: bbrefId },
        parsed_json: { bbref_id: bbrefId }
      });
    }

    // If no specific IDs and we have a name, search for the player
    if (results.length === 0 && playerName) {
      const [savantResult, fangraphsResult, bbrefResult] = await Promise.all([
        searchSavant(playerName),
        searchFanGraphs(playerName),
        searchBBRef(playerName),
      ]);

      if (savantResult) results.push(savantResult);
      if (fangraphsResult) results.push(fangraphsResult);
      if (bbrefResult) results.push(bbrefResult);
    }

    // Upsert results to player_external_profiles
    for (const result of results) {
      const { error } = await supabase
        .from('player_external_profiles')
        .upsert({
          player_id: playerId,
          source: result.source,
          external_player_id: result.external_player_id,
          profile_url: result.profile_url,
          raw_json: result.raw_json,
          parsed_json: result.parsed_json,
          last_scraped_at: now,
          scrape_status: 'success',
        }, {
          onConflict: 'player_id,source'
        });

      if (error) {
        console.error(`Error upserting ${result.source} profile:`, error);
      }
    }

    // Update player record with IDs if found
    const updates: Record<string, string> = {};
    for (const result of results) {
      if (result.source === 'savant' && result.parsed_json?.mlb_id) {
        updates.mlb_id = result.parsed_json.mlb_id.toString();
      }
      if (result.source === 'fangraphs' && result.parsed_json?.fangraphs_id) {
        updates.fangraphs_id = result.parsed_json.fangraphs_id.toString();
      }
      if (result.source === 'baseball_reference' && result.parsed_json?.bbref_id) {
        updates.bbref_id = result.parsed_json.bbref_id;
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('players')
        .update(updates)
        .eq('id', playerId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        profilesFound: results.length,
        sources: results.map(r => r.source)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Scraper error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
