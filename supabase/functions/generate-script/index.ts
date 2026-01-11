import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CharacterInput {
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'narrator';
  description: string;
  personality: string;
}

interface StoryRequest {
  // Legacy simple mode
  topic?: string;
  style?: string;
  duration?: string;
  
  // Full movie mode
  title?: string;
  genre?: string;
  storyStructure?: string;
  targetDurationMinutes?: number;
  setting?: string;
  timePeriod?: string;
  mood?: string;
  movieIntroStyle?: string;
  characters?: CharacterInput[];
  synopsis?: string;
  
  // Continuation mode
  previousScript?: string;
  continuationType?: 'sequel' | 'prequel' | 'episode';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: StoryRequest = await req.json();
    
    console.log("Generating script for:", JSON.stringify(requestData, null, 2));

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;
    
    // Check if this is a full movie request with characters OR if fullMovieMode flag is set
    const hasCharacters = requestData.characters && requestData.characters.length > 0;
    const isFullMovieMode = requestData.title && (hasCharacters || requestData.synopsis);
    
    if (isFullMovieMode) {
      // Full movie script generation - MINIMUM 6 SHOTS with smooth transitions and buffer shots
      systemPrompt = `You write cinematic scripts for AI video generation and stitching. MINIMUM 6 shots, each 6 seconds.

FORMAT (use exactly this):
[SHOT 1] Visual description with motion and physics.
[SHOT 2] Visual description continuing the motion seamlessly.
...continue for all shots...

CRITICAL: BUFFER SHOTS FOR SMOOTH STITCHING
When transitioning between significantly different scenes, include BUFFER SHOTS:
- ENVIRONMENTAL PAUSE: Wide establishing shot before new location
- REACTION BEAT: Close-up of subject processing the moment
- OBJECT DETAIL: Focus on prop/element to bridge scenes
- TRANSITIONAL MOVEMENT: Camera movement that bridges locations

INSERT BUFFER SHOTS:
- Before major location changes (interior → exterior)
- After intense action sequences (fight → calm moment)
- When changing primary subjects
- At emotional tone shifts

CINEMATIC TRANSITION RULES (CRITICAL):
1. PHYSICS CONTINUITY: If shot ends with motion (falling, running, reaching), next shot MUST continue that momentum OR use buffer shot
2. SPATIAL FLOW: Camera perspective flows naturally - if ending on a close-up, use a buffer to reset OR continue movement
3. MATCH-ACTION: Character's gesture/movement at end of one shot continues at start of next
4. LIGHTING BRIDGE: Maintain consistent light direction across cuts, or use buffer to establish new lighting
5. GAZE DIRECTION: If character looks left at end, next shot shows what they see OR buffer establishes new POV

MOTION REQUIREMENTS:
- Every shot includes visible movement (character action, physics motion, or camera drift)
- End each shot with momentum that carries into the next OR with a neutral "safe" position
- For difficult transitions, use a BUFFER SHOT with establishing/detail content
- Describe body mechanics: weight shifts, reach, tension, release

RULES:
- MINIMUM 6 shots (add buffer shots as needed for smooth flow)
- Each shot is EXACTLY 6 seconds
- Rich visual descriptions with motion and physics
- Every transition must be seamless - use buffer shots for major scene changes
- NO static scenes - always movement (even buffer shots have subtle motion)`;

      // Build character descriptions if provided
      const characterDescriptions = hasCharacters 
        ? requestData.characters!.map(char => 
            `${char.name}: ${char.description.split('.')[0]}`
          ).join(', ')
        : '';

      userPrompt = `Write MINIMUM 6 shots (more if needed, include buffer shots for smooth stitching) for: "${requestData.title}"
Genre: ${requestData.genre || 'Drama'}
${requestData.synopsis ? `Concept: ${requestData.synopsis.substring(0, 200)}` : ''}
${characterDescriptions ? `Characters: ${characterDescriptions}` : ''}

CRITICAL: 
- Each shot must transition SMOOTHLY into the next
- Use BUFFER SHOTS (establishing, detail, reaction beats) between major scene changes
- This will be stitched by AI, so ensure visual continuity
MINIMUM 6 SHOTS. Rich visual descriptions. Go:`;

    } else {
      // Legacy simple mode - for topic-based requests
      systemPrompt = `You are a visual storyteller. Write scripts that are VISUALLY RICH with cinematic precision.
Include specific visual details: colors, lighting, textures, movements.
After each key point, add a [VISUAL: description] tag.`;

      // Use synopsis OR topic for the content
      const content = requestData.synopsis || requestData.topic || 'a visually engaging scene';

      userPrompt = `Write a VISUALLY DESCRIPTIVE ${requestData.duration || '60 second'} video script about: ${content}
Style: ${requestData.style || 'Professional and engaging'}
Title: ${requestData.title || 'Untitled'}

Requirements:
- Follow the user's concept EXACTLY
- Start with an attention-grabbing hook AND opening visual
- Include [VISUAL: ...] tags describing imagery
- Use descriptive language for environments and characters
- Keep the script focused on what the user asked for

Write the script now:`;
    }

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
          { role: "user", content: userPrompt },
        ],
        max_tokens: isFullMovieMode ? 800 : 400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid OpenAI API key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const script = data.choices?.[0]?.message?.content;
    
    console.log("Script generated successfully, length:", script?.length);

    return new Response(
      JSON.stringify({ 
        success: true,
        script,
        title: requestData.title,
        genre: requestData.genre,
        characters: requestData.characters?.map(c => c.name),
        wordCount: script?.split(/\s+/).length || 0,
        estimatedDuration: Math.ceil((script?.split(/\s+/).length || 0) / 150),
        model: "google/gemini-2.5-flash",
        usage: data.usage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-script function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
