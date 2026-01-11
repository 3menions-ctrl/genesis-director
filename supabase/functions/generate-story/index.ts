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
  // NEW: Scene-based story generation
  sceneMode?: 'single_scene' | 'multi_scene' | 'episode';
  episodeNumber?: number;
  previousSceneSummary?: string;
  totalEpisodes?: number;
}

interface SceneDescription {
  sceneNumber: number;
  location: string;
  timeOfDay: string;
  characters: string[];
  actionProgression: string[]; // 6 progressive actions for 6 clips
  emotionalArc: string;
  visualStyle: string;
}

interface StoryResponse {
  success: boolean;
  story?: string;
  title?: string;
  synopsis?: string;
  estimatedScenes?: number;
  // NEW: Scene-based data
  sceneMode?: string;
  sceneDescription?: SceneDescription;
  episodeInfo?: {
    episodeNumber: number;
    totalEpisodes: number;
    episodeTitle: string;
    previousSummary?: string;
    nextTeaser?: string;
  };
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

    const targetDuration = request.targetDurationSeconds || 24;
    const sceneMode = request.sceneMode || 'single_scene';

    // SCENE-BASED SYSTEM PROMPT
    const systemPrompt = `You are a SCENE WRITER for AI video generation. Your job is to write ONE CONTINUOUS SCENE that unfolds across 6 connected clips.

CRITICAL CONCEPT: SCENE vs STORY
- A SCENE is ONE continuous moment in ONE location with ONE action sequence
- A STORY spans multiple scenes/episodes
- Each 36-second video = 1 SCENE = 6 clips of 6 seconds each
- The 6 clips show PROGRESSIVE ACTION within the SAME moment

SCENE STRUCTURE (6 PROGRESSIVE CLIPS):
Each clip must be a CONTINUATION of the previous clip, like frames in a movie:

CLIP 1 - ESTABLISH: Set the scene. Character in location. Initial state.
CLIP 2 - INITIATE: Action begins. First movement or change.
CLIP 3 - DEVELOP: Action progresses. Continuation of movement.
CLIP 4 - ESCALATE: Intensity increases. Action builds momentum.
CLIP 5 - PEAK: Highest point of action in this scene.
CLIP 6 - SETTLE: Action concludes for this scene. Holds for next scene.

CRITICAL RULES FOR CONTINUOUS FLOW:

1. SAME LOCATION: All 6 clips are in the EXACT same place
   - NO location changes within a scene
   - Same room, same street, same forest clearing
   - Background elements stay consistent
   
2. CONTINUOUS TIME: No time jumps within a scene
   - Clip 2 starts where Clip 1 ends
   - If character is mid-step in Clip 3, they complete the step in Clip 4
   - Total time elapsed in scene: ~36 seconds of story time
   
3. CONSISTENT LIGHTING: Same light throughout
   - Sun position doesn't change
   - Indoor lighting remains fixed
   - Shadows stay consistent
   
4. PROGRESSIVE ACTION: Each clip advances ONE beat
   - Character walks toward door (1) → reaches for handle (2) → opens it (3) → steps through (4) → looks around (5) → sees something (6)
   - NOT: walks (1) → arrives at destination (2) ← TOO BIG A JUMP
   
5. CONTINUOUS CHARACTER STATE:
   - Same clothes, same hairstyle, same accessories
   - Emotional state evolves smoothly
   - Physical position connects between clips

OUTPUT FORMAT:
Write the scene as 6 connected paragraphs, each describing 6 seconds of continuous action.
Label each: [CLIP 1], [CLIP 2], etc.
End each clip at a moment that naturally flows into the next.
Include: character description (consistent across all clips), exact location, lighting, and progressive action.

${sceneMode === 'episode' ? `
EPISODE MODE:
This is Episode ${request.episodeNumber || 1} of ${request.totalEpisodes || 5}.
${request.previousSceneSummary ? `Previous episode ended with: ${request.previousSceneSummary}` : 'This is the first episode.'}
Start from where the previous episode left off.
End with a moment that leads into the next episode.
` : ''}`;

