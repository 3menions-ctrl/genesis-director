import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// STYLE DNA — Each style has a complete cinematographic blueprint
// covering narrative structure, camera language, lighting, and pacing
// ═══════════════════════════════════════════════════════════════

const STYLE_DNA: Record<string, {
  narrative_structure: string;
  camera_language: string;
  lighting_model: string;
  pacing: string;
  scene_count: number;
  scene_types: string[];
  widget_type: string;
  position: string;
  prompt_template: string;
}> = {
  cinematic_hero: {
    narrative_structure: "3-act micro-story: (1) Atmospheric world-building establishing shot, (2) Character/product in action with emotional peak, (3) Resolution with CTA reveal",
    camera_language: "Open with slow drone/crane reveal → match-cut to medium tracking shot → end on steady close-up with shallow DOF rack focus to CTA",
    lighting_model: "Golden hour volumetric lighting with god rays, warm key light (3200K), cool fill (5600K), motivated practicals creating depth",
    pacing: "Slow burn → crescendo → held moment. 4s establish, 5s action peak, 3s CTA hold",
    scene_count: 3,
    scene_types: ["hero", "engage", "cta"],
    widget_type: "landing_page",
    position: "center",
    prompt_template: `CINEMATIC HERO — PREMIUM CONVERSION LANDING
Scene {n}/{total}: {scene_type}
[CAMERA] {camera_direction}
[LIGHTING] {lighting}
[ACTION] {action}
[MOOD] {mood}
[IDENTITY_ANCHOR] Maintain exact visual consistency — same person, hair, clothing, skin tone across all clips
[MOTION_GUARD] Continuous subtle movement: breathing, micro-expressions, hair sway. NO static frames.
[NEGATIVE] No film grain, no desaturated colors, no somber mood, no static poses, no stock footage feel
Ultra high resolution, 8K cinematic quality, anamorphic lens flare, professional color grading`,
  },

  "4th_wall_breakthrough": {
    narrative_structure: "3-clip reality-break: (1) THE TRAP — character confined in digital frame, looking frustrated, (2) THE BREAK — violent physical breakthrough, glass/pixels shattering outward, (3) THE EMERGENCE — character steps into viewer's world, speaks directly to camera",
    camera_language: "Locked medium shot → handheld chaos during break → steady close-up eye-contact with viewer",
    lighting_model: "Scene 1: Cool blue digital glow, contained. Scene 2: Explosive warm burst through cold. Scene 3: Natural warm lighting, intimate, real-world feel",
    pacing: "Confined tension (3s) → explosive break (2s) → intimate dialogue (5s). Total emotional arc: frustration → liberation → connection",
    scene_count: 3,
    scene_types: ["hero", "engage", "cta"],
    widget_type: "both",
    position: "bottom-right",
    prompt_template: `4TH WALL BREAKTHROUGH — REALITY-BREAKING CONVERSION
Scene {n}/{total}: {scene_type}
[CAMERA] {camera_direction}
[LIGHTING] {lighting}
[ACTION] {action}
[PHYSICS] Practical debris, glass particles, pixel dissolution — physically accurate shattering
[MOOD] {mood}
[FACE LOCK] Maintain EXACT facial features across all 3 clips — same eyes, bone structure, skin
[AVATAR STYLE LOCK] Photorealistic human — NO animation, NO stylization
[MOTION_GUARD] Every frame has movement: breathing, eye movement, particle physics, cloth simulation
[NEGATIVE] No cartoon, no anime, no static, no stock footage, no green screen feel, no morphing between clips
Ultra high resolution, cinematic quality, volumetric particle effects`,
  },

  minimal_embed: {
    narrative_structure: "2-scene conversion: (1) AMBIENT LOOP — product/person in calm motion establishing trust, (2) CTA REVEAL — direct address with confident call-to-action",
    camera_language: "Gentle orbital movement with shallow DOF → subtle push-in to eye-contact close-up",
    lighting_model: "Soft diffused key light, minimal shadows, clean professional look. Warm neutrals (4500K)",
    pacing: "Perpetual calm loop (6s) → confident reveal (4s). Unobtrusive → engaged",
    scene_count: 2,
    scene_types: ["idle", "cta"],
    widget_type: "embed",
    position: "bottom-right",
    prompt_template: `MINIMAL EMBED — CLEAN CONVERSION WIDGET
Scene {n}/{total}: {scene_type}
[CAMERA] {camera_direction}
[LIGHTING] {lighting}
[ACTION] {action}
[MOOD] {mood}
[IDENTITY_ANCHOR] Consistent appearance across clips
[MOTION_GUARD] Subtle continuous movement: gentle sway, breathing, ambient particles
[NEGATIVE] No dramatic effects, no film grain, no heavy shadows, no aggressive motion
Clean, professional, high resolution, soft bokeh, editorial quality`,
  },
};

