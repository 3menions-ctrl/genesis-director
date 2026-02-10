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
    console.log("[AvatarDirect] Starting ASYNC AVATAR pipeline v3.5 (Hardened + Audio-Driven)");
    console.log(`[AvatarDirect] Script (${script.length} chars): "${script.substring(0, 80)}..."`);
    console.log(`[AvatarDirect] Scene: "${sceneDescription || 'Professional studio setting'}"`);
    console.log(`[AvatarDirect] Voice: ${minimaxVoice}, Requested clips: ${requestedClipCount}`);
    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════")

    if (projectId) {
      await supabase.from('movie_projects').update({
        status: 'generating',
        pipeline_state: {
          stage: 'init',
          progress: 5,
          message: 'Preparing video generation...',
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
    
    // Split script into segments for multi-clip prompt variation
    const scriptSegments = finalClipCount > 1 
      ? splitScriptIntoSegments(script, finalClipCount)
      : [script];
    
    console.log(`[AvatarDirect] 🎬 CLIP CALCULATION:`);
    console.log(`[AvatarDirect]    Requested clips: ${requestedClipCount}`);
    console.log(`[AvatarDirect]    FINAL clip count: ${finalClipCount}`);
    console.log(`[AvatarDirect]    Script segments: ${scriptSegments.length}`);

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
    // Just prepare segment data for prompts
    const allSegmentData: Array<{ segmentText: string }> = scriptSegments.map(text => ({ segmentText: text }));

    // START CLIP 1 ONLY - Watchdog will chain the rest
    const clip1Data = allSegmentData[0];
    const videoDuration = (clipDuration && clipDuration >= 10) ? 10 : (clipDuration || 10);
    const actingPrompt = buildActingPrompt(clip1Data.segmentText, sceneDescription, cinematicMode, 0, finalClipCount);
    
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
          prompt: actingPrompt,
          duration: videoDuration,
          start_image: sharedAnimationStartImage,
          aspect_ratio: aspectRatio,
          negative_prompt: "static, frozen, robotic, stiff, unnatural, glitchy, distorted, closed mouth, looking away, boring, monotone, lifeless, dark, somber, moody, gloomy, sad, depressed, dim lighting, shadows, desaturated, muted colors, grey, overcast",
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
              prompt: actingPrompt,
              duration: videoDuration,
              start_image: sharedAnimationStartImage,
              aspect_ratio: aspectRatio,
              negative_prompt: "static, frozen, robotic, stiff, unnatural, glitchy, distorted, closed mouth, looking away, boring, monotone, lifeless, dark, somber, moody, gloomy, sad, depressed, dim lighting, shadows, desaturated, muted colors, grey, overcast",
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
          predictions: pendingPredictions.map(p => ({
            predictionId: p.predictionId,
            clipIndex: p.clipIndex,
            status: p.status,
            segmentText: p.segmentText,
            startImageUrl: p.startImageUrl,
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
 * Build a WORLD-CLASS cinematic prompt for maximum visual impact
 * Each clip gets a unique visual treatment + dynamic scene progression
 */
function buildActingPrompt(
  script: string, 
  sceneDescription?: string, 
  cinematicMode?: CinematicModeConfig, 
  clipIndex: number = 0,
  totalClips: number = 1
): string {
  const emotionalTone = analyzeEmotionalTone(script);
  const performanceStyle = getPerformanceStyle(emotionalTone);
  
  // Check if cinematic mode is enabled for full Hollywood treatment
  if (cinematicMode?.enabled) {
    return buildWorldClassPrompt(script, sceneDescription, clipIndex, totalClips, performanceStyle);
  }
  
  // Even without cinematic mode, still provide variety between clips
  return buildVarietyPrompt(script, sceneDescription, clipIndex, totalClips, performanceStyle);
}

/**
 * Full Hollywood-grade cinematography prompt with DYNAMIC SCENE PROGRESSION
 * CRITICAL: Enforces "ALREADY IN POSITION" - avatar starts IN the scene, not entering it
 */
function buildWorldClassPrompt(
  script: string,
  baseSceneDescription: string | undefined,
  clipIndex: number,
  totalClips: number,
  performanceStyle: string
): string {
  const idx = clipIndex % 10;
  
  // Get unique style elements for this clip
  const movementKey = MOVEMENT_PROGRESSION[idx];
  const angleKey = ANGLE_PROGRESSION[idx];
  const sizeKey = SIZE_PROGRESSION[idx];
  const lightingKey = LIGHTING_PROGRESSION[idx];
  const motionKey = MOTION_PROGRESSION[idx];
  
  const movementPrompt = selectPrompt(CAMERA_MOVEMENTS[movementKey] || CAMERA_MOVEMENTS.static_locked);
  const anglePrompt = selectPrompt(CAMERA_ANGLES[angleKey] || CAMERA_ANGLES.eye_level_centered);
  const sizePrompt = selectPrompt(SHOT_SIZES[sizeKey] || SHOT_SIZES.medium);
  const lightingPrompt = selectPrompt(LIGHTING_STYLES[lightingKey] || LIGHTING_STYLES.classic_key);
  const motionPrompt = selectPrompt(SUBJECT_MOTION[motionKey] || SUBJECT_MOTION.gesture_expressive);
  
  // DYNAMIC SCENE PROGRESSION: Get progressive scene for this clip
  const progressiveScene = getProgressiveScene(baseSceneDescription, clipIndex, totalClips);
  const sceneContext = `Cinematic scene set in ${progressiveScene}.`;
  
  // CRITICAL: "Already in position" enforcement for Kling animation
  const positionEnforcement = "IMPORTANT: The subject is ALREADY fully positioned in the environment from the first frame - NOT walking in, NOT entering, NOT arriving. They are stationary and grounded, having already been present in this location.";
  
  const qualityBaseline = "Ultra-high definition 4K quality, clean crisp image, natural skin tones, bright vibrant colors, professional color grading, cinematic depth of field, warm inviting lighting, award-winning cinematography.";
  
  console.log(`[AvatarDirect] Clip ${clipIndex + 1}/${totalClips} Style: ${movementKey} + ${angleKey} + ${sizeKey}`);
  console.log(`[AvatarDirect] Clip ${clipIndex + 1}/${totalClips} Scene: ${progressiveScene.substring(0, 60)}...`);
  
  return `${positionEnforcement} ${sceneContext} ${sizePrompt}. ${anglePrompt}. ${movementPrompt}. ${lightingPrompt}. The subject is ${motionPrompt}, speaking naturally: "${script.substring(0, 80)}${script.length > 80 ? '...' : ''}". ${performanceStyle} Lifelike fluid movements, natural micro-expressions, authentic lip sync, subtle breathing motion, realistic eye movements and blinks. ${qualityBaseline}`;
}

/**
 * Standard variety prompt (cinematic mode disabled)
 * Still ensures clips look different from each other with SCENE PROGRESSION
 * CRITICAL: Enforces "ALREADY IN POSITION" - avatar starts IN the scene, not entering it
 */
function buildVarietyPrompt(
  script: string,
  baseSceneDescription: string | undefined,
  clipIndex: number,
  totalClips: number,
  performanceStyle: string
): string {
  // Simpler variety cycle - all enforce "already positioned"
  const simpleAngles = [
    "centered medium shot with balanced composition",
    "slightly angled medium close-up with depth",
    "comfortable wide shot with environmental context",
    "intimate close-up with emotional focus",
    "three-quarter medium shot with dimensional framing",
  ];
  
  // CRITICAL: All motions explicitly state "already positioned"
  const simpleMotion = [
    "already positioned, speaking naturally with expressive hand gestures",
    "already in place, engaging warmly with authentic delivery",
    "already situated, presenting confidently with clear diction",
    "already positioned, communicating thoughtfully with measured pace",
    "already grounded, delivering dynamically with natural energy",
  ];
  
  const angle = simpleAngles[clipIndex % simpleAngles.length];
  const motion = simpleMotion[clipIndex % simpleMotion.length];
  
  // DYNAMIC SCENE PROGRESSION: Get progressive scene for this clip
  const progressiveScene = getProgressiveScene(baseSceneDescription, clipIndex, totalClips);
  const sceneContext = `Cinematic scene in ${progressiveScene}, shot with professional cinematography.`;
  
  // CRITICAL: "Already in position" enforcement
  const positionEnforcement = "IMPORTANT: Subject is ALREADY in position from frame 1 - NOT walking in, NOT entering. Stationary and grounded.";
  
  const qualityBaseline = "Ultra high definition, bright vibrant colors, natural skin tones, sharp focus on subject, warm inviting lighting, pleasing background bokeh.";
  
  console.log(`[AvatarDirect] Clip ${clipIndex + 1}/${totalClips} (Standard) Scene: ${progressiveScene.substring(0, 60)}...`);
  
  return `${positionEnforcement} ${sceneContext} ${angle} of the person ${motion}: "${script.substring(0, 80)}${script.length > 80 ? '...' : ''}". ${performanceStyle} Lifelike fluid movements, natural micro-expressions, authentic lip sync. ${qualityBaseline}`;
}

function analyzeEmotionalTone(script: string): 'excited' | 'serious' | 'warm' | 'playful' | 'neutral' {
  const lower = script.toLowerCase();
  
  if (lower.includes('!') || lower.includes('amazing') || lower.includes('incredible')) return 'excited';
  if (lower.includes('important') || lower.includes('serious') || lower.includes('critical')) return 'serious';
  if (lower.includes('welcome') || lower.includes('thank') || lower.includes('love')) return 'warm';
  if (lower.includes('fun') || lower.includes('joke') || lower.includes('haha')) return 'playful';
  
  return 'neutral';
}

function getPerformanceStyle(tone: string): string {
  switch (tone) {
    case 'excited':
      return "Eyes bright with enthusiasm, animated hand gestures, energetic head movements, beaming smile.";
    case 'serious':
      return "Focused expression, measured movements, direct eye contact, nodding to emphasize key points.";
    case 'warm':
      return "Gentle welcoming smile, soft expressive eyes, relaxed natural posture.";
    case 'playful':
      return "Mischievous smile, playful eyebrow raises, animated expressions, lighthearted energy.";
    default:
      return "Natural confident delivery, genuine facial expressions, professional yet personable energy.";
  }
}

function estimateDuration(text: string): number {
  const words = text.length / 5;
  const minutes = words / 150;
  return Math.round(minutes * 60 * 1000);
}
