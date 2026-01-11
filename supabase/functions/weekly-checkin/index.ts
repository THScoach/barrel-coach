import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckinMessage {
  role: 'coach' | 'player';
  content: string;
  timestamp: string;
}

interface WeeklyData {
  games?: number;
  pa?: number;
  ab?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  home_runs?: number;
  bb?: number;
  k?: number;
  best_moment?: string;
  biggest_struggle?: string;
  training_tags?: string[];
  body_fatigue?: number;
  next_week_goal?: string;
}

const QUESTION_FLOW = [
  { key: 'games', question: "How many games did you play this week?", type: 'number' },
  { key: 'pa_ab', question: "How many plate appearances or at-bats did you get?", type: 'composite' },
  { key: 'production', question: "How many hits? Any doubles, triples, or homers?", type: 'composite' },
  { key: 'outcomes', question: "Walks and punchouts — roughly how many?", type: 'composite' },
  { key: 'best_moment', question: "What was your BEST swing or moment this week? Could be a hit, could just be a swing that felt right.", type: 'text' },
  { key: 'biggest_struggle', question: "What gave you the most trouble this week?", type: 'text' },
  { key: 'training', question: "What kind of work did you actually get in? Tee, flips, machine, live, strength — whatever you did.", type: 'text' },
  { key: 'body_fatigue', question: "Body check real quick. Any pain or fatigue? 0 = fresh, 10 = beat up.", type: 'number' },
  { key: 'next_week_goal', question: "What's one thing you want better this coming week?", type: 'text' },
];

function parseNumbers(text: string): number[] {
  const matches = text.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

function inferTrainingTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  
  if (lower.includes('tee')) tags.push('tee');
  if (lower.includes('flip') || lower.includes('soft toss')) tags.push('flips');
  if (lower.includes('machine') || lower.includes('bp')) tags.push('machine');
  if (lower.includes('live') || lower.includes('bullpen')) tags.push('live');
  if (lower.includes('strength') || lower.includes('lift') || lower.includes('gym')) tags.push('strength');
  if (lower.includes('vr') || lower.includes('oculus')) tags.push('vr');
  if (lower.includes('video') || lower.includes('film')) tags.push('video_review');
  
  return tags;
}

function generateCoachResponse(questionKey: string, playerResponse: string, extractedData: WeeklyData): string {
  const responses: Record<string, string[]> = {
    games: ["Got it.", "Alright.", "Okay."],
    pa_ab: ["Alright, keep going.", "Got it.", "Okay."],
    production: ["Good.", "That tracks.", "Alright."],
    outcomes: ["Alright.", "Okay.", "Got it."],
    best_moment: [
      "Good stuff. Hold onto that feel.",
      "Nice. That's what we're looking for.",
      "Alright, that's the kind of swing we want.",
    ],
    biggest_struggle: [
      "Okay, we'll address that.",
      "Noted. We'll work on it.",
      "Alright, I hear you.",
    ],
    training: ["Good work.", "Solid.", "Alright."],
    body_fatigue: extractedData.body_fatigue && extractedData.body_fatigue >= 7 
      ? ["Watch the workload. Don't push through if you're that beat up.", "Okay, take it easy. Recovery matters."]
      : ["Good.", "Alright.", "Got it."],
    next_week_goal: ["Locked in. Let's get after it.", "Good focus.", "Alright, we'll work toward that."],
  };

  const options = responses[questionKey] || ["Alright."];
  return options[Math.floor(Math.random() * options.length)];
}

function generateSummary(data: WeeklyData): string {
  const bullets: string[] = [];
  
  if (data.games) {
    const ab = data.ab || 0;
    const hits = data.hits || 0;
    const avg = ab > 0 ? (hits / ab).toFixed(3).slice(1) : '.000';
    bullets.push(`${data.games} games, ${ab} AB, hitting ${avg}`);
  }
  
  const xbh = (data.doubles || 0) + (data.triples || 0) + (data.home_runs || 0);
  if (xbh > 0) {
    bullets.push(`${xbh} extra base hits`);
  }
  
  if (data.best_moment) {
    bullets.push(`Best: "${data.best_moment.substring(0, 50)}${data.best_moment.length > 50 ? '...' : ''}"`);
  }
  
  if (data.next_week_goal) {
    bullets.push(`Focus: ${data.next_week_goal}`);
  }
  
  return bullets.join('\n• ');
}

