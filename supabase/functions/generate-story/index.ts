import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DetectedContent {
  hasDialogue: boolean;
  hasNarration: boolean;
  dialogueLines: string[];
  narrationText: string;
  estimatedDurationSeconds: number;
  recommendedClipCount: number;
}

/**
 * Detect dialogue and narration from user input
 */
function detectUserContent(text: string): DetectedContent {
  const dialogueLines: string[] = [];
  let narrationText = '';
  
  // Detect quoted dialogue
  const quotedRegex = /"([^"]+)"/g;
  let match;
  while ((match = quotedRegex.exec(text)) !== null) {
    dialogueLines.push(match[1]);
  }
  
  // Detect character dialogue patterns
  const characterDialogueRegex = /([A-Z][A-Z\s]+):\s*["']?([^"'\n]+)["']?/g;
  while ((match = characterDialogueRegex.exec(text)) !== null) {
    if (!dialogueLines.includes(match[2].trim())) {
      dialogueLines.push(match[2].trim());
    }
  }
  
  // Detect "says" pattern
  const saysRegex = /([A-Z][a-z]+)\s+says?\s*[,:]\s*["']([^"']+)["']/gi;
  while ((match = saysRegex.exec(text)) !== null) {
    if (!dialogueLines.includes(match[2].trim())) {
      dialogueLines.push(match[2].trim());
    }
  }
  
  // Detect narration patterns
  const narrationPatterns = [
    /\[NARRATION\]:?\s*([^\[\]]+)/gi,
    /\(voiceover\):?\s*([^\(\)]+)/gi,
    /\(V\.?O\.?\):?\s*([^\(\)]+)/gi,
    /VO:?\s*["']?([^"'\n]+)["']?/gi,
    /NARRATOR:?\s*["']?([^"'\n]+)["']?/gi,
  ];
  
  for (const pattern of narrationPatterns) {
    while ((match = pattern.exec(text)) !== null) {
      narrationText += (narrationText ? ' ' : '') + match[1].trim();
    }
  }
  
  // If no explicit narration found but text has prose-like structure
  if (!narrationText && dialogueLines.length === 0) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length >= 2) {
      narrationText = text;
    }
  }
  
  const allText = [...dialogueLines, narrationText].join(' ');
  const wordCount = allText.split(/\s+/).filter(w => w.length > 0).length;
  
  const WORDS_PER_SECOND = 2.5;
  const CLIP_DURATION = 5; // Kling 2.6: 5-second clips
  const WORDS_PER_CLIP = WORDS_PER_SECOND * CLIP_DURATION;
  
  const estimatedDurationSeconds = Math.ceil(wordCount / WORDS_PER_SECOND);
  let recommendedClipCount = Math.max(6, Math.ceil(wordCount / WORDS_PER_CLIP));
  recommendedClipCount = Math.min(recommendedClipCount, 20);
  
  return {
    hasDialogue: dialogueLines.length > 0,
    hasNarration: narrationText.length > 0,
    dialogueLines,
    narrationText,
    estimatedDurationSeconds,
    recommendedClipCount,
  };
}

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
  // CRITICAL: Explicit clip count and duration from user selection
  clipCount?: number;         // User's explicit clip count (1-20)
  clipDuration?: number;      // User's explicit duration per clip (5 or 10 seconds)
  referenceAnalysis?: ReferenceAnalysis;
  // Scene-based story generation
  sceneMode?: 'single_scene' | 'multi_scene' | 'episode';
  episodeNumber?: number;
  previousSceneSummary?: string;
  totalEpisodes?: number;
  // USER-PROVIDED CONTENT - must be preserved exactly
  userNarration?: string;      // User's exact narration text
  userDialogue?: string[];     // User's exact dialogue lines  
  userScript?: string;         // User's complete script (use as-is)
  preserveUserContent?: boolean; // Flag to ensure user content is kept verbatim
  // ENVIRONMENT DNA - Applied from Environments page
  environmentPrompt?: string;  // Full environment description for scene consistency
  // VOICE/NARRATION CONTROL - when false, NO dialogue or narration should be generated
  includeVoice?: boolean;
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

    // AUTO-DETECT dialogue and narration from user's prompt
    const inputText = [
      request.prompt || '',
      request.userNarration || '',
      ...(request.userDialogue || []),
    ].join(' ');
    
    const detectedContent = detectUserContent(inputText);
    console.log(`[GenerateStory] Detected: ${detectedContent.dialogueLines.length} dialogue lines, narration: ${detectedContent.hasNarration}, clips: ${detectedContent.recommendedClipCount}`);

    // Check if user provided their own complete script - use it directly
    if (request.userScript && request.userScript.trim().length > 50) {
      console.log("[GenerateStory] Using user-provided script directly");
      
      return new Response(
        JSON.stringify({
          success: true,
          story: request.userScript.trim(),
          title: request.prompt.substring(0, 50),
          synopsis: request.userScript.substring(0, 200),
          estimatedScenes: detectedContent.recommendedClipCount,
          source: 'user_provided',
          detectedContent,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // VOICE CONTROL: If includeVoice is explicitly false, NEVER include dialogue or narration
    const voiceDisabled = request.includeVoice === false;
    if (voiceDisabled) {
      console.log("[GenerateStory] ⚠️ VOICE DISABLED - Skipping ALL dialogue/narration detection");
    }
    
    // Use detected content if no explicit user content provided - BUT ONLY if voice is enabled
    let hasUserNarration = false;
    let hasUserDialogue = false;
    
    if (!voiceDisabled) {
      hasUserNarration = !!(request.userNarration && request.userNarration.trim().length > 10);
      hasUserDialogue = !!(request.userDialogue && request.userDialogue.length > 0);
      
      // If we detected content in the prompt, use it
      if (!hasUserNarration && detectedContent.hasNarration) {
        hasUserNarration = true;
        request.userNarration = detectedContent.narrationText;
        console.log("[GenerateStory] Auto-detected narration from input");
      }
      
      if (!hasUserDialogue && detectedContent.hasDialogue) {
        hasUserDialogue = true;
        request.userDialogue = detectedContent.dialogueLines;
        console.log("[GenerateStory] Auto-detected dialogue:", detectedContent.dialogueLines.length, "lines");
      }
    }
    
    const mustPreserveContent = !voiceDisabled && (request.preserveUserContent || hasUserNarration || hasUserDialogue);

    const targetDuration = request.targetDurationSeconds || (detectedContent.recommendedClipCount * 6);
    const sceneMode = request.sceneMode || 'single_scene';
    
    // CRITICAL FIX: Use explicit clip count and duration from user selection
    // Priority 1: Explicit clipCount from request
    // Priority 2: Calculate from targetDuration using explicit clipDuration
    // Priority 3: Fall back to calculated values
    
    const clipDuration = request.clipDuration && request.clipDuration > 0 
      ? request.clipDuration 
      : 5; // Only default to 5 if not provided
    
    let clipCount: number;
    
    if (request.clipCount && request.clipCount > 0) {
      // User explicitly selected clip count - USE IT
      clipCount = request.clipCount;
      console.log(`[GenerateStory] Using EXPLICIT clip count: ${clipCount}`);
    } else if (targetDuration > 0) {
      // Calculate from duration using the correct clip duration
      clipCount = Math.round(targetDuration / clipDuration);
      clipCount = clipCount > 0 ? clipCount : 6;
      console.log(`[GenerateStory] Calculated: ${targetDuration}s / ${clipDuration}s = ${clipCount} clips`);
    } else {
      clipCount = 6; // Default fallback
    }
    
    console.log(`[GenerateStory] Using ${clipCount} clips × ${clipDuration}s each = ${clipCount * clipDuration}s total`);

    // SCENE-BASED SYSTEM PROMPT - use dynamic clip count
    const systemPrompt = `You are a SCENE WRITER for AI video generation. Your job is to write ONE CONTINUOUS SCENE that unfolds across EXACTLY ${clipCount} connected clips.

${voiceDisabled ? `
CRITICAL - NO DIALOGUE OR NARRATION:
The user has NOT selected voice/narration for this video. This means:
- DO NOT include ANY dialogue, speech, narration, or voiceover
- DO NOT have characters speak, talk, say, quote, or utter anything
- DO NOT include "[NARRATION]", "[DIALOGUE]", "says", "speaks", or any speech
- DO NOT describe what characters are saying or thinking in quoted speech
- Focus ONLY on visual action, movement, and atmosphere
- This is a SILENT video with VISUAL storytelling only
- Characters may gesture, move, react - but NEVER speak or narrate
` : ''}

${mustPreserveContent ? `
CRITICAL - USER CONTENT PRESERVATION:
The user has provided specific narration/dialogue that MUST be used EXACTLY as written.
DO NOT paraphrase, summarize, or rewrite the user's text.
Your job is to create VISUAL descriptions that accompany the user's exact words.
Distribute the user's narration/dialogue across the ${clipCount} clips appropriately.
` : ''}

CRITICAL CLIP COUNT REQUIREMENT:
- You MUST output EXACTLY ${clipCount} clips - no more, no less
- Label them [CLIP 1] through [CLIP ${clipCount}]
- This is non-negotiable

CRITICAL CONCEPT: SCENE vs STORY
- A SCENE is ONE continuous moment in ONE location with ONE action sequence
- A STORY spans multiple scenes/episodes
- Each ${targetDuration}-second video = 1 SCENE = ${clipCount} clips of 5 seconds each (Kling 2.6)
- The ${clipCount} clips show PROGRESSIVE ACTION within the SAME moment

SCENE STRUCTURE (${clipCount} PROGRESSIVE CLIPS):
Each clip must be a CONTINUATION of the previous clip, like frames in a movie:

CLIP 1 - ESTABLISH: Set the scene. Character in location. Initial state.
CLIP 2 - INITIATE: Action begins. First movement or change.
${clipCount >= 3 ? `CLIP 3 - DEVELOP: Action progresses. Continuation of movement.` : ''}
${clipCount >= 4 ? `CLIP 4 - ESCALATE: Intensity increases. Action builds momentum.` : ''}
${clipCount >= 5 ? `CLIP 5 - PEAK: Highest point of action in this scene.` : ''}
${clipCount >= 6 ? `CLIP 6 - SETTLE: Action concludes for this scene. Holds for next scene.` : ''}
${clipCount === 5 ? `The final clip should serve as both peak and settle.` : ''}

CRITICAL RULES FOR CONTINUOUS FLOW:

1. SAME LOCATION: All ${clipCount} clips are in the EXACT same place
   - NO location changes within a scene
   - Same room, same street, same forest clearing
   - Background elements stay consistent
   
2. CONTINUOUS TIME: No time jumps within a scene
   - Clip 2 starts where Clip 1 ends
   - If character is mid-step in Clip 3, they complete the step in Clip 4
   - Total time elapsed in scene: ~${clipCount * 5} seconds of story time
   
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
Write the scene as ${clipCount} connected paragraphs, each describing 5 seconds of continuous action (Kling 2.6).
Label each: [CLIP 1], [CLIP 2], etc.
${voiceDisabled ? 'DO NOT include any [NARRATION] or [DIALOGUE] tags. NO SPOKEN WORDS.' : (mustPreserveContent ? "Include [NARRATION] or [DIALOGUE] tags with the user's EXACT text for each clip." : '')}
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
        referenceContext = `\n\nVISUAL REFERENCE (incorporate EXACTLY into ALL ${clipCount} clips):\n${parts.join('\n')}`;
      }
    }

    // Build environment context if provided
    let environmentContext = '';
    if (request.environmentPrompt) {
      environmentContext = `\n\nENVIRONMENT DNA (MANDATORY - ALL clips MUST be set in this environment):
${request.environmentPrompt}
CRITICAL: Every clip MUST take place in this exact environment with this exact lighting and atmosphere. Do NOT change the setting.`;
      console.log('[GenerateStory] Environment DNA injected:', request.environmentPrompt.substring(0, 100));
    }

    const userPrompt = `Write ONE CONTINUOUS SCENE based on this concept:

"${request.prompt}"

${request.genre ? `Genre: ${request.genre}` : ''}
${request.mood ? `Mood/Tone: ${request.mood}` : ''}
${request.style ? `Visual Style: ${request.style}` : ''}${referenceContext}${environmentContext}
${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT CHANGE OR PARAPHRASE):
"""
${request.userNarration}
"""
Distribute this narration across the ${clipCount} clips. Use the EXACT words provided.
` : ''}
${hasUserDialogue && request.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT CHANGE OR PARAPHRASE):
${request.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
Include these dialogue lines in the appropriate clips. Use the EXACT words provided.
` : ''}

This scene will be a ${targetDuration}-second video made of ${clipCount} clips (5 seconds each, Kling 2.6).
All ${clipCount} clips must show CONTINUOUS PROGRESSIVE ACTION in the SAME location.
${mustPreserveContent ? 'CRITICAL: Preserve the user\'s narration/dialogue EXACTLY as written - only add visual descriptions.' : ''}
${request.environmentPrompt ? 'CRITICAL: Use the EXACT environment, lighting, and atmosphere specified in ENVIRONMENT DNA for ALL clips.' : ''}

${sceneMode === 'episode' && request.previousSceneSummary ? `
CONTINUE FROM: ${request.previousSceneSummary}
` : ''}

Write the scene now with [CLIP 1] through [CLIP ${clipCount}] labels:`;

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
      estimatedScenes: clipCount, // Use dynamic clip count
      sceneMode,
      sceneDescription,
    };

    if (sceneMode === 'episode') {
      responseData.episodeInfo = {
        episodeNumber: request.episodeNumber || 1,
        totalEpisodes: request.totalEpisodes || 5,
        episodeTitle: title,
        previousSummary: request.previousSceneSummary,
        nextTeaser: actionProgression[clipCount - 1] || 'To be continued...',
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
