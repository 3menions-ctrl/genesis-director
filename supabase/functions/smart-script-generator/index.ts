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
  mode?: 'text-to-video' | 'image-to-video' | 'avatar' | 'b-roll';
  
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

  // ENGINE TARGETING — tailors prompt structure & vocabulary to the underlying model
  // 'kling'    → Kling V3 (entertainment-first, action-dense, dialogue-aware)
  // 'seedance' → Seedance 2.0 1080p (physics-grade motion, end-frame chaining, lens-aware)
  // 'veo'      → Veo 3 Fast (native audio / physics)
  // 'runway'   → Runway Gen-4 Turbo (character consistency / concise action)
  // 'sora'     → Sora 2 (narrative coherence / longer cinematic beats)
  videoEngine?: 'kling' | 'veo' | 'seedance' | 'runway' | 'sora';
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

    // ═══════════════════════════════════════════════════════════════════
    // ENGINE-AWARE SCRIPTING — Seedance 2.0 vs Kling V3
    // Each model has VERY different prompt sensitivities:
    //   • Kling V3   → entertainment/action-dense, dialogue-aware, ignores lens specs
    //   • Seedance 2.0 → physics-grade motion, lens & camera vocabulary IS interpreted,
    //                    end-frame chaining critical, native 1080p 24fps cinematic
    // ═══════════════════════════════════════════════════════════════════
    const targetEngine: 'kling' | 'veo' | 'seedance' | 'runway' | 'sora' = request.videoEngine || 'kling';
    const isSeedance = targetEngine === 'seedance';
    const enginePersona = isSeedance
      ? 'Seedance 2.0 cinematic mode'
      : targetEngine === 'veo'
        ? 'Veo 3 native-audio physics mode'
        : targetEngine === 'runway'
          ? 'Runway Gen-4 character-consistency mode'
          : targetEngine === 'sora'
            ? 'Sora 2 narrative-coherence mode'
            : 'Kling V3 entertainment mode';
    const generationTargetLabel = targetEngine === 'kling'
      ? 'Kling V3'
      : targetEngine === 'seedance'
        ? 'Seedance 2.0'
        : targetEngine === 'veo'
          ? 'Veo 3 Fast'
          : targetEngine === 'runway'
            ? 'Runway Gen-4 Turbo'
            : 'Sora 2';
    console.log(`[SmartScript] 🎯 ENGINE TARGET: ${targetEngine} (${enginePersona})`);

    const modelBoundDirectives = targetEngine === 'veo'
      ? `\n━━━ MODEL BOUNDS — VEO 3 FAST ━━━\nWrite single-shot beats with natural physics, clear cause/effect motion, and explicit diegetic audio. Favor coherent real-world action over fast cutting. Keep every clip within ${clipDuration}s and avoid unsupported aspect/scene complexity. Dialogue may exist, but audio cues and natural ambience must be specified.`
      : targetEngine === 'runway'
        ? `\n━━━ MODEL BOUNDS — RUNWAY GEN-4 TURBO ━━━\nWrite concise, visually anchored prompts that prioritize character consistency, wardrobe continuity, clean subject-background separation, and one deliberate camera intent per clip. No long dialogue reliance; use action, posture, silhouette, and end-frame continuity.`
        : targetEngine === 'sora'
          ? `\n━━━ MODEL BOUNDS — SORA 2 ━━━\nWrite narrative-causal beats: subject → action → consequence → final tableau. Sora rewards coherent story logic, spatial continuity, and grounded physical transformations. Use audio/ambient cues where helpful, but do not overload with lens jargon.`
          : '';

    const systemPrompt = isSeedance ? `You are a master cinematographer writing for SEEDANCE 2.0 (Bytedance) — a physics-grade, 1080p, 24fps cinematic video model that REWARDS technical precision and PUNISHES vague description.

Create ${clipCount} clips (${clipDuration}s each, ${targetSeconds}s total). Every clip must be of EPIC CINEMATIC PROPORTIONS — the kind of shot that wins at Cannes, that opens a Villeneuve film, that lives rent-free in the audience's head.

━━━ WHY SEEDANCE IS DIFFERENT (READ CAREFULLY) ━━━
Unlike other models, Seedance 2.0:
✅ READS lens specs ("85mm anamorphic", "24mm wide", "macro lens") and applies them
✅ READS camera movement vocabulary ("dolly in", "crane up", "Steadicam orbit", "whip pan", "rack focus")
✅ READS aperture/DOF cues ("f/1.4 shallow depth", "deep focus f/11", "focus pull from foreground to background")
✅ READS motion physics ("inertia", "momentum carry-through", "secondary motion", "weight transfer")
✅ EXCELS at end-frame chaining — the LAST FRAME of each clip MUST be describable as a still image
✅ HONORS frame-rate cues ("slow-motion 120fps ramp", "real-time", "time-lapse", "speed ramp")
✅ DELIVERS native 1080p 24fps with photographic grain — write for FILM, not video
❌ Does NOT respond well to dialogue/lip-sync — keep dialogue field minimal, focus on VISUAL story
❌ Does NOT need "intimate" or generic mood adjectives — give it CONCRETE physics instead

━━━ BANNED CONTENT (will break the pipeline) ━━━
Never use: "intimate moment", "in bed together", "making love", "having sex", "passionate kiss", "seductive", "sensual", "provocative", "lingerie", "topless", "aroused"
Replace with: emotional connection, heartfelt exchange, tender moment, confident stance, elegant attire

━━━ THE SEEDANCE FORMULA — EPIC PROPORTIONS, CINEMATIC PRECISION ━━━

Every clip description is a CINEMATOGRAPHER'S BLOCKING SHEET, not a paragraph. Structure:

1. SHOT SPEC (one sentence, opens the description):
   • Lens: 24mm/35mm/50mm/85mm/100mm macro/anamorphic
   • Aperture: f/1.4 (shallow), f/2.8 (portrait), f/8 (deep), f/11 (epic landscape)
   • Format: shot on 35mm film grain / digital cinema / IMAX 65mm
   • Frame rate cue if relevant: "captured at 48fps for slow-motion ramp"

2. CAMERA CHOREOGRAPHY (one sentence, named movement):
   • Named move: "Steadicam push-in", "crane descent", "dolly orbit clockwise", "drone reveal pull-back", "whip pan left to right", "rack focus from hand to face"
   • Speed: "slow 4-second push", "rapid 1-second whip", "glacial dolly"
   • End point: where the camera lands at the final frame

3. SUBJECT BLOCKING & PHYSICS (3–5 sentences of LIVING motion):
   • Specific body mechanics: "weight shifts to left foot", "shoulder drops as breath releases", "hand opens — fingers uncurl one at a time"
   • Secondary motion: hair lift, fabric drape, dust kick-up, water displacement, smoke curl
   • Inertia & momentum: how mass moves, how it stops, how follow-through carries
   • Micro-expression: blink, jaw tension, breath visible, pupil dilation

4. ENVIRONMENT IN MOTION (2–3 sentences — the world is alive):
   • Atmospheric particulate (dust, snow, embers, mist, rain) with direction and density
   • Light behavior: how it bounces, refracts, scatters through medium
   • Background life: leaves trembling, water rippling, cloth lifting, flames flickering at exact rates

5. END-FRAME LOCK (one sentence — CRITICAL for Seedance chaining):
   • Describe the EXACT still image at frame ${clipDuration * 24} (the final frame)
   • This frame becomes the start frame of the next clip — must be photographable

6. AUDIO BED (one line each):
   • SFX: foley-specific sounds tied to on-screen action
   • AMB: layered atmosphere with directionality
   • SCORE: emotional musical direction with instrumentation hint

━━━ HERO-LEVEL EXAMPLES (study these — Seedance grade) ━━━

EXAMPLE A — INTIMATE PORTRAIT:
"Shot on 85mm anamorphic at f/1.4, 35mm film grain, captured 24fps. Slow 6-second Steadicam push-in from medium-wide to tight close-up, ending with her left eye perfectly center-frame. She turns her head 30 degrees toward the unseen window — chin lifts first, then shoulders rotate, hair (shoulder-length, dark amber) lifts and resettles with gravity's delay. A single breath escapes; the visible exhale catches the cold blue rim light from camera-left, dispersing as warm-cool gradient mist over 1.2 seconds. Background: amber tungsten practical bokeh, octagonal aperture blades visible, soft-focused into watercolor. Dust motes drift down-screen at 3 inches per second through a single shaft of god-light. Final frame: her eye is in razor-sharp focus, eyelashes catching rim light, a single tear pooling at the lower lid but not yet falling — the catchlight forms a perfect crescent. SFX: subtle breath, fabric whisper. AMB: distant rain on glass at -18dB. SCORE: solo cello, low register, sustained Bb."

EXAMPLE B — KINETIC ACTION:
"Shot on 24mm wide at f/5.6, deep focus, IMAX-style 65mm digital. Aggressive 2-second handheld whip-pan left-to-right tracking him as he sprints across the rain-soaked rooftop, ending locked-off at extreme low angle. His body lean: 18-degree forward pitch, arms pumping in opposed rhythm, each footstrike sending a crown-shaped sheet of water 4 feet upward and outward. Coat tails snap 90 degrees behind him with audible flap. Rain falls in silver diagonal sheets at 35 degrees, lit from behind by a single 10K HMI casting hard rim separation. Lightning flash mid-clip: 1/24th second of pure white wash, then return to noir blue-black. Steam vents to his right exhale at exactly the moment he passes — pressure-driven, not decorative. Final frame: he is mid-air leaping the gap between buildings, body in arched silhouette against a lightning-fractured sky, water suspended in droplets around him as if gravity has paused. SFX: heavy footfall splash, coat snap, wind shear. AMB: city-wide thunderstorm with directional thunder rumble. SCORE: pulsing 808 sub, taiko hits on each footstep."

EXAMPLE C — EPIC ESTABLISHING:
"Shot on 14mm ultra-wide at f/11, anamorphic flares, 70mm film stock. 8-second drone-style crane ascent starting at ground level (pebbles, boots, dust) rising vertically to 200ft revealing the full landscape. The valley unfolds: a black basalt cathedral carved by glacier, golden-hour sun grazing the eastern ridge at 12 degrees above horizon, casting 800-foot shadows that move visibly across the valley floor as the camera rises. A river of silver mercury winds through the center, catching light in liquid sequins. Three figures — tiny, scale-defining — stand on the cliff edge stage-right, coats flapping in unison. Sky: cumulus stratus stack, lit from below in coral and rose, with the highest cloud catching pure white-gold. As the camera rises, the horizon line sinks, revealing more world — a second valley, a distant ocean, a curve of earth. Final frame: the three figures are pinpoints, the entire valley visible, sun about to break the ridge into lens flare starburst. SFX: wind grows from -30dB to -12dB as altitude rises. AMB: high-altitude air, distant raven call. SCORE: 90-piece orchestra entering at the 6-second mark, swelling brass."

${referenceImageContext}
${sceneIdentityBlock}

━━━ STRUCTURE: EXACTLY ${clipCount} CLIPS — EPIC ARC ━━━

• Clip 1: COLD OPEN — A single image of such specificity it stops the scroll. Begin in motion.
• Middle clips: ESCALATION ARC — Each clip raises one of: scale, intimacy, stakes, beauty, tension. Vary lens/movement/scale on every cut.
• Final clip: PAYOFF FRAME — The shot the trailer ends on. Earned. Inevitable. Unforgettable.

EVERY clip MUST follow Seedance structure:
1. Shot Spec → 2. Camera Choreography → 3. Subject Blocking & Physics → 4. Environment in Motion → 5. End-Frame Lock → 6. Audio Bed
2. Be 150-220 words — DENSER than Kling because Seedance reads detail
3. Every camera movement is NAMED with speed and end-point
4. Every motion has PHYSICS (inertia, gravity, friction, follow-through)
5. End-Frame Lock is MANDATORY — describes the still that opens the next clip
6. NO two consecutive clips share lens, movement type, AND scale — vary at least two

CHARACTER/ENVIRONMENT CONSISTENCY (Seedance is strict):
• Define character appearance with PHOTOGRAPHIC precision in clip 1, repeat verbatim every clip
• Same location anchored by named landmarks — repeat in every clip's environment description
• Lighting source, direction, and color temperature stated in EVERY clip
${isImageToVideo ? '\n• The uploaded photograph is the visual ground truth. Clip 1 unfreezes that exact frame in real-time motion. Every clip remains chained to this person, this geography, this light source.' : ''}
${voiceDisabled ? '\n🔇 SILENT MODE: dialogue field = "" for ALL clips. Pure visual cinema (Seedance excels here).' : '\n🎤 DIALOGUE: Keep brief — Seedance does not lip-sync. Treat dialogue as voiceover only.'}
${mustPreserveContent ? '\n🎤 USER TEXT: Use the user\'s exact narration/dialogue VERBATIM in the dialogue field as voiceover. Do not paraphrase.' : ''}

${isMultiCharacter ? `
🎭 MULTI-CHARACTER SCENE (${characterCast.length} characters):
${characterCast.map((c) => `${c.name} (${c.role}): ${c.appearance.substring(0, 100)}`).join('\n')}
Scene type: ${sceneType}. State each character's exact spatial position relative to camera in every clip.
` : ''}

OUTPUT FORMAT (strict JSON):
{
  "clips": [
    {
      "index": 0,
      "title": "Evocative 3-5 word title",
      "description": "FULL Seedance-structured description (150-220 words) covering: Shot Spec → Camera Choreography → Subject Blocking & Physics → Environment in Motion → End-Frame Lock → Audio Bed",
      "durationSeconds": ${clipDuration},
      "actionPhase": "establish|initiate|develop|escalate|peak|settle",
      "previousAction": "",
      "currentAction": "Specific physical action with named body mechanics",
      "nextAction": "What happens next — feeds the next clip's opening",
      "characterDescription": "Photographic-precision character appearance — identical in all clips",
      "locationDescription": "Named landmarks + atmosphere — identical in all clips",
      "lightingDescription": "Source, direction, color temperature, quality — identical in all clips",
      "cameraScale": "extreme-wide|wide|medium-wide|medium|medium-close|close-up|extreme-close-up",
      "cameraAngle": "eye-level|low-angle|high-angle|dutch-angle|birds-eye|worms-eye",
      "movementType": "static|dolly-in|dolly-out|tracking|crane-up|crane-down|orbit|steadicam|handheld|whip-pan|rack-focus|drone-reveal",
      "motionDirection": "Direction, speed, end-point of movement",
      "lensSpec": "Lens focal length + aperture (e.g. '85mm anamorphic at f/1.4')",
      "endFrameLock": "Exact description of the final frame as a photographic still",
      "transitionHint": "How this clip's end frame becomes the next clip's start frame",
      "sfxDirection": "Foley-specific sound effects tied to on-screen action",
      "ambientDirection": "Layered atmospheric audio with directionality",
      "musicDirection": "Score direction with instrumentation",
      "dialogue": "${voiceDisabled ? '' : "Brief voiceover line (Seedance does not lip-sync)"}",
      "mood": "Emotional tone"${isMultiCharacter ? `,
      "charactersInScene": ["names"],
      "focusCharacter": "primary character",
      "characterActions": {"Name": "specific physical action"},
      "characterDialogue": {"Name": "voiceover line"},
      "interactionType": "solo|dialogue|group"` : ''}
    }
  ]
}` : `You are a visionary filmmaker — Villeneuve's eye, Spielberg's heart, Fincher's precision. Create ${clipCount} clips (${clipDuration}s each, ${targetSeconds}s total) for ${generationTargetLabel}.

YOUR MANDATE: Every clip must be a painting that MOVES. The kind of shot that makes someone stop scrolling and whisper "how is this real." Ruthlessly cinematic. Zero filler.
${modelBoundDirectives}

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
${isImageToVideo ? '\n• The uploaded photograph IS the story. Clip 1 unfreezes this exact frame. Every clip stays faithful to this person, this world, this light. The image is not a constraint — it is the creative origin.' : ''}
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
      const refAnalysis = request.referenceImageAnalysis;
      
      if (isImageToVideo && refAnalysis) {
        // =====================================================
        // 🎬 IMAGE-IS-THE-STORY MODE — The uploaded image IS the narrative seed
        // =====================================================
        // The script derives its story FROM the image: the frozen moment becomes
        // a living, breathing cinematic sequence. The user's prompt adds flavor,
        // but the WHO, WHERE, MOOD, and implied NARRATIVE come from the photo.
        // =====================================================
        userPrompt = `You are looking at a FROZEN MOMENT captured in a photograph. Your job is to UNFREEZE it — to imagine the seconds before and after this frame, and build a ${clipCount}-clip cinematic sequence that brings this image to life.

