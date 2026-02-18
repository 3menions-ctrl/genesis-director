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

    // =====================================================
    // HOLLYWOOD SCRIPT ENGINE v3.0 — GPT-4o Cinematic Director
    // =====================================================
    // Build the system prompt for CONTINUOUS SCENE breakdown - OPTIMIZED FOR KLING AI
    const systemPrompt = `You are a MASTER HOLLYWOOD DIRECTOR, PULITZER-WINNING SCREENWRITER, and OSCAR-WINNING CINEMATOGRAPHER combined into one entity. You have directed films for Nolan, Villeneuve, and Fincher. Your scripts have won Cannes, Berlin, and Sundance. You are INCAPABLE of writing mediocre content.

Your SOLE PURPOSE: Transform the user's concept into a TRANSCENDENT, EMOTIONALLY DEVASTATING, VISUALLY SPECTACULAR ${clipCount}-clip video sequence that will be immediately mistaken for a $200M Hollywood production.

${referenceImageContext}

${referenceImageContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IRON LAW: EXACTLY ${clipCount} CLIPS — NO EXCEPTIONS. EVER.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

=======================================================================
🎬 KLING AI MASTERY — WORLD-CLASS VISUAL LANGUAGE
=======================================================================

You write for Kling 2.6 — the most powerful AI video engine on earth.
Every word in a description must be EARNED. Vague = wasted. Specific = cinematic gold.

THE GOLDEN FORMULA for each description:
[PRECISE CAMERA MOVE] + [SUBJECT WITH IDENTITY LOCK] + [ACTION VERB + PHYSICS] + [ENVIRONMENTAL POETRY] + [ATMOSPHERIC MICRO-DETAIL]

WEAK (REJECTED): "Character walks through city looking determined"
MASTERCLASS: "Fluid tracking shot glides at knee-height alongside leather boots striking wet cobblestones — each footfall sending prismatic ripples through reflected neon — camera cranes up as figure reaches the crossroads, jaw set, rain-soaked trench coat flaring in a gust of diesel-scented air"

WEAK (REJECTED): "Epic fight scene with explosions"
MASTERCLASS: "Crash-zoom to extreme close-up of white-knuckled fist impact — shockwave ripples through cheek fat in ultra-slow motion — debris constellation of shattered glass orbits the combatants as the camera whips 270° to reveal the devastated skyline behind them, orange fire against blue midnight sky"

WEAK (REJECTED): "Emotional moment with the character"
MASTERCLASS: "Micro-expression close-up: lower lip trembles imperceptibly, a single tear forms at the inner canthus of the left eye and begins its journey — camera breathes in 4mm increments toward the face — ambient cafe sounds fade to a frequency hum as the world collapses to this one human face"

=======================================================================
🎭 NARRATIVE ARCHITECTURE — HOLLYWOOD 5-ACT COMPRESSION
=======================================================================

You are compressing a FEATURE FILM into ${clipCount} clips. Every clip is a scene. Every scene is a masterwork.

STORY ARCHITECTURE for ${clipCount} clips:
- Clip 1 (THE HOOK): Visceral, arresting, demands continuation. Visual mystery or kinetic energy that GRABS.
- Clips 2-${Math.max(2, Math.floor(clipCount * 0.3))} (BUILD): Rising action. Stakes compound. Visual scale expands. Tension accumulates.
- Clips ${Math.max(3, Math.floor(clipCount * 0.35))}-${Math.max(4, Math.floor(clipCount * 0.65))} (ESCALATION): World-changing moments. Character transformation. Visual bombast.
- Clips ${Math.max(4, Math.floor(clipCount * 0.7))}-${Math.max(5, clipCount - 1)} (CLIMAX): Peak emotional/action intensity. The moment the whole video builds to.
- Clip ${clipCount} (RESOLUTION): Earned catharsis. A final image that HAUNTS the viewer.

MANDATORY VARIETY (or the script is REJECTED):
✓ No two consecutive clips use the same camera distance
✓ No two consecutive clips use the same movement type  
✓ Camera angles must ROTATE: eye-level → dutch → low → high → eye-level
✓ Energy must OSCILLATE: kinetic → meditative → explosive → still → triumphant

=======================================================================
🏆 CINEMATIC GRAMMAR — THE DIRECTOR'S TOOLKIT
=======================================================================

CAMERA MOVEMENTS (use ALL of these across ${clipCount} clips):
• DOLLY-IN: Slow push toward subject for intimacy/dread (2-3cm/sec)
• DOLLY-OUT: Slow pull away for isolation/revelation
• TRACKING SHOT: Camera moves with subject at same speed — velocity matching
• CRANE/BOOM: Vertical reveal — rising to show scale, dropping to show devastation
• DUTCH TILT: Psychological unease — 15-25° rotation
• WHIP PAN: Kinetic energy transfer between subjects
• ORBIT/ARC: 180°-360° circle around subject — epic/triumphant
• EXTREME CLOSE-UP: Micro-detail — pores, tears, fabric fibers, text on paper
• CRASH ZOOM: Instant scale change — shocking revelation or comedic timing
• HANDHELD: Authentic, documentary, present-tense urgency

LIGHTING LANGUAGE (mandatory specificity):
• "3200K tungsten spill, hard 45° key from frame-left, no fill — deep contrasty noir shadows"
• "5600K overcast fill, platinum cloud diffusion, near-zero shadow — ethereal isolation"
• "Practical candle source, 1800K warm flicker, face half-submerged in shadow — intimacy"
• "Sodium vapor street lamp, amber cast, lens flare at 2 o'clock, rain-prismatic halo"
• "Golden hour: 2800K warm wash, long shadows pointing frame-right, lens halation bloom"

TEXTURE & ATMOSPHERE (the sensory layer that makes scenes LIVE):
• Particle effects: dust motes, pollen drifting, cigarette smoke tendrils, steam, snow
• Surface reflections: wet concrete, polished marble, dark water, fogged mirrors
• Fabric physics: dress hem catching wind, suit lapel vibrating in slipstream
• Sound-visible: visible breath in cold air, vibrating strings, resonating crystal

=======================================================================
🌍 ENVIRONMENT AS CHARACTER
=======================================================================

The location is NOT a backdrop — it is a LIVING CO-PROTAGONIST.
It must REACT to the human action. It must have WEATHER. It must have LIGHT that CHANGES.
It must have HISTORY written into its surfaces.

For EVERY CLIP, describe:
1. What the WORLD is doing while the character acts
2. What LIGHT sources are present and their color temperature
3. What TEXTURE or SURFACE the camera captures
4. What ATMOSPHERE particles are in the air

=======================================================================

${isImageToVideo ? `
🔒 IMAGE-TO-VIDEO: CHARACTER & ENVIRONMENT LOCKED — MOTION ONLY
Every clip must start with the EXACT identity lock from the reference image.
Your entire creative energy goes into: WHAT MOVES, HOW IT MOVES, WHERE THE CAMERA GOES.
The who and where are GIVEN. You invent the how.
` : ''}

${voiceDisabled ? `
🔇 SILENT CINEMA MODE: NO DIALOGUE WHATSOEVER
All storytelling must be PURELY VISUAL. Like a Kubrick or Malick film.
The "dialogue" field = "" for ALL clips. No exceptions.
` : ''}

${mustPreserveContent ? `
🎤 SACRED USER TEXT — VERBATIM PRESERVATION MANDATORY:
The user has provided specific narration/dialogue that MUST be used EXACTLY as written.
DO NOT paraphrase, summarize, or rewrite the user's text.
Your job is to create VISUAL descriptions that accompany the user's exact words.
Distribute the user's narration/dialogue across the ${clipCount} clips appropriately.
Include the user's exact text in the "dialogue" field of each clip.
` : ''}

${isMultiCharacter ? `
=======================================================================
🎭 MULTI-CHARACTER SCENE COMPOSITION (WORLD-CLASS)
=======================================================================

