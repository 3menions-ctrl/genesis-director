import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  validateInput,
  validateStringArray,
  fetchWithRetry,
  detectUserContent,
  detectNonCharacterSubject,
  errorResponse,
  successResponse,
  calculateMaxTokens,
  extractUserIntent,
  validateScriptAgainstIntent,
  checkMultipleContent,
  getSafetyInstructions,
  type UserIntent,
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
    // ═══ AUTH GUARD: Prevent unauthorized API credit consumption ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const requestData: StoryRequest = await req.json();
    
    // ═══════════════════════════════════════════════════════════════════
    // CONTENT SAFETY CHECK - FIRST PRIORITY
    // Block any NSFW, pornographic, or harmful content BEFORE processing
    // ═══════════════════════════════════════════════════════════════════
    const safetyCheck = checkMultipleContent([
      requestData.topic,
      requestData.synopsis,
      requestData.userScript,
      requestData.userNarration,
      requestData.title,
      ...(requestData.userDialogue || []),
      ...(requestData.characters?.map(c => `${c.name} ${c.description} ${c.personality}`) || []),
    ]);
    
    if (!safetyCheck.isSafe) {
      console.error(`[generate-script] ⛔ CONTENT BLOCKED - Category: ${safetyCheck.category}, Terms: ${safetyCheck.matchedTerms.slice(0, 3).join(', ')}`);
      return errorResponse(safetyCheck.message, 400);
    }
    // ═══════════════════════════════════════════════════════════════════
    
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
    
    // CRITICAL: Pass explicit clipCount to detection so it doesn't get overridden
    const explicitClipCount = requestData.clipCount && requestData.clipCount > 0 ? requestData.clipCount : undefined;
    const detectedContent = detectUserContent(inputText, explicitClipCount);
    
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
    // Priority 1: Explicit clipCount from user selection (HIGHEST PRIORITY)
    // Priority 2: Content-based detection
    const userRequestedClips = requestData.clipCount && requestData.clipCount > 0 ? requestData.clipCount : null;
    const clipCount = userRequestedClips || detectedContent.recommendedClipCount;
    
    console.log(`[generate-script] ENFORCED clip count: ${clipCount} (user requested: ${userRequestedClips}, detected: ${detectedContent.recommendedClipCount})`);
    
    // GUARDRAIL #1: Extract user intent for validation
    const userIntent = extractUserIntent(inputText);
    console.log(`[generate-script] User intent extracted - Core action: "${userIntent.coreAction}", Key elements: [${userIntent.keyElements.join(', ')}]`);
    
    // GUARDRAIL #2: Detect if this is a character-focused or object/scene prompt
    // This prevents hallucinating humans for non-human prompts (e.g., "space shuttle launch")
    const isNonCharacterPrompt = detectNonCharacterSubject(inputText);
    console.log(`[generate-script] Subject detection: isNonCharacter=${isNonCharacterPrompt}`);
    
    if (isFullMovieMode) {
      // Full movie script generation - dynamic shot count based on content (Kling V3: 10s clips)
      systemPrompt = `You are a visionary filmmaker creating ${clipCount} shots (${10}s each) for Kling V3. Every shot must be a PAINTING THAT MOVES.

${isNonCharacterPrompt ? `
⚠️ NON-CHARACTER PROMPT: The user wants a video of an OBJECT, VEHICLE, SCENE, or EVENT — NOT a person.
DO NOT invent humans, observers, narrators, or spectators. Focus ONLY on: ${userIntent.coreAction || inputText.substring(0, 100)}
` : ''}

${mustPreserveContent ? `
🎤 USER CONTENT: The user provided specific narration/dialogue. Use their EXACT words verbatim.
Your job: create VISUAL descriptions to accompany their text. DO NOT paraphrase.
` : ''}

${userIntent.coreAction ? `
━━━ MANDATORY: "${userIntent.coreAction.toUpperCase()}" MUST APPEAR ━━━
${userIntent.keyElements.length > 0 ? `Include: ${userIntent.keyElements.join(', ')}` : ''}
${userIntent.forbiddenElements.length > 0 ? `Avoid: ${userIntent.forbiddenElements.join(', ')}` : ''}
` : ''}

━━━ FORMULA FOR BREATHTAKING AI VIDEO ━━━
✅ TEXTURE & PHYSICS: How light hits surfaces, fabric moves, water behaves, dust drifts
✅ EMOTIONAL WEATHER: Environment mirrors feeling — golden light = hope, blue haze = isolation
✅ LAYERED DEPTH: Foreground action + midground context + background atmosphere in EVERY frame
✅ MICRO-MOVEMENTS: Breathing, blinking, condensation sliding, leaves trembling
❌ AVOID: Camera specs ("85mm f/1.2"), empty adjectives ("beautiful", "epic"), static poses

FORMAT:
[SHOT 1] 100-150 words of lush, sensory-rich visual description with continuous motion and physics.
${hasUserNarration ? '[NARRATION] (User\'s exact narration for this shot)' : ''}
${hasUserDialogue ? '[DIALOGUE] (User\'s exact dialogue for this shot)' : ''}
[SHOT 2] Seamless continuation — the frozen moment from Shot 1 thaws into new action.
...continue for all ${clipCount} shots...

TRANSITIONS: Each shot's last 2 seconds set up the next shot's first 2 seconds.
Use BUFFER SHOTS between major scene changes (establishing wide, detail close-up, reaction beat).

RULES:
- EXACTLY ${clipCount} shots, each 10 seconds
- Every description: 100-150 words, vivid and sensory-rich
- NO static scenes — even calm moments have breathing, light shifts, particles floating
${mustPreserveContent ? '- PRESERVE user\'s exact narration/dialogue verbatim' : ''}
${userIntent.coreAction ? `- "${userIntent.coreAction.toUpperCase()}" IS NON-NEGOTIABLE` : ''}`;

      // Build character descriptions if provided
      const characterDescriptions = hasCharacters 
        ? requestData.characters!.map(char => 
            `${char.name}: ${char.description.split('.')[0]}`
          ).join(', ')
        : '';

      userPrompt = `Write EXACTLY ${clipCount} breathtaking shots for: "${requestData.title}"
Genre: ${requestData.genre || 'Drama'}
${requestData.synopsis ? `Concept: ${requestData.synopsis.substring(0, 300)}` : ''}
${characterDescriptions ? `Characters: ${characterDescriptions}` : ''}
${hasUserNarration ? `
USER'S NARRATION (VERBATIM — DO NOT CHANGE A SINGLE WORD):
"""
${requestData.userNarration}
"""
Distribute across the ${clipCount} shots.
` : ''}
${hasUserDialogue && requestData.userDialogue ? `
USER'S DIALOGUE (VERBATIM — DO NOT CHANGE):
${requestData.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
` : ''}

REQUIREMENTS:
- EXACTLY ${clipCount} shots × 10 seconds = ${clipCount * 10}s total
- Each shot: 100-150 words of LUSH visual description with texture, physics, and emotion
- Shot 1 opens with a HOOK — an image so vivid it stops scrolling
- Each shot's final frame flows into the next shot's opening
- Include at least one texture detail per shot (surface grain, light quality, material feel)
${mustPreserveContent ? '- User\'s narration/dialogue appears EXACTLY as written' : ''}
Write ${clipCount} shots now:`;

    } else {
      // Legacy simple mode - for topic-based requests
      systemPrompt = `You are a cinematic visual poet. Every word you write becomes a moving image.
Your scripts read like the opening of an award-winning film — sensory, specific, alive.
Describe TEXTURES (wet cobblestone, frosted glass, sun-bleached wood), PHYSICS (how light bends through rain, how fabric catches wind), and EMOTION through environment (warm golden light = hope, cold blue haze = isolation).
After each key moment, add a [VISUAL: description] tag with foley-level detail.
${mustPreserveContent ? `
The user provided specific narration/dialogue. Use their EXACT words verbatim.
Only add visual descriptions to accompany their text.
` : ''}`;

      const content = requestData.synopsis || requestData.topic || 'a visually engaging scene';

      userPrompt = `Write a CINEMATIC ${requestData.duration || '60 second'} video script about: ${content}
Style: ${requestData.style || 'Cinematic and immersive'}
Title: ${requestData.title || 'Untitled'}
${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY):
"""
${requestData.userNarration}
"""
` : ''}
${hasUserDialogue && requestData.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY):
${requestData.userDialogue.map((d, i) => `"${d}"`).join('\n')}
` : ''}

Requirements:
- Open with an image that GRABS — a texture, a motion, a light shift that hooks immediately
- Every [VISUAL] tag describes a MOVING scene, not a photograph
- Include at least one texture detail per visual (grain of wood, sheen of rain, warmth of skin)
- Environment should BREATHE — wind, particles, shifting light, living atmosphere
${mustPreserveContent ? '- USE the user\'s EXACT narration/dialogue verbatim' : ''}

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
    
    // GUARDRAIL #2: Validate generated script contains user's core intent
    const intentValidation = validateScriptAgainstIntent(script, userIntent);
    console.log(`[generate-script] Intent validation: score=${intentValidation.score}, passed=${intentValidation.passed}`);
    
    if (!intentValidation.passed) {
      console.warn(`[generate-script] ⚠️ Script may not fully reflect user intent:`, intentValidation.issues);
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
      estimatedDuration: actualShotCount * 10, // Kling V3: 10s per clip
      requestedClipCount: clipCount,
      actualClipCount: actualShotCount,
      detectedContent: {
        hasDialogue: detectedContent.hasDialogue,
        hasNarration: detectedContent.hasNarration,
        dialogueLineCount: detectedContent.dialogueLines.length,
        contentPreserved: mustPreserveContent,
      },
      // NEW: User intent validation results
      intentValidation: {
        score: intentValidation.score,
        passed: intentValidation.passed,
        issues: intentValidation.issues,
        coreAction: userIntent.coreAction,
        keyElements: userIntent.keyElements,
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
