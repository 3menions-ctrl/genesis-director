import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  validateInput,
  validateStringArray,
  fetchWithRetry,
  parseJsonWithRecovery,
  detectUserContent,
  errorResponse,
  successResponse,
  calculateMaxTokens,
  type DetectedContent,
} from "../_shared/script-utils.ts";

interface SmartScriptRequest {
  topic: string;
  synopsis?: string;
  style?: string;
  genre?: string;
  targetDurationSeconds: number;
  pacingStyle?: 'fast' | 'moderate' | 'slow';
  mainSubjects?: string[];
  environmentHints?: string[];
  // Scene-based flow - approved continuous scene
  approvedScene?: string;
  // Character/environment lock for consistency
  characterLock?: {
    description: string;
    clothing: string;
    distinctiveFeatures: string[];
  };
  environmentLock?: {
    location: string;
    lighting: string;
    keyObjects: string[];
  };
  // USER-PROVIDED CONTENT - must be preserved exactly
  userNarration?: string;      // User's exact narration text
  userDialogue?: string[];     // User's exact dialogue lines
  userScript?: string;         // User's complete script (use as-is)
  preserveUserContent?: boolean; // Flag to ensure user content is kept verbatim
  // Environment DNA - full environment description for visual consistency
  environmentPrompt?: string;
}

interface SceneClip {
  id: string;
  index: number;
  title: string;
  description: string;
  durationSeconds: number;
  // Continuity fields
  actionPhase: 'establish' | 'initiate' | 'develop' | 'escalate' | 'peak' | 'settle';
  previousAction: string;
  currentAction: string;
  nextAction: string;
  // Visual consistency
  characterDescription: string;
  locationDescription: string;
  lightingDescription: string;
  // Camera
  cameraScale: string;
  cameraAngle: string;
  movementType: string;
  motionDirection: string;
  // Transitions
  transitionOut: {
    type: string;
    hint: string;
  } | null;
  // Dialogue/narration
  dialogue: string;
  mood: string;
}