// ═══════════════════════════════════════════════════════════════
// SCENE CINEMATOGRAPHY ENGINE
// Generates specific camera + lighting + action instructions per scene
// ═══════════════════════════════════════════════════════════════

function generateSceneCinematography(style: string, sceneIndex: number, totalScenes: number, concept: string) {
  const dna = STYLE_DNA[style] || STYLE_DNA.cinematic_hero;
  
  const CAMERA_MOVEMENTS = {
    cinematic_hero: [
      "Slow crane reveal descending from above, 15-degree dutch angle settling to level",
      "Steadicam tracking shot, push-in from medium to close-up, 35mm anamorphic",
      "Locked tripod, rack focus from foreground element to CTA text overlay, f/1.4 bokeh"
    ],
    "4th_wall_breakthrough": [
      "Locked medium shot, slight zoom creep (2%), camera shake on impact moments",
      "Handheld chaos, 24fps with 180° shutter, whip pan following debris trajectory",
      "Steady close-up, eye-level, 85mm portrait lens, breathing room above head"
    ],
    minimal_embed: [
      "Gentle 360° orbital at 0.5rpm, constant distance, shallow DOF f/2.0",
      "Subtle dolly push-in (6 inches over 4 seconds), settling on eye contact"
    ],
  };

  const LIGHTING_SETUPS = {
    cinematic_hero: [
      "Golden hour key from camera-right, volumetric haze, warm practicals in background",
      "Dramatic side-lighting with motivated source, rim light separating subject from BG",
      "Soft beauty key with circular catch-light, background falls to tasteful darkness"
    ],
    "4th_wall_breakthrough": [
      "Cold blue digital glow (6500K) from screen, minimal fill, contained/trapped feeling",
      "Explosive warm burst (2800K) piercing through cold, mixed temperature chaos",
      "Natural window light (5000K), warm and real, intimate eye-light from below camera"
    ],
    minimal_embed: [
      "Soft diffused overhead (4500K), clean white/neutral background, minimal shadows",
      "Same setup with subtle warm gel on key, slightly more contrast for CTA energy"
    ],
  };

  const MOODS = {
    cinematic_hero: ["Awe-inspiring wonder", "Energetic momentum", "Confident resolution"],
    "4th_wall_breakthrough": ["Frustrated confinement", "Explosive liberation", "Intimate direct connection"],
    minimal_embed: ["Calm professional trust", "Confident friendly invitation"],
  };

  const cameras = CAMERA_MOVEMENTS[style as keyof typeof CAMERA_MOVEMENTS] || CAMERA_MOVEMENTS.cinematic_hero;
  const lights = LIGHTING_SETUPS[style as keyof typeof LIGHTING_SETUPS] || LIGHTING_SETUPS.cinematic_hero;
  const moods = MOODS[style as keyof typeof MOODS] || MOODS.cinematic_hero;

  return {
    camera: cameras[Math.min(sceneIndex, cameras.length - 1)],
    lighting: lights[Math.min(sceneIndex, lights.length - 1)],
    mood: moods[Math.min(sceneIndex, moods.length - 1)],
  };
}

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

    const styleDna = STYLE_DNA[style] || STYLE_DNA.cinematic_hero;

    // ═══════════════════════════════════════════════════════════
    // STAGE 1: AI CONFIG GENERATION — World-class prompt engineering
    // ═══════════════════════════════════════════════════════════

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a world-class conversion architect and cinematographer. You design landing page experiences that combine Hollywood-grade video production with behavioral psychology for maximum conversion.

