import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { notifyVideoComplete, notifyVideoFailed } from "../_shared/pipeline-notifications.ts";
import {
  CAMERA_MOVEMENTS,
  CAMERA_ANGLES,
  SHOT_SIZES,
  LIGHTING_STYLES,
  SUBJECT_MOTION,
  SCENE_JOURNEYS,
  MOVEMENT_PROGRESSION,
  ANGLE_PROGRESSION,
  SIZE_PROGRESSION,
  LIGHTING_PROGRESSION,
  MOTION_PROGRESSION,
  selectPrompt,
  detectJourneyType,
  getProgressiveScene,
  buildPlacementDirective,
  resolveAvatarPlacement,
} from "../_shared/world-class-cinematography.ts";
import {
  GUARD_RAIL_CONFIG,
  checkAndRecoverStaleMutex,
  detectStuckClips,
  checkPipelineHealth,
  getGuaranteedLastFrame,
  isValidImageUrl,
  recoverAllStuckClips,
  findOrphanedVideo,
  recoverStuckClip,
  releaseStaleCompletedLock,
  verifyAllStuckPredictions,
} from "../_shared/pipeline-guard-rails.ts";
import {
  resilientFetch,
  validateImageUrl,
  createReplicatePrediction,
  pollReplicatePrediction,
  sleep,
  calculateBackoff,
  isRetryableError,
  RESILIENCE_CONFIG,
} from "../_shared/network-resilience.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Pipeline Watchdog Edge Function v5.0 - WORLD-CLASS RESILIENCE
 * 
 * HARDENED with:
 * - Exponential backoff for all API calls
 * - Connection reset recovery
 * - Rate limit detection and smart waiting
 * - Pre-flight image URL validation before Kling calls
 * 
 * Now handles:
 * 1. AUTOMATIC MUTEX RECOVERY: Releases stale locks proactively
 * 2. CLIP 0 FRAME GUARANTEE: Ensures Clip 0 always has reference image as last_frame
 * 3. STUCK CLIP DETECTION: Uses guard rail detection for comprehensive recovery
 * 4. PRODUCTION RECOVERY: Stalled 'generating' projects
 * 5. STITCHING RECOVERY: Stuck 'stitching' projects
 * 6. COMPLETION GUARANTEE: Falls back to manifest after max retries
 */

interface StalledProject {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  pending_video_tasks: Record<string, unknown> | null;
  user_id: string;
  generated_script: string | null;
  stitch_attempts: number | null;
  generation_lock: Record<string, unknown> | null;
  pro_features_data: Record<string, unknown> | null;
}

interface StitchJob {
  id: string;
  project_id: string;
  user_id: string;
  status: string;
  retry_after: string | null;
  attempt_number: number;
  max_attempts: number;
  last_error: string | null;
}

interface WatchdogResult {
  stalledProjects: number;
  productionResumed: number;
  stitchingRetried: number;
  retryScheduledProcessed: number;
  manifestFallbacks: number;
  projectsCompleted: number;
  projectsMarkedFailed: number;
  mutexesReleased: number;
  clip0FramesFixed: number;
  stuckClipsRecovered: number;
  details: Array<{
    projectId: string;
    action: string;
    result: string;
  }>;
}

// Timeouts - use guard rail config where applicable
const STALE_TIMEOUT_MS = GUARD_RAIL_CONFIG.CLIP_STUCK_THRESHOLD_MS; // 3 minutes
const STITCHING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_STITCHING_ATTEMPTS = 3;
const MAX_AGE_MS = 60 * 60 * 1000; // 60 minutes

// CINEMATOGRAPHY ENGINE: Imported from _shared/world-class-cinematography.ts
// Contains: CAMERA_MOVEMENTS, CAMERA_ANGLES, SHOT_SIZES, LIGHTING_STYLES, 
// SUBJECT_MOTION, SCENE_JOURNEYS, progression arrays, and helper functions
// Also: buildPlacementDirective — scene-aware avatar grounding

/**
 * Build WORLD-CLASS acting prompt for avatar frame-chaining
 * Each clip gets unique cinematography + DYNAMIC SCENE PROGRESSION
 * Supports SCREENPLAY-DRIVEN movement, emotion, and micro-performance
 */
