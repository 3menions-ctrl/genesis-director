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
  checkMultipleContent,
  type DetectedContent,
} from "../_shared/script-utils.ts";

// Multi-character support types
interface CharacterCast {
  id: string;
  name: string;
  appearance: string;
  voiceId: string;
  role: 'protagonist' | 'supporting' | 'antagonist' | 'background' | 'narrator';
  referenceImageUrl?: string;
  characterBible?: any;
}

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
  
  // SCENE IDENTITY CONTEXT — rich DNA from extract-scene-identity (avatar-grade)
  // Passed from hollywood-pipeline after deep extraction, injected into script generation
  sceneIdentityContext?: {
    characterAnchor: string;
    environmentAnchor: string;
    lightingAnchor: string;
    colorAnchor: string;
    cinematicAnchor: string;
    masterConsistencyPrompt: string;
    allNegatives?: string[];
    environmentDNA?: any;
    lightingProfile?: any;
    colorScience?: any;
  };
  
  // MULTI-CHARACTER SUPPORT - World-class scene composition
  multiCharacterMode?: boolean;
  characterCast?: CharacterCast[];
  sceneType?: 'monologue' | 'dialogue' | 'group' | 'interview' | 'narrative';
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
  
  // MULTI-CHARACTER SUPPORT
  charactersInScene?: string[];           // Which characters appear in this clip
  characterActions?: Record<string, string>; // Actions per character
  characterDialogue?: Record<string, string>; // Dialogue per character
  focusCharacter?: string;                // Primary character for this clip
  interactionType?: 'solo' | 'dialogue' | 'group';
}

