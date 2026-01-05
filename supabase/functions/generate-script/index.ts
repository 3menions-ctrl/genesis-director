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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;
    
    // Check if this is a full movie request with characters OR if fullMovieMode flag is set
    const hasCharacters = requestData.characters && requestData.characters.length > 0;
    const isFullMovieMode = requestData.title && (hasCharacters || requestData.synopsis);
    
    if (isFullMovieMode) {
      // Full movie script generation - CINEMATIC & DESCRIPTIVE
      systemPrompt = `You are an elite cinematographer-screenwriter. You write scripts that are VISUAL MASTERPIECES - every scene reads like a painting that an AI video generator can recreate perfectly.

Your scripts are famous for:
1. RICH ENVIRONMENTAL DESCRIPTIONS - Lighting, weather, atmosphere, textures, colors. Example: "Late afternoon sun filters through oak trees, casting long shadows across the moss-covered path."

2. PRECISE CHARACTER VISUALS - Appearance, clothing, movements, expressions. Example: "HANNAH, 20s, auburn hair catching the light, curled comfortably on a plush grey couch, bare feet tucked beneath her."

3. CAMERA-AWARE WRITING - Write with an invisible camera: "We slowly push in on her face... The camera holds on her thoughtful expression..."

4. ATMOSPHERIC IMMERSION - Sound design, time of day, emotional tone.

FORMAT:
- Scene headings: [SCENE: INT/EXT. LOCATION - TIME OF DAY]
- Visual descriptions in *asterisks*
- Character introductions with full physical description
- Dialogue in quotes with (emotional direction)
- Camera directions in [CAMERA: movement]

CRITICAL: Follow the user's concept EXACTLY. Do not add characters or plotlines they didn't request. If they want someone sitting on a couch, write about that - don't invent adventures or conflicts unless asked.`;

      // Build character descriptions if provided
      const characterDescriptions = hasCharacters 
        ? requestData.characters!.map(char => 
            `- ${char.name.toUpperCase()} (${char.role}): ${char.description}. Personality: ${char.personality}.`
          ).join('\n')
        : '';

      const wordTarget = (requestData.targetDurationMinutes || 5) * 150;

      userPrompt = `Write a ${requestData.targetDurationMinutes || 5}-minute movie script that EXACTLY follows this concept:

TITLE: "${requestData.title}"
GENRE: ${requestData.genre || 'Drama'}
MOOD: ${requestData.mood || 'Atmospheric'}
SETTING: ${requestData.setting || 'Modern day interior'}

${requestData.synopsis ? `USER'S CONCEPT (FOLLOW THIS EXACTLY): ${requestData.synopsis}` : ''}

${characterDescriptions ? `CHARACTERS:\n${characterDescriptions}` : ''}

REQUIREMENTS:
- Write approximately ${wordTarget} words
- EVERY SCENE must have: lighting, environment details, atmosphere
- Describe characters visually: appearance, clothing, expressions
- Include CAMERA DIRECTIONS: [CAMERA: slow push-in], [CAMERA: close-up]
- Stay TRUE to the user's concept - if they want a simple scene, keep it simple
- Don't add unnecessary drama or adventure unless requested

Begin the script now:`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: isFullMovieMode ? 4000 : 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
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