function buildAvatarActingPrompt(
  segmentText: string, 
  sceneDescription?: string, 
  clipIndex: number = 0, 
  totalClips: number = 1, 
  avatarType: string = 'realistic',
  screenplayAction?: string,
  screenplayMovement?: string,
  screenplayEmotion?: string,
  screenplayCameraHint?: string,
  physicalDetail?: string,
  sceneNote?: string,
  transitionNote?: string,
  identityLock?: string,
  aspectRatio: string = '16:9',
): string {
  const idx = clipIndex % 10;
  
  const movementKey = MOVEMENT_PROGRESSION[idx];
  const angleKey = ANGLE_PROGRESSION[idx];
  const sizeKey = SIZE_PROGRESSION[idx];
  const lightingKey = LIGHTING_PROGRESSION[idx];
  
  // Film-school precision camera map
  const cameraHintMap: Record<string, string> = {
    'tracking': 'Smooth Steadicam tracking shot gliding alongside the subject, maintaining perfect focus',
    'close-up': 'Intimate close-up isolating facial micro-expressions, shallow depth of field with bokeh',
    'wide': 'Wide establishing shot placing subject in full environment with scale and context',
    'over-shoulder': 'Over-the-shoulder perspective creating voyeuristic intimacy, foreground soft-focused',
    'medium': 'Classic medium shot from waist up, balanced composition with room to breathe',
    'panning': 'Slow deliberate pan revealing the scene, building anticipation',
    'dolly-in': 'Slow dolly push-in toward the subject, building intensity on their words',
    'low-angle': 'Low-angle shot looking up at the subject, conveying authority and presence',
    'crane': 'Subtle crane movement adding vertical dimension to the visual storytelling',
  };
  
  const movementPrompt = screenplayCameraHint && cameraHintMap[screenplayCameraHint]
    ? cameraHintMap[screenplayCameraHint]
    : selectPrompt(CAMERA_MOVEMENTS[movementKey] || CAMERA_MOVEMENTS.static_locked);
  const anglePrompt = selectPrompt(CAMERA_ANGLES[angleKey] || CAMERA_ANGLES.eye_level_centered);
  const sizePrompt = selectPrompt(SHOT_SIZES[sizeKey] || SHOT_SIZES.medium);
  const lightingPrompt = selectPrompt(LIGHTING_STYLES[lightingKey] || LIGHTING_STYLES.classic_key);
  
  // Aspect ratio composition directive — informs Kling how to frame the shot
  const aspectComposition = (() => {
    if (aspectRatio === '9:16') return '[VERTICAL FRAME: Portrait/mobile format. Subject centered vertically, tight framing, fill the tall frame with energy. Vertical composition with strong headroom.]';
    if (aspectRatio === '1:1') return '[SQUARE FRAME: Subject centered, balanced composition, fill the square frame naturally.]';
    if (aspectRatio === '4:3') return '[STANDARD FRAME: Classic 4:3 composition, subject slightly left or right of center.]';
    // Default 16:9 widescreen
    return '[WIDESCREEN 16:9: Cinematic horizontal composition. Subject positioned in the frame with environmental context visible on either side. Rule of thirds framing.]';
  })();

  // Use screenplay sceneNote if available, falling back to base scene description
  const effectiveScene = sceneNote?.trim() ? `${sceneNote}. ${sceneDescription || ''}` : sceneDescription;
  const progressiveScene = getProgressiveScene(effectiveScene, clipIndex, totalClips, true);
  const sceneContext = `Cinematic scene in ${progressiveScene}, shot on ARRI Alexa with anamorphic lenses.`;

  // SMART PLACEMENT: Derive where/how the avatar is physically situated in the scene
  // e.g. "witch's house" → standing near cauldron; "car" → seated at wheel; "beach" → standing on sand
  const placementDirective = buildPlacementDirective(effectiveScene);
  
  // Use transitionNote for continuity enforcement
  const transitionDirective = transitionNote?.trim() 
    ? `[TRANSITION: ${transitionNote}]` 
    : '';
  
  const avatarTypeLock = avatarType === 'animated'
    ? '[AVATAR STYLE: Stylized CGI/animated character. NOT photorealistic.]'
    : '[AVATAR STYLE: Photorealistic human. NOT cartoon/animated.]';
  
  // Only enforce same environment if the sceneNote doesn't indicate a NEW location
  const isNewLocation = sceneNote && (
    sceneNote.toLowerCase().includes('different') || 
    sceneNote.toLowerCase().includes('new ') || 
    sceneNote.toLowerCase().includes('outside') ||
    sceneNote.toLowerCase().includes('another') ||
    sceneNote.toLowerCase().includes('driving') ||
    sceneNote.toLowerCase().includes('car') ||
    sceneNote.toLowerCase().includes('walks into') ||
    sceneNote.toLowerCase().includes('arrives at')
  );
  const backgroundLock = clipIndex > 0 && !isNewLocation 
    ? '[SAME ENVIRONMENT: Continue in the exact same location with consistent lighting.]' 
    : (isNewLocation ? '[NEW ENVIRONMENT: This is a DIFFERENT location from the previous clip. New background, new setting.]' : '');
  
  // IDENTITY LOCK: Critical for cross-character consistency
  const identityDirective = identityLock 
    ? `[FACE LOCK — CRITICAL: ${identityLock} Maintain EXACT same face, hair color, skin tone, body type, and clothing throughout. NO morphing, NO face changes, NO age shifts. This person must be 100% recognizable and identical to the start frame reference.]`
    : '[IDENTITY LOCK: Maintain EXACT same face, hair, skin tone, body type, and clothing as shown in the start frame. NO morphing, NO face changes, NO age shifts.]';
  
  // Rich movement from screenplay
  const movementMap: Record<string, string> = {
    'walk': 'walking naturally through the scene with confident strides, arms swinging gently',
    'gesture': 'using expressive hand gestures painting the air with conviction',
    'lean': 'leaning in with genuine interest, weight shifting forward, eyes locked',
    'turn': 'turning with fluid body rotation, a natural pivot revealing new intent',
    'sit': 'sitting with lived-in comfort, hands active while talking',
    'stand': 'standing tall with grounded confidence, subtle weight transfers',
    'drive': 'seated behind the wheel, one hand casually on steering wheel',
    'react': 'reacting with whole-body surprise — eyebrows shooting up, torso pulling back',
    'dance': 'moving with infectious rhythmic energy, shoulders bouncing, natural joy',
    'run': 'moving with urgent purposeful energy, body leaning into momentum',
    'laugh': 'breaking into genuine laughter, head tilting back, shoulders shaking',
    'freeze': 'freezing mid-motion in comedic disbelief, eyes wide, completely still',
    'point': 'pointing with conviction, arm extending fully, whole body following',
  };
  
  let motionBlock: string;
  // STATIC START ENFORCEMENT: Character is ALREADY in position from frame 1
  const staticStartDirective = '[STATIC START — CRITICAL: The character is ALREADY positioned in their environment from the very first frame. They are already standing, sitting, or leaning in place. Do NOT show them walking in, entering, or arriving. They are ALREADY THERE, grounded and situated.]';
  
  if (screenplayAction) {
    // Filter out walking-in actions from screenplay
    const sanitizedAction = screenplayAction
      .replace(/walking into frame/gi, 'already positioned in frame')
      .replace(/entering the scene/gi, 'already in the scene')
      .replace(/walks in/gi, 'is already present')
      .replace(/arriving/gi, 'already situated');
    const movePhrase = screenplayMovement && movementMap[screenplayMovement] ? `, ${movementMap[screenplayMovement]}` : '';
    const microAction = physicalDetail ? ` ${physicalDetail}.` : '';
    motionBlock = `The subject is ${sanitizedAction}${movePhrase}.${microAction}`;
  } else {
    motionBlock = `The subject is speaking with natural energy, expressive gestures, weight shifting naturally.`;
  }
  
  // Emotion-based performance direction
  const emotionStyles: Record<string, string> = {
    'amused': 'Mischievous knowing grin, playful eyebrow raises, infectious lighthearted energy.',
    'excited': 'Eyes BLAZING with enthusiasm, animated gestures cutting through air, megawatt smile.',
    'surprised': 'Eyes widening, eyebrows shooting up, slight body pullback, hands rising instinctively.',
    'nervous': 'Subtle fidgeting, darting eyes, weight shifting, uncertain half-smile breaking into nervous laugh.',
    'dramatic': 'Intense locked-in gaze, deliberate measured gestures, commanding physical presence.',
    'confident': 'Rock-solid eye contact, open commanding posture, precisely timed gestures punctuating key words.',
    'thoughtful': 'Pensive expression, slow measured gestures, eyes looking away briefly then returning with insight.',
    'deadpan': 'Completely flat expression, minimal movement, devastating understatement with surgical precision.',
    'tender': 'Genuine warm Duchenne smile, soft expressive gaze, open welcoming posture, gentle head tilts.',
    'mischievous': 'Sly half-smile, one eyebrow raised, leaning toward camera conspiratorially.',
  };
  const performanceStyle = screenplayEmotion && emotionStyles[screenplayEmotion] 
    ? emotionStyles[screenplayEmotion] 
    : 'Natural confident delivery, genuine facial expressions, authentic micro-expressions between phrases.';
  
  // Narrative beat based on position
  let narrativeBeat = '';
  if (totalClips >= 3) {
    if (clipIndex === 0) narrativeBeat = 'OPENING: Hook the audience — confident, attention-grabbing delivery.';
    else if (clipIndex === totalClips - 1) narrativeBeat = 'CLOSING: Land the final beat with impact and conviction.';
    else narrativeBeat = 'BUILDING: Natural escalation of energy and engagement.';
  }
  
  const qualityBaseline = "Ultra-high definition 4K cinematic quality. Natural skin tones with subsurface scattering. Rich vibrant colors with cinematic color grading. Shallow depth of field with bokeh. Volumetric warm lighting. Film-quality motion blur.";
  
  const lifelikeDirective = "Continuous lifelike motion: breathing visible in chest/shoulders, natural eye tracking, involuntary micro-expressions, authentic weight shifts, hair/clothing responding to movement.";
  
  console.log(`[Watchdog] 🎬 Clip ${clipIndex + 1}/${totalClips} | Camera: ${screenplayCameraHint || movementKey} | Movement: ${screenplayMovement || 'default'} | AvatarType: ${avatarType} | IdentityLock: ${identityLock ? 'YES' : 'generic'} | Placement: ${resolveAvatarPlacement(effectiveScene).label}`);
  
  return `${staticStartDirective} ${identityDirective} ${avatarTypeLock} ${aspectComposition} ${backgroundLock} ${placementDirective} ${transitionDirective} ${sceneContext} ${sizePrompt}. ${anglePrompt}. ${movementPrompt}. ${lightingPrompt}. ${narrativeBeat} ${motionBlock} Speaking naturally: "${segmentText.trim().substring(0, 120)}${segmentText.length > 120 ? '...' : ''}". ${performanceStyle} ${lifelikeDirective} ${qualityBaseline}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==================== FORCE STITCH MODE ====================
    // Allows directly triggering stitch for a specific project, bypassing staleness check
    let forceStitchProjectId: string | null = null;
    try {
      const body = await req.clone().json();
      forceStitchProjectId = body?.forceStitchProjectId || null;
    } catch { /* no body is fine */ }

    if (forceStitchProjectId) {
      console.log(`[Watchdog] FORCE STITCH triggered for project: ${forceStitchProjectId}`);
      const stitchResponse = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ projectId: forceStitchProjectId }),
      });
      const stitchResult = await stitchResponse.json();
      console.log(`[Watchdog] Force stitch result:`, JSON.stringify(stitchResult));
      return new Response(JSON.stringify({ success: stitchResponse.ok, forceStitch: true, result: stitchResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: WatchdogResult = {
      stalledProjects: 0,
      productionResumed: 0,
      stitchingRetried: 0,
      retryScheduledProcessed: 0,
      manifestFallbacks: 0,
      projectsCompleted: 0,
      projectsMarkedFailed: 0,
      mutexesReleased: 0,
      clip0FramesFixed: 0,
      stuckClipsRecovered: 0,
      details: [],
    };

    console.log("[Watchdog] Starting v5.0 pipeline recovery with ASYNC AVATAR POLLING...");

    // ==================== PHASE 0-ASYNC: POLL ASYNC AVATAR PREDICTIONS ====================
    // NEW: Poll Kling predictions started by generate-avatar-direct v3.0 async pattern
    // This is the PERMANENT timeout fix - predictions run in background, watchdog completes them
    const { data: asyncAvatarProjects } = await supabase
      .from('movie_projects')
      .select('id, title, status, mode, updated_at, user_id, pending_video_tasks, pipeline_state, voice_audio_url')
      .eq('status', 'generating')
      .eq('mode', 'avatar')
      .limit(30);
    
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    
    for (const project of (asyncAvatarProjects || [])) {
      const tasks = (project.pending_video_tasks || {}) as Record<string, any>;
      
      // Check if this is an async avatar job
      if (tasks.type !== 'avatar_async' || !tasks.predictions) continue;

      // ── SCENE DESCRIPTION FALLBACK ──────────────────────────────────────────
      // If sceneDescription was not stored (user left field blank or a save bug),
      // derive it from the screenplay's sceneNotes so ALL clips get a real background.
      // E.g. if sceneNote says "comedy stage with warm spotlight" we use that.
      const resolvedSceneDescription: string | undefined = (() => {
        if (tasks.sceneDescription?.trim()) return tasks.sceneDescription.trim();
        // Find the most descriptive sceneNote from the screenplay predictions
        const allNotes: string[] = (tasks.predictions as Array<{ sceneNote?: string }>)
          .map(p => p.sceneNote?.trim() || '')
          .filter(Boolean);
        if (allNotes.length === 0) return undefined;
        // Pick the longest (most descriptive) note as the base scene
        const best = allNotes.reduce((a, b) => (a.length >= b.length ? a : b), '');
        // Strip continuity/lighting instructions; keep location description
        return best.split(';')[0].trim();
      })();
      
      const completedPredictions = tasks.predictions.filter((p: { status: string }) => p.status === 'completed').length;
      const totalPredictions = tasks.predictions.length;
      const progressPct = Math.round(10 + (completedPredictions / totalPredictions) * 75);
      console.log(`[Watchdog] 🎬 ASYNC AVATAR: Polling ${project.id} (${completedPredictions}/${totalPredictions} predictions done)`);
      
      // FIX: Ensure pipeline_stage reflects actual generating state (not stuck on 'draft')
      if (project.pipeline_stage === 'draft' || !project.pipeline_stage) {
        await supabase
          .from('movie_projects')
          .update({
            pipeline_stage: 'generating',
            pending_video_tasks: {
              ...tasks,
              progress: progressPct,
              stage: 'generating',
              lastProgressAt: new Date().toISOString(),
            },
          })
          .eq('id', project.id);
      }
      
      let allCompleted = true;
      let anyFailed = false;
      const completedClips: Array<{
        clipIndex: number;
        videoUrl: string;
        audioUrl: string;
      }> = [];
      
      for (const pred of tasks.predictions) {
        if (pred.status === 'completed') {
          completedClips.push({
            clipIndex: pred.clipIndex,
            videoUrl: pred.videoUrl,
            audioUrl: pred.audioUrl,
          });
          // Ensure the video_clips row exists for already-completed predictions
          // (handles cases where the watchdog restarted and lost the insert opportunity)
          if (pred.videoUrl) {
            await supabase.from('video_clips').upsert({
              project_id: project.id,
              shot_index: pred.clipIndex,
              status: 'completed',
              video_url: pred.videoUrl,
              duration_seconds: tasks.clipDuration || 10,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'project_id,shot_index', ignoreDuplicates: false });
          }
          continue;
        }
        
        if (pred.status === 'failed') {
          anyFailed = true;
          continue;
        }
        
        // FRAME-CHAINING: Handle pending clips (waiting for previous clip's frame)
        if (pred.status === 'pending') {
          // CRITICAL RACE-CONDITION GUARD: If this clip already has a predictionId,
          // it was started in a prior watchdog cycle but the DB write hasn't been reflected yet.
          // Treat it as 'processing' to avoid firing duplicate Kling predictions.
          if (pred.predictionId) {
            allCompleted = false;
            console.log(`[Watchdog] ⏳ Clip ${pred.clipIndex + 1} already submitted (predictionId: ${pred.predictionId}) — skipping re-submit`);
            continue;
          }

          // Check if previous clip is completed so we can start this one
          const prevClipIndex = pred.clipIndex - 1;
          const prevPred = tasks.predictions.find((p: { clipIndex: number }) => p.clipIndex === prevClipIndex);
          
          if (!prevPred || prevPred.status !== 'completed' || !prevPred.videoUrl) {
            // Previous clip not ready yet
            allCompleted = false;
            console.log(`[Watchdog] ⏸️ Clip ${pred.clipIndex + 1} PENDING (waiting for clip ${prevClipIndex + 1})`);
            continue;
          }
          
          // Previous clip is complete - extract last frame and start this clip!
          console.log(`[Watchdog] 🔗 FRAME-CHAINING: Starting clip ${pred.clipIndex + 1} from clip ${prevClipIndex + 1}'s last frame`);
          
          // DUAL AVATAR: Determine if switching characters
          const isSecondaryClip = pred.avatarRole === 'secondary' && tasks.secondaryAvatar?.imageUrl;
          const prevWasSecondary = prevPred.avatarRole === 'secondary';
          const isCharacterSwitch = (pred.avatarRole === 'secondary' && !prevWasSecondary) || 
                                    (pred.avatarRole === 'primary' && prevWasSecondary);
          let startImageUrl: string | null = null;
          
          // BUILD IDENTITY LOCK for this clip's character
          let characterIdentityLock = '';
          
          // ═══════════════════════════════════════════════════════════════════════
          // FRAME EXTRACTION HELPER: Extract last frame from any video URL
          // Used for BOTH primary and secondary same-character continuity
          // ═══════════════════════════════════════════════════════════════════════
          const extractLastFrameFromVideo = async (videoUrl: string, forClipIndex: number): Promise<string | null> => {
            try {
              const frameResponse = await fetch(`${supabaseUrl}/functions/v1/extract-last-frame`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  videoUrl,
                  projectId: project.id,
                  clipIndex: forClipIndex,
                }),
              });
              
              if (frameResponse.ok) {
                const frameResult = await frameResponse.json();
                const extractedFrame = frameResult.frameUrl || frameResult.lastFrameUrl;
                if (frameResult.success && extractedFrame) {
                  console.log(`[Watchdog] ✅ Extracted last frame from clip ${forClipIndex + 1} (${frameResult.method}): ${extractedFrame.substring(0, 60)}...`);
                  return extractedFrame;
                }
              }
              console.warn(`[Watchdog] ⚠️ Frame extraction failed for clip ${forClipIndex + 1}`);
            } catch (frameError) {
              console.error(`[Watchdog] Frame extraction error for clip ${forClipIndex + 1}:`, frameError);
            }
            return null;
          };
          
          // ═══════════════════════════════════════════════════════════════════════
          // FIND MOST RECENT CLIP OF SAME CHARACTER (for identity anchoring)
          // ═══════════════════════════════════════════════════════════════════════
          const findLastClipOfRole = (role: string): { clipIndex: number; videoUrl: string; startImageUrl: string } | null => {
            for (let searchIdx = pred.clipIndex - 1; searchIdx >= 0; searchIdx--) {
              const candidate = tasks.predictions.find((p: { clipIndex: number }) => p.clipIndex === searchIdx);
              if (candidate && candidate.avatarRole === role && candidate.status === 'completed' && candidate.videoUrl) {
                return { clipIndex: searchIdx, videoUrl: candidate.videoUrl, startImageUrl: candidate.startImageUrl };
              }
            }
            return null;
          };
          
          if (isSecondaryClip) {
            // ═══════════════════════════════════════════════════════════════════
            // SECONDARY AVATAR CLIP
            // KEY RULE: Only composite on FIRST appearance. After that, use last frame.
            // ═══════════════════════════════════════════════════════════════════
            console.log(`[Watchdog] 🎭 DUAL AVATAR: Clip ${pred.clipIndex + 1} uses SECONDARY avatar (${tasks.secondaryAvatar.name})`);
            characterIdentityLock = `This is ${tasks.secondaryAvatar.name}. The character in this clip must look EXACTLY like the person shown in the start frame reference image. Preserve their exact facial features, hair style, hair color, skin tone, eye color, body build, and outfit.`;
            
            const lastSecondaryClip = findLastClipOfRole('secondary');
            
            if (lastSecondaryClip && !isCharacterSwitch) {
              // SAME CHARACTER CONTINUING: Use last frame from previous secondary clip
              // This preserves identity perfectly — no re-compositing drift
              console.log(`[Watchdog] 🔗 SECONDARY CONTINUITY: Using last frame from clip ${lastSecondaryClip.clipIndex + 1}`);
              startImageUrl = await extractLastFrameFromVideo(lastSecondaryClip.videoUrl, lastSecondaryClip.clipIndex);
            }
            
            if (!startImageUrl && isCharacterSwitch) {
              // FIRST APPEARANCE or re-entering: Need scene compositing
              const isEntranceClip = pred.clipIndex === 1;
              const sceneDesc = isEntranceClip 
                ? (tasks.sceneDescription || 'Professional studio setting')
                : (pred.sceneNote || tasks.sceneDescription || 'Professional studio setting');
              
              // Check if we already have a cached composite for this character
              const cachedSecondaryScene = tasks._secondarySceneCache;
              if (cachedSecondaryScene && isEntranceClip) {
                // Reuse the cached composite for same-scene entrance
                startImageUrl = cachedSecondaryScene;
                console.log(`[Watchdog] ✅ Using CACHED secondary composite: ${startImageUrl.substring(0, 60)}...`);
              } else {
                // Composite once for this character
                console.log(`[Watchdog] 🎨 Compositing secondary avatar (${isEntranceClip ? 'ENTRANCE' : 'NEW LOCATION'})...`);
                try {
                  const sceneResponse = await fetch(`${supabaseUrl}/functions/v1/generate-avatar-scene`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                    body: JSON.stringify({
                      avatarImageUrl: tasks.secondaryAvatar.imageUrl,
                      sceneDescription: sceneDesc,
                      aspectRatio: tasks.aspectRatio || '16:9',
                      placement: 'center',
                      additionalInstructions: `The character is ALREADY positioned in the scene from the start. Show the COMPLETE person from head to toe. Full body visible. Do NOT crop to just the head or face. CRITICAL: Preserve the EXACT face, hair, and appearance of the person in the reference image. NO face changes.`,
                    }),
                  });
                  
                  if (sceneResponse.ok) {
                    const sceneResult = await sceneResponse.json();
                    if (sceneResult.success && sceneResult.sceneImageUrl) {
                      startImageUrl = sceneResult.sceneImageUrl;
                      // Cache for reuse
                      tasks._secondarySceneCache = startImageUrl;
                      console.log(`[Watchdog] ✅ Secondary composite created & cached: ${startImageUrl.substring(0, 60)}...`);
                    }
                  }
                } catch (sceneError) {
                  console.warn(`[Watchdog] Secondary scene compositing failed (non-fatal):`, sceneError);
                }
              }
            }
            
            // If still no start image but we have a previous secondary clip's last frame attempt
            if (!startImageUrl && lastSecondaryClip) {
              startImageUrl = await extractLastFrameFromVideo(lastSecondaryClip.videoUrl, lastSecondaryClip.clipIndex);
            }
            
            // Fallback: use raw secondary avatar image
            if (!startImageUrl) {
              startImageUrl = tasks.secondaryAvatar.imageUrl;
              console.warn(`[Watchdog] ⚠️ Using raw secondary avatar image (fallback)`);
            }
          } else {
            // ═══════════════════════════════════════════════════════════════════
            // PRIMARY AVATAR CLIP
            // KEY RULE: Always use last frame from most recent primary clip.
            // Only fall back to original scene image if no primary clip exists yet.
            // ═══════════════════════════════════════════════════════════════════
            characterIdentityLock = `This is the PRIMARY character. The character in this clip must look EXACTLY like the person shown in the start frame reference image. Preserve their exact facial features, hair style, hair color, skin tone, eye color, body build, and outfit. This MUST be the same person as in clip 1.`;
            
            // ALWAYS try to get last frame from most recent primary clip first
            const lastPrimaryClip = findLastClipOfRole('primary');
            
            if (lastPrimaryClip) {
              // Extract the last frame from the most recent primary clip's VIDEO
              // This preserves identity from the actual rendered character
              console.log(`[Watchdog] 🔗 PRIMARY CONTINUITY: Extracting last frame from clip ${lastPrimaryClip.clipIndex + 1}`);
              startImageUrl = await extractLastFrameFromVideo(lastPrimaryClip.videoUrl, lastPrimaryClip.clipIndex);
              
              if (startImageUrl) {
                console.log(`[Watchdog] ✅ PRIMARY identity anchored from clip ${lastPrimaryClip.clipIndex + 1}'s last frame`);
              }
            }
            
            if (!startImageUrl) {
              // No previous primary clip frame available — use original scene image
              const originalSceneImage = tasks.sceneImageUrl || tasks.predictions[0]?.startImageUrl;
              if (originalSceneImage) {
                startImageUrl = originalSceneImage;
                console.log(`[Watchdog] ✅ Using ORIGINAL primary scene image: ${startImageUrl!.substring(0, 60)}...`);
              }
            }
          }
          
          if (!startImageUrl) {
            // Ultimate fallback - use scene image or first clip's start image
            startImageUrl = tasks.sceneImageUrl || tasks.predictions[0]?.startImageUrl;
            console.warn(`[Watchdog] Using ultimate fallback start image`);
          }
          
          // ═══════════════════════════════════════════════════════════════════════════
          // VALIDATE START IMAGE BEFORE KLING CALL
          // ═══════════════════════════════════════════════════════════════════════════
          const imageValidation = await validateImageUrl(startImageUrl);
          if (!imageValidation.valid) {
            console.error(`[Watchdog] ❌ Start image for clip ${pred.clipIndex + 1} is invalid: ${imageValidation.error}`);
            console.error(`[Watchdog] URL: ${startImageUrl}`);
            
            // Try fallback to scene image or first clip's start image
            const fallbackImage = tasks.sceneImageUrl || tasks.predictions[0]?.startImageUrl;
            if (fallbackImage) {
              const fallbackValidation = await validateImageUrl(fallbackImage);
              if (fallbackValidation.valid) {
                startImageUrl = fallbackImage;
                pred.startImageUrl = fallbackImage;
                console.log(`[Watchdog] ⚠️ Using fallback image: ${fallbackImage.substring(0, 60)}...`);
              } else {
                pred.status = 'failed';
                anyFailed = true;
                console.error(`[Watchdog] ❌ Fallback image also invalid, marking clip as failed`);
                continue;
              }
            } else {
              pred.status = 'failed';
              anyFailed = true;
              continue;
            }
          }
          
          // Store the validated start image for this clip
          pred.startImageUrl = startImageUrl;
          
          // Build acting prompt with SCREENPLAY DATA + IDENTITY LOCK + KLING-NATIVE CONTINUITY
          const avatarType = tasks.avatarType || 'realistic';
          
          // FULL-BODY ENFORCEMENT: Add explicit body instruction for secondary avatar clips
          const fullBodyEnforcement = (pred.avatarRole === 'secondary')
            ? ' CRITICAL: Show the COMPLETE person with full body visible — head, torso, arms, hands, legs, feet. Do NOT crop to just the head or upper body. The character must be fully visible in the scene.'
            : '';
          
          // KLING-NATIVE CONTINUITY: Inject startPose/endPose/visualContinuity
          const klingContinuity = [
            pred.startPose ? `[START POSE: The character begins this clip ${pred.startPose}]` : '',
            pred.endPose ? `[END POSE — CRITICAL: Character must end this clip ${pred.endPose}. This exact position becomes the first frame of the next clip.]` : '',
            pred.visualContinuity ? `[CONTINUITY: ${pred.visualContinuity}]` : '',
          ].filter(Boolean).join(' ');
          
          const actingPrompt = buildAvatarActingPrompt(
            pred.segmentText + fullBodyEnforcement, resolvedSceneDescription, pred.clipIndex, tasks.predictions.length, avatarType,
            pred.action, pred.movement, pred.emotion, pred.cameraHint, pred.physicalDetail,
            pred.sceneNote, pred.transitionNote, characterIdentityLock,
            tasks.aspectRatio || '16:9',
          );
          // Prepend Kling continuity to the acting prompt
          const finalActingPrompt = klingContinuity ? `${klingContinuity} ${actingPrompt}` : actingPrompt;
          const videoDuration = tasks.clipDuration >= 10 ? 10 : (tasks.clipDuration || 10);
          
          // Avatar type-specific negative prompts (with anti-morphing)
          const negativePrompt = avatarType === 'animated'
            ? "photorealistic, real human, live action, photograph, real skin texture, static, frozen, robotic, stiff, unnatural, glitchy, distorted, closed mouth, looking away, boring, monotone, lifeless, face morphing, identity change, different person, age change, face swap, walking into frame, entering scene, arriving, approaching"
            : "cartoon, animated, CGI, 3D render, anime, illustration, drawing, painting, sketch, static, frozen, robotic, stiff, unnatural, glitchy, distorted, closed mouth, looking away, boring, monotone, lifeless, face morphing, identity change, different person, age change, face swap, walking into frame, entering scene, arriving, approaching";
          
          // Start Kling prediction for this clip WITH RESILIENT FETCH
          let klingRetries = 0;
          const maxKlingRetries = 3;
          
          while (klingRetries < maxKlingRetries) {
            try {
              // Add delay between retries with exponential backoff
              if (klingRetries > 0) {
                const delayMs = calculateBackoff(klingRetries, 5000);
                console.log(`[Watchdog] Kling retry ${klingRetries}/${maxKlingRetries} in ${delayMs}ms...`);
                await sleep(delayMs);
              }
              
              const klingResponse = await resilientFetch("https://api.replicate.com/v1/models/kwaivgi/kling-v3-video/predictions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${REPLICATE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  input: {
                    mode: "pro",
                    prompt: finalActingPrompt,
                    duration: Math.max(3, Math.min(15, videoDuration)), // Kling V3: 3–15s
                    start_image: startImageUrl,
                    aspect_ratio: tasks.aspectRatio || "16:9",
                    negative_prompt: negativePrompt,
                    generate_audio: true, // Kling V3 native lip-sync audio for avatar
                  },
                }),
                maxRetries: 2,
                timeoutMs: 30000,
              });
              
              // Handle rate limiting
              if (klingResponse.status === 429) {
                klingRetries++;
                console.warn(`[Watchdog] Rate limited by Kling API, will retry...`);
                continue;
              }
              
              if (klingResponse.ok) {
                const klingPrediction = await klingResponse.json();
                pred.predictionId = klingPrediction.id;
                pred.status = 'processing';
                console.log(`[Watchdog] ✅ Clip ${pred.clipIndex + 1} STARTED with frame-chaining: ${klingPrediction.id}`);
                
                // CRITICAL: Immediately persist the predictionId so concurrent watchdog
                // invocations see this clip as 'processing' and don't fire a duplicate.
                await supabase
                  .from('movie_projects')
                  .update({
                    pending_video_tasks: {
                      ...tasks,
                      predictions: tasks.predictions,
                      lastProgressAt: new Date().toISOString(),
                    },
                  })
                  .eq('id', project.id);
                  
                break; // Success!
              } else {
                const errorText = await klingResponse.text();
                console.error(`[Watchdog] Failed to start clip ${pred.clipIndex + 1}: ${klingResponse.status} - ${errorText.substring(0, 100)}`);
                klingRetries++;
              }
            } catch (klingError) {
              console.error(`[Watchdog] Kling API error:`, klingError);
              
              // Retry on connection errors
              if (isRetryableError(klingError as Error)) {
                klingRetries++;
                continue;
              }
              
              pred.status = 'failed';
              anyFailed = true;
              break;
            }
          }
          
          // If all retries exhausted, mark as failed
          if (klingRetries >= maxKlingRetries && pred.status !== 'processing') {
            pred.status = 'failed';
            anyFailed = true;
          }
          
          allCompleted = false;
          continue;
        }
        
        // PROCESSING: Poll this prediction
        if (!pred.predictionId) {
          allCompleted = false;
          continue;
        }
        
        try {
          // Use resilient fetch for polling
          const pollResponse = await resilientFetch(
            `https://api.replicate.com/v1/predictions/${pred.predictionId}`,
            {
              headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
              maxRetries: 2,
              timeoutMs: 15000,
            }
          );
          
          if (!pollResponse.ok) {
            console.warn(`[Watchdog] Poll failed for ${pred.predictionId}: ${pollResponse.status}`);
            allCompleted = false;
            continue;
          }
          
          const predictionStatus = await pollResponse.json();
          
          if (predictionStatus.status === 'succeeded' && predictionStatus.output) {
            const videoUrl = Array.isArray(predictionStatus.output) 
              ? predictionStatus.output[0] 
              : predictionStatus.output;
            
            console.log(`[Watchdog] ✅ Clip ${pred.clipIndex + 1} video generated: ${videoUrl.substring(0, 60)}...`);
            
            let finalVideoUrl = videoUrl;
            
            // ═══════════════════════════════════════════════════════════════════════════
            // STEP 1: KLING LIP-SYNC - 100% audio-visual synchronization
            // Uses kwaivgi/kling-lip-sync to match lip movements to TTS audio
            // This REPLACES the old audio merge - lip-sync outputs video WITH audio baked in
            // ═══════════════════════════════════════════════════════════════════════════
            if (pred.audioUrl) {
              console.log(`[Watchdog] 👄 Starting Kling Lip-Sync for clip ${pred.clipIndex + 1}...`);
              
              try {
                // Start lip-sync prediction WITH RESILIENT FETCH
                const lipSyncResponse = await resilientFetch("https://api.replicate.com/v1/models/kwaivgi/kling-lip-sync/predictions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${REPLICATE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    input: {
                      video_url: videoUrl,
                      audio_file: pred.audioUrl,
                    },
                  }),
                  maxRetries: 2,
                  timeoutMs: 30000,
                });
                
                if (lipSyncResponse.ok) {
                  const lipSyncPrediction = await lipSyncResponse.json();
                  console.log(`[Watchdog] 👄 Lip-sync prediction started: ${lipSyncPrediction.id}`);
                  
                  // Poll for lip-sync completion (typically 30-90 seconds)
                  const maxLipSyncWaitMs = 120000; // 2 minutes
                  const lipSyncPollInterval = 4000;
                  let lipSyncElapsed = 0;
                  
                  while (lipSyncElapsed < maxLipSyncWaitMs) {
                    await sleep(lipSyncPollInterval);
                    lipSyncElapsed += lipSyncPollInterval;
                    
                    try {
                      const lipSyncStatusResponse = await resilientFetch(
                        `https://api.replicate.com/v1/predictions/${lipSyncPrediction.id}`,
                        { 
                          headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
                          maxRetries: 2,
                          timeoutMs: 15000,
                        }
                      );
                      
                      if (!lipSyncStatusResponse.ok) continue;
                      
                      const lipSyncStatus = await lipSyncStatusResponse.json();
                    
                      if (lipSyncStatus.status === 'succeeded' && lipSyncStatus.output) {
                        const syncedUrl = typeof lipSyncStatus.output === 'string' 
                          ? lipSyncStatus.output 
                          : lipSyncStatus.output?.url || lipSyncStatus.output;
                        
                        if (syncedUrl) {
                          finalVideoUrl = syncedUrl;
                          console.log(`[Watchdog] ✅ Clip ${pred.clipIndex + 1} LIP-SYNC COMPLETE: ${syncedUrl.substring(0, 60)}...`);
                          break;
                        }
                      } else if (lipSyncStatus.status === 'failed') {
                        console.warn(`[Watchdog] ⚠️ Lip-sync failed for clip ${pred.clipIndex + 1}: ${lipSyncStatus.error}`);
                        console.warn(`[Watchdog] Falling back to audio-only merge...`);
                        break;
                      }
                      
                      console.log(`[Watchdog] 👄 Lip-sync polling clip ${pred.clipIndex + 1}: ${lipSyncStatus.status} (${lipSyncElapsed / 1000}s)`);
                    } catch (pollError) {
                      // Continue polling on transient errors
                      console.warn(`[Watchdog] Lip-sync poll error (will retry): ${(pollError as Error).message}`);
                      continue;
                    }
                  }
                  
                  // If lip-sync didn't complete, fall back to simple audio merge
                  if (finalVideoUrl === videoUrl) {
                    console.warn(`[Watchdog] Lip-sync timeout/failed, using fallback audio merge...`);
                    // Fallback: simple audio overlay without lip-sync
                    try {
                      const mergeResponse = await fetch("https://api.replicate.com/v1/predictions", {
                        method: "POST",
                        headers: {
                          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
                          "Content-Type": "application/json",
                          "Prefer": "wait=60",
                        },
                        body: JSON.stringify({
                          version: "684cc0e6bff2f0d3b748d7c386ab8a6fb7c5f6d2095a3a38d68d9d6a3a2cb2f6",
                          input: {
                            video: videoUrl,
                            audio: pred.audioUrl,
                            audio_volume: 1.0,
                            video_volume: 0.0,
                          },
                        }),
                      });
                      
                      if (mergeResponse.ok) {
                        const mergeResult = await mergeResponse.json();
                        if (mergeResult.status === 'succeeded' && mergeResult.output) {
                          finalVideoUrl = mergeResult.output;
                          console.log(`[Watchdog] ✅ Clip ${pred.clipIndex + 1} audio merged (fallback)`);
                        }
                      }
                    } catch (fallbackError) {
                      console.warn(`[Watchdog] Fallback audio merge failed:`, fallbackError);
                    }
                  }
                } else {
                  console.warn(`[Watchdog] ⚠️ Failed to start lip-sync: ${lipSyncResponse.status}`);
                }
              } catch (lipSyncError) {
                console.warn(`[Watchdog] Lip-sync exception (non-fatal):`, lipSyncError);
              }
            }
            
            // ═══════════════════════════════════════════════════════════════════════════
            // STEP 2: Save to permanent storage
            // ═══════════════════════════════════════════════════════════════════════════
            try {
              const videoResponse = await fetch(finalVideoUrl);
              if (videoResponse.ok) {
                const videoBlob = await videoResponse.blob();
                const videoBytes = new Uint8Array(await videoBlob.arrayBuffer());
                
                const fileName = `avatar_${project.id}_clip${pred.clipIndex + 1}_lipsync_${Date.now()}.mp4`;
                const storagePath = `avatar-videos/${project.id}/${fileName}`;
                
                const { error: uploadError } = await supabase.storage
                  .from('video-clips')
                  .upload(storagePath, videoBytes, {
                    contentType: 'video/mp4',
                    upsert: true,
                  });
                
                if (!uploadError) {
                  finalVideoUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${storagePath}`;
                  console.log(`[Watchdog] ✅ Clip ${pred.clipIndex + 1} saved to storage`);
                }
              }
            } catch (storageError) {
              console.warn(`[Watchdog] Storage failed (non-fatal):`, storageError);
            }
            
            // Update prediction status
            pred.status = 'completed';
            pred.videoUrl = finalVideoUrl;
            pred.lipSynced = true;
            
            completedClips.push({
              clipIndex: pred.clipIndex,
              videoUrl: finalVideoUrl,
              audioUrl: pred.audioUrl,
            });

            // ── CRITICAL: Write clip row to video_clips table so the UI can display it ──
            try {
              const { error: clipInsertError } = await supabase
                .from('video_clips')
                .upsert({
                  project_id: project.id,
                  shot_index: pred.clipIndex,
                  status: 'completed',
                  video_url: finalVideoUrl,
                  duration_seconds: tasks.clipDuration || 10,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'project_id,shot_index', ignoreDuplicates: false });

              if (clipInsertError) {
                console.warn(`[Watchdog] ⚠️ Failed to upsert video_clips row for clip ${pred.clipIndex + 1}: ${clipInsertError.message}`);
              } else {
                console.log(`[Watchdog] ✅ video_clips row saved for clip ${pred.clipIndex + 1}`);
              }
            } catch (insertErr) {
              console.warn(`[Watchdog] video_clips insert failed (non-fatal):`, insertErr);
            }
          } else if (predictionStatus.status === 'failed') {
            console.error(`[Watchdog] ❌ Clip ${pred.clipIndex + 1} FAILED:`, predictionStatus.error);
            pred.status = 'failed';
            anyFailed = true;
          } else {
            // Still processing
            allCompleted = false;
            console.log(`[Watchdog] ⏳ Clip ${pred.clipIndex + 1} still processing: ${predictionStatus.status}`);
          }
        } catch (pollError) {
          console.error(`[Watchdog] Poll error for ${pred.predictionId}:`, pollError);
          allCompleted = false;
        }
      }
      
      // Update pending_video_tasks with latest status
      // Calculate if ALL clips are complete for accurate progress
      const totalExpectedClips = tasks.predictions?.length || 0;
      const isFullyComplete = completedClips.length === totalExpectedClips && totalExpectedClips > 0;
      
      // Track progress timestamp for stall detection
      const progressUpdate: Record<string, unknown> = {
        ...tasks,
      };
      if (completedClips.length > (tasks.lastCompletedCount || 0)) {
        progressUpdate.lastProgressAt = new Date().toISOString();
        progressUpdate.lastCompletedCount = completedClips.length;
      }
      
      const currentProgressPct = isFullyComplete ? 90 : Math.round(10 + (completedClips.length / Math.max(totalExpectedClips, 1)) * 75);
      await supabase.from('movie_projects').update({
        pending_video_tasks: {
          ...progressUpdate,
          progress: currentProgressPct,
          stage: isFullyComplete ? 'finalizing' : 'generating',
        },
        pipeline_stage: isFullyComplete ? 'stitching' : 'generating',
        pipeline_state: {
          stage: isFullyComplete ? 'finalizing' : 'async_video_generation',
          progress: currentProgressPct,
          message: isFullyComplete 
            ? 'Finalizing video...' 
            : `Generating clips (${completedClips.length}/${totalExpectedClips})...`,
          totalClips: totalExpectedClips,
          completedClips: completedClips.length,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', project.id);
      
      // If all completed, finalize the project
      // CRITICAL FIX: Explicitly verify ALL clips are complete, not just that some completed
      const expectedClipCount = tasks.predictions?.length || 0;
      const allClipsComplete = completedClips.length === expectedClipCount && expectedClipCount > 0;
      
      if (allClipsComplete) {
        console.log(`[Watchdog] ✅ ALL ${expectedClipCount} clips confirmed complete - finalizing`);
        console.log(`[Watchdog] 🎉 ASYNC AVATAR COMPLETE: Finalizing ${project.id}`);
        console.log(`[Watchdog] Completed clips before sort: ${JSON.stringify(completedClips.map(c => ({ idx: c.clipIndex, url: c.videoUrl.substring(0, 50) })))}`);
        
        // Sort clips by index - CRITICAL for correct playback order
        completedClips.sort((a, b) => a.clipIndex - b.clipIndex);
        
        // Build video_clips array from sorted completed clips
        const videoClipsArray = completedClips.map(c => c.videoUrl);
        const primaryVideoUrl = videoClipsArray[0];
        
        console.log(`[Watchdog] Final video_clips array (${videoClipsArray.length} items):`);
        videoClipsArray.forEach((url, idx) => {
          console.log(`[Watchdog]   Clip ${idx + 1}: ${url.substring(0, 80)}...`);
        });
        
        // ═══════════════════════════════════════════════════════════════════════════
        // WORLD-CLASS MUSIC: Route through sync-music-to-scenes for AI-enhanced scoring
        // This ensures avatar projects get the same Hans Zimmer-level treatment as hollywood-pipeline
        // ═══════════════════════════════════════════════════════════════════════════
        let musicUrl: string | null = null;
        let musicSyncPlan: any = null;
        try {
          const totalDuration = completedClips.length * (tasks.clipDuration || 10); // Kling V3 default: 10s
          console.log(`[Watchdog] 🎵 Generating AI-enhanced music for avatar (${totalDuration}s)...`);
          
          const script = tasks.originalScript || project.synopsis || '';
          
          // Build shot data for sync-music-to-scenes
          const shotData = completedClips.map((clip: any, idx: number) => ({
            id: `avatar_shot_${idx}`,
            description: tasks.segmentText?.[idx] || script.substring(idx * 50, (idx + 1) * 50) || `Avatar speaking clip ${idx + 1}`,
            dialogue: tasks.segmentText?.[idx] || script,
            durationSeconds: tasks.clipDuration || 10, // Kling V3 default: 10s
            mood: 'avatar',
          }));
          
          // CENTRALIZED: Call sync-music-to-scenes for AI analysis + music generation
          console.log(`[Watchdog] 🤖 Calling sync-music-to-scenes for AI-powered scoring...`);
          const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-music-to-scenes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              projectId: project.id,
              shots: shotData,
              totalDuration,
              overallMood: 'avatar',
              tempoPreference: 'moderate',
              includeDialogueDucking: true, // Critical for avatar - always duck music during speech
              useAIAnalysis: true,
            }),
          });
          
          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            if (syncResult.success && syncResult.plan) {
              musicSyncPlan = syncResult.plan;
              console.log(`[Watchdog] 🎵 Music sync plan created: ${musicSyncPlan.musicCues?.length || 0} cues, ${musicSyncPlan.timingMarkers?.length || 0} markers`);
              console.log(`[Watchdog] Scene type: ${musicSyncPlan.sceneType}, Composer: ${musicSyncPlan.referenceComposer}`);
              
              // Now generate music with the AI-enhanced parameters
              const musicResponse = await fetch(`${supabaseUrl}/functions/v1/generate-music`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  projectId: project.id,
                  duration: totalDuration + 2,
                  prompt: syncResult.musicPrompt,
                  mood: 'cinematic',
                  genre: 'hybrid',
                  sceneType: musicSyncPlan.sceneType || 'adventure-journey',
                  intensity: musicSyncPlan.intensity || 'moderate',
                  referenceComposer: musicSyncPlan.referenceComposer || 'hans-zimmer',
                  emotionalArc: musicSyncPlan.overallArc,
                }),
              });
              
              if (musicResponse.ok) {
                const musicResult = await musicResponse.json();
                if (musicResult.musicUrl) {
                  musicUrl = musicResult.musicUrl;
                  console.log(`[Watchdog] 🎵 AI-enhanced music generated: ${musicUrl.substring(0, 60)}...`);
                  
                  // Persist music sync plan for dialogue ducking
                  await supabase.from('movie_projects').update({
                    music_url: musicUrl,
                    pro_features_data: {
                      musicSyncPlan,
                      musicSyncPlanCreatedAt: new Date().toISOString(),
                    },
                  }).eq('id', project.id);
                }
              }
            }
          }
          
          // Fallback to direct generation if sync-music-to-scenes fails
          if (!musicUrl) {
            console.log(`[Watchdog] Sync failed, falling back to direct music generation...`);
            
            const scriptLower = script.toLowerCase();
            let detectedMood = 'cinematic';
            let sceneType = 'adventure-journey';
            let intensity: 'subtle' | 'moderate' | 'intense' = 'moderate';
            
            if (scriptLower.match(/love|romance|heart|together/)) {
              detectedMood = 'romantic';
              sceneType = 'romantic-love';
            } else if (scriptLower.match(/happy|excited|joy|celebrate|amazing/)) {
              detectedMood = 'uplifting';
              sceneType = 'triumph-victory';
              intensity = 'intense';
            } else if (scriptLower.match(/important|announce|launch|reveal|introducing/)) {
              detectedMood = 'epic';
              sceneType = 'adventure-journey';
              intensity = 'intense';
            }
            
            const musicResponse = await fetch(`${supabaseUrl}/functions/v1/generate-music`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                projectId: project.id,
                duration: totalDuration + 2,
                mood: detectedMood,
                genre: 'hybrid',
                sceneType,
                intensity,
                referenceComposer: 'hans-zimmer',
              }),
            });
            
            if (musicResponse.ok) {
              const musicResult = await musicResponse.json();
              if (musicResult.musicUrl) {
                musicUrl = musicResult.musicUrl;
                console.log(`[Watchdog] 🎵 Fallback music generated: ${musicUrl.substring(0, 60)}...`);
                await supabase.from('movie_projects').update({
                  music_url: musicUrl,
                }).eq('id', project.id);
              }
            }
          }
        } catch (musicError) {
          console.warn(`[Watchdog] Music generation skipped:`, musicError);
        }
        
        // ═══════════════════════════════════════════════════════════════════════════
        // AUTO-STITCH: Concatenate all clips into a single continuous video
        // ═══════════════════════════════════════════════════════════════════════════
        let stitchedVideoUrl: string | null = null;
        if (videoClipsArray.length > 1) {
          try {
            console.log(`[Watchdog] 🎬 AUTO-STITCH: Concatenating ${videoClipsArray.length} clips...`);
            const stitchResponse = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                projectId: project.id,
                videoUrls: videoClipsArray,
                musicUrl: musicUrl || undefined,
                outputFilename: `avatar_${project.id}_stitched_${Date.now()}.mp4`,
              }),
            });
            
            if (stitchResponse.ok) {
              const stitchResult = await stitchResponse.json();
              if (stitchResult.success && stitchResult.videoUrl) {
                stitchedVideoUrl = stitchResult.videoUrl;
                console.log(`[Watchdog] ✅ AUTO-STITCH complete: ${stitchedVideoUrl!.substring(0, 60)}...`);
              } else {
                console.warn(`[Watchdog] Stitch returned no video URL, using individual clips`);
              }
            } else {
              console.warn(`[Watchdog] Stitch failed (${stitchResponse.status}), using individual clips`);
            }
          } catch (stitchError) {
            console.warn(`[Watchdog] Auto-stitch exception (non-fatal):`, stitchError);
          }
        }
        
        const finalVideoUrl = stitchedVideoUrl || primaryVideoUrl;
        
        const { error: updateError } = await supabase.from('movie_projects').update({
          status: 'completed',
          video_url: finalVideoUrl,
          video_clips: videoClipsArray,
          pipeline_stage: 'completed',
          pipeline_state: {
            stage: 'completed',
            progress: 100,
            message: 'Avatar video complete!',
            completedAt: new Date().toISOString(),
            asyncCompletedByWatchdog: true,
            totalClipsGenerated: videoClipsArray.length,
            hasMusic: !!musicUrl,
            hasStitchedVideo: !!stitchedVideoUrl,
          },
          pending_video_tasks: {
            ...tasks,
            status: 'completed',
            completedAt: new Date().toISOString(),
            musicUrl,
            stitchedVideoUrl,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', project.id);
        
        if (updateError) {
          console.error(`[Watchdog] ❌ Failed to complete project ${project.id}:`, updateError);
          console.error(`[Watchdog] Update error details:`, JSON.stringify(updateError));
        } else {
          console.log(`[Watchdog] ✅ Database update succeeded for ${project.id}`);
          
          // Notify user their avatar video is ready
          await notifyVideoComplete(supabase, project.user_id, project.id, project.title, {
            clipCount: videoClipsArray.length,
            videoUrl: finalVideoUrl,
          });
        }
        
        result.productionResumed++;
        result.details.push({
          projectId: project.id,
          action: 'async_avatar_completed',
          result: `${completedClips.length} clips finalized${musicUrl ? ' with music' : ''}`,
        });
        console.log(`[Watchdog] ✅ ASYNC AVATAR ${project.id} COMPLETE!`);
        continue;
      }
      
      // Check for stalled async jobs with CLIP-AWARE TIMEOUT
      // Multi-clip videos take 2-3 minutes per clip, so timeout scales with clip count
      const startedAt = tasks.startedAt ? new Date(tasks.startedAt).getTime() : 0;
      const asyncAge = Date.now() - startedAt;
      
      // DYNAMIC TIMEOUT: Base 10 min + 3 min per clip (10 clips = 40 min max)
      const totalExpectedClipsForTimeout = tasks.predictions?.length || 1;
      const MAX_ASYNC_AGE_MS = (10 + totalExpectedClipsForTimeout * 3) * 60 * 1000;
      
      // Also check for no-progress stall: if no new clips completed in last 5 minutes
      const lastProgressMs = tasks.lastProgressAt ? new Date(tasks.lastProgressAt).getTime() : startedAt;
      const timeSinceProgress = Date.now() - lastProgressMs;
      const STALL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes with no new clip
      
      // Fail only if: exceeded dynamic max age AND no clips completed
      // OR: exceeded stall threshold with partial completion (stuck mid-generation)
      const isAbsoluteTimeout = asyncAge > MAX_ASYNC_AGE_MS && completedClips.length === 0;
      const isStalled = timeSinceProgress > STALL_THRESHOLD_MS && completedClips.length > 0 && completedClips.length < totalExpectedClipsForTimeout;
      
      // For stalled projects, check if any predictions are still processing
      let hasActivePredictions = false;
      if (tasks.predictions) {
        hasActivePredictions = tasks.predictions.some((p: { status: string }) => 
          p.status === 'processing' || p.status === 'pending'
        );
      }
      
      // Don't fail if predictions are still active (Kling is slow but working)
      if ((isAbsoluteTimeout || (isStalled && !hasActivePredictions))) {
        console.log(`[Watchdog] ❌ ASYNC AVATAR ${project.id} timed out after ${Math.round(asyncAge / 60000)}m (max was ${Math.round(MAX_ASYNC_AGE_MS / 60000)}m)`);
        console.log(`[Watchdog]    Completed: ${completedClips.length}/${totalExpectedClipsForTimeout}, hasActive: ${hasActivePredictions}`);
        
        // Mark failed and refund
        await supabase.from('movie_projects').update({
          status: 'failed',
          pipeline_state: {
            stage: 'error',
            error: 'Avatar generation timed out',
            failedAt: new Date().toISOString(),
            completedClipsBeforeTimeout: completedClips.length,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', project.id);
        
        // Refund credits (only for clips that weren't generated)
        try {
          const failedClipCount = totalExpectedClipsForTimeout - completedClips.length;
          const estimatedCredits = failedClipCount * 10;
          if (estimatedCredits > 0) {
            // IDEMPOTENCY CHECK: Don't issue duplicate refunds
            const { data: existingRefund } = await supabase
              .from('credit_transactions')
              .select('id')
              .eq('project_id', project.id)
              .eq('transaction_type', 'refund')
              .limit(1);
            
            if (existingRefund && existingRefund.length > 0) {
              console.log(`[Watchdog] Skipping duplicate refund for project ${project.id}`);
            } else {
              await supabase.rpc('increment_credits', {
                user_id_param: project.user_id,
                amount_param: estimatedCredits,
              });
              
              await supabase.from('credit_transactions').insert({
                user_id: project.user_id,
                amount: estimatedCredits,
                transaction_type: 'refund',
                description: `Auto-refund: Async avatar timeout (${failedClipCount}/${totalExpectedClipsForTimeout} clips failed)`,
                project_id: project.id,
              });
              
              console.log(`[Watchdog] 💰 Refunded ${estimatedCredits} credits for ${failedClipCount} failed clips`);
            }
          }
        } catch (refundError) {
          console.error(`[Watchdog] Refund failed:`, refundError);
        }
        
        // Notify user about avatar timeout
        const failedClipCount2 = totalExpectedClipsForTimeout - completedClips.length;
        const estimatedCredits2 = failedClipCount2 * 10;
        await notifyVideoFailed(supabase, project.user_id, project.id, project.title, {
          reason: 'Avatar generation timed out',
          creditsRefunded: estimatedCredits2 > 0 ? estimatedCredits2 : undefined,
        });
        
        result.projectsMarkedFailed++;
        continue;
      } else if (isStalled && hasActivePredictions) {
        console.log(`[Watchdog] ⏳ Avatar ${project.id} stalled but has active predictions - continuing`);
      }
    }

    // ==================== PHASE 0a: ORPHANED AVATAR COMPLETION RECOVERY ====================
    // CRITICAL FIX: Detect avatar projects where DB write failed but videos exist in storage
    // This catches the "connection closed before message completed" scenario
    const AVATAR_STUCK_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes (reduced for faster recovery)
    
    const { data: avatarStuckProjects } = await supabase
      .from('movie_projects')
      .select('id, title, status, mode, updated_at, user_id, pipeline_state, source_image_url, avatar_voice_id, synopsis')
      .eq('status', 'generating')
      .eq('mode', 'avatar')
      .lt('updated_at', new Date(Date.now() - AVATAR_STUCK_THRESHOLD_MS).toISOString())
      .limit(20);
    
    for (const project of (avatarStuckProjects || [])) {
      const projectAge = Date.now() - new Date(project.updated_at).getTime();
      const pipelineState = project.pipeline_state as Record<string, any> || {};
      
      console.log(`[Watchdog] 🎭 Avatar project ${project.id}: age=${Math.round(projectAge / 1000)}s, stage=${pipelineState.stage || 'unknown'}`);
      
      // ═══════════════════════════════════════════════════════════════════════════
      // PRIORITY 1: Check for orphan completion marker (DB write failed but generation succeeded)
      // ═══════════════════════════════════════════════════════════════════════════
      try {
        const markerPath = `avatar-videos/${project.id}/_completion_marker.json`;
        const { data: markerData } = await supabase.storage
          .from('video-clips')
          .download(markerPath);
        
        if (markerData) {
          const markerText = await markerData.text();
          const completionData = JSON.parse(markerText);
          
          console.log(`[Watchdog] 🎯 ORPHAN MARKER FOUND for ${project.id} - recovering from DB failure`);
          
          // Recover the project using the completion marker data
          const { error: recoveryError } = await supabase
            .from('movie_projects')
            .update({
              status: 'completed',
              video_url: completionData.videoUrl,
              final_video_url: completionData.videoUrl,
              voice_audio_url: completionData.audioUrl,
              video_clips: completionData.clips || [],
              pipeline_stage: 'completed',
              pipeline_state: {
                stage: 'completed',
                progress: 100,
                message: 'Recovered from orphaned completion',
                completedAt: completionData.completedAt,
                recoveredByWatchdog: true,
                recoveredAt: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          if (!recoveryError) {
            // Delete the marker after successful recovery
            await supabase.storage
              .from('video-clips')
              .remove([markerPath]);
            
            result.productionResumed++;
            result.details.push({
              projectId: project.id,
              action: 'orphan_completion_recovered',
              result: `DB failure recovered via completion marker`,
            });
            console.log(`[Watchdog] ✅ ORPHAN RECOVERY SUCCESS for ${project.id}`);
            continue; // Skip other recovery attempts
          }
        }
      } catch (markerError) {
        // No marker found, continue with normal recovery
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // PRIORITY 2: Check if video files exist in storage even without marker
      // ═══════════════════════════════════════════════════════════════════════════
      try {
        const { data: storageFiles } = await supabase.storage
          .from('video-clips')
          .list(`avatar-videos/${project.id}`, { limit: 10 });
        
        const videoFiles = (storageFiles || []).filter(f => f.name.endsWith('.mp4'));
        const audioFiles = (storageFiles || []).filter(f => f.name.includes('master_audio') || f.name.endsWith('.mp3'));
        
        if (videoFiles.length > 0) {
          console.log(`[Watchdog] 📁 Found ${videoFiles.length} video(s) in storage for ${project.id}`);
          
          // Video exists! Recover from storage
          const videoUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/avatar-videos/${project.id}/${videoFiles[0].name}`;
          const audioUrl = audioFiles.length > 0 
            ? `${supabaseUrl}/storage/v1/object/public/video-clips/avatar-videos/${project.id}/${audioFiles[0].name}`
            : null;
          
          const { error: storageRecoveryError } = await supabase
            .from('movie_projects')
            .update({
              status: 'completed',
              video_url: videoUrl,
              final_video_url: videoUrl,
              voice_audio_url: audioUrl,
              video_clips: videoFiles.map(f => `${supabaseUrl}/storage/v1/object/public/video-clips/avatar-videos/${project.id}/${f.name}`),
              pipeline_stage: 'completed',
              pipeline_state: {
                stage: 'completed',
                progress: 100,
                message: 'Recovered from storage',
                recoveredByWatchdog: true,
                recoveredAt: new Date().toISOString(),
                recoverySource: 'storage_scan',
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          if (!storageRecoveryError) {
            result.productionResumed++;
            result.details.push({
              projectId: project.id,
              action: 'storage_recovery',
              result: `Recovered ${videoFiles.length} video(s) from storage`,
            });
            console.log(`[Watchdog] ✅ STORAGE RECOVERY SUCCESS for ${project.id}`);
            continue;
          }
        }
      } catch (storageError) {
        console.warn(`[Watchdog] Storage scan failed for ${project.id}:`, storageError);
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // PRIORITY 3: Standard retry/fail logic (no videos found)
      // ═══════════════════════════════════════════════════════════════════════════
      const retryCount = pipelineState.watchdogRetryCount || 0;
      const MAX_AVATAR_RETRIES = 2;
      
      if (retryCount < MAX_AVATAR_RETRIES && project.source_image_url) {
        console.log(`[Watchdog] 🔄 Retrying avatar pipeline for ${project.id} (attempt ${retryCount + 1}/${MAX_AVATAR_RETRIES})`);
        
        try {
          await supabase
            .from('movie_projects')
            .update({
              pipeline_state: {
                ...pipelineState,
                watchdogRetryCount: retryCount + 1,
                lastRetryAt: new Date().toISOString(),
                stage: 'retrying',
                progress: 5,
                message: `Retrying generation (attempt ${retryCount + 2})...`,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          const response = await fetch(`${supabaseUrl}/functions/v1/generate-avatar-direct`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              projectId: project.id,
              userId: project.user_id,
              avatarImageUrl: project.source_image_url,
              voiceId: project.avatar_voice_id || 'bella',
              script: project.synopsis || 'Hello, I am your AI avatar.',
              clipCount: pipelineState.totalClips || 1,
            }),
          });
          
          if (response.ok) {
            result.productionResumed++;
            result.details.push({
              projectId: project.id,
              action: 'avatar_pipeline_retry',
              result: `Retry ${retryCount + 1}/${MAX_AVATAR_RETRIES}`,
            });
            console.log(`[Watchdog] ✅ Avatar pipeline retry triggered for ${project.id}`);
          } else {
            console.error(`[Watchdog] Avatar retry failed: ${response.status}`);
          }
        } catch (error) {
          console.error(`[Watchdog] Avatar retry error:`, error);
        }
      } else {
        // MAX RETRIES EXCEEDED: Mark as failed and refund credits
        console.log(`[Watchdog] ❌ Avatar project ${project.id} failed after ${retryCount} retries - marking failed`);
        
        await supabase
          .from('movie_projects')
          .update({
            status: 'failed',
            pipeline_state: {
              ...pipelineState,
              stage: 'error',
              error: 'Avatar generation failed - no video produced',
              failedAt: new Date().toISOString(),
              watchdogFailure: true,
            },
            pending_video_tasks: {
              stage: 'error',
              error: 'Avatar generation timed out',
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id);
        
        // Refund credits
        try {
          const estimatedCredits = (pipelineState.totalClips || 1) * 10;
          
          // IDEMPOTENCY CHECK: Don't issue duplicate refunds
          const { data: existingRefund } = await supabase
            .from('credit_transactions')
            .select('id')
            .eq('project_id', project.id)
            .eq('transaction_type', 'refund')
            .limit(1);
          
          if (existingRefund && existingRefund.length > 0) {
            console.log(`[Watchdog] Skipping duplicate refund for project ${project.id}`);
          } else {
            await supabase.rpc('increment_credits', {
              user_id_param: project.user_id,
              amount_param: estimatedCredits,
            });
            
            await supabase.from('credit_transactions').insert({
              user_id: project.user_id,
              amount: estimatedCredits,
              transaction_type: 'refund',
              description: `Auto-refund: Avatar generation failed (${project.title || project.id})`,
              project_id: project.id,
            });
            
            console.log(`[Watchdog] 💰 Refunded ${estimatedCredits} credits to user ${project.user_id}`);
          }
        } catch (refundError) {
          console.error(`[Watchdog] Credit refund failed:`, refundError);
        }
        
        // Notify user about avatar failure
        const estimatedCreditsForNotify = (pipelineState.totalClips || 1) * 10;
        await notifyVideoFailed(supabase, project.user_id, project.id, project.title, {
          reason: 'Avatar generation failed after retries',
          creditsRefunded: estimatedCreditsForNotify > 0 ? estimatedCreditsForNotify : undefined,
        });
        
        result.projectsMarkedFailed++;
        result.details.push({
          projectId: project.id,
          action: 'avatar_marked_failed',
          result: `No video after ${Math.round(projectAge / 60000)} minutes, credits refunded`,
        });
      }
    }

    // ==================== PHASE 0b-FIX: FALSE FAILURE RECOVERY ====================
    // CRITICAL: Find avatar projects marked 'failed' that actually have all videos
    // This catches the race condition where a transient error set status='failed'
    // but the video generation actually succeeded afterwards
    console.log("[Watchdog] 🔍 Checking for false failure projects...");
    
    const { data: falseFailureProjects } = await supabase
      .from('movie_projects')
      .select('id, title, status, mode, pending_video_tasks, video_url, video_clips, user_id')
      .eq('status', 'failed')
      .eq('mode', 'avatar')
      .gt('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 mins
      .limit(20);
    
    for (const project of (falseFailureProjects || [])) {
      // deno-lint-ignore no-explicit-any
      const tasks = (project.pending_video_tasks || {}) as Record<string, any>;
      
      // Only process async avatar jobs
      if (tasks.type !== 'avatar_async' || !tasks.predictions) continue;
      
      // deno-lint-ignore no-explicit-any
      const predictions = tasks.predictions as Array<{ clipIndex: number; videoUrl?: string; status: string }>;
      const clipsWithVideo = predictions.filter(p => p.videoUrl && p.videoUrl.length > 0);
      const totalClips = predictions.length;
      
      console.log(`[Watchdog] 🔍 FALSE FAILURE CHECK ${project.id}: ${clipsWithVideo.length}/${totalClips} clips have videos`);
      
      // If ALL clips have video URLs, this is a false failure - recover it!
      if (clipsWithVideo.length === totalClips && totalClips > 0) {
        console.log(`[Watchdog] ⚠️ FALSE FAILURE DETECTED: ${project.id} has all ${totalClips} videos but status='failed'`);
        
        // Sort clips and build video array
        clipsWithVideo.sort((a, b) => a.clipIndex - b.clipIndex);
        const videoClipsArray = clipsWithVideo.map(p => p.videoUrl!);
        const primaryVideoUrl = videoClipsArray[0];
        
        // Fix the prediction statuses to match reality
        const fixedPredictions = predictions.map(p => ({
          ...p,
          status: p.videoUrl ? 'completed' : p.status,
        }));
        
        const { error: recoveryError } = await supabase
          .from('movie_projects')
          .update({
            status: 'completed',
            video_url: primaryVideoUrl,
            video_clips: videoClipsArray,
            pipeline_stage: 'completed',
            pipeline_state: {
              stage: 'completed',
              progress: 100,
              message: 'Video generation complete!',
              completedAt: new Date().toISOString(),
              recoveredFromFalseFailure: true,
              recoveredByWatchdog: true,
            },
            pending_video_tasks: {
              ...tasks,
              predictions: fixedPredictions,
              stage: 'complete',
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id);
        
        if (!recoveryError) {
          result.productionResumed++;
          result.details.push({
            projectId: project.id,
            action: 'false_failure_recovered',
            result: `Recovered ${totalClips} clips from false failure state`,
          });
          console.log(`[Watchdog] ✅ FALSE FAILURE RECOVERED: ${project.id} now completed with ${totalClips} clips`);
        } else {
          console.error(`[Watchdog] Failed to recover ${project.id}:`, recoveryError);
        }
      }
    }

    // ==================== PHASE 0b: GLOBAL MUTEX SWEEP ====================
    // Find and release ALL stale mutexes across all generating projects
    const { data: lockedProjects } = await supabase
      .from('movie_projects')
      .select('id, generation_lock, pro_features_data')
      .eq('status', 'generating')
      .not('generation_lock', 'is', null)
      .limit(50);
    
    for (const project of (lockedProjects || [])) {
      // CRITICAL FIX: First check if the locked clip is already completed
      // This catches the case where clip completed but function timed out before releasing lock
      const completedLockResult = await releaseStaleCompletedLock(supabase, project.id);
      if (completedLockResult.released) {
        result.mutexesReleased++;
        result.details.push({
          projectId: project.id,
          action: 'completed_clip_lock_released',
          result: `Released lock from completed clip ${completedLockResult.completedClip}`,
        });
        console.log(`[Watchdog] 🔓 CRITICAL FIX: Released stale lock from COMPLETED clip ${completedLockResult.completedClip} for ${project.id}`);
        continue; // Skip to next project - lock is now released
      }
      
      // Standard stale lock check (for clips still generating too long)
      const mutexResult = await checkAndRecoverStaleMutex(supabase, project.id);
      if (mutexResult.wasStale) {
        result.mutexesReleased++;
        result.details.push({
          projectId: project.id,
          action: 'mutex_released',
          result: `Released stale lock from clip ${mutexResult.releasedClip}`,
        });
        console.log(`[Watchdog] 🔓 Released stale mutex for ${project.id} (clip ${mutexResult.releasedClip})`);
      }
    }

    // ==================== PHASE 0.5: CLIP 0 FRAME GUARANTEE ====================
    // Ensure all Clip 0s have last_frame_url set to reference image
    const { data: projectsWithClips } = await supabase
      .from('movie_projects')
      .select('id, pro_features_data')
      .eq('status', 'generating')
      .limit(30);
    
    for (const project of (projectsWithClips || [])) {
      const { data: clip0 } = await supabase
        .from('video_clips')
        .select('id, last_frame_url, video_url, status')
        .eq('project_id', project.id)
        .eq('shot_index', 0)
        .maybeSingle();
      
      // If Clip 0 is completed but missing last_frame_url, fix it
      if (clip0 && clip0.status === 'completed' && !clip0.last_frame_url) {
        const proFeatures = project.pro_features_data as Record<string, any> || {};
        const referenceImageUrl = proFeatures.referenceAnalysis?.imageUrl 
          || proFeatures.identityBible?.originalReferenceUrl;
        
        if (referenceImageUrl && isValidImageUrl(referenceImageUrl)) {
          await supabase
            .from('video_clips')
            .update({ 
              last_frame_url: referenceImageUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', clip0.id);
          
          result.clip0FramesFixed++;
          result.details.push({
            projectId: project.id,
            action: 'clip0_frame_fixed',
            result: `Set last_frame_url to reference image`,
          });
          console.log(`[Watchdog] ✓ Fixed Clip 0 last_frame for ${project.id}`);
        }
      }
    }

    // ==================== PHASE 1: RETRY_SCHEDULED PROJECTS ====================
    // These are projects that have scheduled retries - process them first
    const now = new Date().toISOString();
    
    const { data: retryProjects } = await supabase
      .from('movie_projects')
      .select('id, title, status, updated_at, pending_video_tasks, user_id, stitch_attempts')
      .eq('status', 'retry_scheduled')
      .limit(20);
    
    for (const project of (retryProjects as StalledProject[] || [])) {
      const tasks = project.pending_video_tasks || {};
      const retryAfter = (tasks as Record<string, unknown>).retryAfter as string | undefined;
      
      // Check if retry time has passed
      if (retryAfter && new Date(retryAfter) <= new Date(now)) {
        console.log(`[Watchdog] Processing scheduled retry for ${project.id}`);
        
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ projectId: project.id }),
          });
          
          if (response.ok) {
            result.retryScheduledProcessed++;
            result.details.push({
              projectId: project.id,
              action: 'retry_triggered',
              result: `Scheduled retry executed`,
            });
            console.log(`[Watchdog] ✓ Retry triggered for ${project.id}`);
          } else {
            console.error(`[Watchdog] Retry trigger failed: ${response.status}`);
          }
        } catch (error) {
          console.error(`[Watchdog] Retry trigger error:`, error);
        }
      }
    }

    // ==================== PHASE 2: STITCH_JOBS TABLE ====================
    // Check for stitch jobs that are ready for retry
    const { data: pendingJobs } = await supabase
      .from('stitch_jobs')
      .select('id, project_id, user_id, status, retry_after, attempt_number, max_attempts, last_error')
      .eq('status', 'retry_scheduled')
      .lte('retry_after', now)
      .limit(20);
    
    for (const job of (pendingJobs as StitchJob[] || [])) {
      console.log(`[Watchdog] Processing stitch job retry: ${job.id}`);
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ projectId: job.project_id, jobId: job.id }),
        });
        
        if (response.ok) {
          result.stitchingRetried++;
          result.details.push({
            projectId: job.project_id,
            action: 'stitch_job_retry',
            result: `Job ${job.id} retry ${job.attempt_number}/${job.max_attempts}`,
          });
        }
      } catch (error) {
        console.error(`[Watchdog] Stitch job retry error:`, error);
      }
    }

    // ==================== PHASE 2.5: CALLBACK STALL RECOVERY ====================
    // Detect projects where generate-single-clip failed to trigger continue-production
    // These have needsWatchdogResume=true set by the callback retry failure handler
    const { data: callbackStallProjects } = await supabase
      .from('movie_projects')
      .select('id, title, status, updated_at, pending_video_tasks, user_id, generated_script')
      .eq('status', 'generating')
      .limit(50);
    
    for (const project of (callbackStallProjects || [])) {
      const tasks = (project.pending_video_tasks || {}) as Record<string, any>;
      
      if (tasks.needsWatchdogResume) {
        const lastCompletedClip = tasks.lastCompletedClip ?? -1;
        console.log(`[Watchdog] 🔧 CALLBACK STALL detected for ${project.id} - last completed: ${lastCompletedClip + 1}`);
        
        try {
          // Clear the flag and resume
          await supabase
            .from('movie_projects')
            .update({
              pending_video_tasks: {
                ...tasks,
                needsWatchdogResume: false,
                watchdogResumedAt: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          // Trigger continue-production to resume from where it stalled
          const response = await fetch(`${supabaseUrl}/functions/v1/continue-production`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              projectId: project.id,
              userId: project.user_id,
              completedClipIndex: lastCompletedClip,
              totalClips: tasks.clipCount || 5,
            }),
          });
          
          if (response.ok) {
            result.productionResumed++;
            result.details.push({
              projectId: project.id,
              action: 'callback_stall_recovered',
              result: `Resumed from clip ${lastCompletedClip + 2}`,
            });
            console.log(`[Watchdog] ✓ Callback stall recovered for ${project.id}`);
          }
        } catch (error) {
          console.error(`[Watchdog] Callback stall recovery error:`, error);
        }
      }
    }

    // ==================== PHASE 3: STALLED PROJECTS ====================
    const cutoffTime = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString();
    
    const { data: stalledProjects, error: stalledError } = await supabase
      .from('movie_projects')
      .select('id, title, status, updated_at, pending_video_tasks, user_id, generated_script, stitch_attempts')
      .in('status', ['generating', 'stitching', 'rendering', 'assembling'])
      .lt('updated_at', cutoffTime)
      .limit(30);
    
    if (stalledError) {
      console.error("[Watchdog] Error finding stalled projects:", stalledError);
      throw stalledError;
    }

    result.stalledProjects = stalledProjects?.length || 0;
    console.log(`[Watchdog] Found ${result.stalledProjects} potentially stalled projects`);

    for (const project of (stalledProjects as StalledProject[] || [])) {
      const tasks = project.pending_video_tasks || {};
      const projectAge = Date.now() - new Date(project.updated_at).getTime();
      const stage = (tasks as Record<string, unknown>).stage || 'unknown';
      const stitchAttempts = project.stitch_attempts || 0;
      
      console.log(`[Watchdog] Processing: ${project.id} (status=${project.status}, stage=${stage}, age=${Math.round(projectAge / 1000)}s)`);

      // ==================== STUCK STITCHING ====================
      if (project.status === 'stitching' || project.status === 'assembling') {
        const stitchingStarted = (tasks as Record<string, unknown>).stitchingStarted as string | undefined;
        const stitchingAge = stitchingStarted 
          ? Date.now() - new Date(stitchingStarted).getTime()
          : projectAge;

        if (stitchingAge > STITCHING_TIMEOUT_MS) {
          if (stitchAttempts >= MAX_STITCHING_ATTEMPTS) {
            console.log(`[Watchdog] Max stitch attempts for ${project.id}, creating manifest`);
            await createManifestFallback(supabaseUrl, supabaseKey, project.id);
            result.manifestFallbacks++;
            result.details.push({
              projectId: project.id,
              action: 'manifest_fallback',
              result: `Created manifest after ${stitchAttempts} attempts`,
            });
          } else {
            console.log(`[Watchdog] Retrying stitch for ${project.id}`);
            
            await supabase
              .from('movie_projects')
              .update({
                stitch_attempts: stitchAttempts + 1,
                pending_video_tasks: {
                  ...tasks,
                  lastRetryAt: new Date().toISOString(),
                  watchdogRetry: true,
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', project.id);
            
            try {
              const response = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({ projectId: project.id }),
              });
              
              if (response.ok) {
                result.stitchingRetried++;
                result.details.push({
                  projectId: project.id,
                  action: 'stitch_retried',
                  result: `Attempt ${stitchAttempts + 1}/${MAX_STITCHING_ATTEMPTS}`,
                });
              }
            } catch (error) {
              console.error(`[Watchdog] Stitch retry error:`, error);
            }
          }
          continue;
        }
      }

      // ==================== STUCK AT ASSETS STAGE ====================
      // This catches the case where generate-scene-images completed but hollywood-pipeline got early_drop
      if (project.status === 'generating' && stage === 'assets') {
        // Check if scene images exist in DB
        const { data: projectData } = await supabase
          .from('movie_projects')
          .select('scene_images')
          .eq('id', project.id)
          .single();
        
        const sceneImages = projectData?.scene_images;
        const hasSceneImages = sceneImages && Array.isArray(sceneImages) && sceneImages.length > 0;
        
        if (hasSceneImages) {
          console.log(`[Watchdog] Assets stage stall detected for ${project.id} - scene images exist, resuming to production`);
          
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/resume-pipeline`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                projectId: project.id,
                userId: project.user_id,
                resumeFrom: 'production', // Skip to production since images are done
              }),
            });
            
            if (response.ok) {
              result.productionResumed++;
              result.details.push({
                projectId: project.id,
                action: 'assets_stall_recovered',
                result: `Scene images exist, resuming to production`,
              });
              console.log(`[Watchdog] ✓ Assets stall recovered for ${project.id}`);
            }
          } catch (error) {
            console.error(`[Watchdog] Assets stall recovery error:`, error);
          }
          continue;
        } else if (projectAge > 3 * 60 * 1000) {
          // If stuck at assets for 3+ minutes with no images, retry from assets
          console.log(`[Watchdog] Assets stage stall for ${project.id} - no images, restarting assets stage`);
          
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/resume-pipeline`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                projectId: project.id,
                userId: project.user_id,
                resumeFrom: 'assets',
              }),
            });
            
            if (response.ok) {
              result.productionResumed++;
              result.details.push({
                projectId: project.id,
                action: 'assets_stall_restart',
                result: `No scene images after 3min, restarting assets`,
              });
            }
          } catch (error) {
            console.error(`[Watchdog] Assets restart error:`, error);
          }
          continue;
        }
      }

      // ==================== STUCK GENERATING ====================
      if (project.status === 'generating') {
        let expectedClipCount = ((tasks as Record<string, unknown>).clipCount as number) || 6;
        
        if (project.generated_script) {
          try {
            const script = JSON.parse(project.generated_script);
            if (script.shots && Array.isArray(script.shots)) {
              expectedClipCount = script.shots.length;
            }
          } catch { /* ignore */ }
        }
        
        const { data: clips } = await supabase
          .from('video_clips')
          .select('id, shot_index, status, video_url, veo_operation_name, updated_at')
          .eq('project_id', project.id)
          .order('shot_index');
        
        // ==================== CLIP STATUS RECONCILIATION ====================
        // GUARD RAIL: Fix clips that have video_url but status is still 'generating'
        // This happens when DB update races with video storage completion
        const staleStatusClips = (clips || []).filter((c: { status: string; video_url: string | null }) => 
          c.status === 'generating' && c.video_url
        );
        
        if (staleStatusClips.length > 0) {
          console.log(`[Watchdog] ⚠️ Found ${staleStatusClips.length} clips with stale status (have video but status='generating')`);
          
          for (const clip of staleStatusClips) {
            try {
              await supabase
                .from('video_clips')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', clip.id);
              
              console.log(`[Watchdog] ✓ Reconciled clip ${clip.shot_index + 1}: status='generating' -> 'completed'`);
              result.details.push({
                projectId: project.id,
                action: 'clip_status_reconciled',
                result: `Clip ${clip.shot_index + 1} had video but stale 'generating' status - fixed`,
              });
            } catch (reconcileError) {
              console.error(`[Watchdog] Failed to reconcile clip ${clip.shot_index + 1}:`, reconcileError);
            }
          }
          
          // Re-fetch clips after reconciliation
          const { data: refreshedClips } = await supabase
            .from('video_clips')
            .select('id, shot_index, status, video_url, veo_operation_name, updated_at')
            .eq('project_id', project.id)
            .order('shot_index');
          
          // Use refreshed data for remaining logic
          Object.assign(clips || [], refreshedClips || []);
        }
        
        const completedClips = (clips || []).filter((c: { status: string; video_url: string }) => 
          c.status === 'completed' && c.video_url
        );
        
        // ==================== RECOVER STUCK CLIPS ====================
        // GUARD RAIL: Two-pronged recovery approach
        // 1. Check storage for orphaned videos (DB update failed after upload)
        // 2. Check Replicate predictions for clips that timed out during polling
        
        const proFeatures = project.pro_features_data as Record<string, any> || {};
        const referenceImageUrl = proFeatures.referenceAnalysis?.imageUrl 
          || proFeatures.identityBible?.originalReferenceUrl;
        
        // First: Try to recover ALL stuck clips using storage scan
        const storageRecovery = await recoverAllStuckClips(
          supabase, 
          project.id, 
          referenceImageUrl
        );
        
        if (storageRecovery.recoveredCount > 0) {
          result.stuckClipsRecovered += storageRecovery.recoveredCount;
          console.log(`[Watchdog] 🔧 Storage scan recovered ${storageRecovery.recoveredCount} clips`);
          for (const detail of storageRecovery.details) {
            result.details.push({
              projectId: project.id,
              action: 'storage_recovery',
              result: `Clip ${detail.clipIndex + 1}: ${detail.result}`,
            });
          }
        }
        
        // Second: Find remaining stuck clips with prediction IDs
        const stuckClips = (clips || []).filter((c: { status: string; veo_operation_name: string | null; updated_at: string }) => 
          (c.status === 'generating' || c.status === 'pending') && 
          c.veo_operation_name &&
          (Date.now() - new Date(c.updated_at).getTime() > 60000) // Stuck for 1+ minute
        );
        
        if (stuckClips.length > 0) {
          console.log(`[Watchdog] Found ${stuckClips.length} stuck clips with prediction IDs - attempting Replicate recovery`);
          
          for (const clip of stuckClips) {
            try {
              // First: Check if video already exists in storage (faster than Replicate API)
              const orphanedResult = await findOrphanedVideo(supabase, project.id, clip.shot_index);
              
              if (orphanedResult.found && orphanedResult.videoUrl) {
                // Recover from storage directly
                await recoverStuckClip(
                  supabase,
                  project.id,
                  clip.shot_index,
                  clip.id,
                  referenceImageUrl
                );
                
                console.log(`[Watchdog] ✓ Recovered clip ${clip.shot_index + 1} from storage`);
                result.details.push({
                  projectId: project.id,
                  action: 'clip_recovered_storage',
                  result: `Clip ${clip.shot_index + 1} recovered from orphaned storage file`,
                });
                continue;
              }
              
              console.log(`[Watchdog] Checking Replicate prediction ${clip.veo_operation_name} for clip ${clip.shot_index + 1}...`);
              
              // Call check-video-status with autoComplete=true to recover the clip
              const response = await fetch(`${supabaseUrl}/functions/v1/check-video-status`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  taskId: clip.veo_operation_name,
                  provider: 'replicate',
                  projectId: project.id,
                  userId: project.user_id,
                  shotIndex: clip.shot_index,
                  autoComplete: true, // This will store the video and update the clip record
                }),
              });
              
              if (response.ok) {
                const statusResult = await response.json();
                if (statusResult.status === 'SUCCEEDED' && statusResult.autoCompleted) {
                  console.log(`[Watchdog] ✓ Recovered clip ${clip.shot_index + 1} from Replicate`);
                  result.stuckClipsRecovered++;
                  result.details.push({
                    projectId: project.id,
                    action: 'clip_recovered_replicate',
                    result: `Clip ${clip.shot_index + 1} auto-completed from prediction ${clip.veo_operation_name}`,
                  });
                } else if (statusResult.status === 'FAILED') {
                  console.log(`[Watchdog] Clip ${clip.shot_index + 1} prediction failed: ${statusResult.error}`);
                  
                  // Mark clip as failed so it can be retried
                  await supabase
                    .from('video_clips')
                    .update({
                      status: 'failed',
                      error_message: statusResult.error || 'Replicate prediction failed',
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', clip.id);
                } else if (statusResult.status === 'RUNNING' || statusResult.status === 'STARTING') {
                  console.log(`[Watchdog] Clip ${clip.shot_index + 1} still processing`);
                }
              }
            } catch (recoverError) {
              console.error(`[Watchdog] Clip recovery error:`, recoverError);
            }
          }
        }
        
        // Re-fetch clips after recovery attempt
        const { data: updatedClips } = await supabase
          .from('video_clips')
          .select('id, shot_index, status, video_url')
          .eq('project_id', project.id)
          .order('shot_index');
        
        const newCompletedCount = (updatedClips || []).filter((c: { status: string; video_url: string }) => 
          c.status === 'completed' && c.video_url
        ).length;
        
        console.log(`[Watchdog] After recovery: ${newCompletedCount}/${expectedClipCount} clips`);
        
        console.log(`[Watchdog] Clips: ${completedClips.length}/${expectedClipCount}`);
        
        // All done -> trigger stitch
        if (completedClips.length >= expectedClipCount) {
          console.log(`[Watchdog] All clips ready, triggering stitch`);
          
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/simple-stitch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ projectId: project.id }),
            });
            
            if (response.ok) {
              result.projectsCompleted++;
              result.details.push({
                projectId: project.id,
                action: 'stitch_triggered',
                result: `All ${completedClips.length} clips ready`,
              });
            }
          } catch (error) {
            console.error(`[Watchdog] Stitch trigger error:`, error);
          }
          continue;
        }
        
        // Incomplete -> resume production via DIRECT CHAINING (not heavyweight resume-pipeline)
        // This calls continue-production which dispatches the next clip with skipPolling=true
        if (completedClips.length > 0 && completedClips.length < expectedClipCount) {
          const lastCompletedIndex = Math.max(...completedClips.map((c: any) => c.shot_index));
          console.log(`[Watchdog] Direct-chaining: triggering clip ${lastCompletedIndex + 2}/${expectedClipCount} via continue-production`);
          
          try {
            // Get last completed clip's data for continuity
            const lastClip = completedClips.find((c: any) => c.shot_index === lastCompletedIndex);
            
            const response = await fetch(`${supabaseUrl}/functions/v1/continue-production`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                projectId: project.id,
                userId: project.user_id,
                completedClipIndex: lastCompletedIndex,
                completedClipResult: lastClip ? {
                  videoUrl: lastClip.video_url,
                  lastFrameUrl: lastClip.last_frame_url,
                } : undefined,
                totalClips: expectedClipCount,
              }),
            });
            
            if (response.ok) {
              result.productionResumed++;
              result.details.push({
                projectId: project.id,
                action: 'direct_chain_resumed',
                result: `Clip ${lastCompletedIndex + 2}/${expectedClipCount} via continue-production`,
              });
            } else {
              // Fallback to resume-pipeline if continue-production fails
              console.warn(`[Watchdog] Direct chain failed (${response.status}), falling back to resume-pipeline`);
              await fetch(`${supabaseUrl}/functions/v1/resume-pipeline`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  projectId: project.id,
                  userId: project.user_id,
                  resumeFrom: 'production',
                }),
              });
              result.productionResumed++;
            }
          } catch (error) {
            console.error(`[Watchdog] Direct chain error:`, error);
          }
          continue;
        }
      }

      // ==================== MAX AGE EXCEEDED ====================
      if (projectAge > MAX_AGE_MS) {
        console.log(`[Watchdog] Project ${project.id} exceeded max age`);
        
        const { data: clips } = await supabase
          .from('video_clips')
          .select('id, video_url')
          .eq('project_id', project.id)
          .eq('status', 'completed');
        
        if (clips && clips.length > 0) {
          await createManifestFallback(supabaseUrl, supabaseKey, project.id);
          result.manifestFallbacks++;
          result.details.push({
            projectId: project.id,
            action: 'max_age_manifest',
            result: `Manifest for ${clips.length} clips`,
          });
        } else {
          const failError = 'Pipeline exceeded maximum processing time with no clips generated';
          await supabase
            .from('movie_projects')
            .update({
              status: 'failed',
              last_error: failError,
              pending_video_tasks: {
                ...tasks,
                stage: 'error',
                error: failError,
                failedAt: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);
          
          // AUTO-REFUND: Refund all credits when zero clips were generated
          try {
            const { data: existingRefund } = await supabase
              .from('credit_transactions')
              .select('id')
              .eq('project_id', project.id)
              .eq('transaction_type', 'refund')
              .limit(1);
            
            if (!existingRefund || existingRefund.length === 0) {
              // Find the original usage charge to determine refund amount
              const { data: usageCharge } = await supabase
                .from('credit_transactions')
                .select('amount')
                .eq('project_id', project.id)
                .eq('transaction_type', 'usage')
                .limit(1);
              
              // Also check charges without project_id (upfront deduction before project creation)
              const chargeAmount = usageCharge?.[0]?.amount 
                ? Math.abs(usageCharge[0].amount) 
                : ((tasks as Record<string, unknown>).clipCount as number || 5) * 10;
              
              if (chargeAmount > 0) {
                await supabase.rpc('increment_credits', {
                  user_id_param: project.user_id,
                  amount_param: chargeAmount,
                });
                
                await supabase.from('credit_transactions').insert({
                  user_id: project.user_id,
                  amount: chargeAmount,
                  transaction_type: 'refund',
                  description: `Auto-refund: Pipeline timeout with 0 clips generated`,
                  project_id: project.id,
                });
                
                console.log(`[Watchdog] 💰 Auto-refunded ${chargeAmount} credits for failed project ${project.id}`);
              }
            }
          } catch (refundError) {
            console.error(`[Watchdog] Auto-refund failed for ${project.id}:`, refundError);
          }
          
          result.projectsMarkedFailed++;
          result.details.push({
            projectId: project.id,
            action: 'marked_failed',
            result: 'No clips generated within 60 minutes, credits refunded',
          });
        }
      }
    }

    // ==================== PHASE 4: FALSE FAILURE RECOVERY ====================
    // Detects 'failed' projects that still have clips in 'generating' state.
    // This happens when continue-production gives up on mutex conflicts but the
    // project is actually still in progress. We clear the lock and resume.
    console.log(`[Watchdog] 🔍 Checking for false failure projects...`);
    
    const { data: falseFailed } = await supabase
      .from('movie_projects')
      .select('id, title, status, user_id, pending_video_tasks, generation_lock, generated_script')
      .eq('status', 'failed')
      .gte('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // within last 30 min
      .limit(20);
    
    for (const project of (falseFailed || [])) {
      // Check if any clips are still stuck in 'generating'
      const { data: generatingClips } = await supabase
        .from('video_clips')
        .select('id, shot_index, status, updated_at')
        .eq('project_id', project.id)
        .eq('status', 'generating');
      
      if (!generatingClips || generatingClips.length === 0) continue;
      
      const tasks = (project.pending_video_tasks || {}) as Record<string, any>;
      
      // Find last completed clip to resume from
      const { data: completedClips } = await supabase
        .from('video_clips')
        .select('shot_index, last_frame_url, video_url')
        .eq('project_id', project.id)
        .eq('status', 'completed')
        .order('shot_index', { ascending: false })
        .limit(1);
      
      const lastCompletedIndex = completedClips?.[0]?.shot_index ?? -1;
      const expectedClipCount = tasks.clipCount || 2;
      
      console.log(`[Watchdog] ⚠️ FALSE FAILURE: ${project.id} has ${generatingClips.length} stuck-generating clip(s), last completed: ${lastCompletedIndex}`);
      
      // Step 1: Release the mutex lock
      await supabase
        .from('movie_projects')
        .update({ generation_lock: null })
        .eq('id', project.id);
      
      // Step 2: Reset stuck clips back to 'pending'
      const stuckClipIndices = generatingClips.map(c => c.shot_index);
      for (const clipIndex of stuckClipIndices) {
        await supabase
          .from('video_clips')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('project_id', project.id)
          .eq('shot_index', clipIndex);
      }
      
      // Step 3: Restore project to 'generating' state and resume
      await supabase
        .from('movie_projects')
        .update({
          status: 'generating',
          pipeline_stage: 'clips_generating',
          last_error: null,
          pending_video_tasks: {
            ...tasks,
            stage: 'production',
            watchdogFalseFailureRecovery: true,
            recoveredAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);
      
      // Step 4: Resume continue-production to generate the missing clips
      try {
        const resumeResponse = await fetch(`${supabaseUrl}/functions/v1/continue-production`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            projectId: project.id,
            userId: project.user_id,
            completedClipIndex: lastCompletedIndex,
            totalClips: expectedClipCount,
            watchdogRecovery: true,
          }),
        });
        
        if (resumeResponse.ok) {
          result.productionResumed++;
          result.details.push({
            projectId: project.id,
            action: 'false_failure_recovery',
            result: `Resumed from clip ${lastCompletedIndex + 2}/${expectedClipCount}`,
          });
          console.log(`[Watchdog] ✅ FALSE FAILURE RECOVERED: ${project.id} - resuming clip ${lastCompletedIndex + 2}`);
        } else {
          const errText = await resumeResponse.text();
          console.error(`[Watchdog] ❌ Resume failed for ${project.id}: ${errText}`);
        }
      } catch (resumeErr) {
        console.error(`[Watchdog] Resume error for ${project.id}:`, resumeErr);
      }
    }

    console.log(`[Watchdog] Complete: ${result.productionResumed} resumed, ${result.stitchingRetried} stitch retries, ${result.retryScheduledProcessed} scheduled retries, ${result.manifestFallbacks} fallbacks`);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Watchdog] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Watchdog failed",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Create manifest fallback when stitching fails
 */
