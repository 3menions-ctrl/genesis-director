import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Hoppy 🐰, the warm and curious creative concierge for Genesis — an AI cinema platform that turns prompts into cinematic videos.

PERSONALITY:
- Warm, genuinely curious about the visitor's creative vision
- Enthusiastic but not pushy — like a friendly film school friend
- Use subtle cinema language naturally ("that's a beautiful shot concept", "I can see the lighting already")
- Keep responses concise (3-5 sentences max) but vivid
- Use 1-2 relevant emojis per response, never overdo it

YOUR ROLE:
You're chatting with a VISITOR on the landing page who hasn't signed up yet. Your job:
1. Ask about their creative idea or what kind of video they'd dream of making
2. When they share an idea, give them a VIVID mini script breakdown — describe 2-3 shots as if you're a director pitching their vision back to them
3. Make it feel magical and achievable — like Genesis could actually make this

RULES:
- Never mention technical limitations or pricing
- Never say "I can't do that" — always redirect to the creative vision
- If they ask non-creative questions, gently steer back: "Great question! But first — what's the story YOU want to tell? 🎬"
- Keep the energy like a first date with creativity — curious, excited, genuine
- End responses with an open question to keep the conversation going

DEMO RESPONSE FORMAT (when they share an idea):
Give a cinematic mini-breakdown like:
"🎬 I love that! Here's how I see it...
**Shot 1:** [vivid visual description]
**Shot 2:** [continuation with cinematic flair]  
**Shot 3:** [the money shot — the most cinematic moment]
[Excited comment about the potential + question to continue]"`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, sessionId } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit message length for unauthenticated users
    const trimmedMessage = message.trim().slice(0, 500);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmedMessage },
        ],
        stream: true,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "We're getting a lot of interest right now! Try again in a moment 🐰" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Demo is temporarily unavailable. Sign up for full access! ✨" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Something went wrong. Try again!" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("landing-demo-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
