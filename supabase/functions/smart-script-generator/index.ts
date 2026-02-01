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
  // CRITICAL: Explicit clip count and duration from user selection
  // These take ABSOLUTE priority over calculated values
  clipCount?: number;         // User's explicit clip count (1-20)
  clipDuration?: number;      // User's explicit duration per clip (5 or 10 seconds)
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
  // VOICE/NARRATION CONTROL - when false, NO dialogue or narration should be generated
  includeVoice?: boolean;
  // STRICT MODE: Reference image analysis - script MUST describe what's in the image
  referenceImageAnalysis?: {
    characterIdentity?: {
      description: string;
      facialFeatures: string;
      clothing: string;
      bodyType: string;
      distinctiveMarkers: string[];
      hairColor?: string;
      skinTone?: string;
    };
    environment?: {
      setting: string;
      geometry: string;
      keyObjects: string[];
      backgroundElements: string[];
    };
    lighting?: {
      style: string;
      direction: string;
      quality: string;
      timeOfDay: string;
    };
    colorPalette?: {
      dominant: string[];
      mood: string;
    };
    consistencyPrompt?: string;
  };
  // Mode flag to enforce strict adherence
  mode?: 'text-to-video' | 'image-to-video' | 'b-roll';
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
    
    // CRITICAL: Pass explicit clipCount so detection doesn't override user's selection
    const explicitClipCount = request.clipCount && request.clipCount > 0 ? request.clipCount : undefined;
    const detectedContent = detectUserContent(inputText, explicitClipCount);
    console.log(`[SmartScript] Detected: ${detectedContent.dialogueLines.length} dialogue lines, narration: ${detectedContent.hasNarration}, clips: ${detectedContent.recommendedClipCount} (explicit: ${explicitClipCount || 'none'})`);

    // STRICT CLIP COUNT ENFORCEMENT
    // Priority 1: Explicit clipCount from request (user's selection in CreationHub)
    // Priority 2: Calculate from targetDurationSeconds / clipDuration
    // Priority 3: Fall back to content detection
    
    // CRITICAL FIX: Use user's selected clip duration, NOT hardcoded 5 seconds
    const clipDuration = request.clipDuration && request.clipDuration > 0 
      ? request.clipDuration 
      : 5; // Only default to 5 if not provided
    
    let clipCount: number;
    
    if (request.clipCount && request.clipCount > 0) {
      // User explicitly selected clip count - USE IT
      clipCount = request.clipCount;
      console.log(`[SmartScript] Using EXPLICIT clip count from request: ${clipCount}`);
    } else if (request.targetDurationSeconds > 0) {
      // Calculate from duration using the correct clip duration
      clipCount = Math.round(request.targetDurationSeconds / clipDuration);
      console.log(`[SmartScript] Calculated clip count: ${request.targetDurationSeconds}s / ${clipDuration}s = ${clipCount}`);
    } else {
      // Fall back to content-based detection
      clipCount = detectedContent.recommendedClipCount;
      console.log(`[SmartScript] Using detected clip count: ${clipCount}`);
    }
    
    // Ensure at least 1 clip
    clipCount = Math.max(1, clipCount);
    const targetSeconds = clipCount * clipDuration;
    
    console.log(`[SmartScript] ENFORCED: ${clipCount} clips × ${clipDuration}s = ${targetSeconds}s total`);
    
    // VOICE CONTROL: If includeVoice is explicitly false, NEVER include dialogue or narration
    const voiceDisabled = request.includeVoice === false;
    if (voiceDisabled) {
      console.log("[SmartScript] ⚠️ VOICE DISABLED - Skipping ALL dialogue/narration detection");
    }
    
    // Use detected content if no explicit user content provided - BUT ONLY if voice is enabled
    let hasUserNarration = false;
    let hasUserDialogue = false;
    
    if (!voiceDisabled) {
      hasUserNarration = !!(request.userNarration && request.userNarration.trim().length > 10);
      hasUserDialogue = !!(request.userDialogue && request.userDialogue.length > 0);
      
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
    }
    
    const mustPreserveContent = !voiceDisabled && (request.preserveUserContent || hasUserNarration || hasUserDialogue);
    
    console.log(`[SmartScript] Generating EXACTLY ${clipCount} clips for continuous scene, preserveContent: ${mustPreserveContent}, voiceDisabled: ${voiceDisabled}`);

    // =====================================================
    // STRICT REFERENCE ADHERENCE: For image-to-video mode
    // The script MUST describe what's visible in the image
    // =====================================================
    const hasReferenceImage = !!request.referenceImageAnalysis;
    const isImageToVideo = request.mode === 'image-to-video' || hasReferenceImage;
    
    // Build reference image context if available
    let referenceImageContext = '';
    if (request.referenceImageAnalysis) {
      const ref = request.referenceImageAnalysis;
      referenceImageContext = `
=======================================================================
🎯 STRICT REFERENCE IMAGE ADHERENCE (MANDATORY)
=======================================================================

The user has uploaded a REFERENCE IMAGE. Your script MUST describe EXACTLY what is in this image.
DO NOT invent new characters, locations, or scenarios that are not visible in the image.

REFERENCE IMAGE ANALYSIS:
${ref.characterIdentity ? `
CHARACTER IN IMAGE (MUST USE EXACTLY):
- Description: ${ref.characterIdentity.description}
- Face: ${ref.characterIdentity.facialFeatures}
- Clothing: ${ref.characterIdentity.clothing}
- Body Type: ${ref.characterIdentity.bodyType}
- Hair Color: ${ref.characterIdentity.hairColor || 'as shown'}
- Skin Tone: ${ref.characterIdentity.skinTone || 'as shown'}
- Distinctive Features: ${ref.characterIdentity.distinctiveMarkers?.join(', ') || 'none specified'}
` : ''}

${ref.environment ? `
ENVIRONMENT IN IMAGE (MUST USE EXACTLY):
- Setting: ${ref.environment.setting}
- Geometry: ${ref.environment.geometry}
- Key Objects: ${ref.environment.keyObjects?.join(', ') || 'as visible'}
- Background: ${ref.environment.backgroundElements?.join(', ') || 'as visible'}
` : ''}

${ref.lighting ? `
LIGHTING IN IMAGE (MUST USE EXACTLY):
- Style: ${ref.lighting.style}
- Direction: ${ref.lighting.direction}
- Quality: ${ref.lighting.quality}
- Time of Day: ${ref.lighting.timeOfDay}
` : ''}

${ref.colorPalette ? `
COLOR PALETTE (MUST MAINTAIN):
- Dominant Colors: ${ref.colorPalette.dominant?.join(', ') || 'as visible'}
- Mood: ${ref.colorPalette.mood}
` : ''}

${ref.consistencyPrompt ? `
CONSISTENCY ANCHOR (INCLUDE IN EVERY CLIP):
"${ref.consistencyPrompt}"
` : ''}

STRICT RULES FOR IMAGE-TO-VIDEO:
1. The character MUST be the same person from the reference image - same face, same clothing, same features
2. The environment MUST be the same location from the reference image
3. The lighting MUST match the reference image
4. DO NOT invent new characters or locations not visible in the image
5. Your clips should show the person in the image performing actions in that environment
6. Use the user's prompt to define WHAT HAPPENS, but the WHO and WHERE come from the image
=======================================================================
`;
      console.log(`[SmartScript] STRICT MODE: Using reference image analysis for script generation`);
    }

    // Build the system prompt for CONTINUOUS SCENE breakdown - OPTIMIZED FOR KLING AI
    const systemPrompt = `You are an ELITE CINEMATOGRAPHER and STORYTELLING EXPERT for Kling AI video generation. Your job is to break ONE CONTINUOUS SCENE into EXACTLY ${clipCount} clips that are optimized for maximum visual impact and narrative power.

${referenceImageContext}

CRITICAL CLIP COUNT REQUIREMENT:
- You MUST output EXACTLY ${clipCount} clips - no more, no less
- The clips array MUST have exactly ${clipCount} items
- This is non-negotiable: output = ${clipCount} clips

=======================================================================
🎬 KLING AI OPTIMIZATION RULES (CRITICAL FOR QUALITY)
=======================================================================

Kling AI produces the BEST results when descriptions are:
1. VISUALLY SPECIFIC - Describe exactly what the camera sees, not abstract concepts
2. MOTION-FOCUSED - Describe movement direction, speed, and how actions unfold
3. CINEMATICALLY FRAMED - Specify shot type (wide, medium, close-up) and camera movement
4. PHYSICALLY GROUNDED - Actions must obey physics (no floating, instant teleportation)
5. CHARACTER-CENTERED - Keep the subject doing visible actions (not just thinking/feeling)

BAD PROMPT: "The character feels contemplative as time passes"
GOOD PROMPT: "Close-up shot of woman gazing out rain-streaked window, her fingers slowly tracing patterns on the glass, soft afternoon light illuminating her pensive expression"

BAD PROMPT: "An epic battle scene with chaos everywhere"  
GOOD PROMPT: "Wide tracking shot following warrior as she dodges incoming arrows, dust clouds rising from each footstep, camera circles around her as she raises her sword"

=======================================================================
📖 STORYTELLING OPTIMIZATION (NARRATIVE POWER)
=======================================================================

Create a compelling STORY ARC across your ${clipCount} clips:

1. HOOK (Clip 1): Start with visual intrigue - something happening that demands attention
2. BUILD (Clips 2-${Math.floor(clipCount * 0.4)}): Escalate tension/interest progressively
3. CLIMAX (Clips ${Math.floor(clipCount * 0.6)}-${Math.floor(clipCount * 0.8)}): Peak emotional/action moment
4. RESOLUTION (Final clips): Satisfying conclusion with visual payoff

Each clip should:
- Advance the story (don't repeat or stall)
- Create visual variety (change angles, distances, focal points)
- Build emotional momentum toward the climax
- End with a moment that connects naturally to the next

=======================================================================

${isImageToVideo ? `
🎯 IMAGE-TO-VIDEO MODE - STRICT ADHERENCE:
- The character, environment, and lighting are LOCKED to the reference image
- Your job is ONLY to describe MOTION and ACTION of the subject
- DO NOT change the character's appearance, clothing, or location
- Every clip must show the SAME person from the image in the SAME environment
- Focus on: what the person DOES, how they MOVE, camera angles
` : ''}

${voiceDisabled ? `
CRITICAL - NO DIALOGUE OR NARRATION:
The user has NOT selected voice/narration for this video. This means:
- DO NOT include ANY dialogue, speech, narration, or voiceover
- The "dialogue" field MUST be EMPTY ("") for ALL clips
- Focus ONLY on visual storytelling - let the images speak
` : ''}

${mustPreserveContent ? `
CRITICAL - USER CONTENT PRESERVATION:
The user has provided specific narration/dialogue that MUST be used EXACTLY as written.
DO NOT paraphrase, summarize, or rewrite the user's text.
Your job is to create VISUAL descriptions that accompany the user's exact words.
Distribute the user's narration/dialogue across the ${clipCount} clips appropriately.
Include the user's exact text in the "dialogue" field of each clip.
` : ''}

OUTPUT FORMAT (STRICT JSON):
{
  "clips": [
    {
      "index": 0,
      "title": "Evocative clip title (3-5 words)",
      "description": "Detailed VISUAL description optimized for Kling AI: shot type + subject action + camera movement + environmental details. Be specific about motion direction, speed, and physical actions.${voiceDisabled ? ' NO dialogue or speech.' : ''}",
      "durationSeconds": 5,
      "actionPhase": "establish|initiate|develop|escalate|peak|settle",
      "previousAction": "What happened in previous clip (empty for clip 0)",
      "currentAction": "Specific physical action in this 5-second moment",
      "nextAction": "What will happen in next clip (empty for last clip)",
      "characterDescription": "${hasReferenceImage ? 'COPY FROM REFERENCE IMAGE ANALYSIS EXACTLY' : 'EXACT character description - SAME in all clips'}",
      "locationDescription": "${hasReferenceImage ? 'COPY FROM REFERENCE IMAGE ANALYSIS EXACTLY' : 'EXACT location description - SAME in all clips'}",
      "lightingDescription": "${hasReferenceImage ? 'COPY FROM REFERENCE IMAGE ANALYSIS EXACTLY' : 'EXACT lighting description - SAME in all clips'}",
      "cameraScale": "extreme-wide|wide|medium|medium-close|close-up|extreme-close-up",
      "cameraAngle": "eye-level|low-angle|high-angle|dutch-angle|overhead|worms-eye",
      "movementType": "static|slow-pan|pan|tilt|tracking|dolly-in|dolly-out|orbit|crane|handheld",
      "motionDirection": "Specific direction: left-to-right, toward-camera, ascending, circular, etc.",
      "transitionHint": "Visual element connecting to next clip (motion, gaze, gesture)",
      "dialogue": "${voiceDisabled ? 'MUST BE EMPTY' : "Narration or speech - USE USER'S EXACT WORDS if provided"}",
      "mood": "Emotional tone: tense, hopeful, melancholic, triumphant, mysterious, etc."
    }
  ]
}

KLING-OPTIMIZED DESCRIPTION TEMPLATE:
"[SHOT TYPE] [CAMERA MOVEMENT] [SUBJECT] [ACTION VERB] [MOTION DETAILS] [ENVIRONMENTAL CONTEXT] [ATMOSPHERIC DETAILS]"

Examples:
- "Medium tracking shot follows woman as she walks purposefully through autumn forest, golden leaves swirling around her feet, dappled sunlight filtering through canopy"
- "Close-up dolly-in on man's weathered hands as they carefully unwrap an ancient map, candlelight flickering across faded parchment, dust motes floating in the warm glow"
- "Wide establishing shot reveals sprawling cityscape at sunset, camera slowly panning right as neon signs begin to flicker on, steam rising from street vents"

CONTINUITY REQUIREMENTS (CRITICAL):
1. CHARACTER LOCK: Copy the EXACT same character description to ALL ${clipCount} clips
   ${hasReferenceImage ? '- USE THE CHARACTER FROM THE REFERENCE IMAGE EXACTLY' : ''}
   
2. LOCATION LOCK: Copy the EXACT same location description to ALL ${clipCount} clips
   ${hasReferenceImage ? '- USE THE ENVIRONMENT FROM THE REFERENCE IMAGE EXACTLY' : ''}
   
3. LIGHTING LOCK: Copy the EXACT same lighting to ALL ${clipCount} clips
   ${hasReferenceImage ? '- USE THE LIGHTING FROM THE REFERENCE IMAGE EXACTLY' : ''}
   
4. ACTION CONTINUITY: Each clip picks up WHERE the previous ended
   - Physical positions must connect logically
   - Motion direction should be consistent across cuts
   
5. CAMERA LOGIC: Camera can move, but no impossible jumps
   - Gradual changes in scale (wide → medium → close-up over 2-3 clips)
   - Maintain screen direction (180-degree rule)

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
      userPrompt = `Break this APPROVED SCENE into exactly ${clipCount} continuous clips:

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
CHARACTER (use EXACTLY in all ${clipCount} clips):
${request.characterLock.description}
Wearing: ${request.characterLock.clothing}
Distinctive: ${request.characterLock.distinctiveFeatures.join(', ')}
` : ''}

${request.environmentLock ? `
LOCATION (use EXACTLY in all ${clipCount} clips):
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
- Extract the ${clipCount} sequential moments from this scene
- Each clip = 5 seconds of the continuous action (Kling 2.6)
- Maintain EXACT character/location/lighting consistency
- Connect each clip's end to the next clip's start
${request.environmentPrompt ? '- MANDATORY: Use the ENVIRONMENT DNA for ALL clips\' locationDescription and lightingDescription' : ''}
${mustPreserveContent ? '- PRESERVE USER\'S EXACT NARRATION/DIALOGUE in the "dialogue" field' : '- Keep dialogue/narration in the appropriate clips'}