=======================================================================
🎬 THE IMAGE IS YOUR STORY — DERIVE EVERYTHING FROM IT
=======================================================================

WHAT THE IMAGE SHOWS:

PERSON / SUBJECT:
${refAnalysis.characterIdentity?.description || 'Subject as visible in reference'}
- Appearance: ${refAnalysis.characterIdentity?.facialFeatures || 'As shown'}
- Clothing: ${refAnalysis.characterIdentity?.clothing || 'As shown'}
- Body Language: ${refAnalysis.characterIdentity?.bodyType || 'As shown'}
- Distinctive Features: ${refAnalysis.characterIdentity?.distinctiveMarkers?.join(', ') || 'As visible'}

ENVIRONMENT / WORLD:
${refAnalysis.environment?.setting || 'Location as shown in reference'}
- Geometry: ${refAnalysis.environment?.geometry || 'As visible'}
- Key Objects: ${refAnalysis.environment?.keyObjects?.join(', ') || 'As visible'}
- Background: ${refAnalysis.environment?.backgroundElements?.join(', ') || 'As visible'}

LIGHTING / ATMOSPHERE:
${refAnalysis.lighting?.style || 'As shown'}, Direction: ${refAnalysis.lighting?.direction || 'natural'}
Quality: ${refAnalysis.lighting?.quality || 'as captured'}, Time: ${refAnalysis.lighting?.timeOfDay || 'as shown'}