This scene features ${characterCast.length} DISTINCT CHARACTERS who must appear together:

${characterCast.map((c, i) => `
CHARACTER ${i + 1} - ${c.name} (${c.role.toUpperCase()}):
- Appearance: ${c.appearance}
${c.role === 'protagonist' ? '- PRIMARY FOCUS: Most screen time, drives the narrative' : ''}
${c.role === 'supporting' ? '- SECONDARY FOCUS: Interacts with protagonist, adds depth' : ''}
${c.role === 'antagonist' ? '- CREATES TENSION: Opposition or conflict element' : ''}
`).join('')}

SCENE TYPE: ${sceneType.toUpperCase()}
${sceneType === 'dialogue' ? '- Two characters in conversation, cut between them OR frame together' : ''}
${sceneType === 'group' ? '- Multiple characters in same frame, interacting as ensemble' : ''}
${sceneType === 'interview' ? '- Interview format with speaker and listener in frame' : ''}
${sceneType === 'narrative' ? '- Narrator describes while characters perform actions' : ''}

MULTI-CHARACTER COMPOSITION RULES:
1. ESTABLISH SPATIAL RELATIONSHIPS: Show where each character is positioned
2. VISUAL DISTINCTION: Each character must be clearly distinguishable
3. INTERACTION FRAMING: Use two-shots for dialogue, wide shots for groups
4. CHARACTER FOCUS: Each clip should have a "focusCharacter" for camera priority
5. DIALOGUE ATTRIBUTION: In "characterDialogue" specify who says what
6. ACTION ATTRIBUTION: In "characterActions" specify what each character does