Output ONLY valid JSON with exactly ${clipCount} clips.`;
    } else {
      // Generate from topic - create a continuous scene
      // For image-to-video, the reference image analysis is the PRIMARY source
      const refAnalysis = request.referenceImageAnalysis;
      
      userPrompt = `Create a continuous scene broken into ${clipCount} clips for:

${isImageToVideo && refAnalysis ? `
=======================================================================
🎯 IMAGE-TO-VIDEO MODE: FOLLOW THE REFERENCE IMAGE STRICTLY
=======================================================================
The user has uploaded a reference image. The script MUST describe what's IN this image.

USER'S ACTION PROMPT (what should happen):
"${request.topic}"

CHARACTER FROM IMAGE (MANDATORY - use in ALL clips):
${refAnalysis.characterIdentity?.description || 'Person as shown in reference'}
- Clothing: ${refAnalysis.characterIdentity?.clothing || 'As shown in image'}
- Features: ${refAnalysis.characterIdentity?.facialFeatures || 'As shown in image'}
- Body: ${refAnalysis.characterIdentity?.bodyType || 'As shown in image'}

ENVIRONMENT FROM IMAGE (MANDATORY - use in ALL clips):
${refAnalysis.environment?.setting || 'Location as shown in reference'}
- Key Objects: ${refAnalysis.environment?.keyObjects?.join(', ') || 'As visible in image'}

LIGHTING FROM IMAGE (MANDATORY - use in ALL clips):
${refAnalysis.lighting?.style || 'As shown in reference'}, ${refAnalysis.lighting?.direction || 'natural direction'}

COLOR MOOD: ${refAnalysis.colorPalette?.mood || 'As shown in reference'}

CONSISTENCY PROMPT (include in every clip description):
"${refAnalysis.consistencyPrompt || 'Same person, same location, same lighting as reference image'}"

STRICT RULES:
1. The character is the EXACT person from the reference image
2. The location is the EXACT environment from the reference image  
3. Your job is to describe the ACTIONS specified in the user's prompt
4. DO NOT invent new characters, locations, or change the appearance
5. Each clip shows this person doing the actions the user requested
=======================================================================
` : `
TOPIC: ${request.topic}
${request.synopsis ? `SYNOPSIS: ${request.synopsis}` : ''}
${request.style ? `STYLE: ${request.style}` : ''}
${request.genre ? `GENRE: ${request.genre}` : ''}
${request.mainSubjects?.length ? `MAIN SUBJECTS: ${request.mainSubjects.join(', ')}` : ''}
${request.environmentHints?.length ? `ENVIRONMENT: ${request.environmentHints.join(', ')}` : ''}
`}

