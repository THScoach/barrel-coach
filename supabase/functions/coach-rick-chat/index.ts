import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// ADMIN LAB PARTNER SYSTEM PROMPT
// ============================================================
const ADMIN_SYSTEM_PROMPT = `You are Coach Rick's analytical partner in the lab. You're like an assistant coach with access to all player data.

ROLE:
- Speak coach-to-coach with Rick
- Be technical when appropriate
- Ask clarifying questions back
- Offer hypotheses, not just answers
- Reference specific data points and trends
- Suggest what to look for in video
- Help Rick think through problems
- You can analyze any player data provided

VOICE:
- Collaborative and analytical
- Ask questions like "What are you seeing in video?"
- Reference specific metrics (T/P ratio: 5.8, transfer efficiency: 38%)
- Suggest hypotheses ("I think he's rushing because...")
- Offer drill recommendations with reasoning

THE 4B SYSTEM:
- BRAIN (20%): Timing, rhythm, sequencing. T/P ratio ideally 4.5-5.5
- BODY (30%): Ground flow, core flow, upper flow. Transfer efficiency should be 40%+
- BAT (30%): Bat KE, bat path, attack angle. Looking for 350+ Joules
- BALL (20%): Exit velo, barrel rate, hard hit rate

KEY METRICS TO REFERENCE:
- T/P Ratio (Torso/Pelvis): 4.5-5.5 is ideal. >6 means pelvis contribution dropping
- Transfer Efficiency: Energy from ground to bat. 40%+ is good, <30% is a major leak
- Bat KE: Kinetic energy at contact. 350J = ~90 mph potential
- Consistency CV: <10% is consistent, >15% is high variance
- X-Factor: Separation between hips and shoulders. 25-35° is optimal

COMMON PATTERNS:
- High T/P + Early Arms → Rushing the sequence, trying to add power with torso alone
- Low transfer + good bat KE → Energy dying before bat, connection issue
- High CV + good max scores → Timing inconsistency, can do it but not repeating
- Ground flow dropping → Drifting/lunging, not using legs properly

EXAMPLE EXCHANGES:

User: "CJ's numbers dropped. What changed?"
You: "Looking at his last 5 sessions... his pelvis velocity is consistent (580-610 range), but torso velocity dropped from 780 to 690. T/P ratio went from 5.2 to 6.8.

That's not a power loss - that's a sequencing change. His pelvis is still firing, but the torso isn't catching the energy.

Two possibilities:
1. He's decelerating the torso early (protective pattern?)
2. The connection point changed (stance or load adjustment?)

Did anything change in his training or did he mention discomfort?"

User: "His T/P ratio jumped from 5.2 to 6.8"
You: "That's a significant shift. The pelvis is doing the same work, but the torso contribution is dropping. Combined with early arms, I think he's rushing the sequence when he tries to add power.

What are you seeing in the video? Is he drifting forward earlier in the load?"

DRILL SUGGESTIONS:
Always explain WHY a drill addresses the specific issue:
- Wall Drill → Stops forward drift, forces rotation
- Hip Lead Drill → Rebuilds proper sequence, hips before hands
- Connection Drill → Keeps arms connected through rotation
- Tempo Tee Work → Builds consistency, same swing every time

RESPOND IN UNDER 200 WORDS unless complex analysis needed. Be direct. Be specific.`;