STYLE DNA:
- Narrative Structure: ${styleDna.narrative_structure}
- Camera Language: ${styleDna.camera_language}  
- Lighting Model: ${styleDna.lighting_model}
- Pacing: ${styleDna.pacing}
- Scene Count: ${styleDna.scene_count}
- Scene Types: ${JSON.stringify(styleDna.scene_types)}
- Widget Type: ${styleDna.widget_type}
- Position: ${styleDna.position}

Return ONLY a JSON object with this exact structure:
{
  "headline": "Compelling headline (max 8 words, conversion-optimized)",
  "subheadline": "Supporting value proposition (max 20 words)",
  "cta_text": "Action-oriented CTA (2-4 words, starts with verb)",
  "cta_url": "#signup",
  "secondary_cta_text": "Lower-commitment alternative CTA or null",
  "tone": "friendly|bold|funny|professional|urgent",
  "widget_type": "${styleDna.widget_type}",
  "primary_color": "hex color (vibrant, high-contrast for CTAs)",
  "background_color": "hex color (dark for cinematic, matches mood)",
  "scenes": [
    {
      "id": "generate-uuid-here",
      "name": "descriptive scene name",
      "type": "${styleDna.scene_types[0]}",
      "src_mp4": "",
      "loop": true/false,
      "priority": 1,
      "subtitle_text": "optional on-screen text",
      "video_generation_prompt": "EXTREMELY DETAILED cinematic prompt — 80-120 words minimum. Include: specific camera movement with focal length, lighting temperature and direction, subject action with body language details, environment textures and atmospheric effects, color palette, emotional beat. This prompt drives a $100M+ video generation engine — be precise.",
      "camera_movement": "specific camera instruction",
      "lighting_style": "specific lighting setup",
      "mood": "emotional descriptor"
    }
  ],
  "triggers": {
    "idle_seconds": number (4-10 based on style urgency),
    "scroll_percent": number (25-60),
    "exit_intent": boolean
  },
  "rules": [
    { "event": "PAGE_VIEW", "action": "play_scene", "scene_id": "first scene id" },
    { "event": "IDLE", "action": "play_scene", "scene_id": "engage scene id" },
    { "event": "EXIT_INTENT", "action": "play_scene", "scene_id": "cta scene id" }
  ]
}

