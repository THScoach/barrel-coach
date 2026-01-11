import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface ExtractedData {
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

interface CheckinState {
  currentQuestion: number;
  extractedData: ExtractedData;
  isComplete: boolean;
  reportId?: string;
}

const QUESTION_KEYS = [
  'games',
  'pa_ab', 
  'production',
  'outcomes',
  'best_moment',
  'biggest_struggle',
  'training',
  'body_fatigue',
  'next_week_goal'
];

// Coach Rick's system prompt for the weekly check-in
const WEEKLY_CHECKIN_SYSTEM_PROMPT = `You are Coach Rick, conducting a weekly check-in with one of your baseball players. You've coached at the MLB level and trained 400+ college commits. Your job is to collect their weekly game data through NATURAL conversation.

YOUR VOICE:
- First-person, direct, conversational
- Short sentences. No fluff.
- Baseball language, never tech talk
- Sound like a coach in the cage, not a survey bot
- Phrases like: "Alright", "Got it", "Good stuff", "Let's see..."

THE FLOW (follow this order):
1. GAMES - "How many games did you play this week?"
2. OPPORTUNITY - "How many plate appearances or at-bats?"
3. PRODUCTION - "How many hits? Any doubles, triples, or homers?"
4. OUTCOMES - "Walks and punchouts — roughly how many of each?"
5. BEST MOMENT - "What was your BEST swing or moment this week? Doesn't have to be a hit."
6. STRUGGLE - "What gave you the most trouble this week?"
7. TRAINING - "What kind of work did you actually get in? Tee, flips, machine, live, strength?"
8. BODY CHECK - "Body check. Any pain or fatigue? 0 = fresh, 10 = beat up."
9. NEXT WEEK - "What's one thing you want better this coming week?"

CRITICAL RULES:
1. Ask ONE question at a time
2. After each answer, give a SHORT acknowledgment (1-5 words max) then ask the next question
3. If player asks YOU a question mid-flow, answer briefly then say "Alright, back to the check-in..." and continue
4. If fatigue is 7+, respond: "Alright, good you told me that. We'll factor that in."
5. Keep moving through questions - don't get stuck
6. After the last question, generate a 2-3 bullet summary

RESPONSE FORMAT:
- Never use bullet points mid-conversation
- Keep responses under 40 words
- Use line breaks sparingly

CONTEXT PROVIDED:
- Current question number (0-8, or 9+ means complete)
- Player's previous answers so far
- Any prior weeks' data for context

When generating the FINAL SUMMARY after question 9:
Format: "Alright, here's what I see:\n\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n\n[One sentence focus for the week]"`;

function inferTrainingTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  
  if (lower.includes('tee')) tags.push('tee');
  if (lower.includes('flip') || lower.includes('soft toss') || lower.includes('front toss')) tags.push('flips');
  if (lower.includes('machine') || lower.includes('bp') || lower.includes('batting practice')) tags.push('machine');
  if (lower.includes('live') || lower.includes('bullpen') || lower.includes('scrimmage')) tags.push('live');
  if (lower.includes('strength') || lower.includes('lift') || lower.includes('gym') || lower.includes('weight')) tags.push('strength');
  if (lower.includes('vr') || lower.includes('oculus') || lower.includes('virtual')) tags.push('vr');
  if (lower.includes('video') || lower.includes('film') || lower.includes('watch')) tags.push('video_review');
  if (lower.includes('plyo') || lower.includes('overload') || lower.includes('underload')) tags.push('plyo_balls');
  
  return tags.length > 0 ? tags : ['general'];
}