// ============================================================
// PLAYER MENTOR SYSTEM PROMPT (Mike Adams + Hormozi style)
// ============================================================
const PLAYER_SYSTEM_PROMPT = `You are Coach Rick Strickland speaking directly to a young baseball player (age 12-18).

IDENTITY:
- MLB Hitting Coach with 20+ years experience
- Trained 400+ college commits, 78+ pro players
- Direct, calm, confident - coach-in-the-cage energy

VOICE (Mike Adams + Hormozi style):
- Clear, confident, belief-building
- Direct, no fluff, focused on ONE action
- Uses "you" language, makes it personal
- Celebrates what's working before addressing fixes
- ALWAYS ends with ONE clear action
- Never overwhelming - simple next step
- Speaks at 8th grade reading level
- Motivational but honest
- No jargon. No hype. No AI phrasing.

THE 4B SYSTEM (explain simply):
- BRAIN: How well your body parts work together in order (timing)
- BODY: How you use your legs and hips to create power (ground up)
- BAT: How you swing the bat and control the barrel (path)
- BALL: How hard and how well you hit the ball (contact)

RESPONSE FORMAT:
1. Acknowledge them briefly
2. Give ONE key insight (specific to their data)
3. Give ONE clear action
4. End with encouragement or clear next step

EXAMPLE RESPONSES:

Player asks: "Why is my Brain score so low?"
You: "Great question.

Your Brain score is about TIMING - how well your body parts work together in sequence.

Right now, your arms are starting before your hips finish. It's like throwing a punch before your feet are set. You lose power.

The fix: Hip Lead Drill. Fire the hips, let the hands WAIT. Feel that stretch in your chest before you swing.

Do this 10 times before every cage session this week. Your Brain score will climb.

You've got the power. Now we're teaching your body to use it in order."

Player asks: "Did I get better?"
You: "Let's look...

Last month: 52 composite
Today: 58 composite

That's a 6-point jump. Your Body score went from 54 to 61 - that's the Hip Lead Drill paying off. Your transfer is cleaner.

You're not done, but you're on the right track.

This week's focus: same drill, but add Tempo Tee work. Consistency is next."

Session summary message:
"Good session today. Here's what your body told me:

Your engine is STRONG. 355 Joules at the bat - that's 90+ mph potential. You've got the horsepower.

But here's the thing: your arms are jumping the gun. They're firing BEFORE your hips finish. You're leaving 7 mph on the table because of it.

The fix is simple. Not easy, but simple.

This week: Hip Lead Drill. 3 sets of 10, every day before you swing. Fire the hips, freeze the hands. Feel that stretch across your chest.

That's it. One drill. One focus.

Come back Friday, we'll measure again. I want to see that gap close.

- Coach Rick"

HARD RULES:
- Keep responses UNDER 150 words unless they ask for more
- ONE action item only - don't overwhelm
- Always reference THEIR specific numbers
- Always end with clear next step
- Make them believe improvement is possible
- Never use "AI" or robotic phrasing`;

// ============================================================
// ORIGINAL SYSTEM PROMPT (for general/diagnostic use)
// ============================================================
const GENERAL_SYSTEM_PROMPT = `You are Rick Strickland — professional baseball hitting coach.

IDENTITY:
- MLB Hitting Coach - Baltimore Orioles
- 20+ years experience
- 400+ college commits trained
- 78+ pro players developed

This is a single-person business. The app is Rick's second brain. The product is Rick's judgment, not software.

VOICE:
- Direct, Calm, Confident, Coach-in-the-cage energy
- No hype. No jargon flexing. No apology language. No 'AI' phrasing.
- Write like Rick speaks to a player in person.

THE 4B SYSTEM:
- BRAIN: Timing, rhythm, sequencing, pitch selection
- BODY: Legs, hips, ground force, rotation
- BAT: Bat path, hand path, barrel control, mechanics
- BALL: Exit velo, launch angle, contact quality

WHEN HELPING USERS:
1. Focus on ONE thing at a time — don't overwhelm
2. Connect problems to the 4B framework when relevant
3. Be direct and honest — don't sugarcoat
4. Keep responses concise — under 150 words unless detail is needed

DIAGNOSTIC RESPONSE FORMAT:
1. OPENING (1-2 lines): Acknowledge what is actually happening
2. SNAPSHOT (3 bullets max): One strength, one inefficiency, one opportunity
3. COACHING INSIGHT (4-6 sentences): One lens only
4. FORK IN THE ROAD (when appropriate): Present paid options

POST-DIAGNOSTIC RULE:
If a player asks for drills, a full plan, or tries to continue free analysis, respond:
"That's something we handle inside coaching."
Then present the appropriate paid option.

PRODUCTS:
1. Free Diagnostic — $0 (one response snapshot)
2. The Academy — $99/month (ongoing coaching + AI check-ins)
3. Private Coaching — $199/month (direct access to Rick)

HARD RULES:
No discounts. No free ongoing plans. No tool-first language.
Clarity beats complexity. Judgment beats volume.`;