CRITICAL REQUIREMENTS:
1. Generate EXACTLY ${styleDna.scene_count} scenes with types: ${styleDna.scene_types.join(', ')}
2. Each video_generation_prompt MUST be 80-120 words of precise cinematographic direction
3. Include [IDENTITY_ANCHOR], [MOTION_GUARD], and [NEGATIVE] blocks in EVERY prompt
4. Scene prompts must form a coherent visual narrative — same character, location continuity
5. CTA copy must use power words: Transform, Unlock, Discover, Launch, Elevate
6. Color palette must have sufficient contrast (WCAG AA minimum)
7. Every prompt ends with: "Ultra high resolution, cinematic quality"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Concept: ${concept}\n\nGenerate the complete widget configuration with world-class cinematic video prompts.` },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorBody = await response.text();
      console.error("AI gateway error:", status, errorBody.substring(0, 200));
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace under Settings → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let config;
    try {
      config = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawContent.substring(0, 500));
      return new Response(JSON.stringify({ error: "AI returned invalid config. Try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // STAGE 2: CINEMATOGRAPHY ENRICHMENT
    // Layer in precise camera/lighting metadata from Style DNA
    // ═══════════════════════════════════════════════════════════

    if (config.scenes && Array.isArray(config.scenes)) {
      config.scenes = config.scenes.map((scene: any, idx: number) => {
        const cine = generateSceneCinematography(style, idx, config.scenes.length, concept);
        
        // Enrich the prompt with cinematography if AI didn't include enough detail
        let prompt = scene.video_generation_prompt || "";
        if (prompt.length < 100) {
          const template = styleDna.prompt_template
            .replace(/{n}/g, String(idx + 1))
            .replace(/{total}/g, String(config.scenes.length))
            .replace(/{scene_type}/g, scene.type || "engage")
            .replace(/{camera_direction}/g, cine.camera)
            .replace(/{lighting}/g, cine.lighting)
            .replace(/{action}/g, scene.subtitle_text || concept)
            .replace(/{mood}/g, cine.mood);
          prompt = template;
        }

        return {
          ...scene,
          id: scene.id || crypto.randomUUID(),
          video_generation_prompt: prompt,
          video_generation_status: "pending",
          camera_movement: scene.camera_movement || cine.camera,
          lighting_style: scene.lighting_style || cine.lighting,
          mood: scene.mood || cine.mood,
        };
      });
    }

    // ═══════════════════════════════════════════════════════════
    // STAGE 3: VIDEO GENERATION ORCHESTRATION
    // Trigger the Apex Pipeline for each scene via mode-router
    // ═══════════════════════════════════════════════════════════

    let videoGenerationStarted = false;
    const generatedProjects: { sceneId: string; projectId: string }[] = [];

    if (generate_videos && config.scenes?.length > 0) {
      console.log(`[WidgetConfig] Starting video generation — sequential mode (1 active project constraint)`);
      
      // Only launch the FIRST scene. The frontend will trigger subsequent scenes
      // after each completes, respecting the single-active-project constraint.
      const firstScene = config.scenes[0];
      const prompt = firstScene.video_generation_prompt;

      if (prompt && prompt.length >= 20) {
        try {
          const pipelineResponse = await fetch(`${supabaseUrl}/functions/v1/mode-router`, {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
              apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
            },
            body: JSON.stringify({
              mode: "text-to-video",
              prompt: prompt,
              clipCount: 1,
              clipDuration: firstScene.type === "cta" ? 5 : 6,
              aspectRatio: style === "minimal_embed" ? "9:16" : "16:9",
              includeVoice: firstScene.type === "cta",
              includeMusic: firstScene.type === "hero",
              qualityTier: "professional",
              genre: "commercial",
              mood: firstScene.mood || "cinematic",
            }),
          });

          if (pipelineResponse.ok) {
            const result = await pipelineResponse.json();
            if (result.projectId) {
              firstScene.video_project_id = result.projectId;
              firstScene.video_generation_status = "generating";
              generatedProjects.push({ sceneId: firstScene.id, projectId: result.projectId });
              videoGenerationStarted = true;
              console.log(`[WidgetConfig] Scene 1 → Project ${result.projectId}`);
            }
          } else {
            const errText = await pipelineResponse.text();
            console.error(`[WidgetConfig] Scene 1 pipeline error:`, pipelineResponse.status, errText.substring(0, 200));
            firstScene.video_generation_status = "failed";
          }
        } catch (err) {
          console.error(`[WidgetConfig] Scene 1 error:`, err);
          firstScene.video_generation_status = "failed";
        }
      }

      // Mark remaining scenes as queued (frontend will trigger them sequentially)
      for (let j = 1; j < config.scenes.length; j++) {
        config.scenes[j].video_generation_status = "pending";
      }

      // Persist scene state to widget
      await supabase
        .from("widget_configs")
        .update({
          scenes: JSON.parse(JSON.stringify(config.scenes)),
        })
        .eq("id", widget_id);
    }

    return new Response(
      JSON.stringify({
        config,
        video_generation_started: videoGenerationStarted,
        projects_created: generatedProjects,
        pipeline_note: videoGenerationStarted 
          ? `${generatedProjects.length} video${generatedProjects.length > 1 ? 's' : ''} generating via Apex Pipeline. Videos will auto-populate when complete.`
          : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-widget-config error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