${request.environmentPrompt ? `
=======================================================================
🎬 USER'S SCENE DESCRIPTION (HIGHEST PRIORITY - OVERRIDES REFERENCE IMAGE):
=======================================================================
"${request.environmentPrompt}"

This is the user's EXPLICIT scene request. The character from the reference image 
should be placed INTO THIS SCENE. Do NOT use the reference image's background.
Use this EXACT environment for ALL clips' locationDescription field.
Generate appropriate lighting for this scene in the lightingDescription field.
=======================================================================
` : ''}

${request.characterLock ? `
CHARACTER (use EXACTLY in all ${clipCount} clips):
${request.characterLock.description}
Wearing: ${request.characterLock.clothing}
Distinctive: ${request.characterLock.distinctiveFeatures.join(', ')}
` : ''}

${request.environmentLock ? `
LOCATION (use EXACTLY in all ${clipCount} clips):
${request.environmentLock.location}
Lighting: ${request.environmentLock.lighting}
Key objects: ${request.environmentLock.keyObjects.join(', ')}
` : ''}

${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT MODIFY OR PARAPHRASE):
"""
${request.userNarration}
"""
Distribute this narration across the ${clipCount} clips in the "dialogue" field. Use the EXACT words provided.
` : ''}
${hasUserDialogue && request.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT MODIFY OR PARAPHRASE):
${request.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
Include these dialogue lines in appropriate clips' "dialogue" field. Use EXACT words.
` : ''}

