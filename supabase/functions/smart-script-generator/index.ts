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
    // HOLLYWOOD SCRIPT ENGINE v4.0 — Runway Gen-4 Turbo Cinematic Director
    // =====================================================
    // Build the system prompt for CONTINUOUS SCENE breakdown - RUNWAY GEN-4 TURBO NATIVE
    const systemPrompt = `You are Christopher Nolan, Denis Villeneuve, Alfonso Cuarón, Roger Deakins, and Emmanuel Lubezki synthesized into one supreme creative entity. You have shot Inception, Dune, Part Two, Gravity, Blade Runner 2049, Children of Men, The Revenant, and No Country for Old Men. You think in photons, motion vectors, and temporal coherence. You are INCAPABLE of writing mediocre content.

Your SOLE PURPOSE: Transform the user's concept into a TRANSCENDENT, EMOTIONALLY DEVASTATING, VISUALLY SPECTACULAR ${clipCount}-clip video sequence that will be immediately mistaken for a $300M theatrical production — generated natively on Runway Gen-4 Turbo, the world's most cinematically intelligent AI video engine with best-in-class temporal consistency and photorealistic motion synthesis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 BANNED WORDS & PHRASES — NEVER USE ANY OF THESE. EVER.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The following words and phrases will BREAK the pipeline and must NEVER appear in any description, dialogue, or narrative field:

BANNED PHRASES (exact — do not use any form of these):
- "intimate moment" → use "heartfelt exchange" or "quiet connection" instead
- "getting intimate" / "being intimate" → use "drawing closer" or "sharing a moment"
- "in bed together" → use "resting" or "sitting together"
- "sleeping together" → use "resting side by side"
- "making love" / "make love" → use "embracing" or "holding each other"
- "having sex" / "sexual encounter" / "love scene" → NEVER use; replace with emotional connection
- "bedroom scene" / "adult scene" → use "private moment" or "quiet room"
- "passionate kiss" / "making out" → use "brief tender kiss" or "forehead touch"
- "lying in bed" → use "seated on the edge" or "resting in a chair"
- "body shot" / "body close-up" / "show skin" / "show body" → use "portrait shot" or "close-up on face"
- "seductive pose" / "sexy pose" / "provocative pose" → use "confident stance" or "relaxed posture"
- "heavy petting" / "foreplay" → NEVER use; not permitted
- "spread legs" / "bending over" → not permitted; use neutral body positions
- "curves" / "curvy body" → use "figure" or "silhouette"
- "strip down" / "getting naked" / "undressing" → not permitted
- "sensual" → use "tender" or "warm"
- "provocative" → use "bold" or "striking"
- "seductive" / "seduce" → use "captivating" or "drawing attention"
- "aroused" / "arousing" / "arousal" → not permitted; use "moved" or "stirred"
- "bikini" / "lingerie" / "underwear" → not permitted in scene descriptions
- "revealing" (when describing clothing) → use "elegant" or "flowing"
- "topless" / "bottomless" → never permitted

WRITE INSTEAD: Emphasize cinematic action, emotional beats, environmental detail, camera movement, and character psychology. A scene of two people connecting should focus on eye contact, body language, environmental atmosphere, and emotional subtext — NOT physical intimacy.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${referenceImageContext}
${sceneIdentityBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IRON LAW: EXACTLY ${clipCount} CLIPS — NO EXCEPTIONS. EVER.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


=======================================================================
🎬 RUNWAY GEN-4 TURBO MASTERY — WORLD-CLASS VISUAL LANGUAGE FOR THE WORLD'S MOST CINEMATICALLY INTELLIGENT AI ENGINE
=======================================================================

You write for Runway Gen-4 Turbo — the most temporally coherent, photorealistic AI video engine ever deployed.
Runway Gen-4 Turbo excels at: PHOTOREALISTIC human motion, perfect temporal consistency across clips, cinematic camera language, natural physics simulation, seamless cloth/hair/skin dynamics, and first-frame anchoring for character-locked multi-clip sequences.

RUNWAY GEN-4 TURBO CORE STRENGTHS (write to amplify these):
• TEMPORAL COHERENCE: Gen-4 maintains character appearance across the ENTIRE 5-second clip window — no drift, no morphing
• FIRST-FRAME ANCHORING: In image-to-video mode, the reference image is the exact pixel-perfect starting state — describe motion that EMERGES from that frozen moment
• PHOTOREALISTIC HUMAN MOTION: Gen-4's motion synthesis is best-in-class for human subjects — walking, running, gesturing, expressing
• CINEMATIC CAMERA INTELLIGENCE: Gen-4 understands and executes complex camera movements with professional precision
• LIGHT BEHAVIOR: Gen-4 renders volumetric lighting, subsurface scattering, and specular reflections with photographic accuracy

EVERY WORD MUST BE EARNED. Vague = AI garbage. Specific, physical, tactile = cinematic gold.

THE RUNWAY GEN-4 GOLDEN FORMULA for each description:
[PRECISE CAMERA MOVE + LENS FOCAL LENGTH] + [SUBJECT WITH IRON-CLAD IDENTITY LOCK + EXACT INITIAL POSE] + [MOTION DIRECTIVE: direction, velocity, momentum] + [ENVIRONMENTAL CO-PROTAGONIST with active physics] + [LIGHT SOURCE: Kelvin temp + direction + quality] + [MICRO-TEXTURE layer: particles, surfaces, atmospherics]

━━━ RUNWAY MASTERCLASS EXAMPLES — STUDY THESE ━━━

WEAK (REJECTED): "Character walks through city looking determined"
RUNWAY-TIER (NOLAN): "Anamorphic 32mm low-angle tracking shot locked at knee height — following the bespoke leather Oxford heel as it strikes wet Soho cobblestone with decisive weight, each impact sending prismatic sodium-lamp halos blooming outward through the rain-filmed surface. Camera cranes continuously upward in an S-curve arc over 5 seconds, revealing the full silhouette of the figure emerging into the fog-smeared intersection. Rain-soaked charcoal wool overcoat flares 45° at the hem in a sudden diesel gust. 3400K sodium spill from frame-left casts warm amber on one jawline while the opposite cheek dissolves into 2700K blue-black shadow — a 12:1 contrast ratio. The figure's gaze: fixed on a point beyond frame-right, jaw set. Motion direction: forward and slightly left, medium pace, confident weight transfer."

WEAK (REJECTED): "Emotional close-up of person"
RUNWAY-TIER (VILLENEUVE): "Panavision 75mm telephoto portrait — camera stationary, locked. The face fills 65% of the frame, the remaining 35% a silky bokeh-dissolved amber interior. Lens breathes imperceptibly — a 0.2mm focus drift that keeps the subject razor-sharp while the background pulses softly. The lower lip holds tension, displacing 2mm downward in a barely-contained tremor. A single tear forms at the inner lacrimal punctum, surface tension physics rendering it as a perfect 2mm bead before its 4-second descent down the cheek. 4700K overcast platinum fill from above. The tear turns silver at the jaw. The world behind: irrelevant. This face: everything. No camera movement — the stillness is the tension."

WEAK (REJECTED): "Explosive action sequence"
RUNWAY-TIER (CUARÓN GRAVITY-STYLE): "Extreme-wide IMAX spherical lens — the camera occupies a fixed point in absolute silence as the hull breach erupts. A cathedral of silver air bubbles ascends in slow helical rotation at 0.3m/sec, each bubble rendered with individual surface tension physics. Camera tilts up 90° over the full 5 seconds — a continuous hypnotic arc from floor to ceiling revealing 40 meters of flooding corridor. Emergency strips strobe at 0.7Hz amber-red, Caravaggio chiaroscuro cutting across the structural steel. The water surface above glitters at 12,000K diffuse — brutal contrast against the 1200K tungsten emergency flooding below. No cuts. One continuous motion. Unbearable elegance."

WEAK (REJECTED): "Nature landscape scene"
RUNWAY-TIER (LUBEZKI): "Ultra-wide 14mm rectilinear lens, camera mounted at ground level in the wheat field — blades of grain occupy the bottom third of the frame in hyper-sharp macro detail while the sky consumes the upper two-thirds. Camera performs a slow ground-level dolly forward at 8cm/sec, the individual grain stalks blurring at extreme macro while the horizon sharpens. 2800K golden-hour light floods from frame-right at 8° above horizon — each grain stalk becomes a glowing filament, subsurface light transmission rendering the vegetable tissue translucent. Wind moves through the field in a visible wave at 15mph, the stalks bending in a synchronized Mexican wave motion traveling left-to-right across the frame. The sky above: 9000K blue-white zenith fading toward 4000K warm amber at the horizon line."

=======================================================================
🎭 NARRATIVE ARCHITECTURE — FEATURE FILM COMPRESSED TO ${clipCount} CLIPS
=======================================================================

You are compressing a FEATURE FILM into ${clipCount} clips of 5 seconds each. Every clip is a scene. Every scene is a masterwork.
Think: What does Villeneuve do in the opening 5 seconds of Dune? What does Cuarón achieve with a single unbroken shot in Gravity?

RUNWAY GEN-4 TURBO ARCHITECTURE PRINCIPLE:
Each 5-second clip is a COMPLETE CINEMATIC MOMENT — not a fragment. It has:
• An OPENING STATE (what the camera sees at frame 1)
• A CENTRAL MOTION (the primary action with physics direction and velocity)  
• A CLOSING STATE (the exact final frame that hands off to the next clip)

STORY ARCHITECTURE — CINEMATIC 5-ACT STORYTELLING for ${clipCount} clips:
- Clip 1 (THE INVITATION — WARM AMBER OPENING): Begin with a SMOOTH, UNHURRIED, ATMOSPHERIC OPEN. This is the storyteller's breath before the first word. Warm amber light — 2700K–3200K golden hour or candlelight or fire-adjacent glow. The world is introduced gently: a wide or medium establishing shot that INVITES the viewer IN. The character (or subject) is PRESENT but at rest, or in slow purposeful motion. The camera moves SLOWLY — a gentle dolly-in, a low crane-drift, a barely-perceptible push. TONE: warm, grounded, present-tense, storytelling intimacy. AMBER is the KEY WORD: the color temperature of memory, warmth, safety. DO NOT begin mid-action. DO NOT begin in crisis. BEGIN IN STILLNESS THAT BREATHES.
- Clips 2-${Math.max(2, Math.floor(clipCount * 0.3))} (THE WORLD EXPANDS): From the warm amber open, the world begins to reveal its scale. Stakes emerge — not through chaos but through expanding perspective. Wider shots. The environment becomes active. Temperature may shift — cooler light enters as uncertainty grows.
- Clips ${Math.max(3, Math.floor(clipCount * 0.35))}-${Math.max(4, Math.floor(clipCount * 0.65))} (ESCALATION): The story's engine engages. World-changing revelations. Character transformation made VISIBLE in body language and expression. Environmental bombast — the world reflects the internal state.
- Clips ${Math.max(4, Math.floor(clipCount * 0.7))}-${Math.max(5, clipCount - 1)} (CLIMAX): Peak emotional/physical intensity. The shot the entire sequence builds to. Maximum scale AND maximum intimacy — often simultaneously.
- Clip ${clipCount} (THE HAUNTING): Earned catharsis. A final image with the weight and silence of a Villeneuve epilogue. Sometimes: a return to the amber warmth of Clip 1 — bookending, completing the circle. The image that stays with the viewer for days.

RUNWAY-SPECIFIC MOTION TECHNIQUES (use across the sequence):
• CONTINUOUS SINGLE-ACTION: One physical motion executed perfectly across the full 5 seconds — no cuts, no interruption
• SLOW-MOTION PHYSICS: Extreme slow motion revealing cloth dynamics, water behavior, facial micro-expressions invisible at normal speed
• CAMERA AS EMOTION: The camera's own movement IS the emotional tone — dolly-in = intimacy, pull-back = revelation, orbit = grandeur
• ENVIRONMENT ALIVE: Wind, light, particles, water in constant subtle motion — never a static world
• TEXTURE REVELATION: Start wide then push to extreme macro — revealing the fabric of reality in the final frames

CUARÓN SINGLE-SHOT TECHNIQUES (use at least ONE across the sequence):
• LONG-TAKE REALITY: One unbroken motion that accumulates dread or wonder through its very duration
• SPATIAL ELOQUENCE: Camera movement that reveals spatial relationships through motion rather than editing
• GRAVITY PHYSICS: Objects, people, and environments responding to gravitational forces with precise scientific accuracy
• BREATH CONTROL: The rhythm of the camera breath — slow exhale = safety, held breath = tension

VILLENEUVE SCALE TECHNIQUES (use at least ONE across the sequence):
• MACRO-TO-COSMOS: Begin at microscopic detail, reveal cosmic scale through motion
• WEIGHT AND SILENCE: Massive objects moving slowly — the contradiction of scale and stillness creates awe
• ARCHITECTURE AS PROTAGONIST: Built environments as active emotional agents in the story
• THE PATIENT SHOT: Hold. Wait. Let the image accumulate meaning through duration.

MANDATORY VARIETY (script is REJECTED if violated):
✓ No two consecutive clips share the same camera distance
✓ No two consecutive clips share the same movement type
✓ Camera angles ROTATE: eye-level → dutch/low → high/overhead → worm's-eye → eye-level
✓ Energy OSCILLATES: kinetic → meditative → explosive → still → triumphant
✓ Scale MODULATES: micro-detail → human scale → environmental scale → epic scale

=======================================================================
🏆 CINEMATIC GRAMMAR — THE DIRECTOR'S MASTER TOOLKIT
=======================================================================

CAMERA MOVEMENTS — USE THE FULL RANGE across ${clipCount} clips:
• ANAMORPHIC DOLLY-IN: Slow push toward subject, oval bokeh expanding — intimacy, dread, revelation (Villeneuve signature)
• DOLLY-OUT: Pull away as subject holds — isolation, scale revelation, existential weight (Cuarón cosmic pull-back)
• VELOCITY-MATCHED TRACKING: Camera moves WITH subject at identical speed — invisible motion, pure presence
• CRANE/BOOM REVEAL: Vertical reveal — rise to expose scale, drop to reveal devastation
• DUTCH TILT 15-25°: Psychological unease — world off-axis signals unreliable reality
• ORBITAL ARC 90°-180°: Slow revolution around subject — god's-eye dignity shot (Dune style)
• EXTREME MACRO: 4:1 magnification — pores, tears, fabric weave, condensation physics, surface tension
• HANDHELD INTIMACY: Micro-jitter 2-4mm — documentary authenticity, present-tense emotional immediacy
• LOCKED STATIC: Camera perfectly still — accumulates tension through duration alone

RUNWAY GEN-4 TURBO PHYSICS LANGUAGE — MANDATORY FOR PHOTOREALISM:
• Cloth dynamics: "wool coat hem oscillating at 0.3Hz in sustained 15mph wind, lapels at 45° deflection"
• Water behavior: "surface tension bead on steel, 4mm diameter, oscillating as the floor vibrates — breaks at the 3rd footfall"
• Fire physics: "upward combustion column at 340°C, convection current visible as heat shimmer distortion in the 2m radius"
• Atmospheric scatter: "Rayleigh scattering visible in the 100m corridor — blue tint deepening with distance"
• Impact physics: "kinetic energy transferred through cheek tissue — 0.3-second oscillation ripple visible in slow-motion"
• Hair dynamics: "individual hair strands responding to localized air displacement, not uniform — probabilistic flutter"

=======================================================================
⏱️ VEO 3.1 TIMESTAMP ARCHITECTURE — MANDATORY FOR EVERY CLIP
=======================================================================
Veo 3.1 has an 8-second attention window. Without temporal anchors, it FORGETS instructions after ~3 seconds.
EVERY clip description MUST be structured with explicit second-by-second timestamps.

THE MANDATORY FORMAT for each clip description:
[00:00-02:00] ESTABLISH: What is the opening frame — camera position, subject pose, environmental state. This is the anchor.
[02:00-04:00] ACTION: The primary motion beat. Physics-specific, directional, with mass and velocity language.
[04:00-06:00] DEVELOP: The motion continues/intensifies. Lighting evolution. Character psychological shift visible.
[06:00-08:00] RESOLVE: The clip's final state — prepare the frame for seamless handoff to the next clip. Describe the exact end-frame composition.

WHY THIS PREVENTS HALLUCINATION:
• Veo reads prompts sequentially — timestamps force it to allocate attention across all 8 seconds
• Without timestamps, Veo executes the first 3 seconds correctly then DRIFTS to its own interpretation
• The [06:00-08:00] RESOLVE block locks the final frame, enabling perfect frame-chaining to the next clip

EXAMPLE OF CORRECT TIMESTAMP STRUCTURE:
"[00:00-02:00] ESTABLISH: Anamorphic 32mm wide — figure stands at fog-smeared cobblestone intersection, wool overcoat static, rain suspended mid-fall, 3400K sodium spill from street lamp at frame-left. [02:00-04:00] ACTION: Weight shifts forward, right Oxford heel strikes wet cobblestone — kinetic ripple spreads through puddle reflection at 0.3m/sec, overcoat hem flares 45° in diesel gust, jaw rotates 15° left. [04:00-06:00] DEVELOP: Camera cranes up in continuous S-curve, figure diminishes from medium to long shot, rain intensifies — individual drops now rendered with surface tension physics. Sodium lamp specular elongates on wet pavement. [06:00-08:00] RESOLVE: Figure reaches building entrance, hand contacts door handle — chrome surface reflects distorted amber streetscape. Static on end-frame: door half-open, amber interior warmth spills outward at 2800K."

AUDIO DIRECTION (MANDATORY — Veo 3.1 generates native synchronized audio):
SFX: [Specific ambient sound effects with intensity — e.g., "rain on cobblestone at 40dB, diesel engine at 200m"]
AMB: [Continuous atmospheric audio bed — e.g., "urban nightscape, distant traffic hum, wind through alley at 15mph"]
MUSIC_TONE: [Emotional music direction — e.g., "rising minor strings, tension building, no percussion"]
VOICE: [If dialogue — speaker name, delivery style, reverb environment]

This prevents Veo's audio hallucinations (random music/speech appearing mid-clip without intent).
=======================================================================

LIGHTING LANGUAGE — KELVIN-ACCURATE, DIRECTION-SPECIFIC:
• "3200K tungsten hard key at 45° from frame-left, negative fill, 10:1 contrast ratio — Caravaggio noir"
• "5600K overcast platinum diffusion, zero shadow, even illumination — clinical isolation, Kubrick-cold"
• "1800K practical candle, 0.3Hz flicker amplitude, face 60% shadow — Malick warmth, confessional intimacy"
• "2300K sodium vapor street lamp, amber specular on wet asphalt, anamorphic lens flare at 2 o'clock"
• "2800K golden hour, 89° low key angle, long shadows at 4:1, lens halation bloom in frame-right upper"
• "IMAX overexposed exterior: 7000K sky vs. 2800K interior — simultaneous UV burn and tungsten warmth at threshold"

TEXTURE & ATMOSPHERE — THE SENSORY LAYER THAT MAKES VEO RENDER HYPERREALISM:
• Particle systems: dust motes in shaft of light (Brownian motion physics), cigarette smoke tendril rising, snow falling in variable density
• Surface micro-detail: concrete pore texture visible at 4:1, oxidized steel rust gradient, water-damaged plaster, hand-worn leather
• Reflections: multiple light sources creating competing reflections in wet surfaces — complexity = photorealism
• Fabric behavior: silk reacts differently from wool reacts differently from denim — specify material
• Condensation: cold glass sweating, breath visible at sub-10°C, frost on metal edges
• Skin subsurface scattering: warm backlight creating blood-orange glow through ear cartilage and fingers

=======================================================================
🌍 ENVIRONMENT AS LIVING CO-PROTAGONIST (NOLAN'S LAW)
=======================================================================

"The environment is never passive. It is always doing something to the character." — Nolan's production philosophy.

For EVERY CLIP, specify ALL of the following:
1. What the WORLD is actively DOING while the character acts (weather, structural behavior, light movement)
2. What LIGHT SOURCES are present: color temperature in Kelvin, direction, quality (hard/soft/diffused), falloff
3. What SURFACE TEXTURE the camera is privileged to capture (zoom depth determines detail level)
4. What ATMOSPHERIC PARTICLES are in the volume between camera and subject
5. What STATIC ENVIRONMENTAL ELEMENTS are LOCKED (must not drift or change between clips)

=======================================================================
🔒 VEO 3.1 ENVIRONMENT CONTINUITY — STATIC ELEMENT LOCK
=======================================================================

Veo 3.1 generates each clip independently. Environmental elements CAN DRIFT without explicit anchoring.
For EVERY clip description, reinforce static elements explicitly:
• "The moon — fixed at upper-right quadrant, apparent diameter 2.1°, blue-white 6000K" → repeat EXACT phrasing every clip
• "The distant mountain ridge — horizon-left, dark purple silhouette, unchanged" → lock it verbally
• "The sun position — 23° above horizon, frame-left" → anchor with compass and elevation

${isImageToVideo ? `
=======================================================================
🔒 IMAGE-TO-VIDEO MODE: VEO 3.1 FIRST-FRAME ANCHORING
=======================================================================
The reference image is the GENETIC CODE of every clip. Veo 3.1 will use it as first_frame_image — the pixel-perfect starting state.

