import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  validateInput,
  validateStringArray,
  fetchWithRetry,
  detectUserContent,
  errorResponse,
  successResponse,
  calculateMaxTokens,
} from "../_shared/script-utils.ts";

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
  
  // USER-PROVIDED CONTENT - must be preserved exactly
  userNarration?: string;
  userDialogue?: string[];
  userScript?: string;
  preserveUserContent?: boolean;
  
  // CLIP COUNT ENFORCEMENT - user-selected clip count takes priority
  clipCount?: number;
  clipDuration?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const requestData: StoryRequest = await req.json();
    
    // Input validation
    const topicValidation = validateInput(requestData.topic, { 
      maxLength: 5000, 
      fieldName: 'topic' 
    });
    const synopsisValidation = validateInput(requestData.synopsis, { 
      maxLength: 10000, 
      fieldName: 'synopsis' 
    });
    const userScriptValidation = validateInput(requestData.userScript, { 
      maxLength: 50000, 
      fieldName: 'userScript' 
    });
    
    // Apply sanitized values
    if (requestData.topic) requestData.topic = topicValidation.sanitized;
    if (requestData.synopsis) requestData.synopsis = synopsisValidation.sanitized;
    if (requestData.userScript) requestData.userScript = userScriptValidation.sanitized;
    if (requestData.userDialogue) {
      requestData.userDialogue = validateStringArray(requestData.userDialogue, 50, 1000);
    }
    
    console.log("[generate-script] Request received, topic length:", requestData.topic?.length || 0);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;
    
    // Check if user provided their own complete script - use it directly
    if (requestData.userScript && requestData.userScript.trim().length > 50) {
      console.log("[generate-script] Using user-provided script directly");
      
      // Return the user's script with minimal processing
      return new Response(
        JSON.stringify({ 
          success: true,
          script: requestData.userScript.trim(),
          title: requestData.title || 'User Script',
          genre: requestData.genre,
          characters: requestData.characters?.map(c => c.name),
          wordCount: requestData.userScript.split(/\s+/).length,
          estimatedDuration: Math.ceil(requestData.userScript.split(/\s+/).length / 150),
          source: 'user_provided',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if this is a full movie request with characters OR if fullMovieMode flag is set
    const hasCharacters = requestData.characters && requestData.characters.length > 0;
    const isFullMovieMode = requestData.title && (hasCharacters || requestData.synopsis);
    
    // AUTO-DETECT dialogue and narration from user's synopsis/topic
    const inputText = [
      requestData.synopsis || '',
      requestData.topic || '',
      requestData.userNarration || '',
      ...(requestData.userDialogue || []),
    ].join(' ');
    
    const detectedContent = detectUserContent(inputText);
    
    // Use detected content if no explicit user content provided
    let hasUserNarration = requestData.userNarration && requestData.userNarration.trim().length > 10;
    let hasUserDialogue = requestData.userDialogue && requestData.userDialogue.length > 0;
    
    // If we detected content in the synopsis, use it
    if (!hasUserNarration && detectedContent.hasNarration) {
      hasUserNarration = true;
      requestData.userNarration = detectedContent.narrationText;
      console.log("[generate-script] Auto-detected narration from input");
    }
    
    if (!hasUserDialogue && detectedContent.hasDialogue) {
      hasUserDialogue = true;
      requestData.userDialogue = detectedContent.dialogueLines;
      console.log("[generate-script] Auto-detected dialogue from input:", detectedContent.dialogueLines.length, "lines");
    }
    
    const mustPreserveContent = requestData.preserveUserContent || hasUserNarration || hasUserDialogue;
    
    // STRICT CLIP COUNT ENFORCEMENT
    // Priority: 1) Explicit clipCount from user, 2) Content-based detection
    const userRequestedClips = requestData.clipCount && requestData.clipCount > 0 ? requestData.clipCount : null;
    const clipCount = userRequestedClips || detectedContent.recommendedClipCount;
    
    console.log(`[generate-script] Clip count: ${clipCount} (user requested: ${userRequestedClips}, detected: ${detectedContent.recommendedClipCount})`);
    
    if (isFullMovieMode) {
      // Full movie script generation - dynamic shot count based on content (Kling 2.6: 5s clips)
      systemPrompt = `You write cinematic scripts for AI video generation and stitching. Generate EXACTLY ${clipCount} shots, each 5 seconds.

${mustPreserveContent ? `
CRITICAL - USER CONTENT PRESERVATION:
The user has provided specific narration/dialogue that MUST be used EXACTLY as written.
DO NOT paraphrase, summarize, or rewrite the user's text.
Your job is to create VISUAL descriptions that accompany the user's exact words.
` : ''}

FORMAT (use exactly this):
[SHOT 1] Visual description with motion and physics.
${hasUserNarration ? '[NARRATION] (User\'s exact narration for this shot)' : ''}
${hasUserDialogue ? '[DIALOGUE] (User\'s exact dialogue for this shot)' : ''}
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
- Generate EXACTLY ${clipCount} shots to fit the content
- Each shot is EXACTLY 5 seconds (Kling 2.6)
- Rich visual descriptions with motion and physics
- Every transition must be seamless - use buffer shots for major scene changes
- NO static scenes - always movement (even buffer shots have subtle motion)
${mustPreserveContent ? '- PRESERVE USER\'S EXACT NARRATION/DIALOGUE - do not modify their words' : ''}`;

      // Build character descriptions if provided
      const characterDescriptions = hasCharacters 
        ? requestData.characters!.map(char => 
            `${char.name}: ${char.description.split('.')[0]}`
          ).join(', ')
        : '';

      userPrompt = `Write EXACTLY ${clipCount} shots for: "${requestData.title}"
Genre: ${requestData.genre || 'Drama'}
${requestData.synopsis ? `Concept: ${requestData.synopsis.substring(0, 200)}` : ''}
${characterDescriptions ? `Characters: ${characterDescriptions}` : ''}
${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT CHANGE):
"""
${requestData.userNarration}
"""
Distribute this narration across the ${clipCount} shots. Use the EXACT words provided.
` : ''}
${hasUserDialogue && requestData.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT CHANGE):
${requestData.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
Include these dialogue lines in the appropriate shots. Use the EXACT words provided.
` : ''}

CRITICAL: 
- Generate EXACTLY ${clipCount} shots (based on content length)
- Total duration: ${clipCount * 5} seconds
- Each shot must transition SMOOTHLY into the next
- Use BUFFER SHOTS (establishing, detail, reaction beats) between major scene changes
- This will be stitched by AI, so ensure visual continuity
${mustPreserveContent ? '- The user\'s narration/dialogue MUST appear exactly as written - only add visual descriptions' : ''}
Write ${clipCount} shots. Rich visual descriptions. Go:`;

    } else {
      // Legacy simple mode - for topic-based requests
      systemPrompt = `You are a visual storyteller. Write scripts that are VISUALLY RICH with cinematic precision.
Include specific visual details: colors, lighting, textures, movements.
After each key point, add a [VISUAL: description] tag.
${mustPreserveContent ? `
CRITICAL: The user has provided specific narration/dialogue. You MUST use their EXACT words.
DO NOT paraphrase or rewrite. Only add visual descriptions to accompany their text.
` : ''}`;

      // Use synopsis OR topic for the content
      const content = requestData.synopsis || requestData.topic || 'a visually engaging scene';

      userPrompt = `Write a VISUALLY DESCRIPTIVE ${requestData.duration || '60 second'} video script about: ${content}
Style: ${requestData.style || 'Professional and engaging'}
Title: ${requestData.title || 'Untitled'}
${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT MODIFY):
"""
${requestData.userNarration}
"""
` : ''}
${hasUserDialogue && requestData.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT MODIFY):
${requestData.userDialogue.map((d, i) => `"${d}"`).join('\n')}
` : ''}

Requirements:
- Follow the user's concept EXACTLY
${mustPreserveContent ? '- USE THE USER\'S EXACT NARRATION/DIALOGUE - do not paraphrase or rewrite their words' : ''}
- Start with an attention-grabbing hook AND opening visual
- Include [VISUAL: ...] tags describing imagery
- Use descriptive language for environments and characters
- Keep the script focused on what the user asked for

Write the script now:`;
    }

    // Use retry with exponential backoff
    const response = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
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
          max_tokens: calculateMaxTokens(clipCount, 120),
        }),
      },
      { maxRetries: 3, baseDelayMs: 1000 }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-script] OpenAI API error after retries:", response.status, errorText);
      
      if (response.status === 429) {
        return errorResponse("Rate limit exceeded after retries. Please try again later.", 429);
      }
      if (response.status === 401) {
        return errorResponse("Invalid OpenAI API key.", 401);
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const script = data.choices?.[0]?.message?.content;
    
    // Validate response content
    if (!script || script.trim().length < 50) {
      console.error("[generate-script] Empty or too short script generated");
      return errorResponse("Script generation returned insufficient content. Please try again.", 500);
    }
    
    // Count actual shots in generated script
    const shotMatches = script?.match(/\[SHOT \d+\]/g) || [];
    const actualShotCount = shotMatches.length || clipCount;
    
    const generationTimeMs = Date.now() - startTime;
    console.log(`[generate-script] Success in ${generationTimeMs}ms, length: ${script?.length}, shots: ${actualShotCount}`);

    return successResponse({ 
      script,
      title: requestData.title,
      genre: requestData.genre,
      characters: requestData.characters?.map(c => c.name),
      wordCount: script?.split(/\s+/).length || 0,
      estimatedDuration: actualShotCount * 6,
      requestedClipCount: clipCount,
      actualClipCount: actualShotCount,
      detectedContent: {
        hasDialogue: detectedContent.hasDialogue,
        hasNarration: detectedContent.hasNarration,
        dialogueLineCount: detectedContent.dialogueLines.length,
        contentPreserved: mustPreserveContent,
      },
      model: "gpt-4o-mini",
      usage: data.usage,
      generationTimeMs,
    });

  } catch (error) {
    console.error("[generate-script] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error"
    );
  }
});