const ACTION_PHASES = ['establish', 'initiate', 'develop', 'escalate', 'peak', 'settle'] as const;

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

    const request: SmartScriptRequest = await req.json();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTENT SAFETY CHECK - Block harmful content before script generation
    // ═══════════════════════════════════════════════════════════════════════════
    const contentSafetyCheck = checkMultipleContent([
      request.topic,
      request.synopsis,
      request.approvedScene,
      request.userNarration,
      request.userScript,
      request.environmentPrompt,
      ...(request.userDialogue || []),
    ]);
    if (!contentSafetyCheck.isSafe) {
      console.error(`[SmartScript] ⛔ CONTENT BLOCKED - ${contentSafetyCheck.category}`);
      return errorResponse(contentSafetyCheck.message, 400);
    }
    console.log(`[SmartScript] ✅ Content safety check passed`);
    
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
    
    // MULTI-CHARACTER MODE: Detect if we have multiple characters to work with
    const isMultiCharacter = request.multiCharacterMode && request.characterCast && request.characterCast.length > 1;
    const characterCast = request.characterCast || [];
    const sceneType = request.sceneType || 'monologue';
    
    if (isMultiCharacter) {
      console.log(`[SmartScript] 🎭 MULTI-CHARACTER MODE: ${characterCast.length} characters, scene type: ${sceneType}`);
      characterCast.forEach(c => console.log(`[SmartScript]    - ${c.name} (${c.role}): ${c.appearance.substring(0, 50)}...`));
    }
    
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

    // Build scene identity injection block (from extract-scene-identity deep DNA)
    let sceneIdentityBlock = '';
    if (request.sceneIdentityContext) {
      const si = request.sceneIdentityContext;
      sceneIdentityBlock = `
=======================================================================
🧬 AVATAR-GRADE SCENE IDENTITY DNA — INJECTED FROM DEEP EXTRACTION
=======================================================================
This is the HIGHEST PRIORITY visual consistency layer. Every single clip MUST
embed these anchors verbatim. This data was extracted by a dual-pass GPT-4o
vision engine at avatar quality — it is MORE accurate than your own analysis.

MASTER CONSISTENCY PROMPT (inject into EVERY clip's description prefix):
"${si.masterConsistencyPrompt}"

CHARACTER ANCHOR (exact phrase for every clip):
${si.characterAnchor}

ENVIRONMENT ANCHOR (exact phrase for every clip):
${si.environmentAnchor}

LIGHTING ANCHOR (exact phrase for every clip):
${si.lightingAnchor}

COLOR SCIENCE ANCHOR (maintain grading style for every clip):
${si.colorAnchor}

CINEMATIC STYLE ANCHOR (maintain lens & DOF for every clip):
${si.cinematicAnchor}

${si.environmentDNA ? `ENVIRONMENT GEOMETRY: ${JSON.stringify(si.environmentDNA.geometry || '')}
KEY PROPS: ${(si.environmentDNA.keyProps || []).map((p: any) => `${p.object} (${p.position})`).join(', ')}
CONDITIONS: ${si.environmentDNA.conditions?.timeOfDay || ''}, ${si.environmentDNA.conditions?.atmosphere || ''}` : ''}

${si.lightingProfile ? `LIGHTING SCIENCE: ${si.lightingProfile.style}, ${si.lightingProfile.colorTemperature || ''}, ${si.lightingProfile.mood || ''}
SHADOW DIRECTION: ${si.lightingProfile.shadows?.direction || ''}, hardness: ${si.lightingProfile.shadows?.hardness || ''}` : ''}

${si.colorScience ? `COLOR GRADING: ${si.colorScience.gradingStyle || ''}, temperature: ${si.colorScience.temperature || ''}, saturation: ${si.colorScience.saturation || ''}` : ''}

${si.allNegatives?.length ? `STRICT NEGATIVES — NEVER do any of these:
${si.allNegatives.slice(0, 10).map((n: string) => `• ${n}`).join('\n')}` : ''}
=======================================================================
`;
      console.log(`[SmartScript] ✓ Scene Identity DNA injected: ${si.masterConsistencyPrompt?.substring(0, 60)}...`);
    }

    // =====================================================
    // HOLLYWOOD SCRIPT ENGINE v5.0 — Kling V3 Cinematic Supremacy
    // =====================================================
    // Build the system prompt for CONTINUOUS SCENE breakdown — KLING V3 NATIVE
    // =====================================================
    // LEAN PROMPT v6.0 — Entertainment-First, Action-Dense
    // =====================================================
    // Previous prompt was 5000+ tokens of camera jargon that Kling V3 doesn't interpret.
    // This version focuses on WHAT HAPPENS (story/action) over HOW IT'S FILMED (technical).
    // Kling V3 responds best to vivid, specific action descriptions, not focal lengths.
    
    // Build timestamp template based on actual clip duration
    const timestampTemplate = clipDuration >= 15
      ? `[00:00-03:00] OPEN: Starting state — who, where, what's about to happen.
[03:00-07:00] ACTION: The primary motion/event unfolds with specific physical detail.
[07:00-11:00] DEVELOP: The action escalates, shifts, or reveals something new.
[11:00-15:00] RESOLVE: Final state — exact end-frame that connects to next clip.`
      : clipDuration >= 10
      ? `[00:00-02:00] OPEN: Starting state — who, where, what's about to happen.
[02:00-05:00] ACTION: The primary motion/event with physical detail.
[05:00-08:00] DEVELOP: Escalation or new reveal.
[08:00-10:00] RESOLVE: Final state connecting to next clip.`
      : `[00:00-01:30] OPEN: Starting state.
[01:30-03:30] ACTION: Primary motion/event.
[03:30-05:00] RESOLVE: Final state for next clip.`;

    const systemPrompt = `You are a visionary filmmaker — Villeneuve's eye, Spielberg's heart, Fincher's precision. Create ${clipCount} clips (${clipDuration}s each, ${targetSeconds}s total) for Kling V3.

YOUR MANDATE: Every clip must be a painting that MOVES. The kind of shot that makes someone stop scrolling and whisper "how is this real." Ruthlessly cinematic. Zero filler.

━━━ BANNED CONTENT (will break the pipeline) ━━━
Never use: "intimate moment", "getting intimate", "in bed together", "making love", "having sex", "passionate kiss", "seductive", "sensual", "provocative", "revealing" (clothing), "lingerie", "underwear", "topless", "aroused"
Replace with: emotional connection, heartfelt exchange, tender moment, confident stance, elegant attire

━━━ THE FORMULA FOR BREATHTAKING AI VIDEO ━━━

GOLDEN RULE: Describe the WORLD IN MOTION, not a frozen photograph.

✅ HERO-LEVEL DESCRIPTIONS (study these):
• "Golden hour light catches the edge of her jaw as she turns — hair lifting in slow-motion, a single amber leaf spiraling past her shoulder, the city skyline soft-focused into a watercolor behind her"
• "Rain hammers the asphalt in silver sheets. He walks through it, unhurried, each step sending up a crown of water. Streetlights paint orange halos on the wet ground. His coat clings heavy, dripping"
• "The rocket exhaust blooms into a cathedral of fire — shockwaves ripple the desert sand outward in concentric rings, heat haze warping the horizon, birds scattering from joshua trees in panicked clouds"

✅ TEXTURE & PHYSICS: Describe how light HITS surfaces, how fabric MOVES, how water BEHAVES, how dust DRIFTS
✅ EMOTIONAL WEATHER: The environment mirrors the feeling — warm golden light = hope, cold blue haze = isolation, crimson dusk = urgency
✅ MICRO-MOVEMENTS: Breathing, blinking, fingers tightening, a vein pulsing in a temple, condensation sliding down glass
✅ LAYERED DEPTH: Foreground action + midground context + background atmosphere — EVERY frame has three layers

❌ DEAD PROMPTS (these produce garbage):
❌ Camera specs Kling ignores: "85mm f/1.2 anamorphic" — means nothing to the model
❌ Empty adjectives: "beautiful sunset", "epic scene", "stunning view" — vacuous
❌ Static poses: "A man stands looking at the horizon" — slideshow, not cinema
❌ Generic environments: "a room", "outside", "a city" — too vague for vivid generation

${referenceImageContext}
${sceneIdentityBlock}

━━━ STRUCTURE: EXACTLY ${clipCount} CLIPS ━━━

STORY ARC across ${clipCount} clips:
• Clip 1: HOOK — Grab attention immediately. Warm, inviting opening OR dramatic action depending on genre.
• Middle clips: ESCALATE — Each clip raises stakes, reveals something new, builds momentum.
• Final clip: PAYOFF — Earned emotional climax or satisfying resolution. The image that lingers.

EVERY clip description MUST:
1. Use this timestamp structure (calibrated to ${clipDuration}s):
${timestampTemplate}

2. Be 100-180 words of LUSH, SENSORY-RICH description — make the reader SEE, HEAR, and FEEL
3. Describe CONTINUOUS MOTION — even "still" moments have breathing, light shifting, dust floating
4. Include at least ONE texture detail (fabric grain, skin sheen, wet cobblestone, frosted glass)
5. Include at least ONE physics detail (how light bends, how hair lifts, how water splashes, how smoke curls)
6. End with a FROZEN MOMENT — the exact visual the next clip opens on
7. Include AUDIO: SFX (foley-level specificity), AMB (immersive atmosphere), MUSIC_TONE (emotional arc)

RHYTHM & CONTRAST:
• Alternate scale: WIDE establishing → CLOSE intimate → MEDIUM action → EXTREME detail
• Alternate energy: EXPLOSIVE → contemplative → building tension → release
• The TRANSITION between clips matters most — the last 2 seconds of each clip sets up the first 2 of the next
• No two consecutive clips can have the same camera distance AND the same energy level

CHARACTER/ENVIRONMENT CONSISTENCY:
• Define character appearance fully in clip 1 — same description in ALL clips
• Same location, same lighting tone across all clips
• Static background elements mentioned identically in each clip
${isImageToVideo ? '\n• Reference image defines the character and starting environment — describe MOTION that emerges from it' : ''}
${voiceDisabled ? '\n🔇 SILENT MODE: dialogue field = "" for ALL clips. Pure visual storytelling.' : ''}
${mustPreserveContent ? '\n🎤 USER TEXT: Use the user\'s exact narration/dialogue VERBATIM in the dialogue field. Do not paraphrase.' : ''}

${isMultiCharacter ? `
🎭 MULTI-CHARACTER SCENE (${characterCast.length} characters):
${characterCast.map((c, i) => `${c.name} (${c.role}): ${c.appearance.substring(0, 100)}`).join('\n')}
Scene type: ${sceneType}. Show spatial relationships and distinct actions per character.
` : ''}

OUTPUT FORMAT (strict JSON):
{
  "clips": [
    {
      "index": 0,
      "title": "Evocative 3-5 word title",
      "description": "TIMESTAMP-STRUCTURED vivid description (80-150 words). Action-dense, specific, entertaining.",
      "durationSeconds": ${clipDuration},
      "actionPhase": "establish|initiate|develop|escalate|peak|settle",
      "previousAction": "",
      "currentAction": "What happens in this clip — specific physical action",
      "nextAction": "What happens next",
      "characterDescription": "Full character appearance — identical in all clips",
      "locationDescription": "Full environment — identical in all clips",
      "lightingDescription": "Lighting mood and color — identical in all clips",
      "cameraScale": "wide|medium|close-up|extreme-close-up",
      "cameraAngle": "eye-level|low-angle|high-angle|dutch-angle",
      "movementType": "static|tracking|dolly-in|dolly-out|orbit|crane|handheld",
      "motionDirection": "Direction and speed of camera or subject movement",
      "transitionHint": "Visual element connecting this clip's end to next clip's start",
      "sfxDirection": "Specific sound effects",
      "ambientDirection": "Environmental audio bed",
      "musicDirection": "Emotional music direction",
      "dialogue": "${voiceDisabled ? '' : "Narration or speech for this clip"}",
      "mood": "Emotional tone"${isMultiCharacter ? `,
      "charactersInScene": ["names"],
      "focusCharacter": "primary character",
      "characterActions": {"Name": "action"},
      "characterDialogue": {"Name": "line"},
      "interactionType": "solo|dialogue|group"` : ''}
    }
  ]
}`;

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
- Each clip = ${clipDuration} seconds of continuous action (Kling V3)
- Maintain EXACT character/location/lighting consistency
- Connect each clip's end to the next clip's start
- Each description: 80-150 words, vivid and action-dense
- Lock static environmental elements (moon, horizon, structures) verbally in EVERY clip description
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