COLOR / MOOD:
Palette: ${refAnalysis.colorPalette?.dominant?.join(', ') || 'as visible'}
Emotional Mood: ${refAnalysis.colorPalette?.mood || 'as captured'}

CONSISTENCY DNA (embed in EVERY clip):
"${refAnalysis.consistencyPrompt || 'Same person, same world, same light — exactly as the photograph shows'}"

${request.topic ? `
USER'S CREATIVE DIRECTION (flavor, NOT override):
"${request.topic}"
Use this to inspire WHAT HAPPENS (actions, emotion, story beats) — but the WHO and WHERE
must come from the image above. If the user's prompt conflicts with the image, the IMAGE WINS.
` : `
No specific action requested — derive the story entirely from the image.
Ask yourself: What was happening 5 seconds before this photo was taken? What happens next?
What emotion is frozen in this moment? Build a beautiful, cinematic expansion of this frozen instant.
`}

=======================================================================
HOW TO BUILD THE STORY FROM THE IMAGE:
=======================================================================
1. CLIP 1 opens on this EXACT image — describe the frozen frame coming alive
   (a breath taken, a blink, light shifting, dust motes resuming their drift)
2. Each subsequent clip expands outward from this moment — organic, natural motion
3. The environment BREATHES: wind picks up, light changes subtly, atmosphere responds
4. The subject's body language tells the emotional story — no need to invent drama
5. The final clip should feel like a cinematic resolution of the moment's energy
6. EVERY clip maintains this person, this place, this light — NO departures

