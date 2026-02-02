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
    // STEP 3: START ALL KLING PREDICTIONS (async - no waiting!)
    // Store prediction IDs and let watchdog handle polling
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] Step 3: Starting Kling predictions ASYNC...");
    
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

    const pendingPredictions: Array<{
      clipIndex: number;
      predictionId: string;
      segmentText: string;
      audioUrl: string;
      audioDurationMs: number;
    }> = [];

    // Generate TTS for each segment and start Kling predictions in parallel
    for (let clipIndex = 0; clipIndex < scriptSegments.length; clipIndex++) {
      const segmentText = scriptSegments[clipIndex];
      const clipNumber = clipIndex + 1;
      
      console.log(`[AvatarDirect] ═══ Clip ${clipNumber}/${finalClipCount} ═══`);

      // Generate TTS for this segment (fast - ~1-2s)
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

      const clipAudioUrl = voiceResult.audioUrl;
      const clipAudioDurationMs = voiceResult.durationMs || estimateDuration(segmentText);
      
      console.log(`[AvatarDirect] Clip ${clipNumber}: ✅ TTS (${Math.round(clipAudioDurationMs / 1000)}s)`);

      // Start Kling prediction (async - returns immediately)
      // CRITICAL FIX: Ensure 10-second duration is enforced (clipDuration defaults to 10 in interface)
      // Only use 5s if explicitly set to less than 10
      const videoDuration = (clipDuration && clipDuration >= 10) ? 10 : (clipDuration || 10);
      console.log(`[AvatarDirect] Clip ${clipNumber}: Using ${videoDuration}s duration (requested: ${clipDuration}s)`);
      const actingPrompt = buildActingPrompt(segmentText, sceneDescription);
      
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
        throw new Error(`Kling animation failed to start for clip ${clipNumber}`);
      }

      const klingPrediction = await klingResponse.json();
      console.log(`[AvatarDirect] Clip ${clipNumber}: Kling STARTED (async): ${klingPrediction.id}`);

      pendingPredictions.push({
        clipIndex,
        predictionId: klingPrediction.id,
        segmentText,
        audioUrl: clipAudioUrl,
        audioDurationMs: clipAudioDurationMs,
      });
    }

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
            status: 'processing',
            audioUrl: p.audioUrl,
            audioDurationMs: p.audioDurationMs,
            segmentText: p.segmentText, // CRITICAL: Preserve segment text
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

/**
 * Build an expressive acting prompt
 */
function buildActingPrompt(script: string, sceneDescription?: string): string {
  const emotionalTone = analyzeEmotionalTone(script);
  
  const sceneContext = sceneDescription?.trim()
    ? `The scene takes place in ${sceneDescription.trim()}. `
    : "Professional studio setting with soft lighting. ";
  
  const performanceStyle = getPerformanceStyle(emotionalTone);
  
  return `${sceneContext}The person in the frame is speaking directly to the camera, delivering this message: "${script.substring(0, 100)}${script.length > 100 ? '...' : ''}". ${performanceStyle} The performance should feel authentic, engaging, and human.`;
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