function calculateTrend(data: WeeklyData, previousReports: any[]): 'up' | 'flat' | 'down' {
  if (previousReports.length === 0) return 'flat';
  
  const prev = previousReports[0];
  const currentAB = data.ab || 0;
  const currentHits = data.hits || 0;
  const prevAB = prev.ab || 0;
  const prevHits = prev.hits || 0;
  
  const currentAvg = currentAB > 0 ? currentHits / currentAB : 0;
  const prevAvg = prevAB > 0 ? prevHits / prevAB : 0;
  
  if (currentAvg > prevAvg + 0.050) return 'up';
  if (currentAvg < prevAvg - 0.050) return 'down';
  return 'flat';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { playerId, messages, currentStep } = await req.json();

    if (!playerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Player ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current week boundaries (Sunday to Saturday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Check if report exists for this week
    const { data: existingReport } = await supabase
      .from('game_weekly_reports')
      .select('*')
      .eq('player_id', playerId)
      .eq('week_start', weekStart.toISOString().split('T')[0])
      .single();

    // Parse messages to extract data
    const extractedData: WeeklyData = existingReport ? {
      games: existingReport.games,
      pa: existingReport.pa,
      ab: existingReport.ab,
      hits: existingReport.hits,
      doubles: existingReport.doubles,
      triples: existingReport.triples,
      home_runs: existingReport.home_runs,
      bb: existingReport.bb,
      k: existingReport.k,
      best_moment: existingReport.best_moment,
      biggest_struggle: existingReport.biggest_struggle,
      training_tags: existingReport.training_tags,
      body_fatigue: existingReport.body_fatigue,
      next_week_goal: existingReport.next_week_goal,
    } : {};

    // Process the latest player message if provided
    const playerMessages = (messages || []).filter((m: CheckinMessage) => m.role === 'player');
    const latestPlayerMessage = playerMessages[playerMessages.length - 1];
    
    let responseMessage = '';
    let nextStep = currentStep || 0;
    let isComplete = false;

    if (latestPlayerMessage && currentStep !== undefined) {
      const questionKey = QUESTION_FLOW[currentStep]?.key;
      const content = latestPlayerMessage.content;
      
      // Extract data based on question type
      switch (questionKey) {
        case 'games':
          const gamesNum = parseNumbers(content);
          if (gamesNum.length > 0) extractedData.games = gamesNum[0];
          break;
        case 'pa_ab':
          const paAbNums = parseNumbers(content);
          if (paAbNums.length >= 2) {
            extractedData.pa = paAbNums[0];
            extractedData.ab = paAbNums[1];
          } else if (paAbNums.length === 1) {
            extractedData.ab = paAbNums[0];
            extractedData.pa = paAbNums[0];
          }
          break;
        case 'production':
          const prodNums = parseNumbers(content);
          if (prodNums.length > 0) extractedData.hits = prodNums[0];
          if (prodNums.length > 1) extractedData.doubles = prodNums[1];
          if (prodNums.length > 2) extractedData.triples = prodNums[2];
          if (prodNums.length > 3) extractedData.home_runs = prodNums[3];
          break;
        case 'outcomes':
          const outcomeNums = parseNumbers(content);
          if (outcomeNums.length > 0) extractedData.bb = outcomeNums[0];
          if (outcomeNums.length > 1) extractedData.k = outcomeNums[1];
          break;
        case 'best_moment':
          extractedData.best_moment = content;
          break;
        case 'biggest_struggle':
          extractedData.biggest_struggle = content;
          break;
        case 'training':
          extractedData.training_tags = inferTrainingTags(content);
          break;
        case 'body_fatigue':
          const fatigueNum = parseNumbers(content);
          if (fatigueNum.length > 0) extractedData.body_fatigue = Math.min(10, Math.max(0, fatigueNum[0]));
          break;
        case 'next_week_goal':
          extractedData.next_week_goal = content;
          break;
      }

      // Generate coach response and move to next question
      responseMessage = generateCoachResponse(questionKey, content, extractedData);
      nextStep = currentStep + 1;

      if (nextStep < QUESTION_FLOW.length) {
        responseMessage += '\n\n' + QUESTION_FLOW[nextStep].question;
      } else {
        isComplete = true;
        
        // Get previous reports for trend calculation
        const { data: previousReports } = await supabase
          .from('game_weekly_reports')
          .select('*')
          .eq('player_id', playerId)
          .lt('week_start', weekStart.toISOString().split('T')[0])
          .order('week_start', { ascending: false })
          .limit(3);

        const trend = calculateTrend(extractedData, previousReports || []);
        const summary = generateSummary(extractedData);

        responseMessage = `Alright, here's what I see:\n\n• ${summary}\n\n`;
        
        if (trend === 'up') {
          responseMessage += "You're trending up. Keep doing what you're doing.";
        } else if (trend === 'down') {
          responseMessage += "Results are down a bit. Stay patient, trust the process.";
        } else {
          responseMessage += "Staying steady. Keep grinding.";
        }

        // Save completed report
        const xbh = (extractedData.doubles || 0) + (extractedData.triples || 0) + (extractedData.home_runs || 0);
        
        const reportData = {
          player_id: playerId,
          week_start: weekStart.toISOString().split('T')[0],
          week_end: weekEnd.toISOString().split('T')[0],
          games: extractedData.games,
          pa: extractedData.pa,
          ab: extractedData.ab,
          hits: extractedData.hits,
          doubles: extractedData.doubles,
          triples: extractedData.triples,
          home_runs: extractedData.home_runs,
          xbh,
          bb: extractedData.bb,
          k: extractedData.k,
          best_moment: extractedData.best_moment,
          biggest_struggle: extractedData.biggest_struggle,
          training_tags: extractedData.training_tags,
          body_fatigue: extractedData.body_fatigue,
          next_week_goal: extractedData.next_week_goal,
          chat_transcript: messages,
          coach_summary: summary,
          trend_label: trend,
          status: 'completed',
          completed_at: new Date().toISOString(),
          source: 'chat_checkin',
        };

        if (existingReport) {
          await supabase
            .from('game_weekly_reports')
            .update(reportData)
            .eq('id', existingReport.id);
        } else {
          await supabase
            .from('game_weekly_reports')
            .insert(reportData);
        }
      }
    } else {
      // Starting fresh - send intro + first question
      responseMessage = "Alright, quick weekly check-in. Doesn't have to be perfect — I just need the big picture.\n\n" + QUESTION_FLOW[0].question;
      nextStep = 0;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: responseMessage,
        currentStep: nextStep,
        isComplete,
        extractedData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Weekly checkin error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});