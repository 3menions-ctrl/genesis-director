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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
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

const systemPrompt = `You are a video production assistant. Create a shot breakdown from the user's script/concept.

PROJECT TYPE: ${projectType || 'cinematic'}
STYLE: ${projectTypeContext}
TITLE: ${title || 'Untitled'}

CRITICAL RULES:
1. PRESERVE THE USER'S INTENT - Do not add characters, locations, or story elements they didn't mention
2. If the script describes ONE simple scene (e.g., "person sitting on couch"), create shots that all show THAT SAME SCENE from different angles/moments
3. Each shot should be a visual moment within the user's concept, NOT a new adventure
4. Keep descriptions grounded in what the user actually described
5. MAXIMUM DURATION: Each shot MUST be between 4-16 seconds. Never exceed 16 seconds per shot.
6. SEAMLESS TRANSITIONS: Design each shot to flow naturally into the next with smooth visual transitions

For each shot, provide:
- id: Shot identifier (format: "shot_001", "shot_002")
- index: Zero-based index
- title: Brief title for this moment
- description: VISUAL description for AI video generation:
  * What is visible in frame
  * Lighting and atmosphere
  * Character positions and expressions (if mentioned)
  * Use perspective language, NOT camera terms
  * End each shot description with a transition hint for continuity
- dialogue: Any narration/dialogue (empty string if none)
- durationSeconds: 4-16 seconds per shot (MAXIMUM 16 seconds, aim for 5-10 for most shots)
- mood: Emotional tone
- cameraMovement: Perspective type (steady, approaching, retreating, rising, flowing)
- transitionOut: How this shot flows into the next ("dissolve", "match-cut", "continuous", "fade")
- characters: Array of character names (ONLY those mentioned by user)

Return ONLY valid JSON:
{
  "scenes": [
    {
      "id": "shot_001",
      "index": 0,
      "title": "Scene moment",
      "description": "Visual description ending with transition continuity...",
      "dialogue": "",
      "durationSeconds": 8,
      "mood": "calm",
      "cameraMovement": "steady",
      "transitionOut": "continuous",
      "characters": []
    }
  ],
  "totalDurationSeconds": 30
}

TRANSITION GUIDELINES:
- "continuous": Shot ends with movement/action that continues in next shot (best for frame chaining)
- "match-cut": End frame matches start of next shot (same color, shape, or position)
- "dissolve": Gradual blend works for mood/time changes
- "fade": Reserved for scene endings or dramatic pauses

REMEMBER: If the user wants "Hannah sitting on a couch", ALL shots should show Hannah on that couch - different angles, moments, expressions - NOT Hannah going on adventures.`;

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
          { role: "user", content: `Break down this script into shots:\n\n${script}` }
        ],
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
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(
          JSON.stringify({ error: "API credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
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

    // Normalize the response to ensure correct format with duration enforcement
    const MAX_SHOT_DURATION = 16;
    const MIN_SHOT_DURATION = 4;
    
    const normalizedScenes = (scenesData.scenes || []).map((scene: any, index: number) => {
      // Enforce 4-16 second duration limits
      let duration = scene.durationSeconds || 8;
      duration = Math.max(MIN_SHOT_DURATION, Math.min(MAX_SHOT_DURATION, duration));
      
      return {
        id: scene.id || `shot_${String(index + 1).padStart(3, '0')}`,
        index: scene.index ?? index,
        title: scene.title || `Shot ${index + 1}`,
        description: scene.description || scene.visualDescription || '',
        dialogue: scene.dialogue || scene.scriptText || '',
        durationSeconds: duration,
        mood: scene.mood || 'neutral',
        cameraMovement: scene.cameraMovement || 'steady',
        transitionOut: scene.transitionOut || 'continuous',
        characters: scene.characters || [],
        status: 'pending',
      };
    });

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
