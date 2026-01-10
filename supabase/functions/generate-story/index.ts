import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReferenceAnalysis {
  characterIdentity?: {
    description?: string;
    facialFeatures?: string;
    clothing?: string;
    bodyType?: string;
    distinctiveMarkers?: string[];
  };
  environment?: {
    setting?: string;
    geometry?: string;
    keyObjects?: string[];
    backgroundElements?: string[];
  };
  lighting?: {
    style?: string;
    direction?: string;
    quality?: string;
    timeOfDay?: string;
  };
  colorPalette?: {
    dominant?: string[];
    accent?: string[];
    mood?: string;
  };
  consistencyPrompt?: string;
}

interface StoryRequest {
  prompt: string;
  genre?: string;
  mood?: string;
  style?: string;
  targetDurationSeconds?: number;
  referenceAnalysis?: ReferenceAnalysis;
}

interface StoryResponse {
  success: boolean;
  story?: string;
  title?: string;
  synopsis?: string;
  estimatedScenes?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: StoryRequest = await req.json();
    console.log("[GenerateStory] Request:", JSON.stringify(request, null, 2));

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    if (!request.prompt || request.prompt.trim().length < 3) {
      throw new Error("Please provide a story prompt");
    }

    const targetDuration = request.targetDurationSeconds || 30;
    const estimatedScenes = Math.max(2, Math.min(12, Math.ceil(targetDuration / 5)));

    const systemPrompt = `You are a professional SCREENWRITER and STORYTELLER. Your job is to write a complete, CONTINUOUS NARRATIVE story that flows naturally from beginning to end.

STORY STRUCTURE (MANDATORY):
1. OPENING HOOK (10%): Establish character and world immediately. First sentence grabs attention.
2. SETUP (15%): Introduce the situation, stakes, and what the character wants.
3. CATALYST (10%): An event that disrupts the status quo and sets the story in motion.
4. RISING ACTION (30%): Character pursues goal, faces obstacles, tension builds.
5. CLIMAX (15%): The decisive moment - highest tension, most important action.
6. RESOLUTION (20%): Aftermath, character changed, satisfying conclusion.

NARRATIVE CONTINUITY RULES (CRITICAL):
1. CHARACTER CONSISTENCY: The protagonist looks, acts, and feels the same throughout
   - Describe their appearance ONCE clearly, then reference specific details
   - Their clothing does NOT change unless the story requires it
   - Their emotional state evolves logically based on events
   
2. SETTING CONSISTENCY: Each location maintains its established characteristics
   - Lighting, weather, and time of day stay consistent within a scene
   - Environmental details mentioned early remain present later
   
3. CAUSE & EFFECT: Every event follows logically from what came before
   - Character actions have consequences shown in subsequent scenes
   - No unexplained jumps or gaps in logic
   
4. TEMPORAL FLOW: Time progresses naturally
   - Use transitional phrases: "moments later", "as she", "then"
   - Avoid jarring time skips without clear indication

5. EMOTIONAL THREAD: The emotional journey is continuous
   - Feelings build on previous feelings
   - Reactions are proportional to events

VISUAL STORYTELLING (FOR AI VIDEO):
- Write in present tense, vivid prose with VISUAL descriptions
- Include sensory details: what we SEE, HEAR, and FEEL
- Describe character actions, expressions, and movements
- Include environment and setting details
- Each scene should flow naturally into the next - no abrupt jumps
- The story should be CINEMATIC - think of it as describing what would appear on screen

OUTPUT FORMAT:
Write the story as flowing paragraphs. Use line breaks between major story beats.
Each paragraph should represent a continuous visual moment.
The story should be approximately ${Math.ceil(targetDuration / 5) * 50}-${Math.ceil(targetDuration / 5) * 80} words (${estimatedScenes} scenes worth of content).

DO NOT:
- Use numbered shots or scene headers
- Break into disconnected scenes
- Use technical film terminology
- Include camera directions
- Write dialogue in script format
- Change character appearance without explanation

DO:
- Write prose that reads like a short story
- Use vivid, visual descriptions
- Include natural dialogue woven into the narrative
- Create emotional arcs with clear progression
- Ensure visual and thematic continuity throughout
- Make every sentence advance the story or reveal character`;

    // Build reference image context if available
    let referenceContext = '';
    if (request.referenceAnalysis) {
      const ref = request.referenceAnalysis;
      const parts: string[] = [];
      
      if (ref.characterIdentity?.description) {
        parts.push(`MAIN CHARACTER: ${ref.characterIdentity.description}`);
        if (ref.characterIdentity.clothing) parts.push(`Wearing: ${ref.characterIdentity.clothing}`);
        if (ref.characterIdentity.distinctiveMarkers?.length) {
          parts.push(`Distinctive features: ${ref.characterIdentity.distinctiveMarkers.join(', ')}`);
        }
      }
      
      if (ref.environment?.setting) {
        parts.push(`SETTING: ${ref.environment.setting}`);
        if (ref.environment.keyObjects?.length) {
          parts.push(`Key elements: ${ref.environment.keyObjects.join(', ')}`);
        }
      }
      
      if (ref.lighting?.style) {
        parts.push(`LIGHTING: ${ref.lighting.style}${ref.lighting.timeOfDay ? ` (${ref.lighting.timeOfDay})` : ''}`);
      }
      
      if (ref.colorPalette?.mood) {
        parts.push(`COLOR MOOD: ${ref.colorPalette.mood}`);
      }
      
      if (parts.length > 0) {
        referenceContext = `\n\nVISUAL REFERENCE (incorporate these elements into the story):\n${parts.join('\n')}`;
      }
    }

    const userPrompt = `Write a continuous, cinematic story based on this concept:

"${request.prompt}"

${request.genre ? `Genre: ${request.genre}` : ''}
${request.mood ? `Mood/Tone: ${request.mood}` : ''}
${request.style ? `Visual Style: ${request.style}` : ''}${referenceContext}

The story should be suitable for a ${targetDuration}-second video (approximately ${estimatedScenes} visual scenes).
${request.referenceAnalysis ? '\nIMPORTANT: The story MUST feature the character and setting described in the VISUAL REFERENCE above. Maintain consistency with their appearance throughout.' : ''}

Write the complete story now:`;

    console.log("[GenerateStory] Calling OpenAI API...");

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
        max_tokens: 2000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[GenerateStory] OpenAI API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid OpenAI API key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const story = data.choices?.[0]?.message?.content || '';

    if (!story.trim()) {
      throw new Error("Failed to generate story content");
    }

    // Generate a title from the story
    const titleResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Generate a short, catchy title (3-6 words) for this story. Return ONLY the title, no quotes or extra text." },
          { role: "user", content: story.substring(0, 500) },
        ],
        max_tokens: 20,
      }),
    });

    let title = request.prompt.substring(0, 50);
    if (titleResponse.ok) {
      const titleData = await titleResponse.json();
      const generatedTitle = titleData.choices?.[0]?.message?.content?.trim();
      if (generatedTitle && generatedTitle.length < 60) {
        title = generatedTitle.replace(/^["']|["']$/g, '');
      }
    }

    // Create a one-line synopsis
    const synopsis = story.split('\n')[0].substring(0, 200) + (story.length > 200 ? '...' : '');

    const generationTimeMs = Date.now() - startTime;
    console.log(`[GenerateStory] Generated story in ${generationTimeMs}ms, ${story.length} chars`);

    return new Response(
      JSON.stringify({
        success: true,
        story,
        title,
        synopsis,
        estimatedScenes,
        generationTimeMs,
        usage: data.usage,
      } as StoryResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[GenerateStory] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
