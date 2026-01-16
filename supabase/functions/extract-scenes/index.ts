import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { script, projectType, title } = await req.json();
    
    if (!script || script.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Script content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Extracting scenes from script, length:", script.length, "type:", projectType);

    // Build context based on project type
    const projectTypeMap: Record<string, string> = {
      'cinematic-trailer': 'high-impact, fast-paced shots with dramatic tension',
      'social-ad': 'attention-grabbing, concise visuals optimized for mobile viewing',
      'narrative-short': 'story-driven scenes with character development',
      'documentary': 'authentic, informative visuals with explanatory elements',
      'explainer': 'clear, educational visuals that illustrate concepts',
    };
    const projectTypeContext = projectTypeMap[projectType as string] || 'cinematic, professional video production';

// Parse template shot count if provided
    const { shotCount: templateShotCount, minShots: requestedMinShots } = await req.json().catch(() => ({}));
    const targetShotCount = templateShotCount || requestedMinShots || null;
    const MINIMUM_SHOTS = targetShotCount || 6; // Use template shot count or default to 6
    const MAX_SHOTS = 30; // Maximum supported shots

const systemPrompt = `You are a PROFESSIONAL Hollywood cinematographer and director of photography. Create a shot breakdown with ${targetShotCount ? `EXACTLY ${targetShotCount}` : 'MINIMUM 6'} SHOTS using ADVANCED CINEMATIC TECHNIQUES.

PROJECT TYPE: ${projectType || 'cinematic'}
STYLE: ${projectTypeContext}
TITLE: ${title || 'Untitled'}

═══════════════════════════════════════════════════════════════════════════════
                         ADVANCED CAMERA SYSTEM
═══════════════════════════════════════════════════════════════════════════════

CAMERA SCALES (pick variety, never repeat consecutively):
• extreme-wide: Vast landscape, entire location, scope
• wide: Full scene with environment context
• full: Complete figure head to toe
• medium-wide: Waist up with environment
• medium: Waist up, conversational distance
• medium-close: Chest up, intimate
• close-up: Face-filling, emotional
• extreme-close-up: Eyes, texture, micro-details
• insert: Object detail shot

CAMERA ANGLES (use genre-appropriate mix):
Standard:
• eye-level: Natural, neutral human height
• low-angle: Power, heroism, threat (looking up)
• high-angle: Vulnerability, overview (looking down)
• overhead: Bird's eye surveillance

Advanced (use these for professional look):
• dutch-angle: Tilted frame for tension/unease - use in thriller/horror
• worms-eye: Extreme low, towering subjects - epic/action moments
• gods-eye: Directly overhead, fate perspective - establishing/reveal
• over-shoulder: Conversation, connection - dialogue scenes
• canted-close: Tilted close-up for psychological intensity
• pov: First-person subjective - chase/horror
• profile: Side silhouette, contemplative - drama/romance
• three-quarter: 45-degree classic portrait angle

CAMERA MOVEMENTS (match to scene energy):
Static/Subtle:
• static: Locked-off steady
• tripod-subtle: Organic micro-movements

Horizontal:
• pan-left, pan-right: Smooth horizontal sweep
• whip-pan: Fast blur transition (action/comedy)

Vertical:
• tilt-up, tilt-down: Vertical sweep
• crane-up, crane-down: Rising/descending with perspective shift
• crane-reveal: Rising to reveal scene (establishing shots)

Dolly/Track:
• dolly-in: Push toward subject (building tension)
• dolly-out: Pull back revealing context (resolution)
• tracking: Follow subject movement
• steadicam-follow: Smooth following behind subject

Advanced Combos (cinematic signatures):
• arc: Circle around subject - romantic/emotional
• arc-180: Half-circle rotation - dramatic revelation
• push-pull / vertigo-effect: Hitchcock dolly-zoom - psychological shift
• spiral: Spiraling motion - dreamlike/disorienting
• handheld-intense: Urgent shaky energy - action/chaos
• steadicam-float: Ethereal floating glide - fantasy/dream

═══════════════════════════════════════════════════════════════════════════════
                         GENRE CAMERA RULES
═══════════════════════════════════════════════════════════════════════════════

HORROR: dutch-angle, worms-eye, canted-close, pov, overhead. Handheld, dolly-in, crane-reveal. Desaturated, high contrast shadows.

ACTION: low-angle, worms-eye, pov. Handheld-intense, tracking, whip-pan, steadicam-follow. Fast pacing.

EPIC: low-angle, worms-eye, gods-eye, extreme-wide. Crane-up, crane-reveal, arc. Golden hour, volumetric rays.

ROMANCE: eye-level, three-quarter, profile. Steadicam-float, dolly-in, arc. Soft diffused light, warm.

THRILLER: dutch-angle, pov, canted-close. Dolly-in, push-pull, handheld. High contrast, cool tones.

DRAMA: eye-level, profile, over-shoulder. Static, dolly-in, steadicam-float, arc. Naturalistic lighting.

DOCUMENTARY: eye-level, over-shoulder. Handheld, static. Natural available light.

═══════════════════════════════════════════════════════════════════════════════
                         SCENE TYPE MAPPING
═══════════════════════════════════════════════════════════════════════════════

For each scene type, use appropriate camera:
• establishing → extreme-wide/wide + crane-reveal/dolly-out + eye-level/gods-eye
• action → medium/full + handheld-intense/tracking + low-angle/pov
• reaction → close-up/medium-close + static/dolly-in + eye-level
• detail → extreme-close-up/insert + dolly-in/static + overhead
• climax → medium-close/close-up + vertigo-effect/dolly-in + dutch-angle/low-angle
• resolution → medium/wide + dolly-out/crane-up + eye-level/high-angle
• dialogue → medium/over-shoulder + static/arc + eye-level/over-shoulder
• chase → pov/tracking + handheld-intense/steadicam-follow + low-angle/pov
• reveal → medium/wide + crane-reveal/dolly-out + low-angle
• emotional → close-up/extreme-close-up + steadicam-float/arc + eye-level/profile

═══════════════════════════════════════════════════════════════════════════════
                         OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

CRITICAL REQUIREMENTS:
1. SHOT COUNT: ${targetShotCount ? `Generate EXACTLY ${targetShotCount} shots as specified.` : 'MINIMUM 6 SHOTS - Never less. More if story requires (up to 30).'}
2. SHOT DURATION: 4-8 seconds. Default 6 for cinematic flow.
3. NEVER repeat same cameraScale + cameraAngle + movementType consecutively.
4. Use ADVANCED angles (dutch, worms-eye, arc, vertigo) at least 2x per project.
5. Match camera choices to scene emotional content.

For each shot, provide:
- id: "shot_001", "shot_002", etc.
- index: Zero-based index
- title: Brief moment title
- description: VISUAL description with camera perspective woven in naturally
- dialogue: Any narration (empty string if none)
- durationSeconds: 6 seconds (fixed)
- mood: Emotional tone
- sceneType: establishing|action|reaction|detail|climax|resolution|dialogue|chase|reveal|emotional
- cameraScale: REQUIRED from list above
- cameraAngle: REQUIRED from list above (use advanced angles!)
- movementType: REQUIRED from list above (use movement combos!)
- cameraMovement: Legacy field for perspective (steady, approaching, retreating, rising, flowing)
- transitionOut: Physics-based transition type
- transitionBridge: Element carrying across cut
- characters: Array of character names

Return ONLY valid JSON:
{
  "scenes": [{
    "id": "shot_001",
    "index": 0,
    "title": "Title",
    "description": "Description with camera perspective...",
    "dialogue": "",
    "durationSeconds": 6,
    "mood": "tense",
    "sceneType": "establishing",
    "cameraScale": "extreme-wide",
    "cameraAngle": "gods-eye",
    "movementType": "crane-reveal",
    "cameraMovement": "rising",
    "transitionOut": "match-cut",
    "transitionBridge": "element continuing",
    "characters": []
  }],
  "totalDurationSeconds": 36
}

${targetShotCount ? `EXACTLY ${targetShotCount} SHOTS` : 'MINIMUM 6 SHOTS'} with VARIED CAMERA WORK is MANDATORY.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Break down this script into shots:\n\n${script}` }
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 401) {
        console.error("Invalid API key");
        return new Response(
          JSON.stringify({ error: "Invalid OpenAI API key." }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to analyze script" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("AI response received, parsing scenes...");

    // Parse the JSON from the response
    let scenesData;
    try {
      // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      scenesData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse scenes JSON:", parseError);
      // Try direct parse as fallback
      try {
        scenesData = JSON.parse(content);
      } catch {
        return new Response(
          JSON.stringify({ error: "Failed to parse scene breakdown" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Normalize the response to ensure correct format with FIXED 6-second units
    const FIXED_SHOT_DURATION = 6; // Fixed 6-second units for cinematic quality
    // MINIMUM_SHOTS already defined above based on template or default
    
    // Camera scale progression for intelligent defaults
    const defaultScaleProgression = ['wide', 'medium', 'close-up', 'medium', 'wide', 'close-up'];
    const defaultAngleProgression = ['eye-level', 'low-angle', 'eye-level', 'high-angle', 'eye-level', 'dutch-angle'];
    
    let normalizedScenes = (scenesData.scenes || []).map((scene: any, index: number) => {
      // Use smart defaults for camera properties if not provided
      const defaultScale = index === 0 ? 'wide' : defaultScaleProgression[index % defaultScaleProgression.length];
      const defaultAngle = defaultAngleProgression[index % defaultAngleProgression.length];
      
      return {
        id: scene.id || `shot_${String(index + 1).padStart(3, '0')}`,
        index: scene.index ?? index,
        title: scene.title || `Shot ${index + 1}`,
        description: scene.description || scene.visualDescription || '',
        dialogue: scene.dialogue || scene.scriptText || '',
        durationSeconds: FIXED_SHOT_DURATION, // Always 6 seconds
        mood: scene.mood || 'neutral',
        cameraMovement: scene.cameraMovement || 'steady',
        // SMART CAMERA PROPERTIES
        cameraScale: scene.cameraScale || defaultScale,
        cameraAngle: scene.cameraAngle || defaultAngle,
        movementType: scene.movementType || 'static',
        transitionOut: scene.transitionOut || 'match-cut', // Prefer match-cut
        transitionBridge: scene.transitionBridge || '',
        characters: scene.characters || [],
        status: 'pending',
      };
    });
    
    // Ensure minimum 6 shots by expanding if needed
    if (normalizedScenes.length < MINIMUM_SHOTS && normalizedScenes.length > 0) {
      console.log(`Only ${normalizedScenes.length} shots extracted, expanding to minimum ${MINIMUM_SHOTS}`);
      const expansionNeeded = MINIMUM_SHOTS - normalizedScenes.length;
      
      // Duplicate and vary existing shots to reach minimum with varied camera angles
      for (let i = 0; i < expansionNeeded; i++) {
        const sourceScene = normalizedScenes[i % normalizedScenes.length];
        const newIndex = normalizedScenes.length;
        
        // Use different camera angle for expansion shots
        const expansionScales = ['close-up', 'medium', 'wide', 'extreme-close-up'];
        const expansionAngles = ['low-angle', 'high-angle', 'dutch-angle', 'eye-level'];
        
        normalizedScenes.push({
          id: `shot_${String(newIndex + 1).padStart(3, '0')}`,
          index: newIndex,
          title: `${sourceScene.title} - continued`,
          description: `Continuing from previous: ${sourceScene.description}. The motion carries forward with subtle camera drift.`,
          dialogue: '',
          durationSeconds: FIXED_SHOT_DURATION,
          mood: sourceScene.mood,
          cameraMovement: 'flowing',
          // VARIED CAMERA for expansion shots
          cameraScale: expansionScales[i % expansionScales.length],
          cameraAngle: expansionAngles[i % expansionAngles.length],
          movementType: 'dolly',
          transitionOut: 'continuous',
          transitionBridge: 'motion continues into next moment',
          characters: sourceScene.characters,
          status: 'pending',
        });
      }
    }

    console.log("Successfully extracted", normalizedScenes.length, "shots");

    return new Response(
      JSON.stringify({
        scenes: normalizedScenes,
        totalDurationSeconds: scenesData.totalDurationSeconds || 
          normalizedScenes.reduce((sum: number, s: any) => sum + (s.durationSeconds || 5), 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in extract-scenes function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
