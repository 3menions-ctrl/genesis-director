import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GENERATE-AVATAR-DIRECT - World-Class Avatar Pipeline v3.0
 * 
 * ASYNC JOB PATTERN - Permanent timeout fix:
 * 1. Starts Kling prediction and returns IMMEDIATELY with job ID
 * 2. Saves prediction IDs to database for watchdog polling
 * 3. Watchdog handles completion polling (no Edge Function timeout)
 * 4. Ensures verbatim TTS, scene compositing, and natural acting
 */

// Voice mapping for MiniMax
const VOICE_MAP: Record<string, string> = {
  'onwK4e9ZLuTAKqWW03F9': 'onyx',
  'JBFqnCBsd6RMkjVDRZzb': 'echo',
  'EXAVITQu4vr4xnSDxMaL': 'nova',
  'pFZP5JQG7iQjIQuC4Bku': 'shimmer',
  'cjVigY5qzO86Huf0OWal': 'alloy',
  'onyx': 'onyx',
  'echo': 'echo',
  'fable': 'fable',
  'nova': 'nova',
  'shimmer': 'shimmer',
  'alloy': 'alloy',
  'bella': 'bella',
  'adam': 'adam',
  'michael': 'michael',
  'george': 'george',
  'sarah': 'sarah',
  'jessica': 'jessica',
  'lily': 'lily',
  'emma': 'emma',
  'narrator': 'narrator',
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
      aspectRatio = '16:9',
      clipCount = 1,
      clipDuration = 10,
      cinematicMode,
    } = request;

    if (!script || !avatarImageUrl) {
      throw new Error("Both 'script' and 'avatarImageUrl' are required");
    }

    // Split script into segments for multi-clip
    const actualClipCount = Math.max(1, Math.min(clipCount, 10));
    const scriptSegments = actualClipCount > 1 
      ? splitScriptIntoSegments(script, actualClipCount)
      : [script];
    
    const finalClipCount = scriptSegments.length;
    const minimaxVoice = VOICE_MAP[voiceId] || VOICE_MAP[voiceId.toLowerCase()] || 'bella';

    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");
    console.log("[AvatarDirect] Starting ASYNC AVATAR pipeline v3.0 (No Timeout)");
    console.log(`[AvatarDirect] Script (${script.length} chars): "${script.substring(0, 80)}..."`);
    console.log(`[AvatarDirect] Scene: "${sceneDescription || 'Professional studio setting'}"`);
    console.log(`[AvatarDirect] Voice: ${minimaxVoice}, Clips: ${finalClipCount} × ${clipDuration}s each`);
    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");

    if (projectId) {
      await supabase.from('movie_projects').update({
        status: 'generating',
        pipeline_state: {
          stage: 'init',
          progress: 5,
          message: `Preparing ${finalClipCount} clip${finalClipCount > 1 ? 's' : ''}...`,
          totalClips: finalClipCount,
        },
      }).eq('id', projectId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Generate MASTER AUDIO TRACK (fast - ~2-5s)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] Step 1: Generating MASTER AUDIO...");
    
    if (projectId) {
      await supabase.from('movie_projects').update({
        pipeline_state: {
          stage: 'master_audio',
          progress: 10,
          message: 'Creating audio track...',
          totalClips: finalClipCount,
        },
      }).eq('id', projectId);
    }

    const masterVoiceResponse = await fetch(`${supabaseUrl}/functions/v1/generate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        text: script,
        voiceId: minimaxVoice,
        speed: 1.0,
        projectId,
      }),
    });

    if (!masterVoiceResponse.ok) {
      throw new Error("Master TTS generation failed");
    }

    const masterVoiceResult = await masterVoiceResponse.json();
    
    if (!masterVoiceResult.success || !masterVoiceResult.audioUrl) {
      throw new Error("Master TTS failed - no audio");
    }

    const masterAudioUrl = masterVoiceResult.audioUrl;
    const masterAudioDurationMs = masterVoiceResult.durationMs || estimateDuration(script);
    
    console.log(`[AvatarDirect] ✅ Master audio generated: ${Math.round(masterAudioDurationMs / 1000)}s`);

    // Persist master audio to permanent storage
    let permanentMasterAudioUrl = masterAudioUrl;
    if (masterAudioUrl.includes('replicate.delivery') && projectId) {
      try {
        const audioResponse = await fetch(masterAudioUrl);
        if (audioResponse.ok) {
          const audioBlob = await audioResponse.blob();
          const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
          
          const audioFileName = `avatar_${projectId}_master_audio_${Date.now()}.mp3`;
          const audioStoragePath = `avatar-videos/${projectId}/${audioFileName}`;
          
          const { error: audioUploadError } = await supabase.storage
            .from('video-clips')
            .upload(audioStoragePath, audioBytes, {
              contentType: 'audio/mpeg',
              upsert: true,
            });
          
          if (!audioUploadError) {
            permanentMasterAudioUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${audioStoragePath}`;
            console.log("[AvatarDirect] ✅ Master audio saved to permanent storage");
          }
        }
      } catch (audioStorageError) {
        console.warn("[AvatarDirect] Master audio storage failed (non-fatal):", audioStorageError);
      }
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

    // Pre-generate TTS for ALL segments upfront (fast - ~2s each)
    // These will be used by watchdog when chaining subsequent clips
    const allSegmentData: Array<{
      segmentText: string;
      audioUrl: string;
      audioDurationMs: number;
    }> = [];
    console.log("[AvatarDirect] Pre-generating TTS for all segments...");
    
    for (let clipIndex = 0; clipIndex < scriptSegments.length; clipIndex++) {
      const segmentText = scriptSegments[clipIndex];
      const clipNumber = clipIndex + 1;
      
      const voiceResponse = await fetch(`${supabaseUrl}/functions/v1/generate-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          text: segmentText,
          voiceId: minimaxVoice,
          speed: 1.0,
          projectId,
        }),
      });

      if (!voiceResponse.ok) {
        throw new Error(`TTS generation failed for clip ${clipNumber}`);
      }

      const voiceResult = await voiceResponse.json();
      
      if (!voiceResult.success || !voiceResult.audioUrl) {
        throw new Error(`TTS failed for clip ${clipNumber} - no audio`);
      }

      allSegmentData.push({
        segmentText,
        audioUrl: voiceResult.audioUrl,
        audioDurationMs: voiceResult.durationMs || estimateDuration(segmentText),
      });
      console.log(`[AvatarDirect] Clip ${clipNumber}: ✅ TTS ready (${Math.round(allSegmentData[clipIndex].audioDurationMs / 1000)}s)`);
    }

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
          negative_prompt: "static, frozen, robotic, stiff, unnatural, glitchy, distorted, closed mouth, looking away, boring, monotone, lifeless",
        },
      }),
    });

    if (!klingResponse.ok) {
      throw new Error("Kling animation failed to start for clip 1");
    }

    const klingPrediction = await klingResponse.json();
    console.log(`[AvatarDirect] Clip 1: Kling STARTED: ${klingPrediction.id}`);

    // Build predictions array - clip 1 is processing, rest are pending
    const pendingPredictions: Array<{
      clipIndex: number;
      predictionId: string | null;
      segmentText: string;
      audioUrl: string;
      audioDurationMs: number;
      startImageUrl: string | null;
      status: string;
      videoUrl: string | null;
    }> = [];

    // Clip 1 - currently processing
    pendingPredictions.push({
      clipIndex: 0,
      predictionId: klingPrediction.id,
      segmentText: clip1Data.segmentText,
      audioUrl: clip1Data.audioUrl,
      audioDurationMs: clip1Data.audioDurationMs,
      startImageUrl: sharedAnimationStartImage,
      status: 'processing',
      videoUrl: null,
    });

    // Clips 2+ - pending, will be started by watchdog after frame extraction
    for (let i = 1; i < allSegmentData.length; i++) {
      pendingPredictions.push({
        clipIndex: i,
        predictionId: null, // Will be set by watchdog
        segmentText: allSegmentData[i].segmentText,
        audioUrl: allSegmentData[i].audioUrl,
        audioDurationMs: allSegmentData[i].audioDurationMs,
        startImageUrl: null, // Will be set from previous clip's last frame
        status: 'pending', // Waiting for previous clip to complete
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
      masterAudioUrl: permanentMasterAudioUrl,
      masterAudioDurationMs,
      sceneImageUrl: sharedAnimationStartImage,
      startedAt: new Date().toISOString(),
      clipDuration,
      aspectRatio,
      // CRITICAL: Persist original parameters for recovery
      originalScript: script,
      originalSceneDescription: sceneDescription || null,
    };

    if (projectId) {
      const { error: updateError } = await supabase.from('movie_projects').update({
        // CRITICAL: Save user's script to synopsis for reference
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
          predictions: pendingPredictions.map(p => ({
            predictionId: p.predictionId,
            clipIndex: p.clipIndex,
            status: p.status, // CRITICAL: Use actual status (processing vs pending)
            audioUrl: p.audioUrl,
            audioDurationMs: p.audioDurationMs,
            segmentText: p.segmentText,
            startImageUrl: p.startImageUrl, // Preserve start image for frame-chaining
          })),
          masterAudioUrl: permanentMasterAudioUrl,
          sceneImageUrl: sharedAnimationStartImage,
          sceneCompositingApplied: sceneCompositingApplied,
          sceneDescription: sceneDescription || null,
          clipDuration: clipDuration,
          aspectRatio: aspectRatio,
          // CRITICAL: Preserve full script for recovery/debugging
          originalScript: script,
          startedAt: new Date().toISOString(),
        },
        voice_audio_url: permanentMasterAudioUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
      
      if (updateError) {
        console.error("[AvatarDirect] ❌ Failed to save async state:", updateError);
      } else {
        console.log("[AvatarDirect] ✅ Async state saved successfully");
      }
    }

    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");
    console.log("[AvatarDirect] ✅ ASYNC AVATAR PIPELINE v3.0 - JOB STARTED");
    console.log(`[AvatarDirect] Started ${pendingPredictions.length} Kling predictions`);
    console.log("[AvatarDirect] Watchdog will poll for completion and finalize");
    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");

    return new Response(
      JSON.stringify({
        success: true,
        async: true,
        message: `Avatar generation started - ${pendingPredictions.length} clips processing`,
        predictionIds: pendingPredictions.map(p => p.predictionId),
        projectId,
        masterAudioUrl: permanentMasterAudioUrl,
        totalClips: pendingPredictions.length,
        status: 'processing',
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

// ============================================================================
// WORLD-CLASS CINEMATOGRAPHY ENGINE - Inline Implementation
// ============================================================================

const CAMERA_MOVEMENTS: Record<string, string[]> = {
  dolly_in: [
    "smooth dolly push-in toward the subject, building intimacy",
    "gradual forward movement closing distance with emotional impact",
    "elegant dolly approach revealing subtle details",
  ],
  dolly_out: [
    "slow dolly pull-back revealing the full scene context",
    "retreating camera movement expanding the visual scope",
    "widening perspective dolly revealing environmental grandeur",
  ],
  tracking_left: [
    "fluid lateral tracking shot moving left across the scene",
    "smooth side-to-side camera glide following movement",
    "parallel tracking with natural momentum",
  ],
  tracking_right: [
    "elegant rightward tracking shot with steady momentum",
    "horizontal camera motion sweeping across the frame",
    "lateral dolly movement with cinematic fluidity",
  ],
  crane_up: [
    "graceful crane shot rising above the subject",
    "ascending camera movement revealing scope and scale",
    "upward sweeping crane adding vertical dimension",
  ],
  crane_down: [
    "descending crane shot landing on the subject",
    "overhead camera lowering to intimate framing",
    "sweeping downward reveal with dramatic effect",
  ],
  orbit_left: [
    "subtle orbiting shot arcing counterclockwise around the subject",
    "rotational camera movement revealing multiple angles",
    "cinematic arc shot with fluid execution",
  ],
  orbit_right: [
    "clockwise orbital movement around the subject",
    "dynamic arc shot showcasing dimensional presence",
    "rotating camera perspective with smooth execution",
  ],
  steadicam_follow: [
    "professional steadicam following the subject organically",
    "floating camera movement with natural breathing",
    "smooth pursuit shot maintaining perfect framing",
  ],
  static_locked: [
    "rock-solid locked-off shot with precise composition",
    "perfectly stable static frame emphasizing performance",
    "tripod-mounted stillness with intentional gravitas",
  ],
  push_focus: [
    "subtle forward motion with shifting focus plane",
    "gentle push-in with depth-of-field emphasis",
    "approaching shot with cinematic focus transition",
  ],
};

const CAMERA_ANGLES: Record<string, string[]> = {
  eye_level_centered: [
    "direct eye-level framing with centered composition",
    "straight-on neutral angle at subject height",
    "level camera placement for natural connection",
  ],
  eye_level_offset: [
    "eye-level shot with subject positioned off-center using rule of thirds",
    "level angle with asymmetrical composition creating visual interest",
    "natural height camera with negative space emphasis",
  ],
  low_angle_subtle: [
    "slightly low camera angle adding subtle authority",
    "upward tilt from chest height enhancing presence",
    "mild low angle conveying quiet confidence",
  ],
  low_angle_dramatic: [
    "dramatic low angle shooting upward toward the subject",
    "hero shot from below emphasizing power and stature",
    "striking upward perspective with expansive framing",
  ],
  high_angle_gentle: [
    "gentle high angle looking down with empathy",
    "overhead perspective creating intimacy",
    "elevated viewpoint with caring quality",
  ],
  three_quarter_left: [
    "three-quarter angle from subject's left side",
    "45-degree profile revealing depth and dimension",
    "angled perspective showing facial contours",
  ],
  three_quarter_right: [
    "three-quarter composition from subject's right",
    "dimensional 45-degree angle with depth",
    "sculptural perspective emphasizing form",
  ],
  dutch_subtle: [
    "subtle dutch tilt adding dynamic tension",
    "slight camera cant creating visual energy",
    "mild angular tilt enhancing dynamism",
  ],
  over_shoulder_left: [
    "over-the-shoulder shot from behind left side",
    "OTS framing with subject facing right",
    "shoulder-level perspective establishing spatial relationship",
  ],
  profile_silhouette: [
    "striking profile shot with rim lighting",
    "side-view silhouette with dramatic edge light",
    "profile angle creating iconic composition",
  ],
};

const SHOT_SIZES: Record<string, string[]> = {
  wide: [
    "full-body wide shot showing complete figure and surroundings",
    "master shot establishing spatial relationships",
    "wide framing with environmental storytelling",
  ],
  medium_wide: [
    "medium-wide shot from knees up with comfortable headroom",
    "cowboy shot showing gesture and environment balance",
    "three-quarter body framing with context",
  ],
  medium: [
    "classic medium shot from waist up",
    "standard interview framing with expressive potential",
    "mid-shot balancing subject and background",
  ],
  medium_close: [
    "medium close-up from chest level",
    "tighter framing emphasizing upper body expression",
    "intimate mid-close capturing emotional nuance",
  ],
  close_up: [
    "powerful close-up focusing on face and expression",
    "tight facial framing with emotional intensity",
    "intimate close shot capturing micro-expressions",
  ],
  extreme_close_up: [
    "extreme close-up on eyes and expression for maximum intensity",
    "ultra-tight framing on expressive features",
    "macro-level emotional detail shot",
  ],
};

const LIGHTING_STYLES: Record<string, string[]> = {
  classic_key: [
    "professional three-point lighting with dominant key light",
    "balanced studio illumination with soft shadows",
    "commercial-grade lighting setup with fill and rim",
  ],
  chiaroscuro: [
    "dramatic chiaroscuro lighting with deep shadows and highlights",
    "high-contrast illumination with painterly quality",
    "sculptural light and shadow interplay",
  ],
  rembrandt: [
    "Rembrandt lighting with characteristic modeling",
    "classic portrait lighting creating depth and dimension",
    "sculptural side-lighting with dramatic mood",
  ],
  golden_hour: [
    "warm golden hour lighting with amber tones",
    "magic hour glow with long atmospheric shadows",
    "sunset-quality warm illumination",
  ],
  rim_dramatic: [
    "dramatic rim lighting separating subject from background",
    "edge-lit contour with glowing silhouette effect",
    "backlit halo effect with subject definition",
  ],
  overcast_soft: [
    "soft natural lighting without harsh shadows",
    "diffused illumination with even coverage",
    "gentle softbox quality light",
  ],
  volumetric: [
    "atmospheric volumetric lighting with visible light rays",
    "god-rays effect with hazy atmospheric depth",
    "cinematic light beams cutting through space",
  ],
  neon_accent: [
    "vibrant accent lighting with color contrast",
    "contemporary colored edge lighting",
    "modern stylized illumination with color pops",
  ],
  blue_hour: [
    "cool twilight lighting with blue undertones",
    "dusk ambiance with soft gradient sky tones",
    "ethereal blue atmosphere",
  ],
};

const SUBJECT_MOTION: Record<string, string[]> = {
  static_confident: [
    "standing with confident stillness and grounded presence",
    "static but alive with subtle weight shifts",
    "poised and centered with controlled energy",
  ],
  subtle_shift: [
    "gentle weight shifts and natural micro-movements",
    "subtle swaying with organic rhythm",
    "living stillness with breathing motion",
  ],
  gesture_expressive: [
    "expressive hand gestures punctuating speech naturally",
    "animated gesticulation matching verbal emphasis",
    "dynamic hand and arm movements for engagement",
  ],
  walking_forward: [
    "walking purposefully toward camera while speaking",
    "confident approach with maintained eye contact",
    "forward stride with engaging presence",
  ],
  walking_lateral: [
    "walking parallel to camera with natural gait",
    "lateral movement through the scene while speaking",
    "side-to-side traversal with dynamic energy",
  ],
  seated_engaged: [
    "seated position with engaged forward lean",
    "sitting comfortably with attentive posture",
    "chair-based presence with expressive upper body",
  ],
  leaning_casual: [
    "casually leaning against a surface with relaxed energy",
    "comfortable lean position conveying accessibility",
    "relaxed stance with grounded confidence",
  ],
};

// ============================================================================
// DYNAMIC SCENE PROGRESSION - Background changes for multi-clip narratives
// ============================================================================

// Scene journey templates - contextually flowing location sequences
const SCENE_JOURNEYS: Record<string, string[]> = {
  // Professional/Business journey
  professional: [
    "modern executive office with floor-to-ceiling windows and city skyline view",
    "sleek conference room with minimalist design and ambient lighting",
    "stylish coffee shop with warm wood accents and natural light",
    "upscale hotel lobby with marble floors and contemporary art",
    "rooftop terrace overlooking the urban landscape at golden hour",
  ],
  // Creative/Artistic journey
  creative: [
    "artistic loft studio with exposed brick and creative installations",
    "trendy gallery space with white walls and dramatic spotlights",
    "bohemian café with eclectic décor and vintage furniture",
    "outdoor urban art district with colorful murals",
    "modern design studio with sleek workstations and inspiration boards",
  ],
  // Lifestyle/Casual journey  
  lifestyle: [
    "cozy living room with warm lighting and comfortable seating",
    "bright modern kitchen with marble countertops",
    "peaceful garden patio with lush greenery and soft daylight",
    "charming bookstore with wooden shelves and reading nooks",
    "scenic walking path through a park with dappled sunlight",
  ],
  // Tech/Innovation journey
  tech: [
    "futuristic tech hub with holographic displays and neon accents",
    "modern startup office with open floor plan and creative zones",
    "sleek data center with server racks and blue lighting",
    "innovation lab with prototype displays and collaborative spaces",
    "high-rise observation deck with panoramic city views at dusk",
  ],
  // Cinematic/Dramatic journey
  cinematic: [
    "dramatic film noir setting with venetian blinds and moody shadows",
    "elegant theater backstage with velvet curtains and stage lights",
    "atmospheric jazz lounge with dim lighting and vintage aesthetic",
    "grand library with towering bookshelves and warm lamplight",
    "art deco penthouse with city lights twinkling through windows",
  ],
};

/**
 * Determine if scene changes should be used based on clip count
 * - 1-2 clips: Keep same scene for continuity
 * - 3-4 clips: Introduce 2 different scenes
 * - 5+ clips: Full scene journey with multiple locations
 */
function shouldUseSceneProgression(clipCount: number): boolean {
  return clipCount >= 3;
}

/**
 * Get scene description for a specific clip in the sequence
 * Creates a coherent visual journey across the video
 */
function getProgressiveScene(
  baseScene: string | undefined,
  clipIndex: number,
  totalClips: number
): string {
  // For 1-2 clips, use the same scene throughout
  if (totalClips < 3) {
    return baseScene?.trim() || "professional studio with cinematic lighting";
  }
  
  // Detect journey type from base scene description
  const journeyType = detectJourneyType(baseScene);
  const journey = SCENE_JOURNEYS[journeyType];
  
  // Calculate how many scene changes based on clip count
  // 3-4 clips: 2 scenes, 5-6 clips: 3 scenes, 7+ clips: 4-5 scenes
  const sceneChangeCount = Math.min(journey.length, Math.ceil(totalClips / 2));
  
  // Determine which scene this clip should use
  const sceneIndex = Math.floor((clipIndex / totalClips) * sceneChangeCount);
  const selectedScene = journey[Math.min(sceneIndex, journey.length - 1)];
  
  console.log(`[AvatarDirect] Clip ${clipIndex + 1}/${totalClips} → Scene ${sceneIndex + 1}/${sceneChangeCount}: ${selectedScene.substring(0, 50)}...`);
  
  return selectedScene;
}

/**
 * Detect the appropriate journey type based on base scene description
 */
function detectJourneyType(baseScene: string | undefined): string {
  if (!baseScene) return 'professional';
  
  const lower = baseScene.toLowerCase();
  
  if (lower.includes('tech') || lower.includes('future') || lower.includes('digital') || lower.includes('cyber')) {
    return 'tech';
  }
  if (lower.includes('art') || lower.includes('creative') || lower.includes('studio') || lower.includes('gallery')) {
    return 'creative';
  }
  if (lower.includes('home') || lower.includes('cozy') || lower.includes('casual') || lower.includes('garden')) {
    return 'lifestyle';
  }
  if (lower.includes('film') || lower.includes('dramatic') || lower.includes('noir') || lower.includes('theater')) {
    return 'cinematic';
  }
  
  return 'professional';
}

// Clip style progression for variety
const MOVEMENT_PROGRESSION = [
  'dolly_in', 'tracking_right', 'crane_up', 'orbit_left', 'dolly_out',
  'steadicam_follow', 'tracking_left', 'crane_down', 'orbit_right', 'push_focus',
];

const ANGLE_PROGRESSION = [
  'eye_level_offset', 'low_angle_subtle', 'three_quarter_left', 'high_angle_gentle',
  'dutch_subtle', 'three_quarter_right', 'low_angle_dramatic', 'eye_level_centered',
  'over_shoulder_left', 'profile_silhouette',
];

const SIZE_PROGRESSION = [
  'medium', 'medium_close', 'wide', 'close_up', 'medium_wide',
  'medium', 'extreme_close_up', 'medium_wide', 'close_up', 'wide',
];

const LIGHTING_PROGRESSION = [
  'classic_key', 'rembrandt', 'golden_hour', 'chiaroscuro', 'rim_dramatic',
  'overcast_soft', 'neon_accent', 'volumetric', 'blue_hour', 'classic_key',
];

const MOTION_PROGRESSION = [
  'gesture_expressive', 'walking_forward', 'subtle_shift', 'static_confident',
  'walking_lateral', 'leaning_casual', 'gesture_expressive', 'seated_engaged',
  'walking_forward', 'subtle_shift',
];

function selectPrompt(prompts: string[]): string {
  return prompts[Math.floor(Math.random() * prompts.length)];
}

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
  
  const qualityBaseline = "Ultra-high definition 4K quality, subtle film-grain texture, natural skin tones, professional color grading, cinematic depth of field, award-winning cinematography.";
  
  console.log(`[AvatarDirect] Clip ${clipIndex + 1}/${totalClips} Style: ${movementKey} + ${angleKey} + ${sizeKey}`);
  console.log(`[AvatarDirect] Clip ${clipIndex + 1}/${totalClips} Scene: ${progressiveScene.substring(0, 60)}...`);
  
  return `${sceneContext} ${sizePrompt}. ${anglePrompt}. ${movementPrompt}. ${lightingPrompt}. The subject is ${motionPrompt}, speaking naturally: "${script.substring(0, 80)}${script.length > 80 ? '...' : ''}". ${performanceStyle} Lifelike fluid movements, natural micro-expressions, authentic lip sync, subtle breathing motion, realistic eye movements and blinks. ${qualityBaseline}`;
}

/**
 * Standard variety prompt (cinematic mode disabled)
 * Still ensures clips look different from each other with SCENE PROGRESSION
 */
function buildVarietyPrompt(
  script: string,
  baseSceneDescription: string | undefined,
  clipIndex: number,
  totalClips: number,
  performanceStyle: string
): string {
  // Simpler variety cycle
  const simpleAngles = [
    "centered medium shot with balanced composition",
    "slightly angled medium close-up with depth",
    "comfortable wide shot with environmental context",
    "intimate close-up with emotional focus",
    "three-quarter medium shot with dimensional framing",
  ];
  
  const simpleMotion = [
    "speaking naturally with expressive hand gestures",
    "engaging warmly with authentic delivery",
    "presenting confidently with clear diction",
    "communicating thoughtfully with measured pace",
    "delivering dynamically with natural energy",
  ];
  
  const angle = simpleAngles[clipIndex % simpleAngles.length];
  const motion = simpleMotion[clipIndex % simpleMotion.length];
  
  // DYNAMIC SCENE PROGRESSION: Get progressive scene for this clip
  const progressiveScene = getProgressiveScene(baseSceneDescription, clipIndex, totalClips);
  const sceneContext = `Cinematic scene in ${progressiveScene}, shot with professional cinematography.`;
  
  const qualityBaseline = "Ultra high definition, film-quality, natural skin tones, sharp focus on subject, pleasing background bokeh.";
  
  console.log(`[AvatarDirect] Clip ${clipIndex + 1}/${totalClips} (Standard) Scene: ${progressiveScene.substring(0, 60)}...`);
  
  return `${sceneContext} ${angle} of the person ${motion}: "${script.substring(0, 80)}${script.length > 80 ? '...' : ''}". ${performanceStyle} Lifelike fluid movements, natural micro-expressions, authentic lip sync. ${qualityBaseline}`;
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
