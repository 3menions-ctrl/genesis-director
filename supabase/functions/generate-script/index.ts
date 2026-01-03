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
      // Full movie script generation with characters
      systemPrompt = `You are an award-winning screenwriter and storyteller. You write compelling, emotionally engaging movie scripts with memorable characters, sharp dialogue, and cinematic visual descriptions.

Your scripts follow proper screenplay format:
- Scene headings in brackets: [SCENE: INT/EXT. LOCATION - TIME]
- Character names in CAPS when speaking
- Dialogue in quotes: "Like this"
- Action and descriptions in *asterisks*: *The hero steps forward*
- Parentheticals for emotion/direction: (whispering)
- Transitions: --- CUT TO: --- or --- FADE TO: ---

Create scripts that are:
1. Emotionally compelling with clear character arcs
2. Visually descriptive for AI video generation
3. Paced appropriately for the target duration
4. True to the specified genre and mood
5. Feature the named characters prominently with distinct voices`;

      // Build character descriptions
      const characterDescriptions = requestData.characters!.map(char => 
        `- ${char.name.toUpperCase()} (${char.role}): ${char.description}. Personality: ${char.personality}`
      ).join('\n');

      // Build the story structure guidance
      const structureGuide = {
        'three_act': 'Follow classic three-act structure: Setup (introduce characters/conflict), Confrontation (rising tension, obstacles), Resolution (climax and conclusion).',
        'hero_journey': "Follow the Hero's Journey: Ordinary World → Call to Adventure → Crossing the Threshold → Tests/Allies → Ordeal → Reward → Return.",
        'circular': 'Create a circular narrative where the ending mirrors or returns to the beginning, showing change through contrast.',
        'in_medias_res': 'Start in the middle of action, then weave in context through the narrative.',
        'episodic': 'Create connected vignettes or scenes that build a cohesive story.',
      }[requestData.storyStructure || 'three_act'];

      // Build intro style guidance
      const introGuide = {
        'cinematic': 'Open with an epic, sweeping introduction. Set the scene grandly with atmospheric description.',
        'documentary': 'Begin with a factual, grounded introduction that establishes context and stakes.',
        'dramatic': 'Start with a powerful character monologue or voiceover that draws the audience in.',
        'mystery': 'Open with an intriguing hook, question, or mysterious scene that creates immediate curiosity.',
        'none': 'Jump directly into the story without preamble.',
      }[requestData.movieIntroStyle || 'cinematic'];

      const wordTarget = (requestData.targetDurationMinutes || 5) * 150;

      userPrompt = `Write a complete ${requestData.targetDurationMinutes || 5}-minute movie script.

TITLE: "${requestData.title}"
GENRE: ${requestData.genre || 'Drama'}
MOOD: ${requestData.mood || 'Epic & Grand'}
SETTING: ${requestData.setting || 'Modern day'}
TIME PERIOD: ${requestData.timePeriod || 'Present Day'}

CHARACTERS:
${characterDescriptions}

STORY STRUCTURE: ${structureGuide}

OPENING STYLE: ${introGuide}

${requestData.synopsis ? `SYNOPSIS/CONCEPT: ${requestData.synopsis}` : ''}

${requestData.previousScript ? `
PREVIOUS STORY (Continue from this):
${requestData.previousScript.slice(0, 1000)}...

Write a ${requestData.continuationType || 'sequel'} that continues this story.
` : ''}

REQUIREMENTS:
- Write approximately ${wordTarget} words
- Feature ALL named characters with distinct dialogue and personality
- Include vivid visual descriptions suitable for AI video generation
- Create emotional beats and character development
- Use proper screenplay formatting
- Make the dialogue natural and memorable
- Include scene transitions and pacing for ${requestData.targetDurationMinutes} minutes
- Ensure the ${requestData.characters![0]?.name || 'protagonist'} has a clear arc

Begin the script now:`;

    } else {
      // Legacy simple mode for backwards compatibility
      systemPrompt = `You are a professional video script writer for Apex Studio, an AI video production platform. 
Create engaging, natural-sounding scripts that work well with AI voice narration.
The script should be clear, conversational, and optimized for video presentation.
Include natural pauses indicated by "..." and emphasis with *asterisks*.
Keep sentences short and punchy for better AI voice rendering.`;

      userPrompt = `Write a ${requestData.duration || '60 second'} video script about: ${requestData.topic}
Style: ${requestData.style || 'Professional and engaging'}

Requirements:
- Start with an attention-grabbing hook
- Use conversational language
- Include 2-3 key points
- End with a clear call-to-action
- Optimize for AI voice narration`;
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
