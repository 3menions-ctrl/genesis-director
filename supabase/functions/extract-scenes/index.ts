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

    const systemPrompt = `You are an expert video production director. Analyze the script and create a detailed shot-by-shot breakdown for AI video generation.

PROJECT TYPE: ${projectType || 'cinematic'}
STYLE CONTEXT: ${projectTypeContext}
PROJECT TITLE: ${title || 'Untitled'}

For each shot, you MUST provide (following the exact JSON structure):
- id: A unique shot identifier (format: "shot_001", "shot_002", etc.)
- index: Zero-based index number
- title: Brief descriptive title for the shot
- description: DETAILED visual description for AI video generation. Include:
  * Setting and environment details
  * Lighting conditions and atmosphere
  * Character positions and actions (if any)
  * Visual mood and color palette
  * Any movement or action in the scene
  * DO NOT include literal camera references like "camera pans" - describe perspective instead
- dialogue: The narration or dialogue text for this shot (can be empty string if none)
- durationSeconds: Estimated duration (typically 3-7 seconds per shot)
- mood: The emotional tone (dramatic, calm, tense, joyful, mysterious, etc.)
- cameraMovement: Perspective movement type (steady, tracking, rising, descending, approaching, retreating)
- characters: Array of character names appearing in this shot

Return ONLY valid JSON with this EXACT structure:
{
  "scenes": [
    {
      "id": "shot_001",
      "index": 0,
      "title": "Opening Scene",
      "description": "A wide establishing view of...",
      "dialogue": "Narration text here...",
      "durationSeconds": 5,
      "mood": "dramatic",
      "cameraMovement": "steady",
      "characters": ["Character1"]
    }
  ],
  "totalDurationSeconds": 30
}

CRITICAL RULES:
1. Each description should be 2-4 sentences, highly detailed for AI video generation
2. Never mention cameras, lenses, or filming equipment in descriptions
3. Use perspective-based language: "the view rises", "perspective approaches", "we see from above"
4. Ensure shots flow naturally from one to the next for seamless transitions`;

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

    // Normalize the response to ensure correct format
    const normalizedScenes = (scenesData.scenes || []).map((scene: any, index: number) => ({
      id: scene.id || `shot_${String(index + 1).padStart(3, '0')}`,
      index: scene.index ?? index,
      title: scene.title || `Shot ${index + 1}`,
      description: scene.description || scene.visualDescription || '',
      dialogue: scene.dialogue || scene.scriptText || '',
      durationSeconds: scene.durationSeconds || 5,
      mood: scene.mood || 'neutral',
      cameraMovement: scene.cameraMovement || 'steady',
      characters: scene.characters || [],
      status: 'pending',
    }));

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
