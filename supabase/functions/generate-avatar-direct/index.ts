import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GENERATE-AVATAR-DIRECT - World-Class Avatar Pipeline v2.1
 * 
 * EXPRESSIVE ACTING pipeline with MULTI-CLIP support that ensures:
 * 1. VERBATIM TTS - User's exact script is spoken word-for-word using avatar's voice
 * 2. SCENE COMPOSITING - Avatar placed in user-specified environment via Kling
 * 3. NATURAL ACTING - Kling generates expressive, human-like performance
 * 4. AUDIO SYNC - TTS audio merged with generated video
 * 5. MULTI-CLIP - Script can be split across multiple clips for longer content
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
    console.log("[AvatarDirect] Starting MULTI-CLIP AVATAR pipeline v2.2 (Continuous Audio)");
    console.log(`[AvatarDirect] Script (${script.length} chars): "${script.substring(0, 80)}..."`);
    console.log(`[AvatarDirect] Scene: "${sceneDescription || 'Professional studio setting'}"`);
    console.log(`[AvatarDirect] Voice: ${minimaxVoice}, Clips: ${finalClipCount}`);
    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");

    if (projectId) {
      await supabase.from('movie_projects').update({
        status: 'generating',
        pipeline_state: {
          stage: 'init',
          progress: 5,
          message: `Generating ${finalClipCount} clip${finalClipCount > 1 ? 's' : ''} with continuous audio...`,
          totalClips: finalClipCount,
        },
      }).eq('id', projectId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Generate MASTER AUDIO TRACK for entire script (continuous playback)
    // This ensures seamless audio across all clip transitions
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[AvatarDirect] Step 1: Generating MASTER AUDIO for entire script...");
    
    if (projectId) {
      await supabase.from('movie_projects').update({
        pipeline_state: {
          stage: 'master_audio',
          progress: 8,
          message: 'Creating continuous audio track...',
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

    // Persist master audio to storage immediately
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

    // Pre-generate scene image once for all clips
    let sharedAnimationStartImage = avatarImageUrl;
    
    if (sceneDescription?.trim()) {
      console.log("[AvatarDirect] Step 2: Pre-generating shared scene image...");
      
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

        if (sceneResponse.ok) {
          const sceneResult = await sceneResponse.json();
          if (sceneResult.success && sceneResult.sceneImageUrl) {
            sharedAnimationStartImage = sceneResult.sceneImageUrl;
            console.log("[AvatarDirect] ✅ Scene compositing succeeded");
          }
        }
      } catch (sceneError) {
        console.warn("[AvatarDirect] Scene-First error (non-fatal):", sceneError);
      }
    }

    // Generate each clip
    const generatedClips: Array<{
      videoUrl: string;
      audioUrl: string;
      audioDurationMs: number;
      segmentText: string;
      clipIndex: number;
    }> = [];

    for (let clipIndex = 0; clipIndex < scriptSegments.length; clipIndex++) {
      const segmentText = scriptSegments[clipIndex];
      const clipNumber = clipIndex + 1;
      
      console.log(`[AvatarDirect] ═══ Clip ${clipNumber}/${finalClipCount} ═══`);
      console.log(`[AvatarDirect] Segment: "${segmentText.substring(0, 60)}..."`);

      if (projectId) {
        const baseProgress = 10 + (clipIndex / finalClipCount) * 80;
        await supabase.from('movie_projects').update({
          pipeline_state: {
            stage: 'clip_generation',
            progress: Math.round(baseProgress),
            message: `Generating clip ${clipNumber} of ${finalClipCount}...`,
            totalClips: finalClipCount,
            currentClip: clipNumber,
          },
        }).eq('id', projectId);
      }

      // Generate TTS for this segment
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

      // Generate expressive animation with Kling
      const audioDurationSec = Math.ceil(clipAudioDurationMs / 1000);
      const videoDuration = audioDurationSec <= 5 ? 5 : 10;
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
        throw new Error(`Kling animation failed for clip ${clipNumber}`);
      }

      const klingPrediction = await klingResponse.json();
      console.log(`[AvatarDirect] Clip ${clipNumber}: Kling started: ${klingPrediction.id}`);

      // Poll for completion
      let clipVideoUrl: string | null = klingPrediction.status === "succeeded" && klingPrediction.output
        ? klingPrediction.output
        : await pollForResult(klingPrediction.id, REPLICATE_API_KEY, 300);

      if (!clipVideoUrl) {
        throw new Error(`Video generation timed out for clip ${clipNumber}`);
      }

      console.log(`[AvatarDirect] Clip ${clipNumber}: ✅ Video generated`);

      // Merge audio
      let finalClipVideoUrl = clipVideoUrl;
      try {
        const mergedUrl = await mergeAudioWithVideo(clipVideoUrl, clipAudioUrl, REPLICATE_API_KEY);
        if (mergedUrl) {
          finalClipVideoUrl = mergedUrl;
          console.log(`[AvatarDirect] Clip ${clipNumber}: ✅ Audio merged`);
        }
      } catch {
        console.warn(`[AvatarDirect] Clip ${clipNumber}: Audio merge failed (non-fatal)`);
      }

      // Copy to permanent storage
      if (finalClipVideoUrl.includes('replicate.delivery') && projectId) {
        try {
          const videoResponse = await fetch(finalClipVideoUrl);
          if (videoResponse.ok) {
            const videoBlob = await videoResponse.blob();
            const videoBytes = new Uint8Array(await videoBlob.arrayBuffer());
            
            const fileName = `avatar_${projectId}_clip${clipNumber}_${Date.now()}.mp4`;
            const storagePath = `avatar-videos/${projectId}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('video-clips')
              .upload(storagePath, videoBytes, {
                contentType: 'video/mp4',
                upsert: true,
              });
            
            if (!uploadError) {
              finalClipVideoUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${storagePath}`;
              console.log(`[AvatarDirect] Clip ${clipNumber}: ✅ Saved to storage`);
            }
          }
        } catch (storageError) {
          console.warn(`[AvatarDirect] Clip ${clipNumber}: Storage failed (non-fatal):`, storageError);
        }
      }

      generatedClips.push({
        videoUrl: finalClipVideoUrl,
        audioUrl: clipAudioUrl,
        audioDurationMs: clipAudioDurationMs,
        segmentText,
        clipIndex,
      });

      // Create shot record
      if (projectId) {
        try {
          await supabase.from('shots').insert({
            project_id: projectId,
            shot_number: clipNumber,
            description: segmentText.substring(0, 200),
            dialogue: segmentText,
            video_url: finalClipVideoUrl,
            audio_url: clipAudioUrl,
            status: 'completed',
            scene_number: 1,
            start_time_ms: generatedClips.slice(0, clipIndex).reduce((sum, c) => sum + c.audioDurationMs, 0),
            end_time_ms: generatedClips.slice(0, clipIndex).reduce((sum, c) => sum + c.audioDurationMs, 0) + clipAudioDurationMs,
            duration_seconds: Math.ceil(clipAudioDurationMs / 1000),
          });
        } catch (shotError) {
          console.warn(`[AvatarDirect] Clip ${clipNumber}: Shot record failed:`, shotError);
        }
      }

      console.log(`[AvatarDirect] ═══ Clip ${clipNumber}/${finalClipCount} COMPLETE ═══\n`);
    }

    // Complete
    const primaryVideoUrl = generatedClips[0]?.videoUrl || '';
    const totalDurationMs = generatedClips.reduce((sum, c) => sum + c.audioDurationMs, 0);

    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");
    console.log("[AvatarDirect] ✅ MULTI-CLIP AVATAR PIPELINE v2.2 COMPLETE");
    console.log(`[AvatarDirect] Total clips: ${generatedClips.length}`);
    console.log(`[AvatarDirect] Total duration: ${Math.round(totalDurationMs / 1000)}s`);
    console.log(`[AvatarDirect] Master audio: ${permanentMasterAudioUrl.substring(0, 60)}...`);
    console.log("[AvatarDirect] ═══════════════════════════════════════════════════════════");

    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL: ATOMIC DB WRITE - Must happen BEFORE response to prevent orphaned completions
    // If connection closes after this, the project is still marked complete
    // ═══════════════════════════════════════════════════════════════════════════
    if (projectId) {
      const completionData = {
        status: 'completed',
        video_url: primaryVideoUrl,
        final_video_url: primaryVideoUrl,
        voice_audio_url: permanentMasterAudioUrl,
        video_clips: generatedClips.map(c => c.videoUrl),
        pipeline_stage: 'completed',
        pipeline_state: {
          stage: 'completed',
          progress: 100,
          message: `${generatedClips.length} clip${generatedClips.length > 1 ? 's' : ''} generated with continuous audio!`,
          completedAt: new Date().toISOString(),
          voiceUsed: minimaxVoice,
          sceneApplied: !!sceneDescription,
          totalClips: generatedClips.length,
          totalDurationMs,
          masterAudioUrl: permanentMasterAudioUrl,
          masterAudioDurationMs: masterAudioDurationMs,
          clips: generatedClips.map((c, idx) => ({
            videoUrl: c.videoUrl,
            audioUrl: c.audioUrl,
            durationMs: c.audioDurationMs,
            startTimeMs: generatedClips.slice(0, idx).reduce((sum, prev) => sum + prev.audioDurationMs, 0),
          })),
        },
        updated_at: new Date().toISOString(),
      };
      
      // Retry DB write up to 3 times to ensure completion is persisted
      let dbWriteSuccess = false;
      for (let attempt = 1; attempt <= 3 && !dbWriteSuccess; attempt++) {
        try {
          const { error: updateError } = await supabase
            .from('movie_projects')
            .update(completionData)
            .eq('id', projectId);
          
          if (updateError) {
            console.error(`[AvatarDirect] DB write attempt ${attempt}/3 failed:`, updateError.message);
            if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
          } else {
            dbWriteSuccess = true;
            console.log(`[AvatarDirect] ✅ DB WRITE SUCCESS (attempt ${attempt})`);
          }
        } catch (dbError) {
          console.error(`[AvatarDirect] DB write attempt ${attempt}/3 exception:`, dbError);
          if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
        }
      }
      
      if (!dbWriteSuccess) {
        console.error("[AvatarDirect] ⚠️ CRITICAL: All DB write attempts failed - watchdog will recover");
        // Write orphan marker to storage for watchdog detection
        try {
          const orphanMarker = JSON.stringify({
            projectId,
            videoUrl: primaryVideoUrl,
            audioUrl: permanentMasterAudioUrl,
            completedAt: new Date().toISOString(),
            clips: generatedClips.map(c => c.videoUrl),
          });
          await supabase.storage
            .from('video-clips')
            .upload(`avatar-videos/${projectId}/_completion_marker.json`, orphanMarker, {
              contentType: 'application/json',
              upsert: true,
            });
          console.log("[AvatarDirect] Orphan marker written - watchdog will recover");
        } catch (markerError) {
          console.error("[AvatarDirect] Failed to write orphan marker:", markerError);
        }
      }
    }

    // Response is now safe - DB is updated (or orphan marker exists for recovery)
    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: primaryVideoUrl,
        audioUrl: permanentMasterAudioUrl,
        masterAudioUrl: permanentMasterAudioUrl,
        totalDurationMs,
        voiceUsed: minimaxVoice,
        sceneApplied: !!sceneDescription,
        scriptUsed: script,
        clipsGenerated: generatedClips.length,
        clips: generatedClips.map((c, idx) => ({
          videoUrl: c.videoUrl,
          audioUrl: c.audioUrl,
          durationMs: c.audioDurationMs,
          startTimeMs: generatedClips.slice(0, idx).reduce((sum, prev) => sum + prev.audioDurationMs, 0),
        })),
        message: `${generatedClips.length} avatar clip${generatedClips.length > 1 ? 's' : ''} generated with continuous audio!`,
        pipeline: "avatar-direct-v2.3-atomic-completion",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AvatarDirect] Error:", error);
    
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
 * Split script into segments for multi-clip generation
 * CRITICAL: Always returns EXACTLY targetCount segments, even for short scripts
 * If script has fewer sentences than targetCount, distribute sentences evenly
 */
function splitScriptIntoSegments(script: string, targetCount: number): string[] {
  if (targetCount <= 1) return [script];
  
  // Split by sentences (including last segment without punctuation)
  const sentences = script.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [script];
  const cleanSentences = sentences.map(s => s.trim()).filter(s => s.length > 0);
  
  // If no valid sentences, return the whole script as targetCount segments
  if (cleanSentences.length === 0) {
    return Array(targetCount).fill(script);
  }
  
  // If we have enough sentences, distribute them
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
    
    // Ensure we have exactly targetCount segments
    while (segments.length < targetCount) {
      segments.push(cleanSentences[cleanSentences.length - 1]);
    }
    
    return segments;
  }
  
  // IMPORTANT: If script has fewer sentences than targetCount,
  // distribute sentences across clips (some clips may share content)
  // This ensures user gets the number of clips they requested
  const segments: string[] = [];
  
  for (let i = 0; i < targetCount; i++) {
    // Distribute sentences round-robin style
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

async function pollForResult(predictionId: string, apiKey: string, maxSeconds: number): Promise<string | null> {
  for (let i = 0; i < maxSeconds; i++) {
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
  
  return null;
}

async function mergeAudioWithVideo(videoUrl: string, audioUrl: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Prefer": "wait=120",
      },
      body: JSON.stringify({
        version: "684cc0e6bff2f0d3b748d7c386ab8a6fb7c5f6d2095a3a38d68d9d6a3a2cb2f6",
        input: {
          video: videoUrl,
          audio: audioUrl,
          audio_volume: 1.0,
          video_volume: 0.0,
        },
      }),
    });

    if (!response.ok) return null;

    const prediction = await response.json();
    
    if (prediction.status === "succeeded" && prediction.output) {
      return prediction.output;
    }
    
    return await pollForResult(prediction.id, apiKey, 60);
  } catch {
    return null;
  }
}

function estimateDuration(text: string): number {
  const words = text.length / 5;
  const minutes = words / 150;
  return Math.round(minutes * 60 * 1000);
}
