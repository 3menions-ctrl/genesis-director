import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STYLE_PROMPTS: Record<string, string> = {
  cinematic_hero: `Style: CINEMATIC HERO
- Full-screen background video with dark overlays
- Big bold headline with staggered reveal animation
- CTA button that "pops" in after 1.8s with glow effect
- Muted ambient video behind text
- Widget type: landing_page
- Position: center
- Scenes: 1 hero scene (loop, autoplay), 1 engage scene, 1 CTA scene
- Triggers: idle at 6s, scroll at 35%
- Dark, premium color palette`,

  "4th_wall_breakthrough": `Style: 4TH WALL BREAKTHROUGH  
- Character appears to break out of the video container
- 3-clip narrative: confinement → breakthrough → speaks to viewer
- Widget type: both (embed + landing)
- Position: bottom-right for embed, center for landing
- Scenes: 3 scenes (trap, break, emergence) 
- The final scene has the CTA dialogue
- Triggers: idle at 4s, exit_intent enabled
- Bold, high-energy color palette with accent color`,

  minimal_embed: `Style: MINIMAL EMBED
- Clean, small floating widget
- Single auto-play scene with subtle CTA overlay
- Widget type: embed
- Position: bottom-right
- Compact dimensions (320x400)
- Scenes: 1 idle scene (loop), 1 CTA scene
- Triggers: idle at 8s, scroll at 50%
- Understated, professional palette`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { concept, style, widget_id, generate_videos } = await req.json();

    if (!concept || !style || !widget_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify widget ownership
    const { data: widget, error: widgetError } = await supabase
      .from("widget_configs")
      .select("id, user_id")
      .eq("id", widget_id)
      .single();

    if (widgetError || !widget || widget.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Widget not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.cinematic_hero;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a conversion-optimized landing page architect. Given a user's concept and a visual style, generate a complete widget configuration as JSON.

${stylePrompt}

Return ONLY a JSON object with these fields:
{
  "headline": "string - compelling, short headline (max 8 words)",
  "subheadline": "string - supporting text (max 20 words)", 
  "cta_text": "string - action-oriented CTA button text (2-4 words)",
  "cta_url": "string - suggested CTA URL or '#signup'",
  "secondary_cta_text": "string or null",
  "tone": "friendly|bold|funny|professional|urgent",
  "widget_type": "embed|landing_page|both",
  "primary_color": "hex color for primary brand accent",
  "background_color": "hex color for background",
  "scenes": [
    {
      "id": "uuid",
      "name": "string",
      "type": "hero|idle|engage|cta|exit_save|testimonial",
      "src_mp4": "",
      "loop": boolean,
      "priority": number,
      "subtitle_text": "string or empty",
      "video_generation_prompt": "Detailed cinematic prompt for Apex Pipeline video generation - include camera movements, lighting, character actions, and mood. Be specific and visual."
    }
  ],
  "triggers": {
    "idle_seconds": number,
    "scroll_percent": number,
    "exit_intent": boolean
  },
  "rules": [
    { "event": "PAGE_VIEW|IDLE|SCROLL_DEPTH|EXIT_INTENT", "action": "play_scene", "scene_id": "matching scene id" }
  ]
}

IMPORTANT:
- Each scene MUST have a detailed "video_generation_prompt" describing the video to generate
- Generate UUIDs for scene IDs
- Make the copy conversion-focused and compelling
- Match the tone to the concept
- src_mp4 should be empty string (videos will be generated)`;

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
          { role: "user", content: `Concept: ${concept}\n\nGenerate the complete widget configuration.` },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits required. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", status, await response.text());
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let config;
    try {
      config = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawContent.substring(0, 500));
      return new Response(JSON.stringify({ error: "AI returned invalid config. Try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO: If generate_videos is true, trigger pipeline for each scene's video_generation_prompt
    // For now, we just return the config and video generation will be a follow-up feature
    let videoGenerationStarted = false;

    return new Response(
      JSON.stringify({
        config,
        video_generation_started: videoGenerationStarted,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("generate-widget-config error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