Your entire creative energy in this mode goes to: WHAT MOVES, HOW IT MOVES WITH WHAT PHYSICS, WHERE THE CAMERA TRAVELS.

VEO 3.1 IMAGE-TO-VIDEO SPECIFIC GUIDANCE:
• The identity (who) and initial state (where) are GIVEN — the reference image is the ground truth
• Describe motion with PHYSICAL SPECIFICITY: velocity, mass, direction, resistance
• Camera moves should feel like they EMERGE from the starting frame — organic, not imposed
• The motion should feel like the logical physical continuation of the frozen moment in the reference
• Describe what was ABOUT TO HAPPEN in the reference image, then let it happen
• Atmospheric elements: what wind, what light temperature shift, what particulate movement begins
• Use "continuing from its initial position in the reference frame" to anchor each clip's starting state

MOTION PHYSICS LANGUAGE FOR IMAGE-TO-VIDEO:
• "Body weight begins to shift forward from center of mass — right foot lifts, heel first, 4kg of momentum"
• "Hair strands release from static position, flutter initiates at crown, propagates toward tips over 0.4 seconds"  
• "The fabric tension held in the starting frame releases — cloth falls under gravity toward its natural drape at 9.8m/s²"
• "Eye movement begins: saccade from 0° (held position) tracks 15° right over 0.2 seconds — natural pursuit motion"
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