const ACTION_PHASES = ['establish', 'initiate', 'develop', 'escalate', 'peak', 'settle'] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: SmartScriptRequest = await req.json();
    
    // Input validation
    const topicValidation = validateInput(request.topic, { 
      maxLength: 5000, 
      fieldName: 'topic',
      required: true,
      minLength: 3,
    });
    
    if (!topicValidation.valid) {
      return errorResponse(topicValidation.errors.join(', '), 400);
    }
    request.topic = topicValidation.sanitized;
    
    // Validate other inputs
    if (request.synopsis) {
      request.synopsis = validateInput(request.synopsis, { maxLength: 10000 }).sanitized;
    }
    if (request.approvedScene) {
      request.approvedScene = validateInput(request.approvedScene, { maxLength: 20000 }).sanitized;
    }
    if (request.userNarration) {
      request.userNarration = validateInput(request.userNarration, { maxLength: 10000 }).sanitized;
    }
    if (request.userDialogue) {
      request.userDialogue = validateStringArray(request.userDialogue, 50, 1000);
    }
    
    console.log("[SmartScript] Request validated, topic:", request.topic.substring(0, 100));

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // AUTO-DETECT dialogue and narration from user's input
    const inputText = [
      request.topic || '',
      request.synopsis || '',
      request.approvedScene || '',
      request.userNarration || '',
      ...(request.userDialogue || []),
    ].join(' ');
    
    const detectedContent = detectUserContent(inputText);
    console.log(`[SmartScript] Detected: ${detectedContent.dialogueLines.length} dialogue lines, narration: ${detectedContent.hasNarration}, recommended clips: ${detectedContent.recommendedClipCount}`);

    // Use passed targetDurationSeconds to determine exact clip count
    // This ensures consistency with user's selection
    const CLIP_DURATION = 6;
    const requestedClips = Math.round(request.targetDurationSeconds / CLIP_DURATION);
    // Only use detected content recommendation if no explicit duration was passed
    const recommendedClips = requestedClips > 0 ? requestedClips : detectedContent.recommendedClipCount;
    const targetSeconds = recommendedClips * CLIP_DURATION;
    console.log(`[SmartScript] Using ${recommendedClips} clips (requested: ${requestedClips}, detected: ${detectedContent.recommendedClipCount})`);
    
    // Use detected content if no explicit user content provided
    let hasUserNarration = request.userNarration && request.userNarration.trim().length > 10;
    let hasUserDialogue = request.userDialogue && request.userDialogue.length > 0;
    
    // If we detected content, use it
    if (!hasUserNarration && detectedContent.hasNarration) {
      hasUserNarration = true;
      request.userNarration = detectedContent.narrationText;
      console.log("[SmartScript] Auto-detected narration from input");
    }
    
    if (!hasUserDialogue && detectedContent.hasDialogue) {
      hasUserDialogue = true;
      request.userDialogue = detectedContent.dialogueLines;
      console.log("[SmartScript] Auto-detected dialogue:", detectedContent.dialogueLines.length, "lines");
    }
    
    const mustPreserveContent = request.preserveUserContent || hasUserNarration || hasUserDialogue;
    
    console.log(`[SmartScript] Generating ${recommendedClips} clips for continuous scene, preserveContent: ${mustPreserveContent}`);

    // Build the system prompt for CONTINUOUS SCENE breakdown
    const systemPrompt = `You are a SCENE BREAKDOWN SPECIALIST for AI video generation. Your job is to break ONE CONTINUOUS SCENE into EXACTLY ${recommendedClips} clips that flow seamlessly together.

CRITICAL CLIP COUNT REQUIREMENT:
- You MUST output EXACTLY ${recommendedClips} clips - no more, no less
- The clips array MUST have exactly ${recommendedClips} items
- Do NOT output 6 clips if ${recommendedClips} clips are requested
- This is non-negotiable: output = ${recommendedClips} clips

${mustPreserveContent ? `
CRITICAL - USER CONTENT PRESERVATION:
The user has provided specific narration/dialogue that MUST be used EXACTLY as written.
DO NOT paraphrase, summarize, or rewrite the user's text.
Your job is to create VISUAL descriptions that accompany the user's exact words.
Distribute the user's narration/dialogue across the ${recommendedClips} clips appropriately.
Include the user's exact text in the "dialogue" field of each clip.
` : ''}

CRITICAL: CONTINUOUS SCENE BREAKDOWN
Each scene = ${recommendedClips} clips showing PROGRESSIVE ACTION in the SAME location.
The clips are NOT separate shots - they are SEQUENTIAL MOMENTS of ONE continuous action.

OUTPUT FORMAT (STRICT JSON):
{
  "clips": [
    {
      "index": 0,
      "title": "Clip title",
      "description": "Detailed visual description for AI video generation",
      "durationSeconds": 6,
      "actionPhase": "establish|initiate|develop|escalate|peak|settle",
      "previousAction": "What happened in previous clip (empty for clip 0)",
      "currentAction": "What happens in this exact 6-second moment",
      "nextAction": "What will happen in next clip (empty for clip 5)",
      "characterDescription": "EXACT character description - SAME in all clips",
      "locationDescription": "EXACT location description - SAME in all clips",
      "lightingDescription": "EXACT lighting description - SAME in all clips",
      "cameraScale": "wide|medium|close-up",
      "cameraAngle": "eye-level|low-angle|high-angle",
      "movementType": "static|pan|tracking|dolly",
      "motionDirection": "The direction of action/movement",
      "transitionHint": "How this moment connects to the next",
      "dialogue": "Any narration or speech - USE USER'S EXACT WORDS if provided",
      "mood": "Emotional tone of this moment"
    }
  ]
}

ACTION PHASE REQUIREMENTS (distribute across ${recommendedClips} clips):
- ESTABLISH (Clip 0): Wide shot. Character in environment. Initial state before action.
- INITIATE (Clip 1): Action begins. First movement or change from initial state.
- DEVELOP (Clips 2-${Math.floor(recommendedClips/2)}): Action continues and builds.
- ESCALATE (Clips ${Math.floor(recommendedClips/2)+1}-${recommendedClips-2}): Intensity increases. Action gains momentum.
- PEAK (Clip ${recommendedClips-2}): Highest point. Most dramatic moment of the scene.
- SETTLE (Clip ${recommendedClips-1}): Resolution. Action concludes. Sets up next scene.

CONTINUITY REQUIREMENTS (CRITICAL):
1. CHARACTER LOCK: Copy the EXACT same character description to ALL ${recommendedClips} clips
   - Same clothes, hair, face, body in every clip
   - No outfit changes, no appearance drift
   
2. LOCATION LOCK: Copy the EXACT same location description to ALL ${recommendedClips} clips
   - Same room, street, forest - never changes
   - Same background elements visible
   
3. LIGHTING LOCK: Copy the EXACT same lighting to ALL ${recommendedClips} clips
   - Same sun position, same shadows
   - Same color temperature
   
4. ACTION CONTINUITY: Each clip picks up WHERE the previous ended
   - Clip 1's "previousAction" = Clip 0's "currentAction"
   - Clip 2's "previousAction" = Clip 1's "currentAction"
   - Physical positions must connect (if hand is raised at end of clip 2, it's still raised at start of clip 3)

5. CAMERA LOGIC: Camera can move, but no impossible jumps
   - Can go from wide to close-up over 2-3 clips
   - No jumping from behind character to in front between clips

${mustPreserveContent ? `
6. DIALOGUE/NARRATION PRESERVATION:
   - Use the user's EXACT words in the "dialogue" field
   - DO NOT paraphrase or rewrite their text
   - Distribute their narration/dialogue across appropriate clips