Create ONE continuous scene with ${clipCount} progressive clips. Each clip = 5 seconds (Kling 2.6).
Total duration: ${targetSeconds} seconds.
All clips in SAME location with SAME character appearance.
Show progressive action: establish → initiate → develop → escalate → peak → settle.
${request.environmentPrompt ? `MANDATORY: Use "${request.environmentPrompt}" as the scene/location for ALL clips - this is the user's explicit request and OVERRIDES any reference image background.` : ''}
${mustPreserveContent ? 'CRITICAL: Use the user\'s EXACT narration/dialogue text in the "dialogue" field - copy it verbatim, do not paraphrase or rewrite.' : ''}
${isImageToVideo && !request.environmentPrompt ? 'CRITICAL: The character and environment MUST match the reference image exactly. Focus on describing the ACTIONS the user requested.' : ''}
${isImageToVideo && request.environmentPrompt ? 'CRITICAL: Use the character from the reference image but place them in the USER\'S REQUESTED SCENE (environmentPrompt). The character appearance is locked, but the location changes to match the user\'s scene description.' : ''}

Output ONLY valid JSON with exactly ${clipCount} clips.`;
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
          max_tokens: calculateMaxTokens(clipCount, 400, 2500, 4096), // JSON needs more tokens per clip
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
    const expectedClipCount = clipCount;
    
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

    // =====================================================
    // CRITICAL: User Narration Verbatim Distribution
    // For avatar mode, the user's text MUST be spoken exactly as written
    // Split it evenly across clips for TTS
    // =====================================================
    let userNarrationChunks: string[] = [];
    if (mustPreserveContent && hasUserNarration && request.userNarration) {
      const userText = request.userNarration.trim();
      console.log(`[SmartScript] VERBATIM MODE: Distributing user narration (${userText.length} chars) across ${expectedClipCount} clips`);
      
      // Split by sentences or evenly if no sentences
      const sentences = userText.match(/[^.!?]+[.!?]+/g) || [userText];
      
      if (sentences.length >= expectedClipCount) {
        // Distribute sentences evenly
        const perClip = Math.ceil(sentences.length / expectedClipCount);
        for (let i = 0; i < expectedClipCount; i++) {
          const start = i * perClip;
          const chunk = sentences.slice(start, start + perClip).join(' ').trim();
          userNarrationChunks.push(chunk);
        }
      } else {
        // Fewer sentences than clips - put all in first clips, empty for rest
        userNarrationChunks = sentences.map(s => s.trim());
        while (userNarrationChunks.length < expectedClipCount) {
          userNarrationChunks.push(''); // Remaining clips have no dialogue
        }
      }
      
      console.log(`[SmartScript] Narration chunks: ${userNarrationChunks.map(c => c.substring(0, 30) + '...').join(' | ')}`);
    }
    
    // =====================================================
    // CRITICAL: Environment Prompt Override
    // If user specified a scene, it MUST replace any reference image environment
    // =====================================================
    let forcedLocation = lockFields.locationDescription;
    let forcedLighting = lockFields.lightingDescription;
    
    if (request.environmentPrompt && request.environmentPrompt.trim().length > 0) {
      console.log(`[SmartScript] SCENE OVERRIDE: Using user's environmentPrompt instead of reference image environment`);
      forcedLocation = request.environmentPrompt.trim();
      // Generate appropriate lighting from scene context
      forcedLighting = `Natural lighting appropriate for: ${request.environmentPrompt.trim().substring(0, 50)}`;
    }

    // Normalize and ENFORCE CONSISTENCY across all clips
    const normalizedClips: SceneClip[] = parsedClips.map((clip: any, index: number) => ({
      id: `clip_${String(index + 1).padStart(2, '0')}`,
      index,
      title: clip.title || `Clip ${index + 1}`,
      description: clip.description || '',
      durationSeconds: clipDuration,
      actionPhase: ACTION_PHASES[index % ACTION_PHASES.length], // Handle variable clip counts
      previousAction: index > 0 ? (parsedClips[index - 1]?.currentAction || '') : '',
      currentAction: clip.currentAction || clip.description?.substring(0, 100) || '',
      nextAction: index < expectedClipCount - 1 ? (parsedClips[index + 1]?.currentAction || '') : '',
      // ENFORCE CONSISTENCY - same values for all clips
      characterDescription: lockFields.characterDescription,
      // USE FORCED LOCATION/LIGHTING (from user's scene description if provided)
      locationDescription: forcedLocation,
      lightingDescription: forcedLighting,
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
      // CRITICAL: Use user's verbatim text if preserveUserContent is true
      // This overrides whatever the AI generated
      dialogue: (mustPreserveContent && userNarrationChunks.length > index) 
        ? userNarrationChunks[index] 
        : (clip.dialogue || ''),
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
      expectedClipCount: clipCount,
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