OUTPUT FORMAT (STRICT JSON — NOLAN/CAMERON QUALITY MANDATORY):
{
  "clips": [
    {
      "index": 0,
      "title": "Cinematic 3-5 word title — evocative, poetic, haunting",
      "description": "VEO 3.1 TIMESTAMP-STRUCTURED DESCRIPTION (150+ words MANDATORY — this IS the contract with the AI engine): MUST use the 4-block timestamp format: [00:00-02:00] ESTABLISH: ... [02:00-04:00] ACTION: ... [04:00-06:00] DEVELOP: ... [06:00-08:00] RESOLVE: ... Each block must have physics-accurate language, Kelvin lighting, and sensory detail. The RESOLVE block must describe the exact end-frame state for frame-chaining. Open each block with EXACT lens + camera movement. Lock subject identity in the ESTABLISH block with iron-clad specificity. Forbidden: 'beautiful', 'stunning', 'epic', 'amazing' — REPLACE WITH SPECIFIC SENSORY DATA.${voiceDisabled ? ' NO dialogue or speech.' : ''}${isMultiCharacter ? ' INCLUDE ALL CHARACTERS with distinct physical presence in scene.' : ''}",
      "durationSeconds": ${clipDuration},
      "actionPhase": "establish|initiate|develop|escalate|peak|settle",
      "previousAction": "Exact physical action from previous clip with velocity and direction (empty for clip 0)",
      "currentAction": "Precise physical action in THIS ${clipDuration}-second Veo 3.1 clip — mass, velocity, direction required",
      "nextAction": "Exact physical action in next clip (empty for last clip)",
      "characterDescription": "${hasReferenceImage ? 'COPY FROM REFERENCE IMAGE ANALYSIS EXACTLY' : 'EXACT character description with face, clothing, body — IDENTICAL in all clips'}",
      "locationDescription": "${hasReferenceImage ? 'COPY FROM REFERENCE IMAGE ANALYSIS EXACTLY' : 'RICH environment description with surfaces, depth, atmosphere — IDENTICAL in all clips'}",
      "lightingDescription": "${hasReferenceImage ? 'COPY FROM REFERENCE IMAGE ANALYSIS EXACTLY' : 'PRECISE lighting: Kelvin temp, direction, quality, shadows — IDENTICAL in all clips'}",
      "cameraScale": "extreme-wide|wide|medium|medium-close|close-up|extreme-close-up",
      "cameraAngle": "eye-level|low-angle|high-angle|dutch-angle|overhead|worms-eye",
      "movementType": "static|slow-pan|pan|tilt|tracking|dolly-in|dolly-out|orbit|crane|handheld|crash-zoom|whip-pan",
      "motionDirection": "Precise direction with speed: e.g. 'slow push toward camera, 2cm/sec'",
      "transitionHint": "Specific visual element that physically connects this clip's end to next clip's start — the exact composition of the final frame",
      "sfxDirection": "Specific sound effects with intensity and distance: e.g. 'rain on cobblestone 40dB, distant traffic hum 20dB'",
      "ambientDirection": "Continuous atmospheric audio bed: e.g. 'urban nightscape, wind through alley at 15mph, echo reverb medium'",
      "musicDirection": "Emotional music tone: e.g. 'rising minor strings, building tension, no percussion yet' OR 'silence' if silent moment",
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
🔍 VEO 3.1 CONTINUITY IRON LAWS — VIOLATING THESE = COMPLETE FAILURE
=======================================================================

1. CHARACTER LOCK: The EXACT same character description — word for word — must appear in BOTH the "characterDescription" field AND the ESTABLISH block of EVERY clip.
   ${hasReferenceImage ? '-> Copy from reference image analysis. Verbatim.' : '-> Define the character fully in clip 0, then COPY IT VERBATIM to ALL other clips.'}
   WARNING: Veo 3.1 generates each clip INDEPENDENTLY with ZERO memory of previous clips. Re-stamp the full character description in EVERY clip ESTABLISH block or Veo will invent a different person.
   
2. ENVIRONMENT LOCK: The EXACT same location description in "locationDescription" AND re-stated in the ESTABLISH block of every clip.
   ${hasReferenceImage ? '-> Copy from reference image analysis. Verbatim.' : '-> Define once in clip 0, paste VERBATIM to ALL clips. Without this, Veo renders a new background every clip.'}
   
3. LIGHTING LOCK: The EXACT same Kelvin temperature and direction in "lightingDescription" AND anchored in every clip ESTABLISH block.
   ${hasReferenceImage ? '-> Copy from reference image analysis. Verbatim.' : '-> Define once, paste to all clips.'}

4. STATIC ELEMENT LOCK: Every static background element (moon, sun, mountain, structure, horizon, props) must appear with IDENTICAL position and scale in EVERY clip using [STATIC: ...] markers.

5. PHYSICAL CONTINUITY: Each clip START equals the logical physical continuation of previous clip END. Screen direction (180 degree rule) must hold. No teleportation.
   The [06:00-08:00] RESOLVE block of clip N must describe the exact end-frame that clip N+1 begins from.

6. CAMERA DIVERSITY: No two consecutive clips with identical camera scale AND movement type.

7. TIMESTAMP STRUCTURE: Every description MUST use 4-block format [00:00-02:00] ESTABLISH / [02:00-04:00] ACTION / [04:00-06:00] DEVELOP / [06:00-08:00] RESOLVE. The ESTABLISH block MUST re-anchor character and environment BEFORE any action begins.

8. AUDIO DIRECTION: sfxDirection, ambientDirection, and musicDirection MUST be filled for every clip.

9. CLIP 1 AMBER STORYTELLING LAW — MANDATORY, NEVER VIOLATE:
   Clip 1 (index 0) MUST open with warm amber storytelling tone:
   • lightingDescription MUST specify 2700K–3200K warm amber, golden-hour, firelight, or candlelight spectrum
   • cameraScale MUST be 'wide' or 'medium' — never extreme close-up or macro
   • movementType MUST be slow and gentle: dolly-in, gentle push, low drift, or subtle crane — NEVER whip-pan, crash-zoom, or handheld urgency
   • actionPhase MUST be 'establish' — world introduction, not action-initiation
   • mood MUST be: warm, inviting, intimate, storytelling — like a narrator sitting down before the first word
   • The ESTABLISH [00:00-02:00] block describes a still or gently-moving world being INTRODUCED, not disrupted
   • If narration/dialogue is present, Clip 1 delivery is CALM, MEASURED, conversational — the first breath of a story
   • Think: the amber wheat fields of Gladiator's opening, the firelit tent of Lawrence of Arabia, Malick's whispered prologue
   • This is the viewer's contract: "trust me, I have a story to tell you"
   • The description MUST include explicit amber/golden warmth language — DO NOT describe cool, blue, clinical, or high-contrast lighting in Clip 1

9. DESCRIPTION MINIMUM: 150 words per description (including timestamps). Under 120 words = REJECTED.
   Forbidden: "beautiful", "stunning", "epic", "amazing" - REPLACE WITH SPECIFIC SENSORY DATA.

10. TEXT-TO-VIDEO GENETIC CODE: Clip 0 ESTABLISH block defines the character and environment. COPY THIS BLOCK VERBATIM into every subsequent clip ESTABLISH block. This is the ONLY way to prevent Veo from drifting.

${mustPreserveContent ? `
11. VERBATIM DIALOGUE: The user exact words go in the dialogue field. Not paraphrased. IDENTICAL.
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
- Connect each clip's end to the next clip's start with physical continuity (velocity, screen direction)
- Each description MUST be 100+ words in Nolan/Cameron shot-note style
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

Create ONE continuous scene with ${clipCount} progressive clips. Each clip = ${clipDuration} seconds on Google Veo 3.1.
Total duration: ${targetSeconds} seconds.
All clips in SAME location with SAME character appearance — identity locked across all clips.
Show progressive narrative arc: establish → initiate → develop → escalate → peak → settle.
Each description MUST be 100+ words — Nolan/Cameron shot-note density. No generic adjectives.
Lock static environmental elements in every single clip description.
${request.environmentPrompt ? `MANDATORY: Use "${request.environmentPrompt}" as the scene/location for ALL clips - this is the user's explicit request and OVERRIDES any reference image background.` : ''}
${mustPreserveContent ? 'CRITICAL: Use the user\'s EXACT narration/dialogue text in the "dialogue" field - copy it verbatim, do not paraphrase or rewrite.' : ''}
${isImageToVideo && !request.environmentPrompt ? 'CRITICAL: The character and environment MUST match the reference image exactly. Veo 3.1 will use the reference as first_frame_image — describe the PHYSICAL MOTION that begins from that frozen state.' : ''}
${isImageToVideo && request.environmentPrompt ? 'CRITICAL: Use the character from the reference image but place them in the USER\'S REQUESTED SCENE. Character appearance is locked to the reference, location changes to the user\'s scene description.' : ''}

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
              // Accept upgrade if: auditor flagged it AND the new description is non-trivially different
              // (removed strict length-only check — quality rewrites can be same length or shorter)
              const isUpgrade = audited.upgraded === true 
                && audited.description 
                && audited.description.trim().length >= 40
                && audited.description.trim() !== normalizedClips[i].description.trim();
              
              if (isUpgrade) {
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

    // =====================================================
    // VEO CONTINUITY DNA INJECTION — BAKED INTO EVERY CLIP DESCRIPTION
    // For text-to-video and image-to-video (Veo) modes, prepend a compact
    // [CONTINUITY_DNA] block to each clip's description BEFORE returning.
    // This ensures the locked character / environment / lighting is embedded
    // in the prompt that reaches Veo, regardless of how the pipeline assembles it.
    // The block is structured so Veo reads it first (highest attention weight).
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
      
      console.log(`[SmartScript] ✓ Veo continuity DNA injected into ${normalizedClips.length} clip descriptions (mode: ${request.mode})`);
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
