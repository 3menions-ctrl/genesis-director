import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkMultipleContent } from "../_shared/content-safety.ts";
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
} from "../_shared/world-class-cinematography.ts";
import {
  resilientFetch,
  validateImageUrl,
  callEdgeFunction,
  createReplicatePrediction,
  sleep,
  calculateBackoff,
  RESILIENCE_CONFIG,
} from "../_shared/network-resilience.ts";
import {
  generateAvatarScreenplay,
  type ScreenplaySegment,
  type AvatarCharacter,
} from "../_shared/avatar-screenplay-generator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GENERATE-AVATAR-DIRECT - World-Class Avatar Pipeline v3.5
 * 
 * HARDENED with:
 * - Pre-flight image URL validation before Kling calls
 * - Exponential backoff with jitter for all network operations
 * - Connection reset recovery
 * - Rate limit detection and smart waiting
 * 
 * ASYNC JOB PATTERN - Permanent timeout fix:
 * 1. Starts Kling prediction and returns IMMEDIATELY with job ID
 * 2. Saves prediction IDs to database for watchdog polling
 * 3. Watchdog handles completion polling (no Edge Function timeout)
 * 4. Ensures verbatim TTS, scene compositing, and natural acting
 */

// Voice mapping - complete voice library matching generate-voice function
// Maps avatar voice_id to the actual voice used for TTS generation
const VOICE_MAP: Record<string, string> = {
  // Legacy ElevenLabs IDs (for backwards compatibility)
  'onwK4e9ZLuTAKqWW03F9': 'onyx',
  'JBFqnCBsd6RMkjVDRZzb': 'echo',
  'EXAVITQu4vr4xnSDxMaL': 'nova',
  'pFZP5JQG7iQjIQuC4Bku': 'shimmer',
  'cjVigY5qzO86Huf0OWal': 'alloy',
  
  // Male voices - Deep & Authoritative
  'onyx': 'onyx',
  'george': 'george',
  'michael': 'michael',
  
  // Male voices - Warm & Friendly
  'echo': 'echo',
  'adam': 'adam',
  'fable': 'fable',
  
  // Male voices - Youthful & Energetic
  'marcus': 'marcus',
  'tyler': 'tyler',
  'jake': 'jake',
  
  // Male voices - Professional
  'david': 'david',
  'james': 'james',
  
  // Female voices - Confident & Strong
  'nova': 'nova',
  'aria': 'aria',
  'victoria': 'victoria',
  
  // Female voices - Warm & Friendly
  'bella': 'bella',
  'sarah': 'sarah',
  'alloy': 'alloy',
  'emma': 'emma',
  
  // Female voices - Elegant & Sophisticated
  'shimmer': 'shimmer',
  'lily': 'lily',
  'charlotte': 'charlotte',
  
  // Female voices - Youthful & Energetic
  'jessica': 'jessica',
  'zoey': 'zoey',
  'mia': 'mia',
  
  // Female voices - Professional
  'rachel': 'rachel',
  'claire': 'claire',
  
  // Special voices - Narration
  'narrator': 'narrator',
  'storyteller': 'storyteller',
  'documentary': 'documentary',
  
  // Default fallback
  'default': 'bella',
};

interface CinematicModeConfig {
  enabled: boolean;
  movementType: 'static' | 'walking' | 'driving' | 'action' | 'random';
  cameraAngle: 'static' | 'tracking' | 'dynamic' | 'random';
}

interface AvatarDirectRequest {
  script: string;
  avatarImageUrl: string;
  voiceId?: string;
  sceneDescription?: string;
  projectId?: string;
  userId?: string;
  aspectRatio?: string;
  clipCount?: number;
  clipDuration?: number;
  cinematicMode?: CinematicModeConfig;
  avatarType?: 'realistic' | 'animated';
  enableDualAvatar?: boolean;
  avatarTemplateId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