    // Build reference image context if available
    let referenceContext = '';
    if (request.referenceAnalysis) {
      const ref = request.referenceAnalysis;
      const parts: string[] = [];
      
      if (ref.characterIdentity?.description) {
        parts.push(`MAIN CHARACTER (use EXACTLY in all clips): ${ref.characterIdentity.description}`);
        if (ref.characterIdentity.clothing) parts.push(`Wearing: ${ref.characterIdentity.clothing}`);
        if (ref.characterIdentity.distinctiveMarkers?.length) {
          parts.push(`Distinctive features: ${ref.characterIdentity.distinctiveMarkers.join(', ')}`);
        }
      }
      
      if (ref.environment?.setting) {
        parts.push(`LOCATION (same for all clips): ${ref.environment.setting}`);
        if (ref.environment.keyObjects?.length) {
          parts.push(`Key elements: ${ref.environment.keyObjects.join(', ')}`);
        }
      }
      
      if (ref.lighting?.style) {
        parts.push(`LIGHTING (consistent): ${ref.lighting.style}${ref.lighting.timeOfDay ? ` (${ref.lighting.timeOfDay})` : ''}`);
      }
      
      if (ref.colorPalette?.mood) {
        parts.push(`COLOR MOOD: ${ref.colorPalette.mood}`);
      }
      
      if (parts.length > 0) {
        referenceContext = `\n\nVISUAL REFERENCE (incorporate EXACTLY into ALL 6 clips):\n${parts.join('\n')}`;
      }
    }

    const userPrompt = `Write ONE CONTINUOUS SCENE based on this concept:

"${request.prompt}"

${request.genre ? `Genre: ${request.genre}` : ''}
${request.mood ? `Mood/Tone: ${request.mood}` : ''}
${request.style ? `Visual Style: ${request.style}` : ''}${referenceContext}

This scene will be a ${targetDuration}-second video made of 6 clips (6 seconds each).
All 6 clips must show CONTINUOUS PROGRESSIVE ACTION in the SAME location.

${sceneMode === 'episode' && request.previousSceneSummary ? `
CONTINUE FROM: ${request.previousSceneSummary}
` : ''}

Write the scene now with [CLIP 1] through [CLIP 6] labels:`;

    console.log("[GenerateStory] Calling OpenAI API for scene-based generation...");

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
        temperature: 0.7,
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
      throw new Error("Failed to generate scene content");
    }

    // Extract clip descriptions for scene description
    const clipMatches = story.matchAll(/\[CLIP (\d+)\]([\s\S]*?)(?=\[CLIP \d+\]|$)/g);
    const actionProgression: string[] = [];
    for (const match of clipMatches) {
      const clipContent = match[2].trim().split('\n')[0].substring(0, 100);
      actionProgression.push(clipContent);
    }

    // Generate a title from the scene
    const titleResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Generate a short, evocative title (3-6 words) for this scene. Return ONLY the title, no quotes." },
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

    // Create scene description
    const sceneDescription: SceneDescription = {
      sceneNumber: request.episodeNumber || 1,
      location: request.referenceAnalysis?.environment?.setting || 'Extracted from scene',
      timeOfDay: request.referenceAnalysis?.lighting?.timeOfDay || 'Extracted from scene',
      characters: request.referenceAnalysis?.characterIdentity?.description 
        ? [request.referenceAnalysis.characterIdentity.description]
        : [],
      actionProgression,
      emotionalArc: request.mood || 'building tension',
      visualStyle: request.style || 'cinematic',
    };

    // Create a one-line synopsis
    const synopsis = story.split('\n').find((line: string) => line.includes('[CLIP 1]'))?.replace('[CLIP 1]', '').trim().substring(0, 200) || story.substring(0, 200);

    const generationTimeMs = Date.now() - startTime;
    console.log(`[GenerateStory] Generated scene in ${generationTimeMs}ms, ${story.length} chars, ${actionProgression.length} clips`);

    const responseData: StoryResponse = {
      success: true,
      story,
      title,
      synopsis,
      estimatedScenes: 6, // Always 6 clips per scene
      sceneMode,
      sceneDescription,
    };

    if (sceneMode === 'episode') {
      responseData.episodeInfo = {
        episodeNumber: request.episodeNumber || 1,
        totalEpisodes: request.totalEpisodes || 5,
        episodeTitle: title,
        previousSummary: request.previousSceneSummary,
        nextTeaser: actionProgression[5] || 'To be continued...',
      };
    }

    return new Response(
      JSON.stringify({
        ...responseData,
        generationTimeMs,
        usage: data.usage,
      }),
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