FORBIDDEN:
- Inventing new characters not in the image
- Changing location or environment
- Altering the subject's appearance, clothing, or features
- Generic/stock imagery that ignores the specific photograph
- Treating the image as just a "starting frame" then going somewhere else
=======================================================================


${request.environmentPrompt ? `
🎬 USER'S SCENE OVERRIDE: "${request.environmentPrompt}"
Place the person from the photograph INTO this scene. Use this environment for ALL clips.
` : ''}

${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT MODIFY):
"""
${request.userNarration}
"""
Distribute across the ${clipCount} clips in the "dialogue" field. Use EXACT words.
` : ''}
${hasUserDialogue && request.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT MODIFY):
${request.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
` : ''}

Create ONE continuous scene with ${clipCount} progressive clips. Each clip = ${clipDuration} seconds on ${generationTargetLabel}.
Total duration: ${targetSeconds} seconds.
The IMAGE is the story origin. Clip 1 unfreezes the photograph. Every clip stays in this world.
Each description: 80-150 words, vivid and action-dense. No generic adjectives.
${mustPreserveContent ? 'Use the user\'s EXACT narration/dialogue verbatim in the "dialogue" field.' : ''}

Output ONLY valid JSON with exactly ${clipCount} clips.`;
      } else {
        // Standard text-to-video mode
        userPrompt = `Create a continuous scene broken into ${clipCount} clips for:

TOPIC: ${request.topic}
${request.synopsis ? `SYNOPSIS: ${request.synopsis}` : ''}
${request.style ? `STYLE: ${request.style}` : ''}
${request.genre ? `GENRE: ${request.genre}` : ''}
${request.mainSubjects?.length ? `MAIN SUBJECTS: ${request.mainSubjects.join(', ')}` : ''}
${request.environmentHints?.length ? `ENVIRONMENT: ${request.environmentHints.join(', ')}` : ''}

${request.environmentPrompt ? `
ENVIRONMENT DNA (MANDATORY - ALL clips MUST use this):
"${request.environmentPrompt}"
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
Distribute across the ${clipCount} clips in the "dialogue" field. Use EXACT words.
` : ''}
${hasUserDialogue && request.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT MODIFY OR PARAPHRASE):
${request.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
Include in appropriate clips' "dialogue" field. Use EXACT words.
` : ''}

Create ONE continuous scene with ${clipCount} progressive clips. Each clip = ${clipDuration} seconds on ${generationTargetLabel}.
Total duration: ${targetSeconds} seconds.
All clips in SAME location with SAME character appearance.
Show progressive story arc: hook → build → escalate → climax → resolve.
Each description: 80-150 words, vivid and action-dense. No generic adjectives.
${request.environmentPrompt ? `MANDATORY: Use "${request.environmentPrompt}" as the scene/location for ALL clips.` : ''}
${mustPreserveContent ? 'Use the user\'s EXACT narration/dialogue verbatim in the "dialogue" field.' : ''}

Output ONLY valid JSON with exactly ${clipCount} clips.`;
      }
    }

    console.log(`[SmartScript] 🎬 Calling GPT-4o for ${generationTargetLabel} (${enginePersona}) scene breakdown...`);

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
          // Seedance scripts are denser (150-220w/clip with structured sections) — give more headroom.
          max_tokens: isSeedance
            ? calculateMaxTokens(clipCount, 800, 4500, 9000)
            : calculateMaxTokens(clipCount, 500, 3000, 6000),
          temperature: isSeedance ? 0.75 : 0.8, // Slightly tighter for technical precision
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
    const shouldInjectDNA = request.mode === 'text-to-video' || request.mode === 'image-to-video' || request.mode === 'avatar';

    if (shouldInjectDNA) {
      const lockedChar = lockFields.characterDescription;
      const lockedEnv  = forcedLocation;
      const lockedLight = forcedLighting;
      const masterDNA  = request.sceneIdentityContext?.masterConsistencyPrompt
        || request.referenceImageAnalysis?.consistencyPrompt
        || '';

      normalizedClips.forEach((clip) => {
        const dnaParts: string[] = [];

        // Seedance reads technical directives — inject them at the very top, highest weight.
        if (isSeedance) {
          dnaParts.push(`[SEEDANCE_DIRECTIVES — TARGET ENGINE: Seedance 2.0 1080p 24fps. Honor all named camera moves, lens specs, aperture cues, and end-frame locks. Render with photographic 35mm film grain. Maintain physics-grade motion: inertia, gravity, follow-through, secondary motion on hair/fabric/particulate.]`);
        } else if (targetEngine === 'veo') {
          dnaParts.push(`[VEO_DIRECTIVES — TARGET ENGINE: Veo 3 Fast. Prioritize coherent real-world physics, natural native audio cues, diegetic sound, and single-shot causal motion inside ${clipDuration}s.]`);
        } else if (targetEngine === 'runway') {
          dnaParts.push(`[RUNWAY_DIRECTIVES — TARGET ENGINE: Runway Gen-4 Turbo. Prioritize character consistency, wardrobe continuity, clear subject silhouette, and one concise camera intent per clip.]`);
        } else if (targetEngine === 'sora') {
          dnaParts.push(`[SORA_DIRECTIVES — TARGET ENGINE: Sora 2. Prioritize narrative coherence, spatial continuity, grounded transformations, and a clear final tableau.]`);
        }

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

      console.log(`[SmartScript] ✓ ${generationTargetLabel} continuity DNA injected into ${normalizedClips.length} clip descriptions (mode: ${request.mode})`);
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
      targetEngine,
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
