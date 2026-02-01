import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GENERATE-AVATAR-DIRECT - World-Class Avatar Pipeline v2.0
 * 
 * EXPRESSIVE ACTING pipeline that ensures:
 * 1. VERBATIM TTS - User's exact script is spoken word-for-word using avatar's voice
 * 2. SCENE COMPOSITING - Avatar placed in user-specified environment via Kling
 * 3. NATURAL ACTING - Kling generates expressive, human-like performance
 * 4. AUDIO SYNC - TTS audio merged with generated video
 * 
 * Architecture:
 * 1. Generate TTS audio from user's exact script (MiniMax Speech 2.6)
 * 2. Generate scene background + avatar composite prompt for Kling
 * 3. Kling generates EXPRESSIVE speaking animation with scene context
 * 4. Merge TTS audio with generated video
 */

// Voice mapping for MiniMax - supports all avatar template voices
const VOICE_MAP: Record<string, string> = {
  // ElevenLabs legacy IDs mapped to MiniMax
  'onwK4e9ZLuTAKqWW03F9': 'onyx',
  'JBFqnCBsd6RMkjVDRZzb': 'echo',
  'EXAVITQu4vr4xnSDxMaL': 'nova',
  'pFZP5JQG7iQjIQuC4Bku': 'shimmer',
  'cjVigY5qzO86Huf0OWal': 'alloy',
  // Direct voice names (avatar_templates use these)
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
  // User's EXACT script to be spoken (no AI modification)
  script: string;
  
  // Avatar face image URL
  avatarImageUrl: string;
  
  // Voice ID for TTS (should match avatar template's voice_id)
  voiceId?: string;
  
  // Scene/environment description (e.g., "a witch's house in the forest")
  sceneDescription?: string;
  
  // Project tracking
  projectId?: string;
  userId?: string;
  
  // Output configuration
  aspectRatio?: string;
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
    } = request;

    if (!script || !avatarImageUrl) {
      throw new Error("Both 'script' (exact text to speak) and 'avatarImageUrl' are required");
    }

    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");
    console.log("[AvatarDirect] Starting EXPRESSIVE ACTING pipeline v2.0");
    console.log(`[AvatarDirect] Script (${script.length} chars): "${script.substring(0, 100)}..."`);
    console.log(`[AvatarDirect] Scene: "${sceneDescription || 'Professional studio setting'}"`);
    console.log(`[AvatarDirect] Voice: ${voiceId}, Aspect: ${aspectRatio}`);
    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");

    // Update project status if we have one
    if (projectId) {
      await supabase.from('movie_projects').update({
        status: 'generating',
        pipeline_state: {
          stage: 'tts_generation',
          progress: 10,
          message: 'Generating speech from your script...',
          scriptLength: script.length,
        },
      }).eq('id', projectId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Generate TTS from user's EXACT script using AVATAR'S VOICE
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] STEP 1: Generating TTS (verbatim script)...");
    console.log(`[AvatarDirect] Input voiceId: "${voiceId}"`);
    
    // Map the voice ID to MiniMax voice - avatar templates use openai voice names
    const minimaxVoice = VOICE_MAP[voiceId] || VOICE_MAP[voiceId.toLowerCase()] || 'bella';
    console.log(`[AvatarDirect] Mapped to MiniMax voice: "${minimaxVoice}"`);
    
    const voiceResponse = await fetch(`${supabaseUrl}/functions/v1/generate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        text: script, // EXACT user text, no changes
        voiceId: minimaxVoice,
        speed: 1.0,
        projectId,
      }),
    });

    if (!voiceResponse.ok) {
      const errorText = await voiceResponse.text();
      console.error("[AvatarDirect] TTS failed:", errorText);
      throw new Error(`TTS generation failed: ${voiceResponse.status}`);
    }

    const voiceResult = await voiceResponse.json();
    
    if (!voiceResult.success || !voiceResult.audioUrl) {
      throw new Error("TTS generation failed - no audio URL returned");
    }

    const audioUrl = voiceResult.audioUrl;
    const audioDurationMs = voiceResult.durationMs || estimateDuration(script);
    
    console.log(`[AvatarDirect] ✅ TTS complete with voice "${minimaxVoice}": ${audioUrl.substring(0, 60)}...`);
    console.log(`[AvatarDirect] Audio duration: ${Math.round(audioDurationMs / 1000)}s`);

    // Update progress
    if (projectId) {
      await supabase.from('movie_projects').update({
        pipeline_state: {
          stage: 'animation_generation',
          progress: 30,
          message: 'Creating expressive speaking animation...',
          audioUrl,
          voiceUsed: minimaxVoice,
        },
      }).eq('id', projectId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Generate EXPRESSIVE speaking animation with Kling
    // Kling is superior to Wav2Lip for natural, human-like acting
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] STEP 2: Generating expressive speaking animation (Kling)...");
    
    const audioDurationSec = Math.ceil(audioDurationMs / 1000);
    // Kling supports 5s or 10s - choose based on audio length
    const videoDuration = audioDurationSec <= 5 ? 5 : 10;
    
    // Build a rich, expressive prompt that captures the scene AND acting style
    // The prompt instructs Kling to create natural, engaging performance
    let actingPrompt = buildActingPrompt(script, sceneDescription);
    
    console.log(`[AvatarDirect] Acting prompt: "${actingPrompt.substring(0, 150)}..."`);
    console.log(`[AvatarDirect] Video duration: ${videoDuration}s`);
    
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
          start_image: avatarImageUrl,
          aspect_ratio: aspectRatio,
          negative_prompt: "static, frozen, robotic, stiff, unnatural, glitchy, distorted, closed mouth, looking away, boring, monotone, lifeless",
        },
      }),
    });

    if (!klingResponse.ok) {
      const errorText = await klingResponse.text();
      console.error("[AvatarDirect] Kling failed:", errorText);
      throw new Error(`Kling animation failed: ${klingResponse.status} - ${errorText}`);
    }

    const klingPrediction = await klingResponse.json();
    console.log(`[AvatarDirect] Kling prediction started: ${klingPrediction.id}`);

    // Update progress
    if (projectId) {
      await supabase.from('movie_projects').update({
        pipeline_state: {
          stage: 'video_rendering',
          progress: 50,
          message: 'Rendering expressive performance (this takes 2-4 minutes)...',
          predictionId: klingPrediction.id,
          audioUrl,
        },
      }).eq('id', projectId);
    }

    // Poll for Kling completion (can take 2-4 minutes)
    let videoUrl: string | null = null;
    
    if (klingPrediction.status === "succeeded" && klingPrediction.output) {
      videoUrl = klingPrediction.output;
    } else {
      videoUrl = await pollForResult(klingPrediction.id, REPLICATE_API_KEY, 300); // 5 min timeout
    }

    if (!videoUrl) {
      throw new Error("Video generation timed out - please try again");
    }

    console.log(`[AvatarDirect] ✅ Expressive video generated: ${videoUrl.substring(0, 60)}...`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Merge TTS audio with generated video
    // Uses ffmpeg to replace Kling's video audio with our TTS
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] STEP 3: Merging TTS audio with video...");
    
    if (projectId) {
      await supabase.from('movie_projects').update({
        pipeline_state: {
          stage: 'audio_merge',
          progress: 85,
          message: 'Synchronizing voice with video...',
          videoUrl,
          audioUrl,
        },
      }).eq('id', projectId);
    }

    // Use ffmpeg via Replicate to merge audio
    let finalVideoUrl = videoUrl;
    
    try {
      const mergedUrl = await mergeAudioWithVideo(videoUrl, audioUrl, REPLICATE_API_KEY);
      if (mergedUrl) {
        finalVideoUrl = mergedUrl;
        console.log(`[AvatarDirect] ✅ Audio merged: ${finalVideoUrl.substring(0, 60)}...`);
      } else {
        console.log("[AvatarDirect] Audio merge failed, using video as-is");
      }
    } catch (mergeError) {
      console.warn("[AvatarDirect] Audio merge error (non-fatal):", mergeError);
      // Non-fatal - video still plays, just without TTS audio synced
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPLETE: Update project and return result
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");
    console.log("[AvatarDirect] ✅ EXPRESSIVE AVATAR PIPELINE COMPLETE");
    console.log(`[AvatarDirect] Final video: ${finalVideoUrl}`);
    console.log(`[AvatarDirect] Voice used: ${minimaxVoice}`);
    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");

    if (projectId) {
      // Create a shot record for the avatar clip
      const { data: shot, error: shotError } = await supabase.from('shots').insert({
        project_id: projectId,
        shot_number: 1,
        description: script.substring(0, 200),
        dialogue: script,
        video_url: finalVideoUrl,
        audio_url: audioUrl,
        status: 'completed',
        scene_number: 1,
        start_time_ms: 0,
        end_time_ms: audioDurationMs,
        duration_seconds: Math.ceil(audioDurationMs / 1000),
      }).select('id').single();

      if (shotError) {
        console.error("[AvatarDirect] Failed to create shot record:", shotError);
      } else {
        console.log(`[AvatarDirect] Created shot record: ${shot?.id}`);
      }

      // Update project to completed with verification
      const { data: updatedProject, error: updateError } = await supabase.from('movie_projects').update({
        status: 'completed',
        video_url: finalVideoUrl,
        final_video_url: finalVideoUrl,
        voice_audio_url: audioUrl,
        pipeline_stage: 'completed',
        pipeline_state: {
          stage: 'completed',
          progress: 100,
          message: 'Avatar video complete!',
          completedAt: new Date().toISOString(),
          voiceUsed: minimaxVoice,
          sceneApplied: !!sceneDescription,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId).select('id, status, video_url').single();

      if (updateError) {
        console.error("[AvatarDirect] ❌ Failed to update project:", updateError);
        // Retry once
        const { error: retryError } = await supabase.from('movie_projects').update({
          status: 'completed',
          video_url: finalVideoUrl,
          final_video_url: finalVideoUrl,
          voice_audio_url: audioUrl,
          pipeline_stage: 'completed',
          updated_at: new Date().toISOString(),
        }).eq('id', projectId);
        
        if (retryError) {
          console.error("[AvatarDirect] ❌ Retry also failed:", retryError);
        }
      } else {
        console.log(`[AvatarDirect] ✅ Project updated: ${updatedProject?.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: finalVideoUrl,
        audioUrl,
        audioDurationMs,
        voiceUsed: minimaxVoice,
        sceneApplied: !!sceneDescription,
        scriptUsed: script,
        message: "Avatar video generated with expressive acting!",
        pipeline: "avatar-direct-v2",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AvatarDirect] Error:", error);
    
    // Update project status on failure
    const request = await req.clone().json().catch(() => ({}));
    if (request.projectId) {
      await supabase.from('movie_projects').update({
        status: 'failed',
        pipeline_state: {
          stage: 'failed',
          progress: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }).eq('id', request.projectId);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Build an expressive acting prompt that captures scene + performance style
 * This is the key to making avatars act like real humans
 */
function buildActingPrompt(script: string, sceneDescription?: string): string {
  // Analyze the script to determine emotional tone
  const emotionalTone = analyzeEmotionalTone(script);
  
  // Build the scene context
  const sceneContext = sceneDescription && sceneDescription.trim()
    ? `The scene takes place in ${sceneDescription.trim()}. `
    : "Professional studio setting with soft lighting. ";
  
  // Build the performance instruction based on script content
  const performanceStyle = getPerformanceStyle(emotionalTone, script);
  
  return `${sceneContext}The person in the frame is speaking directly to the camera, delivering this message: "${script.substring(0, 100)}${script.length > 100 ? '...' : ''}". ${performanceStyle} The performance should feel authentic, engaging, and human - like a charismatic presenter or actor delivering their lines with genuine emotion and connection to the audience.`;
}

/**
 * Analyze the emotional tone of the script
 */
function analyzeEmotionalTone(script: string): 'excited' | 'serious' | 'warm' | 'playful' | 'neutral' {
  const lower = script.toLowerCase();
  
  if (lower.includes('!') || lower.includes('amazing') || lower.includes('incredible') || lower.includes('exciting')) {
    return 'excited';
  }
  if (lower.includes('important') || lower.includes('serious') || lower.includes('critical') || lower.includes('warning')) {
    return 'serious';
  }
  if (lower.includes('welcome') || lower.includes('thank') || lower.includes('love') || lower.includes('friend')) {
    return 'warm';
  }
  if (lower.includes('fun') || lower.includes('joke') || lower.includes('haha') || lower.includes('😄') || lower.includes('lol')) {
    return 'playful';
  }
  
  return 'neutral';
}

/**
 * Get performance style instructions based on emotional tone
 */
function getPerformanceStyle(tone: string, script: string): string {
  switch (tone) {
    case 'excited':
      return "Eyes bright with enthusiasm, animated hand gestures, energetic head movements, beaming smile, leaning slightly forward with excitement. Speaking with passion and energy.";
    case 'serious':
      return "Focused, determined expression, measured deliberate movements, direct unwavering eye contact, nodding to emphasize key points. Speaking with authority and conviction.";
    case 'warm':
      return "Gentle welcoming smile, soft expressive eyes, relaxed natural posture, occasional appreciative nods, warmth radiating from the expression. Speaking with genuine kindness.";
    case 'playful':
      return "Mischievous smile, playful eyebrow raises, animated expressions, occasional head tilts and shoulder movements, lighthearted energy. Speaking with humor and fun.";
    default:
      return "Natural confident delivery, genuine facial expressions that match the words, subtle emphatic gestures, professional yet personable energy. Speaking clearly and engagingly.";
  }
}

/**
 * Poll Replicate for prediction result
 */
async function pollForResult(predictionId: string, apiKey: string, maxSeconds: number): Promise<string | null> {
  const maxAttempts = maxSeconds;
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    
    const status = await response.json();
    
    if (status.status === "succeeded") {
      return Array.isArray(status.output) ? status.output[0] : status.output;
    }
    
    if (status.status === "failed") {
      console.error(`[AvatarDirect] Prediction ${predictionId} failed:`, status.error);
      return null;
    }
    
    if (i % 15 === 0) {
      console.log(`[AvatarDirect] Polling ${predictionId}... (${i}s, status: ${status.status})`);
    }
  }
  
  console.error(`[AvatarDirect] Polling timeout for ${predictionId}`);
  return null;
}

/**
 * Merge TTS audio with video using ffmpeg via Replicate
 */
async function mergeAudioWithVideo(videoUrl: string, audioUrl: string, apiKey: string): Promise<string | null> {
  try {
    // Use a simple video+audio merge model
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Prefer": "wait=120",
      },
      body: JSON.stringify({
        version: "684cc0e6bff2f0d3b748d7c386ab8a6fb7c5f6d2095a3a38d68d9d6a3a2cb2f6", // ffmpeg model
        input: {
          video: videoUrl,
          audio: audioUrl,
          audio_volume: 1.0,
          video_volume: 0.0, // Mute original video audio
        },
      }),
    });

    if (!response.ok) {
      console.log("[AvatarDirect] Audio merge model not available, skipping");
      return null;
    }

    const prediction = await response.json();
    
    if (prediction.status === "succeeded" && prediction.output) {
      return prediction.output;
    }
    
    // Poll for result
    const result = await pollForResult(prediction.id, apiKey, 60);
    return result;
  } catch (error) {
    console.warn("[AvatarDirect] Audio merge failed:", error);
    return null;
  }
}

/**
 * Estimate audio duration based on text length (~150 WPM)
 */
function estimateDuration(text: string): number {
  const words = text.length / 5;
  const minutes = words / 150;
  return Math.round(minutes * 60 * 1000);
}