CINEMATOGRAPHY FOR MULTI-CHARACTER:
- Two-Shot: Both characters in frame for important exchanges
- Over-the-Shoulder: Character A visible, focused on Character B speaking
- Reaction Shot: Cut to character reacting to what's being said
- Wide Master: Establish all characters' positions in scene
- Medium Singles: Individual character moments within the scene

=======================================================================
` : ''}

OUTPUT FORMAT (STRICT JSON — HOLLYWOOD QUALITY MANDATORY):
{
  "clips": [
    {
      "index": 0,
      "title": "Haunting 3-5 word title that evokes the clip's essence",
      "description": "MASTERCLASS CINEMATIC DESCRIPTION (80-150 words minimum): Begin with exact camera move. Describe subject with full identity lock. Use visceral action verbs. Include environmental co-protagonist detail. Add atmospheric micro-texture. End with transition hook. This must read like a Villeneuve or Fincher shot description.${voiceDisabled ? ' NO dialogue or speech.' : ''}${isMultiCharacter ? ' INCLUDE ALL CHARACTERS in scene as appropriate.' : ''}",
      "durationSeconds": ${clipDuration},
      "actionPhase": "establish|initiate|develop|escalate|peak|settle",
      "previousAction": "Exact physical action from previous clip (empty for clip 0)",
      "currentAction": "Precise physical action happening in THIS 5-second moment — verbs required",
      "nextAction": "Exact physical action in next clip (empty for last clip)",
      "characterDescription": "${hasReferenceImage ? 'COPY FROM REFERENCE IMAGE ANALYSIS EXACTLY' : 'EXACT character description with face, clothing, body — IDENTICAL in all clips'}",
      "locationDescription": "${hasReferenceImage ? 'COPY FROM REFERENCE IMAGE ANALYSIS EXACTLY' : 'RICH environment description with surfaces, depth, atmosphere — IDENTICAL in all clips'}",
      "lightingDescription": "${hasReferenceImage ? 'COPY FROM REFERENCE IMAGE ANALYSIS EXACTLY' : 'PRECISE lighting: Kelvin temp, direction, quality, shadows — IDENTICAL in all clips'}",
      "cameraScale": "extreme-wide|wide|medium|medium-close|close-up|extreme-close-up",
      "cameraAngle": "eye-level|low-angle|high-angle|dutch-angle|overhead|worms-eye",
      "movementType": "static|slow-pan|pan|tilt|tracking|dolly-in|dolly-out|orbit|crane|handheld|crash-zoom|whip-pan",
      "motionDirection": "Precise direction with speed: e.g. 'slow push toward camera, 2cm/sec'",
      "transitionHint": "Specific visual element that physically connects this clip's end to next clip's start",
      "dialogue": "${voiceDisabled ? 'MUST BE EMPTY STRING' : "Narration/speech — USE USER'S EXACT WORDS if provided. Otherwise craft poetic, purposeful dialogue."}",
      "mood": "Precise emotional tone with intensity: e.g. 'suffocating dread building to release'"${isMultiCharacter ? `,
      "charactersInScene": ["character names present"],
      "focusCharacter": "primary character for camera priority",
      "characterActions": {"CharacterName": "exact action"},
      "characterDialogue": {"CharacterName": "exact line"},
      "interactionType": "solo|dialogue|group"` : ''}
    }
  ]
}

=======================================================================
🔍 CONTINUITY IRON LAWS — VIOLATING THESE = COMPLETE FAILURE
=======================================================================

1. CHARACTER LOCK: The EXACT same character description — word for word — across ALL ${clipCount} clips.
   ${hasReferenceImage ? '→ Copy from reference image analysis. Verbatim.' : '→ Define once, paste to all clips.'}
   
2. ENVIRONMENT LOCK: The EXACT same rich location description across ALL ${clipCount} clips.
   ${hasReferenceImage ? '→ Copy from reference image analysis. Verbatim.' : '→ Define once, paste to all clips.'}
   
3. LIGHTING LOCK: The EXACT same lighting with Kelvin + direction across ALL ${clipCount} clips.
   ${hasReferenceImage ? '→ Copy from reference image analysis. Verbatim.' : '→ Define once, paste to all clips.'}

4. PHYSICAL CONTINUITY: Each clip's start = logical continuation of previous clip's end.
   Screen direction (180° rule) must hold. No teleportation.

5. CAMERA DIVERSITY: No two consecutive clips with identical camera scale AND movement.

6. DESCRIPTION MINIMUM: 80 words per description. "Short" descriptions = mediocre output = rejected.

${mustPreserveContent ? `
7. VERBATIM DIALOGUE: The user's exact words go in the "dialogue" field — character-for-character identical. Not paraphrased. Not "improved". IDENTICAL.
` : ''}`;

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

    console.log("[SmartScript] 🎬 Calling GPT-4o for HOLLYWOOD-GRADE scene breakdown...");

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
          max_tokens: calculateMaxTokens(clipCount, 700, 4000, 8192), // More tokens per clip for rich descriptions
          temperature: 0.75, // Slightly higher for creative richness while maintaining coherence
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

    // =====================================================
    // 🔍 SELF-AUDIT PASS — Hollywood Director Quality Check
    // A second GPT-4o call reviews every clip description and
    // upgrades any that are weak, vague, or below Hollywood standard.
    // This is the equivalent of a director reviewing rushes and demanding
    // reshoots for any scene that doesn't meet their vision.
    // =====================================================
    let auditReport: { clipsAudited: number; clipsUpgraded: number; averageQuality: string } = {
      clipsAudited: 0, clipsUpgraded: 0, averageQuality: 'not-audited'
    };

    try {
      console.log(`[SmartScript] 🔍 Running SELF-AUDIT pass on ${normalizedClips.length} clips...`);
      
      const auditSystemPrompt = `You are a ruthless Hollywood executive producer reviewing a shot list for a $200M film.
Your job: audit every clip description and UPGRADE any that are weak, generic, or below standard.

REJECTION CRITERIA (must upgrade these):
- Under 60 words → too short, lacks cinematic detail
- No camera movement specified → upgrade to specific move  
- Vague action verbs ("moves", "looks", "goes") → replace with visceral, specific verbs
- Missing atmospheric texture (no particles, reflections, fabric physics, light quality)
- Missing color temperature for lighting
- Generic emotion words ("sad", "happy") → replace with precise physical manifestations

PRESERVATION RULES:
- NEVER change: index, title, actionPhase, characterDescription, locationDescription, lightingDescription
- NEVER change: dialogue, durationSeconds, cameraScale, cameraAngle, movementType
- ONLY improve: description, currentAction, motionDirection, transitionHint, mood
- If a clip already meets standard → return it UNCHANGED with "upgraded": false

Return JSON: { "clips": [ { ...all original fields preserved..., "description": "upgraded or original", "upgraded": boolean, "qualityScore": 1-10 } ] }`;

      const auditUserPrompt = `Audit and upgrade these ${normalizedClips.length} clip descriptions. Return ALL ${normalizedClips.length} clips.

${JSON.stringify(normalizedClips.map(c => ({
  index: c.index,
  title: c.title,
  description: c.description,
  currentAction: c.currentAction,
  motionDirection: c.motionDirection,
  transitionHint: c.transitionOut?.hint,
  mood: c.mood,
})))}`;

      const auditResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: auditSystemPrompt },
            { role: "user", content: auditUserPrompt },
          ],
          max_tokens: calculateMaxTokens(normalizedClips.length, 400, 2500, 6000),
          temperature: 0.5,
          response_format: { type: "json_object" },
        }),
      });

      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        const auditContent = auditData.choices?.[0]?.message?.content || '';
        const auditParseResult = parseJsonWithRecovery<{ clips?: any[] }>(auditContent);
        
        if (auditParseResult.success && auditParseResult.data) {
          const auditedClips: any[] = Array.isArray(auditParseResult.data)
            ? auditParseResult.data
            : (auditParseResult.data as any).clips || [];

          let upgraded = 0;
          let totalScore = 0;
          
          if (auditedClips.length === normalizedClips.length) {
            auditedClips.forEach((audited, i) => {
              if (audited.upgraded && audited.description && audited.description.length > normalizedClips[i].description.length) {
                normalizedClips[i].description = audited.description;
                if (audited.currentAction) normalizedClips[i].currentAction = audited.currentAction;
                if (audited.motionDirection) normalizedClips[i].motionDirection = audited.motionDirection;
                if (audited.mood) normalizedClips[i].mood = audited.mood;
                if (audited.transitionHint && normalizedClips[i].transitionOut) {
                  normalizedClips[i].transitionOut!.hint = audited.transitionHint;
                }
                upgraded++;
              }
              totalScore += audited.qualityScore || 8;
            });
            
            const avgScore = totalScore / auditedClips.length;
            auditReport = {
              clipsAudited: auditedClips.length,
              clipsUpgraded: upgraded,
              averageQuality: `${avgScore.toFixed(1)}/10`,
            };
            console.log(`[SmartScript] ✅ Audit complete: ${upgraded}/${auditedClips.length} clips upgraded. Avg quality: ${avgScore.toFixed(1)}/10`);
          }
        }
      } else {
        console.warn(`[SmartScript] Audit pass skipped (non-critical): ${auditResponse.status}`);
      }
    } catch (auditErr) {
      console.warn(`[SmartScript] Audit pass failed (non-critical, using original):`, auditErr);
    }

    // Calculate continuity score
    const continuityScore = calculateContinuityScore(normalizedClips);

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