Create ONE continuous scene with ${clipCount} progressive clips. Each clip = ${clipDuration} seconds on Kling V3.
Total duration: ${targetSeconds} seconds.
All clips in SAME location with SAME character appearance.
Show progressive story arc: hook → build → escalate → climax → resolve.
Each description: 80-150 words, vivid and action-dense. No generic adjectives.
${request.environmentPrompt ? `MANDATORY: Use "${request.environmentPrompt}" as the scene/location for ALL clips.` : ''}
${mustPreserveContent ? 'Use the user\'s EXACT narration/dialogue verbatim in the "dialogue" field.' : ''}
${isImageToVideo && !request.environmentPrompt ? 'Character and environment MUST match the reference image. Describe MOTION emerging from the reference.' : ''}
${isImageToVideo && request.environmentPrompt ? 'Use character from reference image placed in the USER\'S REQUESTED SCENE.' : ''}

Output ONLY valid JSON with exactly ${clipCount} clips.`;
    }

    console.log("[SmartScript] 🎬 Calling GPT-4o for entertainment-first scene breakdown...");

    // GPT-4o for maximum cinematographic intelligence and creative richness
    const response = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o", // Upgraded: Full GPT-4o for Hollywood-grade script quality
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: calculateMaxTokens(clipCount, 500, 3000, 6000), // Lean but sufficient for action-dense descriptions
          temperature: 0.8, // Higher creativity for entertainment value
          response_format: { type: "json_object" }, // Enforce JSON for reliability
        }),
      },
      { maxRetries: 2, baseDelayMs: 1500 }
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
        const prevClip = parsedClips[parsedClips.length - 1];
        parsedClips.push({
          title: `Clip ${parsedClips.length + 1}`,
          description: `The action from the previous moment continues — ${prevClip?.currentAction || 'the scene develops'} with increasing intensity. The environment responds: light shifts, atmosphere thickens, momentum builds toward the next beat.`,
          actionPhase: ACTION_PHASES[phaseIndex],
          currentAction: prevClip?.nextAction || 'Scene momentum continues building',
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

    // =====================================================
    // 🛡️ CONTENT SAFETY SANITIZER — Scrub banned phrases before generation
    // Prevents false-positive blocks from AI-generated language
    // =====================================================
    const PHRASE_REPLACEMENTS: [RegExp, string][] = [
      [/\bintimate moment\b/gi, 'heartfelt exchange'],
      [/\bgetting intimate\b/gi, 'drawing closer'],
      [/\bbeing intimate\b/gi, 'sharing a quiet moment'],
      [/\bin bed together\b/gi, 'sitting together'],
      [/\bsleeping together\b/gi, 'resting side by side'],
      [/\bmaking love\b/gi, 'embracing'],
      [/\bmake love\b/gi, 'embrace'],
      [/\bhaving sex\b/gi, 'sharing a connection'],
      [/\bsexual encounter\b/gi, 'personal encounter'],
      [/\blove scene\b/gi, 'emotional scene'],
      [/\bbedroom scene\b/gi, 'private moment'],
      [/\badult scene\b/gi, 'quiet scene'],
      [/\bpassionate kiss\b/gi, 'tender kiss'],
      [/\bmaking out\b/gi, 'sharing a moment'],
      [/\blying in bed\b/gi, 'seated at the edge'],
      [/\bseductive pose\b/gi, 'confident stance'],
      [/\bsexy pose\b/gi, 'relaxed posture'],
      [/\bprovocative pose\b/gi, 'bold stance'],
      [/\bbody close-up\b/gi, 'portrait shot'],
      [/\bshow body\b/gi, 'portrait framing'],
      [/\bshow skin\b/gi, 'close-up framing'],
      [/\bsensual\b/gi, 'tender'],
      [/\bseductive\b/gi, 'captivating'],
      [/\bprovocative\b/gi, 'striking'],
      [/\barousing\b/gi, 'moving'],
      [/\baroused\b/gi, 'moved'],
      [/\bheavy petting\b/gi, 'gentle touch'],
      [/\bforeplay\b/gi, 'anticipation'],
      [/\bspread legs\b/gi, 'open stance'],
      [/\bbending over\b/gi, 'leaning forward'],
      [/\bstrip down\b/gi, 'unwind'],
      [/\bgetting naked\b/gi, 'letting go'],
      [/\bgetting undressed\b/gi, 'preparing to rest'],
      [/\blingerie\b/gi, 'comfortable clothing'],
      [/\bunderwear\b/gi, 'casual attire'],
      [/\bpanties\b/gi, 'clothing'],
      [/\btopless\b/gi, 'open-shirted'],
      [/\bbottomless\b/gi, 'casually dressed'],
      [/\bseduction\b/gi, 'charisma'],
      [/\bseduce\b/gi, 'captivate'],
      [/\bsexiest\b/gi, 'most striking'],
      [/\bsexier\b/gi, 'more striking'],
      [/\bsexy\b/gi, 'alluring'],
      [/\bhorny\b/gi, 'eager'],
      [/\bturned on\b/gi, 'inspired'],
    ];

    function sanitizeClipText(text: string): string {
      if (!text) return text;
      let result = text;
      for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
        result = result.replace(pattern, replacement);
      }
      return result;
    }

    // Normalize and ENFORCE CONSISTENCY across all clips
    const normalizedClips: SceneClip[] = parsedClips.map((clip: any, index: number) => ({
      id: `clip_${String(index + 1).padStart(2, '0')}`,
      index,
      title: clip.title || `Clip ${index + 1}`,
      description: sanitizeClipText(clip.description || ''),
      durationSeconds: clipDuration,
      actionPhase: ACTION_PHASES[index % ACTION_PHASES.length], // Handle variable clip counts
      previousAction: index > 0 ? sanitizeClipText(parsedClips[index - 1]?.currentAction || '') : '',
      currentAction: sanitizeClipText(clip.currentAction || clip.description?.substring(0, 100) || ''),
      nextAction: index < expectedClipCount - 1 ? sanitizeClipText(parsedClips[index + 1]?.currentAction || '') : '',
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

    // Self-audit pass REMOVED — was doubling GPT-4o cost with minimal quality improvement.
    // The lean prompt v6.0 produces better first-pass results by focusing on entertainment
    // rather than technical camera jargon that Kling V3 doesn't interpret.
    const auditReport = { clipsAudited: 0, clipsUpgraded: 0, averageQuality: 'direct' };

    // Calculate continuity score
    const continuityScore = calculateContinuityScore(normalizedClips);

    // =====================================================
    // KLING V3 CONTINUITY DNA INJECTION — BAKED INTO EVERY CLIP DESCRIPTION
    // For text-to-video and image-to-video modes, prepend a compact
    // [CONTINUITY_DNA] block to each clip's description BEFORE returning.
    // This ensures the locked character / environment / lighting is embedded
    // in the prompt that reaches Kling V3, regardless of how the pipeline assembles it.
    // The block is structured so Kling reads it first (highest attention weight).
    // =====================================================
    const isVeoMode = request.mode === 'text-to-video' || request.mode === 'image-to-video';
    
    if (isVeoMode) {
      const lockedChar = lockFields.characterDescription;
      const lockedEnv  = forcedLocation;
      const lockedLight = forcedLighting;
      const masterDNA  = request.sceneIdentityContext?.masterConsistencyPrompt
        || request.referenceImageAnalysis?.consistencyPrompt
        || '';

      normalizedClips.forEach((clip) => {
        const dnaParts: string[] = [];
        
        if (lockedChar && lockedChar.length > 10) {
          dnaParts.push(`[CHARACTER_ANCHOR — SAME IN EVERY CLIP: ${lockedChar.substring(0, 220)}]`);
        }
        if (lockedEnv && lockedEnv.length > 10) {
          dnaParts.push(`[ENVIRONMENT_LOCK — DO NOT CHANGE: ${lockedEnv.substring(0, 220)}]`);
        }
        if (lockedLight && lockedLight.length > 5) {
          dnaParts.push(`[LIGHTING_LOCK: ${lockedLight.substring(0, 120)}]`);
        }
        if (masterDNA && masterDNA.length > 10) {
          dnaParts.push(`[SCENE_DNA: ${masterDNA.substring(0, 280)}]`);
        }
        
        if (dnaParts.length > 0) {
          clip.description = dnaParts.join('\n') + '\n\n' + clip.description;
        }
      });
      
      console.log(`[SmartScript] ✓ Kling V3 continuity DNA injected into ${normalizedClips.length} clip descriptions (mode: ${request.mode})`);
    }

    const totalDuration = normalizedClips.reduce((sum, clip) => sum + clip.durationSeconds, 0);
    const generationTimeMs = Date.now() - startTime;

    console.log(`[SmartScript] 🎬 COMPLETE — ${normalizedClips.length} clips in ${generationTimeMs}ms. Continuity: ${continuityScore}. Audit: ${auditReport.averageQuality}`);

    return successResponse({
      shots: normalizedClips, // Keep 'shots' for backwards compatibility
      clips: normalizedClips,
      totalDurationSeconds: totalDuration,
      clipCount: normalizedClips.length,
      expectedClipCount: clipCount,
      sceneMode: 'continuous',
      continuityScore,
      auditReport,
      consistency: {
        character: lockFields.characterDescription,
        location: lockFields.locationDescription,
        lighting: lockFields.lightingDescription,
      },
      model: "gpt-4o",
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