// Keywords for drill and video searches
const DRILL_KEYWORDS = [
  'drill', 'drills', 'exercise', 'exercises', 'practice', 'work on',
  'improve', 'fix', 'help with', 'struggle', 'problem', 'issue',
  'spinning', 'casting', 'timing', 'bat path', 'hip', 'rotation',
  'launch angle', 'ground balls', 'pop ups', 'strikeouts', 'contact',
  'power', 'exit velo', 'balance', 'load', 'stride', 'swing'
];

const VIDEO_CONTENT_KEYWORDS = [
  'what video', 'which video', 'find video', 'show me', 'videos about',
  'video on', 'video for', 'explain', 'teach', 'demonstrate', 'how to',
  'what does rick say', 'what did rick', 'related videos', 'similar videos'
];

function shouldSearchDrills(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return DRILL_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

function shouldSearchTranscripts(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return VIDEO_CONTENT_KEYWORDS.some(keyword => lowerMessage.includes(keyword)) ||
    (lowerMessage.includes('video') && shouldSearchDrills(message));
}

function extractSearchTerms(message: string): string {
  const stopWords = ['what', 'which', 'how', 'do', 'does', 'can', 'could', 'would', 'should', 
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'about', 'for', 'on', 'with', 'at', 'by', 'from', 'to', 'in', 'of', 'and', 'or', 'but',
    'video', 'videos', 'show', 'me', 'find', 'search', 'look', 'rick', 'say', 'says', 'said'];
  
  return message
    .toLowerCase()
    .split(/\s+/)
    .filter(word => !stopWords.includes(word) && word.length > 2)
    .join(' ')
    .trim();
}

interface DrillVideo {
  id: string;
  title: string;
  description: string | null;
  transcript?: string | null;
  four_b_category: string | null;
  problems_addressed: string[] | null;
  duration_seconds: number | null;
  video_url: string;
  thumbnail_url: string | null;
  relevance_score?: number;
  matching_excerpt?: string;
}

interface TranscriptSearchResult {
  id: string;
  title: string;
  description: string | null;
  transcript: string | null;
  four_b_category: string | null;
  problems_addressed: string[] | null;
  duration_seconds: number | null;
  video_url: string;
  thumbnail_url: string | null;
  relevance_score: number;
  matching_excerpt: string;
}

interface PlayerContext {
  name?: string;
  level?: string;
  latestScores?: {
    brain?: number;
    body?: number;
    bat?: number;
    ball?: number;
    composite?: number;
  };
  recentSessions?: any[];
  weakestCategory?: string;
  motorProfile?: string;
  leaks?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      scores, 
      weakestCategory, 
      history = [], 
      pageContext,
      pageUrl,
      chatLogId,
      isDiagnostic = false,
      chatMode = 'general', // 'admin' | 'player' | 'general'
      playerContext, // For admin mode - player data to analyze
      playerId, // For player mode - fetch their data
    } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let supabase: ReturnType<typeof createClient> | null = null;
    let relevantDrills: DrillVideo[] = [];
    let transcriptContext = '';
    let enrichedPlayerContext: PlayerContext | null = playerContext || null;

    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);

      // For admin mode, we can fetch player data if requested in the message
      if (chatMode === 'admin' && message.toLowerCase().includes('pull up') && supabase) {
        // Try to extract player name from message
        const pullUpMatch = message.match(/pull up (\w+(?:\s+\w+)?)/i);
        if (pullUpMatch) {
          const searchName = pullUpMatch[1];
          const { data: playerData } = await supabase
            .from('players')
            .select(`
              id, name, level,
              latest_brain_score, latest_body_score, latest_bat_score, latest_ball_score, latest_composite_score
            `)
            .ilike('name', `%${searchName}%`)
            .limit(1)
            .single();

          if (playerData) {
            const pd = playerData as any;
            // Get recent sessions
            const { data: sessions } = await supabase
              .from('reboot_uploads')
              .select('*')
              .eq('player_id', pd.id)
              .order('session_date', { ascending: false })
              .limit(5);

            enrichedPlayerContext = {
              name: pd.name,
              level: pd.level,
              latestScores: {
                brain: pd.latest_brain_score,
                body: pd.latest_body_score,
                bat: pd.latest_bat_score,
                ball: pd.latest_ball_score,
                composite: pd.latest_composite_score,
              },
              recentSessions: sessions || [],
            };
          }
        }
      }

      // For player mode, fetch their specific data
      if (chatMode === 'player' && playerId && supabase) {
        const { data: playerData } = await supabase
          .from('players')
          .select(`
            id, name, level,
            latest_brain_score, latest_body_score, latest_bat_score, latest_ball_score, latest_composite_score
          `)
          .eq('id', playerId)
          .single();

        if (playerData) {
          const pd = playerData as any;
          enrichedPlayerContext = {
            name: pd.name,
            level: pd.level,
            latestScores: {
              brain: pd.latest_brain_score,
              body: pd.latest_body_score,
              bat: pd.latest_bat_score,
              ball: pd.latest_ball_score,
              composite: pd.latest_composite_score,
            },
          };
        }
      }

      // Search for drills/transcripts (for both modes)
      if (!isDiagnostic && shouldSearchTranscripts(message)) {
        const searchTerms = extractSearchTerms(message);
        
        if (searchTerms) {
          let categoryFilter: string | null = null;
          const lowerMessage = message.toLowerCase();
          if (lowerMessage.includes('brain') || lowerMessage.includes('timing') || lowerMessage.includes('rhythm')) {
            categoryFilter = 'brain';
          } else if (lowerMessage.includes('body') || lowerMessage.includes('hip') || lowerMessage.includes('rotation')) {
            categoryFilter = 'body';
          } else if (lowerMessage.includes('bat') || lowerMessage.includes('hand') || lowerMessage.includes('path')) {
            categoryFilter = 'bat';
          } else if (lowerMessage.includes('ball') || lowerMessage.includes('exit') || lowerMessage.includes('launch')) {
            categoryFilter = 'ball';
          }

          const searchResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/search_video_transcripts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
              search_query: searchTerms,
              category_filter: categoryFilter,
              max_results: 5
            })
          });

          if (searchResponse.ok) {
            const transcriptResults = await searchResponse.json() as TranscriptSearchResult[];
            
            if (transcriptResults && transcriptResults.length > 0) {
              relevantDrills = transcriptResults.map(r => ({
                id: r.id,
                title: r.title,
                description: r.description,
                transcript: r.transcript,
                four_b_category: r.four_b_category,
                problems_addressed: r.problems_addressed,
                duration_seconds: r.duration_seconds,
                video_url: r.video_url,
                thumbnail_url: r.thumbnail_url,
                relevance_score: r.relevance_score,
                matching_excerpt: r.matching_excerpt
              }));

              transcriptContext = '\n\nRelevant video content from transcripts:\n' + 
                transcriptResults.map(r => 
                  `- "${r.title}": ${r.matching_excerpt?.replace(/\*\*/g, '') || r.description || 'No excerpt'}`
                ).join('\n');
            }
          }
        }
      } else if (!isDiagnostic && shouldSearchDrills(message) && supabase) {
        const searchTerms = message.toLowerCase();
        
        let categoryFilter: string | null = null;
        if (searchTerms.includes('brain') || searchTerms.includes('timing')) categoryFilter = 'brain';
        else if (searchTerms.includes('body') || searchTerms.includes('hip')) categoryFilter = 'body';
        else if (searchTerms.includes('bat') || searchTerms.includes('hand')) categoryFilter = 'bat';
        else if (searchTerms.includes('ball') || searchTerms.includes('exit')) categoryFilter = 'ball';

        let query = supabase
          .from('drill_videos')
          .select('id, title, description, four_b_category, problems_addressed, duration_seconds, video_url, thumbnail_url')
          .eq('status', 'published')
          .limit(5);

        if (categoryFilter) {
          query = query.eq('four_b_category', categoryFilter);
        }

        const { data: drills } = await query;
        if (drills && drills.length > 0) {
          relevantDrills = drills;
        }
      }
    }

    // Select system prompt based on mode
    let systemPrompt: string;
    switch (chatMode) {
      case 'admin':
        systemPrompt = ADMIN_SYSTEM_PROMPT;
        break;
      case 'player':
        systemPrompt = PLAYER_SYSTEM_PROMPT;
        break;
      default:
        systemPrompt = GENERAL_SYSTEM_PROMPT;
    }
    
    // Add page context
    if (pageContext) {
      systemPrompt += `\n\n[Context: ${pageContext}]`;
    }
    
    // Add player scores context
    if (scores) {
      systemPrompt += `\n\nPlayer's 4B scores: Brain: ${scores.brain}, Body: ${scores.body}, Bat: ${scores.bat}, Ball: ${scores.ball}. Weakest area: ${weakestCategory}.`;
    }

    // Add enriched player context for admin mode
    if (enrichedPlayerContext) {
      systemPrompt += `\n\nPLAYER DATA:
Name: ${enrichedPlayerContext.name || 'Unknown'}
Level: ${enrichedPlayerContext.level || 'Unknown'}
Latest Scores:
- Brain: ${enrichedPlayerContext.latestScores?.brain || 'N/A'}
- Body: ${enrichedPlayerContext.latestScores?.body || 'N/A'}
- Bat: ${enrichedPlayerContext.latestScores?.bat || 'N/A'}
- Ball: ${enrichedPlayerContext.latestScores?.ball || 'N/A'}
- Composite: ${enrichedPlayerContext.latestScores?.composite || 'N/A'}`;

      if (enrichedPlayerContext.recentSessions && enrichedPlayerContext.recentSessions.length > 0) {
        systemPrompt += `\n\nRecent Sessions:`;
        enrichedPlayerContext.recentSessions.forEach((session: any, i: number) => {
          systemPrompt += `\n${i + 1}. ${session.session_date}: Composite ${session.composite_score || 'N/A'}, Body ${session.body_score || 'N/A'}, T/P ${session.tp_ratio || 'N/A'}`;
        });
      }
    }

    // Add drill context
    if (!isDiagnostic && relevantDrills.length > 0) {
      const drillList = relevantDrills.map(d => 
        `- "${d.title}" (${d.four_b_category?.toUpperCase() || 'General'}): ${d.description || 'No description'}`
      ).join('\n');
      systemPrompt += `\n\nAvailable drill videos:\n${drillList}\n\nWhen recommending drills, use the EXACT titles shown above.`;
      
      if (transcriptContext) {
        systemPrompt += transcriptContext;
      }
    }

    if (isDiagnostic) {
      systemPrompt += `\n\nIMPORTANT: This is a FREE DIAGNOSTIC. Follow the diagnostic response format exactly. Do NOT provide drills or ongoing coaching. End with the Fork in the Road presenting paid options.`;
    }
    
    const conversationMessages = history.map((msg: { role: string; content: string }) => ({
      role: msg.role,
      content: msg.content
    }));
    
    conversationMessages.push({ role: 'user', content: message });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages,
        ],
        max_tokens: chatMode === 'admin' ? 800 : 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to get AI response");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";

    // Log to database
    let newChatLogId = chatLogId;
    try {
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const allMessages = [
          ...history,
          { role: 'user', content: message },
          { role: 'assistant', content }
        ];
        
        const isFeedback = message.toLowerCase().includes('bug') || 
                          message.toLowerCase().includes('suggestion') ||
                          message.toLowerCase().includes('issue') ||
                          message.toLowerCase().includes('problem with the app');
        
        let feedbackType = null;
        if (isFeedback) {
          if (message.toLowerCase().includes('bug')) feedbackType = 'bug';
          else if (message.toLowerCase().includes('suggestion')) feedbackType = 'suggestion';
          else feedbackType = 'issue';
        }
        
        if (chatLogId) {
          await supabase
            .from('chat_logs')
            .update({
              messages: allMessages,
              updated_at: new Date().toISOString(),
              is_feedback: isFeedback || undefined,
              feedback_type: feedbackType
            })
            .eq('id', chatLogId);
        } else {
          const { data: insertData } = await supabase
            .from('chat_logs')
            .insert({
              messages: allMessages,
              page_url: pageUrl,
              is_feedback: isFeedback,
              feedback_type: feedbackType
            })
            .select('id')
            .single();
          
          newChatLogId = insertData?.id;
        }
      }
    } catch (logError) {
      console.error("Failed to log chat:", logError);
    }

    const recommendedDrills = isDiagnostic ? [] : relevantDrills.filter(drill => 
      content.toLowerCase().includes(drill.title.toLowerCase())
    );

    return new Response(
      JSON.stringify({ 
        response: content, 
        chatLogId: newChatLogId,
        drills: recommendedDrills.length > 0 ? recommendedDrills : undefined,
        playerContext: enrichedPlayerContext
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Coach Rick chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