  if (!REPLICATE_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "REPLICATE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const request: AvatarDirectRequest = await req.json();
    const {
      script,
      avatarImageUrl,
      voiceId = 'bella',
      sceneDescription,
      projectId,
      userId,
      aspectRatio = '16:9',
      clipCount = 1,
      clipDuration = 10,
      cinematicMode,
      avatarType = 'realistic',
      enableDualAvatar = false,
      avatarTemplateId,
    } = request;

    if (!script || !avatarImageUrl) {
      throw new Error("Both 'script' and 'avatarImageUrl' are required");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTENT SAFETY CHECK - BLOCK ALL NSFW/EXPLICIT/ILLEGAL CONTENT
    // ═══════════════════════════════════════════════════════════════════════════
    const safetyCheck = checkMultipleContent([script, sceneDescription]);
    if (!safetyCheck.isSafe) {
      console.error(`[AvatarDirect] ⛔ CONTENT BLOCKED - Category: ${safetyCheck.category}, Terms: ${safetyCheck.matchedTerms.slice(0, 3).join(', ')}`);
      if (projectId) {
        await supabase.from('movie_projects').update({
          status: 'failed',
          last_error: safetyCheck.message,
        }).eq('id', projectId);
      }
      return new Response(
        JSON.stringify({ success: false, error: safetyCheck.message, blocked: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[AvatarDirect] ✅ Content safety check passed");

    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL: Pre-flight image URL validation
    // This prevents Kling API failures due to expired/invalid image URLs
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] Validating avatar image URL...");
    const imageValidation = await validateImageUrl(avatarImageUrl);
    
    if (!imageValidation.valid) {
      console.error(`[AvatarDirect] ❌ Avatar image URL validation FAILED: ${imageValidation.error}`);
      console.error(`[AvatarDirect] URL: ${avatarImageUrl}`);
      
      // Update project with clear error message
      if (projectId) {
        await supabase.from('movie_projects').update({
          status: 'failed',
          last_error: `Avatar image is not accessible: ${imageValidation.error}. Please try again with a different avatar.`,
        }).eq('id', projectId);
      }
      
      throw new Error(`Avatar image URL is not accessible: ${imageValidation.error}. The image may have expired or been deleted.`);
    }
    console.log("[AvatarDirect] ✅ Avatar image URL is valid and accessible");

    // Clip count driven by user request (no audio-driven calculation)
    const requestedClipCount = Math.max(1, Math.min(clipCount, 20));

    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");
    console.log("[AvatarDirect] Starting ASYNC AVATAR pipeline v4.5 (Dual Avatar + Continuity)");
    console.log(`[AvatarDirect] Script (${script.length} chars): "${script.substring(0, 80)}..."`);
    console.log(`[AvatarDirect] Scene: "${sceneDescription || 'Professional studio setting'}"`);
    console.log(`[AvatarDirect] Voice: ${voiceId}, Requested clips: ${requestedClipCount}`);
    console.log(`[AvatarDirect] Dual Avatar: ${enableDualAvatar ? 'ENABLED' : 'disabled'}`);
    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════")

    // ═══════════════════════════════════════════════════════════════════════════
    // DUAL AVATAR: AI auto-pick a secondary character for dialogue scenes
    // ═══════════════════════════════════════════════════════════════════════════
    let secondaryAvatar: { id: string; name: string; imageUrl: string; voiceId: string; avatarType: string } | null = null;
    
    if (enableDualAvatar && avatarTemplateId) {
      console.log("[AvatarDirect] 🎭 DUAL AVATAR: Finding secondary character...");
      
      try {
        // Query avatar_templates for a matching secondary (same type, different avatar)
        // First get primary avatar's details for contrast selection
        const { data: primaryTemplate } = await supabase
          .from('avatar_templates')
          .select('gender, voice_id, personality, style')
          .eq('id', avatarTemplateId)
          .single();
        
        const { data: candidates } = await supabase
          .from('avatar_templates')
          .select('id, name, face_image_url, front_image_url, voice_id, avatar_type, gender, personality, style')
          .eq('is_active', true)
          .eq('avatar_type', avatarType)
          .neq('id', avatarTemplateId)
          .limit(20);
        
        if (candidates && candidates.length > 0) {
          // SMART SELECTION: Prefer gender contrast and different voice for visual/audible distinction
          let picked = candidates[0];
          const primaryGender = primaryTemplate?.gender || 'unknown';
          const primaryVoice = primaryTemplate?.voice_id || voiceId;
          
          // Score each candidate: higher = better contrast
          const scored = candidates.map(c => {
            let score = 0;
            // Gender contrast is the strongest signal for visual distinction
            if (c.gender && c.gender !== primaryGender && primaryGender !== 'unknown') score += 3;
            // Different voice ensures audible distinction
            if (c.voice_id !== primaryVoice) score += 2;
            // Different personality/style adds creative contrast
            if (c.personality && c.personality !== primaryTemplate?.personality) score += 1;
            if (c.style && c.style !== primaryTemplate?.style) score += 1;
            return { candidate: c, score };
          });
          
          // Sort by score descending, pick best (with randomness among ties)
          scored.sort((a, b) => b.score - a.score);
          const topScore = scored[0].score;
          const topCandidates = scored.filter(s => s.score === topScore);
          picked = topCandidates[Math.floor(Math.random() * topCandidates.length)].candidate;
          
          console.log(`[AvatarDirect] 🎭 Smart selection: ${picked.name} (gender=${picked.gender}, contrast score=${topScore})`);
          // CRITICAL: Prefer front_image_url (full-body) to prevent headless avatar rendering
          const secondaryImageUrl = picked.front_image_url || picked.face_image_url;
          const isFullBody = !!picked.front_image_url;
          if (!isFullBody) {
            console.warn(`[AvatarDirect] ⚠️ Secondary avatar "${picked.name}" has NO full-body image (front_image_url). Using face_image_url — may produce head-only render.`);
          }
          
          secondaryAvatar = {
            id: picked.id,
            name: picked.name,
            imageUrl: secondaryImageUrl,
            voiceId: picked.voice_id,
            avatarType: picked.avatar_type || avatarType,
            isFullBody,
          };
          console.log(`[AvatarDirect] ✅ Secondary avatar picked: ${secondaryAvatar.name} (${secondaryAvatar.id})`);
        } else {
          console.warn("[AvatarDirect] ⚠️ No suitable secondary avatar found, proceeding with single avatar");
        }
      } catch (pickError) {
        console.error("[AvatarDirect] Secondary avatar pick failed:", pickError);
      }
    }

    if (projectId) {
      await supabase.from('movie_projects').update({
        status: 'generating',
        pipeline_state: {
          stage: 'init',
          progress: 5,
          message: secondaryAvatar 
            ? `Preparing dual avatar scene with ${secondaryAvatar.name}...`
            : 'Preparing video generation...',
          totalClips: requestedClipCount,
        },
      }).eq('id', projectId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EMBEDDED AUDIO STRATEGY: Kling generates videos with native audio.
    // No separate TTS generation needed - clips use their own embedded audio.
    // Clip count is driven by user request, not audio duration.
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] Using EMBEDDED AUDIO strategy - Kling native audio, no TTS overlay");
    
    const finalClipCount = Math.max(requestedClipCount, 1);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // AI SCREENPLAY GENERATION: Transform user's prompt into creative dialogue
    // with movement, humor, and natural character interactions
    // ═══════════════════════════════════════════════════════════════════════════
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    const primaryChar: AvatarCharacter = {
      name: 'Character 1',
      role: 'primary',
      avatarType: avatarType as 'realistic' | 'animated',
      voiceId,
    };
    
    // Try to get avatar name from template
    if (avatarTemplateId) {
      const { data: templateData } = await supabase
        .from('avatar_templates')
        .select('name')
        .eq('id', avatarTemplateId)
        .single();
      if (templateData?.name) primaryChar.name = templateData.name;
    }
    
    const secondaryChar: AvatarCharacter | null = secondaryAvatar ? {
      name: secondaryAvatar.name,
      role: 'secondary',
      avatarType: secondaryAvatar.avatarType as 'realistic' | 'animated',
      voiceId: secondaryAvatar.voiceId,
    } : null;

    let screenplaySegments: ScreenplaySegment[];
    let screenplayTitle = 'Untitled';
    
    if (OPENAI_API_KEY && finalClipCount > 1) {
      console.log("[AvatarDirect] 🎬 Generating AI screenplay from user prompt...");
      
      if (projectId) {
        await supabase.from('movie_projects').update({
          pipeline_state: {
            stage: 'screenplay',
            progress: 12,
            message: 'Writing creative screenplay...',
            totalClips: finalClipCount,
          },
        }).eq('id', projectId);
      }
      
      const screenplay = await generateAvatarScreenplay({
        userPrompt: script,
        clipCount: finalClipCount,
        clipDuration: clipDuration || 10,
        primaryCharacter: primaryChar,
        secondaryCharacter: secondaryChar,
        sceneDescription,
        openaiApiKey: OPENAI_API_KEY,
      });
      
      screenplaySegments = screenplay.segments;
      screenplayTitle = screenplay.title;
      console.log(`[AvatarDirect] ✅ Screenplay "${screenplayTitle}" generated: ${screenplaySegments.length} segments, movement=${screenplay.hasMovement}`);
    } else {
      // Fallback: simple split for single clip or no OpenAI key
      const scriptSegments = finalClipCount > 1 
        ? splitScriptIntoSegments(script, finalClipCount)
        : [script];
      
      screenplaySegments = scriptSegments.map((text, i) => ({
        clipIndex: i,
        avatarRole: 'primary' as const,
        dialogue: text,
        action: 'speaking expressively',
        movement: 'gesture',
        sceneNote: '',
        emotion: 'confident',
        cameraHint: 'medium',
      }));
    }
    
    console.log(`[AvatarDirect] 🎬 CLIP CALCULATION:`);
    console.log(`[AvatarDirect]    Requested clips: ${requestedClipCount}`);
    console.log(`[AvatarDirect]    FINAL clip count: ${finalClipCount}`);
    console.log(`[AvatarDirect]    Screenplay segments: ${screenplaySegments.length}`);
    if (secondaryAvatar) {
      console.log(`[AvatarDirect]    Avatar roles: ${screenplaySegments.map(s => s.avatarRole).join(', ')}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Optional Scene Compositing (fast - ~5-10s)
    // ═══════════════════════════════════════════════════════════════════════════
    let sharedAnimationStartImage = avatarImageUrl;
    let sceneCompositingApplied = false;
    
    if (sceneDescription?.trim()) {
      console.log("[AvatarDirect] Step 2: Pre-generating shared scene image...");
      console.log(`[AvatarDirect] Scene description: "${sceneDescription}"`);
      
      if (projectId) {
        await supabase.from('movie_projects').update({
          pipeline_state: {
            stage: 'scene_compositing',
            progress: 15,
            message: 'Creating scene for your avatar...',
            totalClips: finalClipCount,
          },
        }).eq('id', projectId);
      }
      
      try {
        const sceneResponse = await fetch(`${supabaseUrl}/functions/v1/generate-avatar-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            avatarImageUrl,
            sceneDescription,
            aspectRatio,
            placement: 'center',
          }),
        });

        const sceneResponseText = await sceneResponse.text();
        console.log(`[AvatarDirect] Scene response status: ${sceneResponse.status}`);
        
        if (sceneResponse.ok) {
          try {
            const sceneResult = JSON.parse(sceneResponseText);
            if (sceneResult.success && sceneResult.sceneImageUrl) {
              sharedAnimationStartImage = sceneResult.sceneImageUrl;
              sceneCompositingApplied = true;
              console.log(`[AvatarDirect] ✅ Scene compositing SUCCEEDED via ${sceneResult.method}`);
              console.log(`[AvatarDirect] Scene image URL: ${sceneResult.sceneImageUrl.substring(0, 80)}...`);
            } else {
              console.error(`[AvatarDirect] ❌ Scene compositing returned success=false: ${sceneResult.error}`);
            }
          } catch (parseError) {
            console.error(`[AvatarDirect] ❌ Scene response parse error: ${parseError}`);
            console.error(`[AvatarDirect] Raw response: ${sceneResponseText.substring(0, 200)}`);
          }
        } else {
          console.error(`[AvatarDirect] ❌ Scene compositing HTTP error ${sceneResponse.status}: ${sceneResponseText.substring(0, 200)}`);
        }
      } catch (sceneError) {
        console.error("[AvatarDirect] ❌ Scene-First exception:", sceneError);
      }
      
      // Log final decision
      if (!sceneCompositingApplied) {
        console.warn(`[AvatarDirect] ⚠️ SCENE COMPOSITING FAILED - Using original avatar image as fallback`);
      }
    } else {
      console.log("[AvatarDirect] No scene description provided - using avatar image directly");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: SEQUENTIAL FRAME-CHAINED CLIP GENERATION (ASYNC WATCHDOG PATTERN)
    // 
    // ARCHITECTURE: Start only clip 1, watchdog chains subsequent clips
    // - Clip 1 starts immediately with scene image
    // - When clip 1 completes, watchdog extracts last frame → starts clip 2
    // - When clip 2 completes, watchdog extracts last frame → starts clip 3
    // - This ensures visual continuity without Edge Function timeout
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] Step 3: Starting FRAME-CHAINED generation (watchdog-driven)...");
    console.log(`[AvatarDirect] Mode: ${finalClipCount > 1 ? 'SEQUENTIAL CHAINED (clip 1 now, watchdog chains rest)' : 'SINGLE CLIP'}`);
    
    if (projectId) {
      await supabase.from('movie_projects').update({
        pipeline_state: {
          stage: 'clip_generation',
          progress: 20,
          message: `Starting video generation for ${finalClipCount} clip(s)...`,
          totalClips: finalClipCount,
          currentClip: 1,
        },
      }).eq('id', projectId);
    }

    // EMBEDDED AUDIO: No TTS pre-generation needed - Kling produces native audio
    // Use screenplay segments which include dialogue, action, movement, and avatar role
    const allSegmentData = screenplaySegments.map((seg) => ({
      segmentText: seg.dialogue,
      avatarRole: seg.avatarRole,
      action: seg.action,
      movement: seg.movement,
      emotion: seg.emotion,
      cameraHint: seg.cameraHint,
      sceneNote: seg.sceneNote,
      transitionNote: (seg as any).transitionNote || '',
      physicalDetail: (seg as any).physicalDetail || '',
    }));

    // START CLIP 1 ONLY - Watchdog will chain the rest
    const clip1Data = allSegmentData[0];
    const videoDuration = (clipDuration && clipDuration >= 10) ? 10 : (clipDuration || 10);
    const actingPrompt = buildActingPrompt(clip1Data.segmentText, sceneDescription, cinematicMode, 0, finalClipCount, avatarType, clip1Data.action, clip1Data.movement, clip1Data.emotion, clip1Data.cameraHint);
    const avatarTypeLock = avatarType === 'animated' 
      ? '[AVATAR STYLE LOCK: This character is a stylized CGI/animated character. Maintain cartoon/animated art style throughout. DO NOT render as photorealistic human.]'
      : '[AVATAR STYLE LOCK: This character is a photorealistic human. Maintain realistic appearance throughout. DO NOT render as cartoon/animated/CGI style.]';
    
    // IDENTITY LOCK: Injected into EVERY clip prompt to prevent face drift
    const identityLockPrefix = `[STATIC START — CRITICAL: The character is ALREADY positioned in their environment from the very first frame. They are already standing, sitting, or leaning in place. Do NOT show them walking in, entering, or arriving.] [FACE LOCK — CRITICAL: The person in this video must look EXACTLY like the person in the start frame reference image. Preserve their exact facial features, hair style, hair color, skin tone, eye color, body build, and outfit throughout ALL frames. NO morphing, NO face changes, NO age shifts. This person must be 100% recognizable.]`;
    
    console.log(`[AvatarDirect] ═══ Starting Clip 1/${finalClipCount} ═══`);
    console.log(`[AvatarDirect] Start image: ${sharedAnimationStartImage.substring(0, 60)}...`);
    
    const klingResponse = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v2.6/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          mode: "pro",
          prompt: `${identityLockPrefix} ${avatarTypeLock} ${actingPrompt}`,
          duration: videoDuration,
          start_image: sharedAnimationStartImage,
          aspect_ratio: aspectRatio,
          negative_prompt: avatarType === 'animated'
            ? "photorealistic, real human, live action, photograph, real skin texture, static, frozen, robotic, stiff, unnatural, glitchy, distorted, closed mouth, looking away, boring, monotone, lifeless, dark, somber, moody, gloomy, sad, depressed, dim lighting, shadows, desaturated, muted colors, grey, overcast, face morphing, identity change, different person, age change, walking into frame, entering scene, arriving, approaching"
            : "cartoon, animated, CGI, 3D render, anime, illustration, drawing, painting, sketch, static, frozen, robotic, stiff, unnatural, glitchy, distorted, closed mouth, looking away, boring, monotone, lifeless, dark, somber, moody, gloomy, sad, depressed, dim lighting, shadows, desaturated, muted colors, grey, overcast, face morphing, identity change, different person, age change, walking into frame, entering scene, arriving, approaching",
        },
      }),
    });

    if (!klingResponse.ok) {
      const errorText = await klingResponse.text();
      console.error(`[AvatarDirect] ❌ Kling API error ${klingResponse.status}: ${errorText}`);
      
      // Handle rate limits specifically - 429 from Replicate
      if (klingResponse.status === 429) {
        // Wait and retry once for rate limits
        console.log(`[AvatarDirect] Rate limited by Kling API, waiting 15s and retrying...`);
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        const retryResponse = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v2.6/predictions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${REPLICATE_API_KEY}`,
            "Content-Type": "application/json",
          },
           body: JSON.stringify({
            input: {
              mode: "pro",
              prompt: `${identityLockPrefix} ${avatarTypeLock} ${actingPrompt}`,
              duration: videoDuration,
              start_image: sharedAnimationStartImage,
              aspect_ratio: aspectRatio,
              negative_prompt: avatarType === 'animated'
                ? "photorealistic, real human, live action, photograph, real skin texture, static, frozen, robotic, stiff, unnatural, glitchy, distorted, closed mouth, looking away, boring, monotone, lifeless, dark, somber, moody, gloomy, sad, depressed, dim lighting, shadows, desaturated, muted colors, grey, overcast, face morphing, identity change, different person, age change"
                : "cartoon, animated, CGI, 3D render, anime, illustration, drawing, painting, sketch, static, frozen, robotic, stiff, unnatural, glitchy, distorted, closed mouth, looking away, boring, monotone, lifeless, dark, somber, moody, gloomy, sad, depressed, dim lighting, shadows, desaturated, muted colors, grey, overcast, face morphing, identity change, different person, age change",
            },
          }),
        });
        
        if (!retryResponse.ok) {
          const retryErrorText = await retryResponse.text();
          throw new Error(`Kling animation failed after retry (${retryResponse.status}): ${retryErrorText.substring(0, 200)}`);
        }
        
        // Continue with retry response
        const klingPrediction = await retryResponse.json();
        console.log(`[AvatarDirect] Clip 1: Kling STARTED after retry: ${klingPrediction.id}`);
        
        // Build predictions array - clip 1 is processing, rest are pending
        const pendingPredictions: Array<{
          clipIndex: number;
          predictionId: string | null;
          segmentText: string;
          startImageUrl: string | null;
          status: string;
          videoUrl: string | null;
        }> = [];

        // Clip 1 - currently processing
        pendingPredictions.push({
          clipIndex: 0,
          predictionId: klingPrediction.id,
          segmentText: clip1Data.segmentText,
          startImageUrl: sharedAnimationStartImage,
          status: 'processing',
          videoUrl: null,
        });

        // Clips 2+ - pending, will be started by watchdog after frame extraction
        for (let i = 1; i < allSegmentData.length; i++) {
          pendingPredictions.push({
            clipIndex: i,
            predictionId: null,
            segmentText: allSegmentData[i].segmentText,
            startImageUrl: null,
            status: 'pending',
            videoUrl: null,
            avatarRole: allSegmentData[i].avatarRole,
            action: allSegmentData[i].action,
            movement: allSegmentData[i].movement,
            emotion: allSegmentData[i].emotion,
            cameraHint: allSegmentData[i].cameraHint,
            physicalDetail: allSegmentData[i].physicalDetail,
            transitionNote: allSegmentData[i].transitionNote,
            sceneNote: allSegmentData[i].sceneNote,
          });
        }

        // Store in pending_video_tasks for watchdog to monitor
        const taskData = {
          project_id: projectId,
          user_id: userId,
          task_type: 'avatar_multi_clip',
          status: 'processing',
          predictions: pendingPredictions,
          shared_scene_image: sharedAnimationStartImage,
          scene_description: sceneDescription,
          aspect_ratio: aspectRatio,
          cinematic_mode: cinematicMode,
          clip_duration: videoDuration,
          total_clips: finalClipCount,
          current_clip: 1,
          created_at: new Date().toISOString(),
          embeddedAudioOnly: true,
        };

        await supabase.from('pending_video_tasks').upsert({
          id: projectId,
          ...taskData,
        });

        // Update project status - CRITICAL: Include type: 'avatar_async' for multi-clip detection
        if (projectId) {
          await supabase.from('movie_projects').update({
            status: 'generating',
            // CRITICAL: Save user's script to synopsis for reference
            synopsis: script,
            pipeline_state: {
              stage: 'async_video_generation',
              progress: 25,
              message: `Video clip 1/${finalClipCount} generating (after retry)...`,
              totalClips: finalClipCount,
              currentClip: 1,
              predictionId: klingPrediction.id,
              asyncJobData: {
                predictions: pendingPredictions,
                sceneImageUrl: sharedAnimationStartImage,
                clipDuration: videoDuration,
                aspectRatio,
                embeddedAudioOnly: true,
              },
            },
            pending_video_tasks: {
              type: 'avatar_async',
              embeddedAudioOnly: true,
          predictions: pendingPredictions.map(p => ({
            predictionId: p.predictionId,
            clipIndex: p.clipIndex,
            status: p.status,
            segmentText: p.segmentText,
            startImageUrl: p.startImageUrl,
            avatarRole: (p as any).avatarRole || 'primary',
            action: (p as any).action || '',
            movement: (p as any).movement || '',
            emotion: (p as any).emotion || '',
            cameraHint: (p as any).cameraHint || '',
            physicalDetail: (p as any).physicalDetail || '',
            transitionNote: (p as any).transitionNote || '',
            sceneNote: (p as any).sceneNote || '',
          })),
          sceneImageUrl: sharedAnimationStartImage,
          sceneCompositingApplied: sceneCompositingApplied,
          sceneDescription: sceneDescription || null,
          clipDuration: videoDuration,
          aspectRatio: aspectRatio,
          originalScript: script,
          startedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          }).eq('id', projectId);
        }

        console.log(`[AvatarDirect] ✅ Pipeline started after rate limit retry`);
        return new Response(
          JSON.stringify({
            success: true,
            projectId,
            predictionId: klingPrediction.id,
            message: "Avatar generation started after retry (watchdog will complete)",
            totalClips: finalClipCount,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Kling animation failed to start (${klingResponse.status}): ${errorText.substring(0, 200)}`);
    }

    const klingPrediction = await klingResponse.json();
    console.log(`[AvatarDirect] Clip 1: Kling STARTED: ${klingPrediction.id}`);

    // Build predictions array - clip 1 is processing, rest are pending
    const pendingPredictions: Array<{
      clipIndex: number;
      predictionId: string | null;
      segmentText: string;
      startImageUrl: string | null;
      status: string;
      videoUrl: string | null;
      avatarRole: 'primary' | 'secondary';
    }> = [];

    // Clip 1 - currently processing
    pendingPredictions.push({
      clipIndex: 0,
      predictionId: klingPrediction.id,
      segmentText: clip1Data.segmentText,
      startImageUrl: sharedAnimationStartImage,
      status: 'processing',
      videoUrl: null,
      avatarRole: clip1Data.avatarRole,
    });

    // Clips 2+ - pending, will be started by watchdog after frame extraction
    for (let i = 1; i < allSegmentData.length; i++) {
      pendingPredictions.push({
        clipIndex: i,
        predictionId: null,
        segmentText: allSegmentData[i].segmentText,
        startImageUrl: null,
        status: 'pending',
        videoUrl: null,
        avatarRole: allSegmentData[i].avatarRole,
        // Screenplay acting data for watchdog
        action: allSegmentData[i].action,
        movement: allSegmentData[i].movement,
        emotion: allSegmentData[i].emotion,
        cameraHint: allSegmentData[i].cameraHint,
        physicalDetail: allSegmentData[i].physicalDetail,
        transitionNote: allSegmentData[i].transitionNote,
        sceneNote: allSegmentData[i].sceneNote,
      });
    }

    console.log(`[AvatarDirect] Prepared ${pendingPredictions.length} predictions (1 processing, ${pendingPredictions.length - 1} pending)`);


    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: SAVE PENDING STATE TO DATABASE
    // CRITICAL: Persist ALL parameters so watchdog can recover correctly
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] Step 4: Saving async job state to database...");
    console.log(`[AvatarDirect] Persisting: script=${script.length}chars, scene="${sceneDescription?.substring(0, 30) || 'none'}", duration=${clipDuration}s`);

    const asyncJobData = {
      predictions: pendingPredictions,
      sceneImageUrl: sharedAnimationStartImage,
      startedAt: new Date().toISOString(),
      clipDuration,
      aspectRatio,
      embeddedAudioOnly: true,
      originalScript: script,
      originalSceneDescription: sceneDescription || null,
    };

    if (projectId) {
      const { error: updateError } = await supabase.from('movie_projects').update({
        synopsis: script,
        pipeline_state: {
          stage: 'async_video_generation',
          progress: 25,
          message: `Video generation in progress (${finalClipCount} clips)...`,
          totalClips: finalClipCount,
          asyncJobData,
        },
        pending_video_tasks: {
          type: 'avatar_async',
          embeddedAudioOnly: true,
          avatarType: avatarType,
          // DUAL AVATAR: Persist secondary avatar data for watchdog
          secondaryAvatar: secondaryAvatar || null,
          // IDENTITY ANCHOR: Original unmodified avatar reference image
          // This is the ground truth for character identity — never re-composited
          originalAvatarImageUrl: avatarImageUrl,
          predictions: pendingPredictions.map(p => ({
            predictionId: p.predictionId,
            clipIndex: p.clipIndex,
            status: p.status,
            segmentText: p.segmentText,
            startImageUrl: p.startImageUrl,
            avatarRole: (p as any).avatarRole || 'primary',
            action: (p as any).action || '',
            movement: (p as any).movement || '',
            emotion: (p as any).emotion || '',
            cameraHint: (p as any).cameraHint || '',
            physicalDetail: (p as any).physicalDetail || '',
            transitionNote: (p as any).transitionNote || '',
            sceneNote: (p as any).sceneNote || '',
          })),
          sceneImageUrl: sharedAnimationStartImage,
          sceneCompositingApplied: sceneCompositingApplied,
          sceneDescription: sceneDescription || null,
          clipDuration: clipDuration,
          aspectRatio: aspectRatio,
          originalScript: script,
          startedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
      
      if (updateError) {
        console.error("[AvatarDirect] ❌ Failed to save async state:", updateError);
      } else {
        console.log("[AvatarDirect] ✅ Async state saved successfully");
      }
    }

    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");
    console.log("[AvatarDirect] ✅ ASYNC AVATAR PIPELINE v4.0 - EMBEDDED AUDIO");
    console.log(`[AvatarDirect] Started ${pendingPredictions.length} Kling predictions`);
    console.log("[AvatarDirect] Using Kling native audio - no TTS overlay");
    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");

    return new Response(
      JSON.stringify({
        success: true,
        async: true,
        message: `Avatar generation started - ${pendingPredictions.length} clips processing (embedded audio)`,
        predictionIds: pendingPredictions.map(p => p.predictionId),
        projectId,
        totalClips: pendingPredictions.length,
        status: 'processing',
        embeddedAudioOnly: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[AvatarDirect] Pipeline error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Split script into segments for multi-clip generation
 */
function splitScriptIntoSegments(script: string, targetCount: number): string[] {
  if (targetCount <= 1) return [script];
  
  const sentences = script.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [script];
  const cleanSentences = sentences.map(s => s.trim()).filter(s => s.length > 0);
  
  if (cleanSentences.length === 0) {
    return Array(targetCount).fill(script);
  }
  
  if (cleanSentences.length >= targetCount) {
    const segments: string[] = [];
    const sentencesPerSegment = Math.ceil(cleanSentences.length / targetCount);
    
    for (let i = 0; i < targetCount; i++) {
      const start = i * sentencesPerSegment;
      const end = Math.min(start + sentencesPerSegment, cleanSentences.length);
      if (start < cleanSentences.length) {
        const segment = cleanSentences.slice(start, end).join(' ').trim();
        segments.push(segment);
      }
    }
    
    while (segments.length < targetCount) {
      segments.push(cleanSentences[cleanSentences.length - 1]);
    }
    
    return segments;
  }
  
  // Distribute sentences evenly across target count
  const segments: string[] = [];
  for (let i = 0; i < targetCount; i++) {
    const sentenceIndex = i % cleanSentences.length;
    segments.push(cleanSentences[sentenceIndex]);
  }
  
  console.log(`[AvatarDirect] Script split: ${cleanSentences.length} sentences → ${targetCount} segments`);
  return segments;
}

// CINEMATOGRAPHY ENGINE: Imported from _shared/world-class-cinematography.ts
// Contains: CAMERA_MOVEMENTS, CAMERA_ANGLES, SHOT_SIZES, LIGHTING_STYLES, 
// SUBJECT_MOTION, SCENE_JOURNEYS, progression arrays, and helper functions

/**
 * Build a WORLD-CLASS cinematic prompt using screenplay data for dynamic, natural acting.
 * Supports full range of movement, emotion, and camera work.
 */
function buildActingPrompt(
  script: string, 
  sceneDescription?: string, 
  cinematicMode?: CinematicModeConfig, 
  clipIndex: number = 0,
  totalClips: number = 1,
  avatarType: string = 'realistic',
  screenplayAction?: string,
  screenplayMovement?: string,
  screenplayEmotion?: string,
  screenplayCameraHint?: string,
  physicalDetail?: string,
): string {
  const emotionalTone = screenplayEmotion || analyzeEmotionalTone(script);
  const performanceStyle = getPerformanceStyle(typeof emotionalTone === 'string' ? emotionalTone : 'neutral');
  
  const movementInstruction = buildMovementInstruction(screenplayMovement, screenplayAction, clipIndex, physicalDetail);
  
  // Always use world-class prompts now
  return buildWorldClassPrompt(script, sceneDescription, clipIndex, totalClips, performanceStyle, avatarType, movementInstruction, screenplayCameraHint, physicalDetail);
}

/**
 * Convert screenplay movement/action into rich, natural motion instruction for Kling.
 */
function buildMovementInstruction(movement?: string, action?: string, clipIndex: number = 0, physicalDetail?: string): string {
  if (!movement && !action) return '';
  
  const movementMap: Record<string, string> = {
    'walk': 'walking naturally through the scene with confident strides, arms swinging gently',
    'gesture': 'using expressive hand gestures and animated body language, hands painting the air',
    'lean': 'leaning in with genuine interest, weight shifting forward, eyes locked on target',
    'turn': 'turning with fluid body rotation, a natural pivot that reveals new intent',
    'sit': 'sitting with lived-in comfort, hands active while talking, slight shifts in posture',
    'stand': 'standing tall with grounded confidence, subtle weight transfers between feet',
    'drive': 'seated behind the wheel, one hand casually on the steering wheel, glancing between road and camera',
    'react': 'reacting with whole-body surprise — eyebrows shooting up, torso pulling back, hands rising',
    'dance': 'moving with infectious rhythmic energy, shoulders bouncing, natural unscripted joy',
    'run': 'moving with urgent purposeful energy, body leaning into the momentum',
    'point': 'pointing with conviction, arm extending fully, whole body following the gesture',
    'laugh': 'breaking into genuine laughter, head tilting back, shoulders shaking, eyes crinkling',
    'freeze': 'freezing mid-motion in comedic disbelief, eyes wide, body completely still',
  };

  const motionPhrase = movementMap[movement || ''] || '';
  const actionPhrase = action ? `${action}` : '';
  const microAction = physicalDetail ? ` ${physicalDetail}.` : '';
  
  if (actionPhrase && motionPhrase) {
    return `The subject is ${actionPhrase}, ${motionPhrase}.${microAction}`;
  }
  return actionPhrase 
    ? `The subject is ${actionPhrase}.${microAction}` 
    : (motionPhrase ? `The subject is ${motionPhrase}.${microAction}` : '');
}

/**
 * WORLD-CLASS Hollywood-grade cinematography prompt.
 * Every clip feels like it was directed by a master filmmaker.
 */
function buildWorldClassPrompt(
  script: string,
  baseSceneDescription: string | undefined,
  clipIndex: number,
  totalClips: number,
  performanceStyle: string,
  avatarType: string = 'realistic',
  movementInstruction: string = '',
  cameraHint?: string,
  physicalDetail?: string,
): string {
  const idx = clipIndex % 10;
  
  const movementKey = MOVEMENT_PROGRESSION[idx];
  const angleKey = ANGLE_PROGRESSION[idx];
  const sizeKey = SIZE_PROGRESSION[idx];
  const lightingKey = LIGHTING_PROGRESSION[idx];
  
  // Enhanced camera map with film-school precision
  const cameraMap: Record<string, string> = {
    'tracking': 'Smooth Steadicam tracking shot gliding alongside the subject, maintaining perfect focus',
    'close-up': 'Intimate close-up isolating facial micro-expressions, shallow depth of field blurring background into bokeh',
    'wide': 'Wide establishing shot placing the subject in their full environment, giving scale and context',
    'over-shoulder': 'Over-the-shoulder perspective creating voyeuristic intimacy, foreground shoulder soft-focused',
    'medium': 'Classic medium shot from waist up, balanced composition with room to breathe',
    'panning': 'Slow deliberate pan revealing the scene around the subject, building anticipation',
    'dolly-in': 'Slow dolly push-in toward the subject, building intensity and focus on their words',
    'low-angle': 'Low-angle shot looking up at the subject, conveying authority and presence',
    'crane': 'Subtle crane movement adding vertical dimension, elevating the visual storytelling',
  };
  
  const movementPrompt = cameraHint && cameraMap[cameraHint] 
    ? cameraMap[cameraHint]
    : selectPrompt(CAMERA_MOVEMENTS[movementKey] || CAMERA_MOVEMENTS.static_locked);
  const anglePrompt = selectPrompt(CAMERA_ANGLES[angleKey] || CAMERA_ANGLES.eye_level_centered);
  const sizePrompt = selectPrompt(SHOT_SIZES[sizeKey] || SHOT_SIZES.medium);
  const lightingPrompt = selectPrompt(LIGHTING_STYLES[lightingKey] || LIGHTING_STYLES.classic_key);
  
  const progressiveScene = getProgressiveScene(baseSceneDescription, clipIndex, totalClips, true);
  const sceneContext = `Cinematic scene set in ${progressiveScene}, shot on ARRI Alexa with anamorphic lenses.`;
  const backgroundLock = clipIndex > 0 ? '[SAME ENVIRONMENT: Continue in the exact same location with consistent lighting and props.]' : '';
  
  // Rich motion direction
  const motionBlock = movementInstruction 
    ? movementInstruction
    : `The subject is speaking with natural energy, using expressive gestures, weight shifting naturally between feet.`;
  
  // Performance nuance based on clip position in narrative
  let narrativeBeat = '';
  if (totalClips >= 3) {
    if (clipIndex === 0) narrativeBeat = 'OPENING ENERGY: This is the hook — confident, attention-grabbing delivery.';
    else if (clipIndex === totalClips - 1) narrativeBeat = 'CLOSING MOMENT: This is the payoff — land the final beat with impact and conviction.';
    else narrativeBeat = 'BUILDING MOMENTUM: The story is developing — natural escalation of energy and engagement.';
  }
  
  const qualityBaseline = "Ultra-high definition 4K cinematic quality. Natural skin tones with subsurface scattering. Rich vibrant colors with cinematic color grading. Shallow depth of field with natural bokeh. Volumetric warm lighting with soft fill. Film-quality motion blur on movement.";
  
  const lifelikeDirective = "Continuous lifelike motion: breathing visible in chest/shoulders, natural eye movements tracking between focal points, involuntary micro-expressions (slight brow raises, lip movements between words), authentic weight shifts, hair/clothing responding to movement with physics-accurate motion.";
  
  console.log(`[AvatarDirect] 🎬 Clip ${clipIndex + 1}/${totalClips} | Camera: ${cameraHint || movementKey} | Emotion: ${performanceStyle.substring(0, 30)}...`);
  
  return `${backgroundLock} ${sceneContext} ${sizePrompt}. ${anglePrompt}. ${movementPrompt}. ${lightingPrompt}. ${narrativeBeat} ${motionBlock} Speaking naturally with authentic delivery: "${script.substring(0, 120)}${script.length > 120 ? '...' : ''}". ${performanceStyle} ${lifelikeDirective} ${qualityBaseline}`;
}

function analyzeEmotionalTone(script: string): string {
  const lower = script.toLowerCase();
  if (lower.includes('!') && (lower.includes('amazing') || lower.includes('incredible') || lower.includes('wow'))) return 'excited';
  if (lower.includes('important') || lower.includes('serious') || lower.includes('critical') || lower.includes('listen')) return 'dramatic';
  if (lower.includes('welcome') || lower.includes('thank') || lower.includes('love') || lower.includes('heart')) return 'tender';
  if (lower.includes('fun') || lower.includes('joke') || lower.includes('haha') || lower.includes('lol') || lower.includes('funny')) return 'amused';
  if (lower.includes('wait') || lower.includes('what') || lower.includes('seriously') || lower.includes('no way')) return 'surprised';
  if (lower.includes('okay so') || lower.includes('look') || lower.includes('here\'s the thing') || lower.includes('let me')) return 'confident';
  return 'neutral';
}

function getPerformanceStyle(tone: string): string {
  switch (tone) {
    case 'excited': return "Eyes BLAZING with enthusiasm, animated hand gestures cutting through the air, energetic head movements, megawatt smile that lights up the frame. Voice pitch rises naturally.";
    case 'dramatic': return "Intense locked-in gaze, deliberate measured gestures that demand attention, controlled breathing between phrases, commanding physical presence that owns the frame.";
    case 'warm': case 'tender': return "Genuine warm smile reaching the eyes (Duchenne smile), soft expressive gaze, open welcoming posture, gentle head tilts showing authentic care and connection.";
    case 'amused': case 'playful': return "Mischievous knowing grin, playful eyebrow raises, animated expressions shifting rapidly between amusement and mock-seriousness, infectious lighthearted energy.";
    case 'surprised': return "Eyes widening in genuine surprise, eyebrows shooting up, slight body pullback, mouth forming an 'O' before breaking into speech, hands rising instinctively.";
    case 'nervous': return "Subtle fidgeting — adjusting collar, touching face, weight shifting between feet — with darting eye movements and an uncertain half-smile that breaks into nervous laughter.";
    case 'confident': return "Rock-solid eye contact with the lens, open commanding posture, precisely timed gestures that punctuate key words, the assured energy of someone who KNOWS they're right.";
    case 'deadpan': return "Completely flat expression, minimal movement, devastating understatement delivered with surgical precision. The comedy comes from the stillness.";
    case 'mischievous': return "Sly half-smile, one eyebrow slightly raised, leaning toward camera conspiratorially, the energy of someone about to reveal a delicious secret.";
    default: return "Natural confident delivery with genuine facial expressions, professional yet personable energy, authentic micro-expressions between phrases that show real thinking.";
  }
}

function estimateDuration(text: string): number {
  const words = text.length / 5;
  const minutes = words / 150;
  return Math.round(minutes * 60 * 1000);
}