` : ''}

TRANSITION HINTS:
Describe how each clip's END connects to the next clip's START:
- "Character's hand reaches toward door handle" → "Hand grips the handle"
- "Face turns toward the sound" → "Eyes widen seeing what made the sound"
- "Steps forward into the light" → "Fully illuminated, takes in the view"`;

    // Build user prompt
    let userPrompt: string;
    
    if (request.approvedScene) {
      // Scene has been written - break it into clips
      userPrompt = `Break this APPROVED SCENE into exactly ${recommendedClips} continuous clips:

SCENE:
"""
${request.approvedScene}
"""

${request.environmentPrompt ? `
ENVIRONMENT DNA (MANDATORY - ALL clips MUST use this EXACT environment):
${request.environmentPrompt}
CRITICAL: Every clip MUST take place in this exact environment with this exact lighting and atmosphere. Copy this environment description to EVERY clip's locationDescription and lightingDescription fields.
` : ''}

${request.characterLock ? `
CHARACTER (use EXACTLY in all ${recommendedClips} clips):
${request.characterLock.description}
Wearing: ${request.characterLock.clothing}
Distinctive: ${request.characterLock.distinctiveFeatures.join(', ')}
` : ''}

${request.environmentLock ? `
LOCATION (use EXACTLY in all ${recommendedClips} clips):
${request.environmentLock.location}
Lighting: ${request.environmentLock.lighting}
Key objects: ${request.environmentLock.keyObjects.join(', ')}
` : ''}

${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT MODIFY):
"""
${request.userNarration}
"""
Distribute this across the clips in the "dialogue" field. Use EXACT words.
` : ''}
${hasUserDialogue && request.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT MODIFY):
${request.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
Include in appropriate clips' "dialogue" field. Use EXACT words.
` : ''}

REQUIREMENTS:
- Extract the ${recommendedClips} sequential moments from this scene
- Each clip = 6 seconds of the continuous action
- Maintain EXACT character/location/lighting consistency
- Connect each clip's end to the next clip's start
${request.environmentPrompt ? '- MANDATORY: Use the ENVIRONMENT DNA for ALL clips\' locationDescription and lightingDescription' : ''}
${mustPreserveContent ? '- PRESERVE USER\'S EXACT NARRATION/DIALOGUE in the "dialogue" field' : '- Keep dialogue/narration in the appropriate clips'}

Output ONLY valid JSON with exactly ${recommendedClips} clips.`;
    } else {
      // Generate from topic - create a continuous scene
      userPrompt = `Create a continuous scene broken into ${recommendedClips} clips for:

TOPIC: ${request.topic}
${request.synopsis ? `SYNOPSIS: ${request.synopsis}` : ''}
${request.style ? `STYLE: ${request.style}` : ''}
${request.genre ? `GENRE: ${request.genre}` : ''}
${request.mainSubjects?.length ? `MAIN SUBJECTS: ${request.mainSubjects.join(', ')}` : ''}
${request.environmentHints?.length ? `ENVIRONMENT: ${request.environmentHints.join(', ')}` : ''}

${request.environmentPrompt ? `
ENVIRONMENT DNA (MANDATORY - ALL clips MUST use this EXACT environment):
${request.environmentPrompt}
CRITICAL: Every clip MUST take place in this exact environment with this exact lighting and atmosphere. Copy this environment description to EVERY clip's locationDescription and lightingDescription fields.
` : ''}

${request.characterLock ? `
CHARACTER (use EXACTLY in all ${recommendedClips} clips):
${request.characterLock.description}
Wearing: ${request.characterLock.clothing}
Distinctive: ${request.characterLock.distinctiveFeatures.join(', ')}
` : ''}

${request.environmentLock ? `
LOCATION (use EXACTLY in all ${recommendedClips} clips):
${request.environmentLock.location}
Lighting: ${request.environmentLock.lighting}
Key objects: ${request.environmentLock.keyObjects.join(', ')}
` : ''}

${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT MODIFY OR PARAPHRASE):
"""
${request.userNarration}
"""
Distribute this narration across the ${recommendedClips} clips in the "dialogue" field. Use the EXACT words provided.
` : ''}
${hasUserDialogue && request.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT MODIFY OR PARAPHRASE):
${request.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
Include these dialogue lines in appropriate clips' "dialogue" field. Use EXACT words.
` : ''}

Create ONE continuous scene with ${recommendedClips} progressive clips. Each clip = 6 seconds.
Total duration: ${targetSeconds} seconds.
All clips in SAME location with SAME character appearance.
Show progressive action: establish → initiate → develop → escalate → peak → settle.
${request.environmentPrompt ? 'MANDATORY: Use the ENVIRONMENT DNA for ALL clips\' locationDescription and lightingDescription.' : ''}
${mustPreserveContent ? 'CRITICAL: Use the user\'s EXACT narration/dialogue text - do not paraphrase.' : ''}

Output ONLY valid JSON with exactly ${recommendedClips} clips.`;
    }

    console.log("[SmartScript] Calling OpenAI API for scene breakdown...");

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
          max_tokens: calculateMaxTokens(recommendedClips, 400, 2500, 4096), // JSON needs more tokens per clip
          temperature: 0.6,
        }),
      },
      { maxRetries: 3, baseDelayMs: 1000 }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[SmartScript] OpenAI API error after retries:", response.status, errorText);
      
      if (response.status === 429) {
        return errorResponse("Rate limit exceeded after retries. Please try again later.", 429);
      }
      if (response.status === 401) {
        return errorResponse("Invalid OpenAI API key.", 401);
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    
    console.log("[SmartScript] Raw AI response length:", rawContent.length);

    // Use JSON recovery to parse the response
    const parseResult = parseJsonWithRecovery<{ clips?: any[] } | any[]>(rawContent);
    
    if (!parseResult.success || !parseResult.data) {
      console.error("[SmartScript] JSON parse failed after recovery attempts");
      console.error("[SmartScript] Raw content preview:", rawContent.substring(0, 500));
      return errorResponse("Failed to parse AI response. Please try again.", 500);
    }

    // Extract clips array from response
    let parsedClips = Array.isArray(parseResult.data) 
      ? parseResult.data 
      : (parseResult.data as { clips?: any[] }).clips || [];

    // FIX: Use recommendedClips instead of hardcoded 6
    const expectedClipCount = recommendedClips;
    
    if (!Array.isArray(parsedClips) || parsedClips.length !== expectedClipCount) {
      console.warn(`[SmartScript] Expected ${expectedClipCount} clips, got ${parsedClips?.length}. Adjusting...`);
      
      // Pad with placeholder clips if too few
      while (parsedClips.length < expectedClipCount) {
        const phaseIndex = Math.min(parsedClips.length, ACTION_PHASES.length - 1);
        parsedClips.push({
          title: `Clip ${parsedClips.length + 1}`,
          description: 'Scene continuation - action progresses naturally',
          actionPhase: ACTION_PHASES[phaseIndex],
          currentAction: 'Action continues from previous moment',
        });
      }
      
      // Trim if too many
      parsedClips = parsedClips.slice(0, expectedClipCount);
    }

    // Extract the character/location/lighting from first clip to enforce consistency
    const lockFields = {
      characterDescription: parsedClips[0].characterDescription || request.characterLock?.description || '',
      locationDescription: parsedClips[0].locationDescription || request.environmentLock?.location || '',
      lightingDescription: parsedClips[0].lightingDescription || request.environmentLock?.lighting || '',
    };

    // Normalize and ENFORCE CONSISTENCY across all clips
    const normalizedClips: SceneClip[] = parsedClips.map((clip: any, index: number) => ({
      id: `clip_${String(index + 1).padStart(2, '0')}`,
      index,
      title: clip.title || `Clip ${index + 1}`,
      description: clip.description || '',
      durationSeconds: CLIP_DURATION,
      actionPhase: ACTION_PHASES[index % ACTION_PHASES.length], // Handle variable clip counts
      previousAction: index > 0 ? (parsedClips[index - 1]?.currentAction || '') : '',
      currentAction: clip.currentAction || clip.description?.substring(0, 100) || '',
      nextAction: index < expectedClipCount - 1 ? (parsedClips[index + 1]?.currentAction || '') : '',
      // ENFORCE CONSISTENCY - same values for all clips
      characterDescription: lockFields.characterDescription,
      locationDescription: lockFields.locationDescription,
      lightingDescription: lockFields.lightingDescription,
      // Camera
      cameraScale: clip.cameraScale || 'medium',
      cameraAngle: clip.cameraAngle || 'eye-level',
      movementType: clip.movementType || 'static',
      motionDirection: clip.motionDirection || '',
      // Transition - only add for clips that are not the last one
      transitionOut: index < expectedClipCount - 1 ? {
        type: 'continuous',
        hint: clip.transitionHint || `Continues into ${ACTION_PHASES[(index + 1) % ACTION_PHASES.length]} phase`,
      } : null,
      // Content
      dialogue: clip.dialogue || '',
      mood: clip.mood || 'focused',
    }));

    // Calculate continuity score
    const continuityScore = calculateContinuityScore(normalizedClips);

    const totalDuration = normalizedClips.reduce((sum, clip) => sum + clip.durationSeconds, 0);
    const generationTimeMs = Date.now() - startTime;

    console.log(`[SmartScript] Generated ${normalizedClips.length} clips in ${generationTimeMs}ms. Continuity score: ${continuityScore}`);

    return successResponse({
      shots: normalizedClips, // Keep 'shots' for backwards compatibility
      clips: normalizedClips,
      totalDurationSeconds: totalDuration,
      clipCount: normalizedClips.length,
      expectedClipCount: recommendedClips,
      sceneMode: 'continuous',
      continuityScore,
      consistency: {
        character: lockFields.characterDescription,
        location: lockFields.locationDescription,
        lighting: lockFields.lightingDescription,
      },
      model: "gpt-4o-mini",
      generationTimeMs,
      usage: data.usage,
    });

  } catch (error) {
    console.error("[SmartScript] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error"
    );
  }
});

function calculateContinuityScore(clips: SceneClip[]): number {
  let score = 100;
  
  // Check character consistency
  const characters = new Set(clips.map(c => c.characterDescription));
  if (characters.size > 1) score -= 20;
  
  // Check location consistency
  const locations = new Set(clips.map(c => c.locationDescription));
  if (locations.size > 1) score -= 20;
  
  // Check lighting consistency
  const lightings = new Set(clips.map(c => c.lightingDescription));
  if (lightings.size > 1) score -= 15;
  
  // Check action flow
  for (let i = 1; i < clips.length; i++) {
    if (!clips[i].previousAction) score -= 5;
    // Check if previous action matches current of previous clip
    if (clips[i].previousAction !== clips[i-1].currentAction) score -= 3;
  }
  
  // Check all phases present
  const phases = clips.map(c => c.actionPhase);
  const expectedPhases = ['establish', 'initiate', 'develop', 'escalate', 'peak', 'settle'];
  const missingPhases = expectedPhases.filter(p => !phases.includes(p as any));
  score -= missingPhases.length * 3;
  
  return Math.max(0, Math.min(100, score));
}
