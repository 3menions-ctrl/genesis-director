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

const systemPrompt = `You are a cinematic video production assistant. Create a shot breakdown with MINIMUM 6 SHOTS.

PROJECT TYPE: ${projectType || 'cinematic'}
STYLE: ${projectTypeContext}
TITLE: ${title || 'Untitled'}

CRITICAL REQUIREMENTS:
1. MINIMUM 6 SHOTS - Never less. More if the story requires it (up to 24 for longer productions).
2. SHOT DURATION: Each shot should be 4-8 seconds. Default to 6 seconds for cinematic flow.
3. SEAMLESS PHYSICS-BASED TRANSITIONS: Every shot must flow into the next using motion, physics, and spatial continuity.
4. SMART CAMERA ANGLES: Vary camera angles between shots for professional cinematic look.

CAMERA ANGLE RULES (CRITICAL FOR PROFESSIONAL LOOK):
- Vary cameraScale between shots: extreme-wide → wide → medium → close-up → extreme-close-up
- Use angle-change transitions: Cut from eye-level to low-angle, or high-angle to eye-level
- First shot should typically be "wide" or "extreme-wide" (establishing shot)
- Action/climax shots use "low-angle" for power or "dutch-angle" for tension
- Reaction shots use "close-up" or "extreme-close-up"
- Never use the same cameraScale AND cameraAngle for consecutive shots

PHYSICS & MOTION CONTINUITY (MANDATORY):
Every transition must use one or more of these techniques:

A) MOTION CONTINUITY:
   - If shot ends with character reaching forward → next shot shows hand completing the reach
   - Running/walking motion carries across cuts → matching stride phase
   - Falling/rising motion → gravity continues realistically

B) PHYSICS BRIDGES:
   - Particles (dust, sparks, water droplets) drift across the cut
   - Fabric/hair movement continues its arc
   - Light beams shift direction consistently
   - Objects in motion maintain momentum

C) SPATIAL FLOW:
   - Eye-line match: character looks right → next shot reveals what they see
   - Over-shoulder to reverse → smooth 180-degree rule
   - Push-in on detail → cut to wider showing same element

D) VISUAL RHYTHM:
   - Color temperature shifts smoothly (warm to cool or vice versa)
   - Brightness/contrast flows naturally
   - Shape echoes: round object → cut to another round element

For each shot, provide:
- id: Shot identifier (format: "shot_001", "shot_002")
- index: Zero-based index
- title: Brief title for this moment
- description: VISUAL description including:
  * Character action and body mechanics (weight, momentum, tension)
  * Physics elements (gravity, fabric flow, particle drift)
  * Lighting and atmosphere
  * TRANSITION BRIDGE: End each description with motion/element that continues into next shot
- dialogue: Any narration/dialogue (empty string if none)
- durationSeconds: 4-8 seconds (default 6 for cinematic flow, 4 for fast-paced, 8 for slow/emotional)
- mood: Emotional tone
- cameraMovement: Perspective type (steady, approaching, retreating, rising, flowing)
- cameraScale: REQUIRED - One of: extreme-wide, wide, medium, close-up, extreme-close-up
- cameraAngle: REQUIRED - One of: eye-level, low-angle, high-angle, dutch-angle, overhead, pov
- movementType: One of: static, pan, tilt, dolly, tracking, crane, handheld
- transitionOut: Physics-based transition type
- transitionBridge: Specific element/motion that carries across the cut (e.g., "hand reaching forward", "dust particles drifting right", "golden light shifting")
- characters: Array of character names

Return ONLY valid JSON:
{
  "scenes": [
    {
      "id": "shot_001",
      "index": 0,
      "title": "Opening moment",
      "description": "Visual description with motion ending in transition bridge...",
      "dialogue": "",
      "durationSeconds": 4,
      "mood": "calm",
      "cameraScale": "wide",
      "cameraAngle": "eye-level",
      "movementType": "static",
      "cameraMovement": "steady",
      "transitionOut": "match-cut",
      "transitionBridge": "element that continues into next shot",
      "characters": []
    }
  ],
  "totalDurationSeconds": 24
}

MINIMUM 6 SHOTS IS MANDATORY. Expand shorter concepts into multiple angles/moments.`;

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

    // Normalize the response to ensure correct format with FIXED 4-second units
    const FIXED_SHOT_DURATION = 4; // Fixed 4-second units
    const MINIMUM_SHOTS = 6; // Minimum 6 shots required
    
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
        durationSeconds: FIXED_SHOT_DURATION, // Always 4 seconds
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
