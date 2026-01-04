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
    
    // Check if this is a full movie request or simple topic request
    const isFullMovieMode = requestData.title && requestData.characters && requestData.characters.length > 0;
    
    if (isFullMovieMode) {
      // Full movie script generation with characters - CINEMATIC & DESCRIPTIVE
      systemPrompt = `You are an elite cinematographer-screenwriter hybrid. You write scripts that are VISUAL MASTERPIECES - every scene reads like a painting, every moment is described with such vivid detail that an AI video generator can recreate it perfectly.

Your scripts are famous for:
1. RICH ENVIRONMENTAL DESCRIPTIONS - You paint every setting in exquisite detail: lighting conditions, weather, atmosphere, textures, colors, depth, scale. Example: "The amber glow of late afternoon sun filters through ancient oak trees, casting long shadows across the moss-covered stone path. Mist rises from the distant valley below."

2. PRECISE CHARACTER VISUALS - Every character is described cinematically: their appearance, clothing, movements, expressions, posture. Example: "MAYA, 30s, sharp green eyes beneath rain-soaked dark hair, her weathered leather jacket glistening as she steps into the doorway, jaw clenched with determination."

3. CAMERA-AWARE WRITING - You write with an invisible camera in mind: "We push slowly through the crowd... The camera lingers on his trembling hands... A sweeping aerial reveals the vast desert below..."

4. ATMOSPHERIC IMMERSION - Sound design, weather, time of day, emotional tone. Example: "Thunder rumbles in the distance. The crackling fire casts dancing shadows on the cave walls. Outside, rain hammers the leaves."

5. TRANSITION MASTERY - Seamless visual bridges between scenes: "MATCH CUT from the spinning coin to the spinning Earth from orbit..."

FORMAT:
- Scene headings: [SCENE: INT/EXT. LOCATION - TIME OF DAY - WEATHER/ATMOSPHERE]
- Visual descriptions in *asterisks with rich detail*
- Character introductions with full physical description on first appearance
- Dialogue in quotes with (emotional direction)
- Camera directions in [CAMERA: movement/angle]
- Transitions: --- CUT TO: --- or --- FADE TO: --- or --- DISSOLVE TO: ---`;

      // Build character descriptions with visual details
      const characterDescriptions = requestData.characters!.map(char => 
        `- ${char.name.toUpperCase()} (${char.role}): ${char.description}. Personality: ${char.personality}. IMPORTANT: Describe their exact appearance, clothing, and distinctive visual traits in their first scene.`
      ).join('\n');

      // Build the story structure guidance
      const structureGuide = {
        'three_act': 'Follow classic three-act structure: Setup (introduce characters/conflict), Confrontation (rising tension, obstacles), Resolution (climax and conclusion).',
        'hero_journey': "Follow the Hero's Journey: Ordinary World → Call to Adventure → Crossing the Threshold → Tests/Allies → Ordeal → Reward → Return.",
        'circular': 'Create a circular narrative where the ending mirrors or returns to the beginning, showing change through contrast.',
        'in_medias_res': 'Start in the middle of action, then weave in context through the narrative.',
        'episodic': 'Create connected vignettes or scenes that build a cohesive story.',
      }[requestData.storyStructure || 'three_act'];

      // Build intro style guidance with visual emphasis
      const introGuide = {
        'cinematic': 'Open with an EPIC establishing shot - describe the landscape from above, slowly descending into the scene. Set atmosphere with weather, lighting, and environmental details.',
        'documentary': 'Begin with authentic, grounded visuals. Real locations, natural lighting, candid character moments.',
        'dramatic': 'Start with an intense close-up or powerful visual metaphor that sets the emotional tone.',
        'mystery': 'Open with partial reveals - shadows, silhouettes, fragments of the scene that create intrigue.',
        'none': 'Jump directly into action but still describe the visual environment clearly.',
      }[requestData.movieIntroStyle || 'cinematic'];

      const wordTarget = (requestData.targetDurationMinutes || 5) * 150;

      userPrompt = `Write a VISUALLY STUNNING ${requestData.targetDurationMinutes || 5}-minute movie script that an AI video generator can bring to life perfectly.

TITLE: "${requestData.title}"
GENRE: ${requestData.genre || 'Drama'}
MOOD: ${requestData.mood || 'Epic & Grand'}
SETTING: ${requestData.setting || 'Modern day'}
TIME PERIOD: ${requestData.timePeriod || 'Present Day'}

CHARACTERS (describe EXACTLY how each looks in their first appearance):
${characterDescriptions}

STORY STRUCTURE: ${structureGuide}

OPENING STYLE: ${introGuide}

${requestData.synopsis ? `SYNOPSIS/CONCEPT: ${requestData.synopsis}` : ''}

${requestData.previousScript ? `
PREVIOUS STORY (Continue from this):
${requestData.previousScript.slice(0, 1000)}...

Write a ${requestData.continuationType || 'sequel'} that continues this story with VISUAL CONSISTENCY - same character appearances, similar visual style.
` : ''}

CRITICAL REQUIREMENTS FOR AI VIDEO GENERATION:
- Write approximately ${wordTarget} words
- EVERY SCENE must have: lighting description, environment details, atmosphere, weather if outdoors
- EVERY CHARACTER must be described visually: age, build, hair, eyes, clothing, distinctive features
- Include CAMERA DIRECTIONS: [CAMERA: slow push-in], [CAMERA: sweeping aerial], [CAMERA: close-up on hands]
- Describe COLORS, TEXTURES, MATERIALS: "polished mahogany desk", "weathered stone walls", "shimmering silk gown"
- Include MOVEMENT descriptions: how characters walk, gesture, express emotion physically
- Use SENSORY details: sounds, smells, tactile sensations that create atmosphere
- Create VISUAL TRANSITIONS between scenes that flow cinematically
- Maintain VISUAL CONSISTENCY: same character looks, same color palette, same lighting style throughout

REMEMBER: The AI video generator can ONLY see what you describe. If you don't describe it, it won't appear. Be extraordinarily specific and visual.

Begin the script now:`;

    } else {
      // Legacy simple mode - enhanced for visual description
      systemPrompt = `You are a visual storyteller for Apex Studio, an AI video production platform. 
You write scripts that are VISUALLY RICH - describing scenes, environments, and imagery with cinematic precision.
Every sentence should paint a picture. Include specific visual details: colors, lighting, textures, movements.
The script should work as both narration AND visual direction for AI video generation.
Include natural pauses indicated by "..." and emphasis with *asterisks*.
After each key point, add a [VISUAL: description] tag describing what should appear on screen.`;

      userPrompt = `Write a VISUALLY DESCRIPTIVE ${requestData.duration || '60 second'} video script about: ${requestData.topic}
Style: ${requestData.style || 'Professional and engaging'}

Requirements:
- Start with an attention-grabbing hook AND describe the opening visual
- For each key point, describe what the viewer should SEE
- Include [VISUAL: ...] tags describing specific imagery: environments, objects, lighting, colors
- Use descriptive language: "golden sunlight streaming through windows" not just "bright room"
- Describe any people/characters: their appearance, clothing, expressions
- End with a memorable final image
- Make it easy for AI video to visualize every moment

Example format:
"Welcome to the future of technology..."
[VISUAL: Sleek glass skyscraper reflecting sunset colors, camera slowly rising upward]

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
