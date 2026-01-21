import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Archetype mappings based on motor profile and characteristics
const ARCHETYPES: Record<string, { name: string; description: string }> = {
  spinner: { name: "The Slingshotter", description: "Rotation-dominant energy transfer" },
  pusher: { name: "The Linear Pusher", description: "Force-driven straight-line power" },
  slinger: { name: "The Whip Cracker", description: "Late barrel acceleration specialist" },
  balanced: { name: "The Double Stuf", description: "Best of both worlds - rotation + extension" },
  rotator: { name: "The Helicopter", description: "Pure rotation with torque generation" },
  slider: { name: "The Sliding Slingshot", description: "Lateral weight shift with rotation" },
  default: { name: "The Oreo Thin", description: "Compact, quick swing mechanics" },
};

// Leak translations to "8th grade" language
const LEAK_TRANSLATIONS: Record<string, { hook: string; why: string; fix: string }> = {
  EARLY_ARMS: {
    hook: "The T-Rex Arm Leak",
    why: "The arms are racing ahead of the body. It's like throwing a punch before your hips turn - you lose all your power.",
    fix: "The Towel Drill - Keep a towel under your lead armpit until hip rotation starts.",
  },
  CAST: {
    hook: "The Casting Leak",
    why: "The barrel is getting away from the body too early, like a fishing rod. This kills bat speed at contact.",
    fix: "The Knob-to-Ball Drill - Point the knob at the pitcher until the last possible moment.",
  },
  HIP_SLIDE: {
    hook: "The Backside Slide",
    why: "The back hip is sliding forward instead of rotating. Energy is leaking into the ground instead of the ball.",
    fix: "The Anchor Drill - Keep that back foot planted like it's stuck in cement.",
  },
  EARLY_EXTENSION: {
    hook: "The Pop-Up Problem",
    why: "Standing up too early during the swing. This creates a steep bat path and lots of fly balls.",
    fix: "The Stay Low Drill - Keep your belt buckle pointed at the catcher through contact.",
  },
  DISCONNECTION: {
    hook: "The Broken Chain",
    why: "The kinetic chain is broken - pelvis, torso, and arms aren't working together.",
    fix: "The Connection Drill - Feel like you're squeezing a ball between your lead arm and chest.",
  },
  LATE_BARREL: {
    hook: "The Late Arrival",
    why: "The barrel is getting to the zone too late. Good fastballs are getting by.",
    fix: "The Early Trigger Drill - Start your hip turn earlier in the pitcher's delivery.",
  },
  default: {
    hook: "The Power Leak",
    why: "Energy is escaping somewhere in the swing. We need to find and plug that leak.",
    fix: "The 4B Analysis Drill - Focus on the weakest B-score first.",
  },
};

interface SessionData {
  composite_score?: number;
  brain_score?: number;
  body_score?: number;
  bat_score?: number;
  motor_profile?: string;
  leak_detected?: string;
  priority_drill?: string;
  level?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionData }: { sessionData: SessionData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get archetype based on motor profile
    const motorProfile = sessionData.motor_profile?.toLowerCase() || "default";
    const archetype = ARCHETYPES[motorProfile] || ARCHETYPES.default;

    // Get leak translation
    const leakKey = sessionData.leak_detected?.toUpperCase().replace(/\s+/g, "_") || "default";
    const leak = LEAK_TRANSLATIONS[leakKey] || LEAK_TRANSLATIONS.default;

    // Build context for AI
    const context = {
      archetype: archetype.name,
      archetypeDescription: archetype.description,
      leakHook: leak.hook,
      leakWhy: leak.why,
      leakFix: leak.fix,
      compositeScore: sessionData.composite_score || 55,
      brainScore: sessionData.brain_score || 50,
      bodyScore: sessionData.body_score || 50,
      batScore: sessionData.bat_score || 50,
      priorityDrill: sessionData.priority_drill || leak.fix,
      level: sessionData.level || "Amateur",
    };

    // Calculate the "should be" score (ceiling estimate)
    const currentLowest = Math.min(context.brainScore, context.bodyScore, context.batScore);
    const shouldBeScore = Math.min(currentLowest + 20, 80);

    const systemPrompt = `You are the "4B Lab" Social Media Content Creator. You write short, punchy posts about baseball swing mechanics using simple "8th grade" language.

RULES:
1. NEVER use player names, ages, teams, or any identifying information
2. Use archetypes like "The Slingshotter" or "The Double Stuf" instead of names
3. Keep language simple - use metaphors like "springs," "leaks," "anchors"
4. Every post should teach something valuable
5. End with a hashtag combination: #4BLogic #SwingRehab #TheLabView

VOICE:
- Confident but not arrogant
- Teaching, not lecturing
- Use "we" not "I" (The Lab perspective)
- Make complex biomechanics sound simple`;

    const userPrompt = `Generate a social media post for this anonymous swing analysis:

ARCHETYPE: ${context.archetype} (${context.archetypeDescription})
THE LEAK: ${context.leakHook}
WHY IT HAPPENS: ${context.leakWhy}
THE FIX: ${context.leakFix}
4B SCORES: Brain ${context.brainScore} | Body ${context.bodyScore} | Bat ${context.batScore} | Composite ${context.compositeScore}
SCORE INSIGHT: Current lowest score is ${currentLowest}, should be ${shouldBeScore}
LEVEL: ${context.level}

Write a post following this structure:
1. HEADLINE: A punchy 3-5 word hook
2. THE CASE: 1 sentence describing the archetype's profile
3. THE LEAK: 1-2 sentences on what's going wrong (8th grade language)
4. THE FIX: 1 sentence on the solution
5. THE LAB VIEW: 1 sentence on the transformation potential
6. HASHTAGS: #4BLogic #SwingRehab #TheLabView

Format the response as JSON with these fields:
{
  "headline": "...",
  "theCase": "...",
  "theLeak": "...",
  "theFix": "...",
  "theLabView": "...",
  "hashtags": "..."
}`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let postData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      postData = JSON.parse(jsonMatch[1].trim());
    } catch {
      // Fallback structure if JSON parsing fails
      postData = {
        headline: "The 4B Lab Analysis",
        theCase: `Just analyzed a ${context.archetype} archetype in the lab.`,
        theLeak: `${context.leakHook}: ${context.leakWhy}`,
        theFix: context.leakFix,
        theLabView: `With this fix, we can take that ${currentLowest} score up to a ${shouldBeScore}.`,
        hashtags: "#4BLogic #SwingRehab #TheLabView",
      };
    }

    // Build the full formatted post
    const fullPost = `**${postData.headline}**

🔬 The Case: ${postData.theCase}

⚠️ The Leak: ${postData.theLeak}

🔧 The Fix: ${postData.theFix}

📊 The Lab View: ${postData.theLabView}

${postData.hashtags}`;

    return new Response(
      JSON.stringify({
        success: true,
        post: postData,
        fullPost,
        archetype: context.archetype,
        scores: {
          brain: context.brainScore,
          body: context.bodyScore,
          bat: context.batScore,
          composite: context.compositeScore,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-social-post error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
