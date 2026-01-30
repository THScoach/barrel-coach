import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, mimeType } = await req.json();
    
    if (!audio) {
      return new Response(
        JSON.stringify({ error: "No audio provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Transcribing audio, mimeType:", mimeType);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert base64 to binary
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create form data with the audio file
    const formData = new FormData();
    const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
    formData.append("file", blob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    // Call OpenAI Whisper via Lovable AI gateway
    // Note: The Lovable AI gateway supports the same format as OpenAI
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Whisper API error:", response.status, errorText);
      
      // Fallback: try with Deepgram if available
      const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");
      if (DEEPGRAM_API_KEY) {
        console.log("Trying Deepgram fallback...");
        
        const dgResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&language=en", {
          method: "POST",
          headers: {
            Authorization: `Token ${DEEPGRAM_API_KEY}`,
            "Content-Type": mimeType || "audio/webm",
          },
          body: bytes,
        });

        if (dgResponse.ok) {
          const dgData = await dgResponse.json();
          const transcript = dgData.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
          console.log("Deepgram transcript:", transcript);
          
          return new Response(
            JSON.stringify({ text: transcript }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: "Transcription failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Whisper transcript:", data.text);

    return new Response(
      JSON.stringify({ text: data.text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