async function createManifestFallback(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string
) {
  console.log(`[Watchdog] Creating manifest for ${projectId}`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: project } = await supabase
    .from('movie_projects')
    .select('title, voice_audio_url, music_url')
    .eq('id', projectId)
    .single();
  
  const { data: clips } = await supabase
    .from('video_clips')
    .select('id, video_url, duration_seconds, shot_index')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('shot_index');
  
  if (!clips || clips.length === 0) {
    console.error(`[Watchdog] No clips for manifest: ${projectId}`);
    return;
  }
  
  const totalDuration = clips.reduce((sum: number, c: { duration_seconds: number }) => sum + (c.duration_seconds || 10), 0);
  
  const manifest = {
    version: "1.0",
    projectId,
    mode: "client_side_concat",
    createdAt: new Date().toISOString(),
    source: "watchdog_fallback",
    clips: clips.map((clip: { id: string; video_url: string; duration_seconds: number }, index: number) => ({
      index,
      shotId: clip.id,
      videoUrl: clip.video_url,
      duration: clip.duration_seconds || 10,
      startTime: clips.slice(0, index).reduce((sum: number, c: { duration_seconds: number }) => sum + (c.duration_seconds || 10), 0),
    })),
    totalDuration,
    voiceUrl: (project as { voice_audio_url: string | null } | null)?.voice_audio_url || null,
    musicUrl: (project as { music_url: string | null } | null)?.music_url || null,
  };

  const fileName = `manifest_${projectId}_watchdog_${Date.now()}.json`;
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

  await supabase.storage
    .from('temp-frames')
    .upload(fileName, manifestBytes, { contentType: 'application/json', upsert: true });

  const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;

  await supabase
    .from('movie_projects')
    .update({
      status: 'completed',
      video_url: manifestUrl,
      pending_video_tasks: {
        stage: 'complete',
        progress: 100,
        mode: 'manifest_playback',
        manifestUrl,
        clipCount: clips.length,
        totalDuration,
        source: 'watchdog_fallback',
        completedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  console.log(`[Watchdog] ✅ Manifest: ${manifestUrl}`);
}