function parseNumbers(text: string): number[] {
  const matches = text.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

function extractDataFromResponse(questionKey: string, content: string, currentData: ExtractedData): ExtractedData {
  const data = { ...currentData };
  const numbers = parseNumbers(content);
  
  switch (questionKey) {
    case 'games':
      if (numbers.length > 0) data.games = numbers[0];
      break;
    case 'pa_ab':
      if (numbers.length >= 2) {
        data.pa = numbers[0];
        data.ab = numbers[1];
      } else if (numbers.length === 1) {
        data.ab = numbers[0];
        data.pa = numbers[0];
      }
      break;
    case 'production':
      if (numbers.length > 0) data.hits = numbers[0];
      if (numbers.length > 1) data.doubles = numbers[1];
      if (numbers.length > 2) data.triples = numbers[2];
      if (numbers.length > 3) data.home_runs = numbers[3];
      // Check for "homer" or "home run" mentions
      if (content.toLowerCase().includes('homer') || content.toLowerCase().includes('home run')) {
        if (!data.home_runs && numbers.length > 0) {
          data.home_runs = numbers[numbers.length - 1] || 1;
        }
      }
      break;
    case 'outcomes':
      if (numbers.length > 0) data.bb = numbers[0];
      if (numbers.length > 1) data.k = numbers[1];
      break;
    case 'best_moment':
      data.best_moment = content.trim();
      break;
    case 'biggest_struggle':
      data.biggest_struggle = content.trim();
      break;
    case 'training':
      data.training_tags = inferTrainingTags(content);
      break;
    case 'body_fatigue':
      if (numbers.length > 0) {
        data.body_fatigue = Math.min(10, Math.max(0, numbers[0]));
      }
      break;
    case 'next_week_goal':
      data.next_week_goal = content.trim();
      break;
  }
  
  return data;
}

function generateSummary(data: ExtractedData): string {
  const bullets: string[] = [];
  
  // Performance summary
  if (data.games) {
    const ab = data.ab || 0;
    const hits = data.hits || 0;
    const avg = ab > 0 ? (hits / ab).toFixed(3).slice(1) : '.000';
    bullets.push(`${data.games} games, ${hits}-for-${ab} (${avg})`);
  }
  
  // XBH summary
  const xbh = (data.doubles || 0) + (data.triples || 0) + (data.home_runs || 0);
  if (xbh > 0) {
    const parts = [];
    if (data.doubles) parts.push(`${data.doubles} 2B`);
    if (data.triples) parts.push(`${data.triples} 3B`);
    if (data.home_runs) parts.push(`${data.home_runs} HR`);
    bullets.push(parts.join(', '));
  }
  
  // Plate discipline
  if ((data.bb || 0) > 0 || (data.k || 0) > 0) {
    bullets.push(`${data.bb || 0} BB, ${data.k || 0} K`);
  }
  
  // Focus for next week
  if (data.next_week_goal) {
    bullets.push(`Focus: ${data.next_week_goal}`);
  }
  
  return bullets.join('\n• ');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      playerId, 
      message, 
      messages = [], 
      state 
    } = await req.json();

    if (!playerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Player ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

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

    // Get player info
    const { data: player } = await supabase
      .from('players')
      .select('name, is_in_season')
      .eq('id', playerId)
      .single();

    const playerName = player?.name?.split(' ')[0] || 'player';

    // Check for existing report this week
    const { data: existingReport } = await supabase
      .from('game_weekly_reports')
      .select('*')
      .eq('player_id', playerId)
      .eq('week_start', weekStart.toISOString().split('T')[0])
      .single();

    // Get previous reports for context
    const { data: previousReports } = await supabase
      .from('game_weekly_reports')
      .select('*')
      .eq('player_id', playerId)
      .lt('week_start', weekStart.toISOString().split('T')[0])
      .order('week_start', { ascending: false })
      .limit(3);

    // Initialize or restore state
    let currentState: CheckinState = state || {
      currentQuestion: 0,
      extractedData: existingReport ? {
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
      } : {},
      isComplete: existingReport?.status === 'completed',
      reportId: existingReport?.id
    };

    // If this is the start (no message yet)
    if (!message && messages.length === 0) {
      const startMessage = `Alright ${playerName}, quick weekly check-in. Just tell me what you can — doesn't have to be perfect.\n\nHow many games did you play this week?`;
      
      // Create or update report as in-progress
      if (!existingReport) {
        const { data: newReport } = await supabase
          .from('game_weekly_reports')
          .insert({
            player_id: playerId,
            week_start: weekStart.toISOString().split('T')[0],
            week_end: weekEnd.toISOString().split('T')[0],
            status: 'in-progress',
            source: 'chat_checkin',
            chat_transcript: [{ role: 'assistant', content: startMessage, timestamp: new Date().toISOString() }]
          })
          .select('id')
          .single();
        
        currentState.reportId = newReport?.id;
      }

      return new Response(
        JSON.stringify({
          success: true,
          response: startMessage,
          state: currentState,
          isComplete: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract data from the latest user message
    if (message && currentState.currentQuestion < QUESTION_KEYS.length) {
      const questionKey = QUESTION_KEYS[currentState.currentQuestion];
      currentState.extractedData = extractDataFromResponse(
        questionKey, 
        message, 
        currentState.extractedData
      );
      currentState.currentQuestion++;
    }

    // Build context for AI
    let contextInfo = `Player: ${playerName}\nCurrent question: ${currentState.currentQuestion} of ${QUESTION_KEYS.length}\n`;
    contextInfo += `Data collected so far: ${JSON.stringify(currentState.extractedData, null, 2)}\n`;
    
    if (previousReports && previousReports.length > 0) {
      const lastWeek = previousReports[0];
      contextInfo += `\nLast week: ${lastWeek.games || 0} games, ${lastWeek.hits || 0} hits, ${lastWeek.ab || 0} AB`;
      if (lastWeek.next_week_goal) {
        contextInfo += `\nTheir goal last week was: "${lastWeek.next_week_goal}"`;
      }
    }

    // Check if we should generate the final summary
    const shouldComplete = currentState.currentQuestion >= QUESTION_KEYS.length;
    
    if (shouldComplete) {
      contextInfo += `\n\nPLAYER HAS ANSWERED ALL QUESTIONS. Generate the final summary now.`;
      contextInfo += `\nUse this data for the summary: ${JSON.stringify(currentState.extractedData, null, 2)}`;
    }

    // Build conversation for AI
    const conversationMessages: { role: string; content: string }[] = [];
    
    // Add all previous messages
    for (const msg of messages) {
      conversationMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    }
    
    // Add current user message
    if (message) {
      conversationMessages.push({ role: 'user', content: message });
    }

    // Call AI for response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: WEEKLY_CHECKIN_SYSTEM_PROMPT + `\n\n[CONTEXT]\n${contextInfo}` },
          ...conversationMessages,
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Service temporarily unavailable." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('AI response failed');
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices?.[0]?.message?.content || "Let's continue. What else can you tell me?";

    // Mark complete if done
    if (shouldComplete) {
      currentState.isComplete = true;
      
      // Calculate trend
      let trendLabel = 'flat';
      if (previousReports && previousReports.length > 0) {
        const prev = previousReports[0];
        const currentAvg = (currentState.extractedData.ab || 0) > 0 
          ? (currentState.extractedData.hits || 0) / (currentState.extractedData.ab || 1) 
          : 0;
        const prevAvg = (prev.ab || 0) > 0 
          ? (prev.hits || 0) / (prev.ab || 1) 
          : 0;
        
        if (currentAvg > prevAvg + 0.050) trendLabel = 'up';
        else if (currentAvg < prevAvg - 0.050) trendLabel = 'down';
      }

      // Save completed report
      const xbh = (currentState.extractedData.doubles || 0) + 
                  (currentState.extractedData.triples || 0) + 
                  (currentState.extractedData.home_runs || 0);

      const updatedTranscript = [
        ...messages,
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() }
      ];

      const reportData = {
        games: currentState.extractedData.games,
        pa: currentState.extractedData.pa,
        ab: currentState.extractedData.ab,
        hits: currentState.extractedData.hits,
        doubles: currentState.extractedData.doubles,
        triples: currentState.extractedData.triples,
        home_runs: currentState.extractedData.home_runs,
        xbh,
        bb: currentState.extractedData.bb,
        k: currentState.extractedData.k,
        best_moment: currentState.extractedData.best_moment,
        biggest_struggle: currentState.extractedData.biggest_struggle,
        training_tags: currentState.extractedData.training_tags,
        body_fatigue: currentState.extractedData.body_fatigue,
        next_week_goal: currentState.extractedData.next_week_goal,
        chat_transcript: updatedTranscript,
        coach_summary: generateSummary(currentState.extractedData),
        trend_label: trendLabel,
        status: 'completed',
        completed_at: new Date().toISOString(),
      };

      if (currentState.reportId) {
        await supabase
          .from('game_weekly_reports')
          .update(reportData)
          .eq('id', currentState.reportId);
      } else {
        await supabase
          .from('game_weekly_reports')
          .insert({
            ...reportData,
            player_id: playerId,
            week_start: weekStart.toISOString().split('T')[0],
            week_end: weekEnd.toISOString().split('T')[0],
            source: 'chat_checkin',
          });
      }
    } else {
      // Update in-progress transcript
      const updatedTranscript = [
        ...messages,
        ...(message ? [{ role: 'user', content: message, timestamp: new Date().toISOString() }] : []),
        { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() }
      ];

      if (currentState.reportId) {
        await supabase
          .from('game_weekly_reports')
          .update({
            chat_transcript: updatedTranscript,
            ...currentState.extractedData,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentState.reportId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        state: currentState,
        isComplete: currentState.isComplete,
        extractedData: currentState.extractedData
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
