import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// MASTER SYSTEM PROMPT — CATCHING BARRELS v1.0
// ============================================================
const SYSTEM_PROMPT = `You are Rick Strickland — professional baseball hitting coach.

IDENTITY:
- MLB Hitting Coach - Baltimore Orioles
- 20+ years experience
- 400+ college commits trained
- 78+ pro players developed

This is a single-person business. The app is Rick's second brain. The product is Rick's judgment, not software.
"You're working with Rick — the app just helps him see more clearly and coach more consistently."

VOICE:
- Direct, Calm, Confident, Coach-in-the-cage energy
- No hype. No jargon flexing. No apology language. No 'AI' phrasing.
- Write like Rick speaks to a player in person.
- Use phrases like: "Let's go to work", "Got it", "Here's what stands out", "Good stuff"

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

DIAGNOSTIC RESPONSE FORMAT (when giving initial swing assessments):

1. OPENING (1-2 lines)
   Acknowledge what is actually happening, not what the player hopes.
   "Here's what stands out right away."

2. SNAPSHOT (3 bullets max)
   - One strength
   - One inefficiency
   - One missed opportunity
   No extra numbers. No fluff.

3. COACHING INSIGHT (4-6 sentences)
   One lens only. No drills in free diagnostic. No long-term plan. No over-coaching.

4. FORK IN THE ROAD (when appropriate)
   "If you want ongoing structure, Guided Coaching ($99/mo) keeps you on track.
   If you want the full picture in person, the assessment ($399) is where that happens."

POST-DIAGNOSTIC RULE:
If a player asks for drills, a full plan, or tries to continue free analysis, respond:
"That's something we handle inside coaching."
Then present the appropriate paid option.

PRODUCTS (4 only):
1. Ask Rick Diagnostic — FREE (one response snapshot)
2. Guided Coaching — $99/month (ongoing structure, weekly check-ins, progress tracking)
3. In-Person Assessment — $399 (full evaluation, movement, sequence, contact, game transfer)
4. 90-Day Transformation — By application only (flagship program for serious players)

DRILL RECOMMENDATIONS:
You have access to a drill library. ONLY recommend drills from videos explicitly provided to you.
Reference them by exact title. If no relevant drills are available, acknowledge that.

WHEN USERS REPORT BUGS:
Thank them and ask for details. Their feedback helps improve the app.

HARD RULES:
No discounts. No free ongoing plans. No 'starter tiers'. No tool-first language.
No corporate tone. No feature dumping. No overexplaining.

Clarity beats complexity. Judgment beats volume. Rick beats tools.`;

// Keywords that suggest the user wants drill recommendations
const DRILL_KEYWORDS = [
  'drill', 'drills', 'exercise', 'exercises', 'practice', 'work on',
  'improve', 'fix', 'help with', 'struggle', 'problem', 'issue',
  'spinning', 'casting', 'timing', 'bat path', 'hip', 'rotation',
  'launch angle', 'ground balls', 'pop ups', 'strikeouts', 'contact',
  'power', 'exit velo', 'balance', 'load', 'stride', 'swing'
];

function shouldSearchDrills(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return DRILL_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

interface DrillVideo {
  id: string;
  title: string;
  description: string | null;
  four_b_category: string | null;
  problems_addressed: string[] | null;
  duration_seconds: number | null;
  video_url: string;
  thumbnail_url: string | null;
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
      isDiagnostic = false
    } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client for drill lookup
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let supabase: ReturnType<typeof createClient> | null = null;
    let relevantDrills: DrillVideo[] = [];

    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);

      // Search for relevant drill videos if the message suggests they want drills
      // Note: In diagnostic mode, we don't provide drills (per Master Prompt rules)
      if (!isDiagnostic && shouldSearchDrills(message)) {
        const searchTerms = message.toLowerCase();
        
        // Determine category from message
        let categoryFilter: string | null = null;
        if (searchTerms.includes('brain') || searchTerms.includes('timing') || searchTerms.includes('rhythm')) {
          categoryFilter = 'brain';
        } else if (searchTerms.includes('body') || searchTerms.includes('hip') || searchTerms.includes('rotation') || searchTerms.includes('leg')) {
          categoryFilter = 'body';
        } else if (searchTerms.includes('bat') || searchTerms.includes('hand') || searchTerms.includes('path') || searchTerms.includes('barrel')) {
          categoryFilter = 'bat';
        } else if (searchTerms.includes('ball') || searchTerms.includes('exit') || searchTerms.includes('launch') || searchTerms.includes('contact')) {
          categoryFilter = 'ball';
        }

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
        } else if (categoryFilter) {
          // If no category-specific drills, get any drills
          const { data: anyDrills } = await supabase
            .from('drill_videos')
            .select('id, title, description, four_b_category, problems_addressed, duration_seconds, video_url, thumbnail_url')
            .eq('status', 'published')
            .limit(5);
          relevantDrills = anyDrills || [];
        }
      }
    }

    // Build system prompt with optional context
    let systemPrompt = SYSTEM_PROMPT;
    
    if (pageContext) {
      systemPrompt += `\n\n[Context: ${pageContext}]`;
    }
    
    if (scores) {
      systemPrompt += `\n\nPlayer's 4B scores: Brain: ${scores.brain}, Body: ${scores.body}, Bat: ${scores.bat}, Ball: ${scores.ball}. Weakest area: ${weakestCategory}. Focus advice on their weakest category.`;
    }

    // Add available drills to system prompt (only if not in diagnostic mode)
    if (!isDiagnostic && relevantDrills.length > 0) {
      const drillList = relevantDrills.map(d => 
        `- "${d.title}" (${d.four_b_category?.toUpperCase() || 'General'}): ${d.description || 'No description'}`
      ).join('\n');
      systemPrompt += `\n\nAvailable drill videos you can recommend:\n${drillList}\n\nWhen recommending drills, use the EXACT titles shown above.`;
    }

    // Add diagnostic mode instruction
    if (isDiagnostic) {
      systemPrompt += `\n\nIMPORTANT: This is a FREE DIAGNOSTIC. Follow the diagnostic response format exactly. Do NOT provide drills or ongoing coaching. End with the Fork in the Road presenting paid options.`;
    }
    
    // Build conversation messages
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
        max_tokens: 500,
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
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const allMessages = [
          ...history,
          { role: 'user', content: message },
          { role: 'assistant', content }
        ];
        
        // Check if this is feedback
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
          // Update existing log
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
          // Create new log
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
      // Continue anyway - logging shouldn't break the chat
    }

    // Extract recommended drill titles from AI response (only if not diagnostic)
    const recommendedDrills = isDiagnostic ? [] : relevantDrills.filter(drill => 
      content.toLowerCase().includes(drill.title.toLowerCase())
    );

    return new Response(
      JSON.stringify({ 
        response: content, 
        chatLogId: newChatLogId,
        drills: recommendedDrills.length > 0 ? recommendedDrills : undefined
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
