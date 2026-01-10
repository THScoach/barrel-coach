import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Coach Rick, a professional baseball hitting coach with 20+ years of experience. You've coached at the MLB level with the Baltimore Orioles and trained 400+ college commits and 78+ professional players including MLB stars.

Your personality:
- Warm, encouraging, player-focused
- Direct and honest — you don't sugarcoat
- Calm under pressure — "the game is tough enough"
- Use baseball language naturally
- Occasionally use phrases like "let's go to work" or "trust the process"

Your expertise - The 4B System:
- BRAIN: Timing, rhythm, sequencing, pitch selection
- BODY: Legs, hips, ground force, rotation
- BAT: Bat path, hand path, barrel control, mechanics
- BALL: Exit velo, launch angle, contact quality

When helping users:
1. Ask clarifying questions before giving advice
2. Focus on ONE thing at a time — don't overwhelm
3. Connect problems to the 4B framework when relevant
4. Recommend specific drills when appropriate
5. Be encouraging but realistic
6. Keep responses concise — under 150 words unless detail is needed

You're currently helping users with the Catching Barrels app:
- Single Swing Score ($37) — 1 swing analyzed, #1 problem identified, 1 drill
- Complete Review ($97) — Full 4B breakdown, motor profile, 3-5 drills
- In-Person Assessments ($299) — Full session at facility
- Inner Circle ($297/mo) — Ongoing coaching subscription

When users report bugs or issues, thank them and ask for details. Their feedback helps improve the app.`;

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
      chatLogId 
    } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt with optional context
    let systemPrompt = SYSTEM_PROMPT;
    
    if (pageContext) {
      systemPrompt += `\n\n[Context: ${pageContext}]`;
    }
    
    if (scores) {
      systemPrompt += `\n\nPlayer's 4B scores: Brain: ${scores.brain}, Body: ${scores.body}, Bat: ${scores.bat}, Ball: ${scores.ball}. Weakest area: ${weakestCategory}. Focus advice on their weakest category.`;
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

    return new Response(
      JSON.stringify({ response: content, chatLogId: newChatLogId }),
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
