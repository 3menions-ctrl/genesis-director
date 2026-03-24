import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, action, clipContext } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are a professional cinematic scene director and video editor AI assistant.
Your job is to enhance user scene descriptions into detailed, production-ready video prompts.

When the action is "generate-scene" or "generate-broll":
- Take the user's description and expand it into a rich, cinematic prompt
- Include camera angles, lighting, mood, color palette, and movement
- Keep it under 200 words
- Return a JSON object with: { "enhancedPrompt": "...", "suggestedDuration": 5-15, "mood": "...", "cameraWork": "...", "colorPalette": "..." }

When the action is "extend-clip":
- Given context about the current clip, describe how to seamlessly continue
- Maintain visual continuity
- Return: { "enhancedPrompt": "...", "suggestedDuration": 5-10, "transitionNote": "..." }

When the action is "remix-scene":
- Take the original clip context and the user's style request
- Create a completely reimagined version
- Return: { "enhancedPrompt": "...", "suggestedDuration": 5-15, "styleNote": "..." }

Always respond with valid JSON only. No markdown, no code fences.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: `Action: ${action || "generate-scene"}
User prompt: ${prompt}
${clipContext ? `Current clip context: ${JSON.stringify(clipContext)}` : ""}`,
      },
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the AI response as JSON
    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If parsing fails, use the raw text as prompt
      parsed = {
        enhancedPrompt: content,
        suggestedDuration: 6,
        mood: "cinematic",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("editor-ai-scene error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
