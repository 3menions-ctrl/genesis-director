import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Simple Stitch Edge Function v6 - FIXED CHUNKED PROCESSING
 * 
 * Uses the correct Cloud Run endpoints:
 * - /stitch-chunk for processing individual chunks
 * - /merge-chunks for combining chunks with audio
 * - /stitch for direct (non-chunked) processing
 * 
 * Creates stitch_jobs for tracking and supports retry_scheduled recovery
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SimpleStitchRequest {
  projectId: string;
  userId?: string;
  forceManifest?: boolean;
  forceChunked?: boolean;
  jobId?: string; // Resume existing job
}

interface ClipData {
  shotId: string;
  videoUrl: string;
  durationSeconds: number;
}

// Chunked stitching config
const CHUNK_SIZE = 10;
const MAX_DIRECT_STITCH_CLIPS = 15;

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { projectId, forceManifest, forceChunked, jobId } = await req.json() as SimpleStitchRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[SimpleStitch] Starting stitch for project: ${projectId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Load all completed clips
    console.log("[SimpleStitch] Step 1: Loading completed clips...");
    
    const { data: clips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, video_url, duration_seconds')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('shot_index');

    if (clipsError) {
      throw new Error(`Failed to load clips: ${clipsError.message}`);
    }

    if (!clips || clips.length === 0) {
      throw new Error("No completed clips found for this project");
    }

    console.log(`[SimpleStitch] Found ${clips.length} completed clips`);

    // Get project details including narration preference
    const { data: project } = await supabase
      .from('movie_projects')
      .select('title, voice_audio_url, music_url, user_id, stitch_attempts, include_narration')
      .eq('id', projectId)
      .single();

    // Check user tier for chunked stitching support
    let useChunkedStitching = forceChunked || false;
    let userTier = 'free';
    
    if (project?.user_id && clips.length > MAX_DIRECT_STITCH_CLIPS) {
      try {
        const { data: tierData } = await supabase.rpc('get_user_tier_limits', { 
          p_user_id: project.user_id 
        });
        
        if (tierData?.chunked_stitching) {
          useChunkedStitching = true;
          userTier = tierData.tier || 'free';
          console.log(`[SimpleStitch] User tier (${userTier}) supports chunked stitching`);
        }
      } catch (err) {
        console.warn(`[SimpleStitch] Failed to fetch tier limits:`, err);
      }
    }

    // Prepare clip data
    const clipData: ClipData[] = clips.map((clip: { id: string; video_url: string; duration_seconds: number }) => ({
      shotId: clip.id,
      videoUrl: clip.video_url,
      durationSeconds: clip.duration_seconds || 6,
    }));

    const totalDuration = clipData.reduce((sum, c) => sum + c.durationSeconds, 0);

    // Check for Cloud Run
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    // CRITICAL: Only use Google Cloud Run for stitching - no manifest fallbacks
    if (!cloudRunUrl) {
      console.error("[SimpleStitch] CLOUD_RUN_STITCHER_URL not configured - cannot stitch");
      
      // Update project to show Cloud Run is required
      await supabase
        .from('movie_projects')
        .update({
          status: 'stitching_blocked',
          pending_video_tasks: {
            stage: 'stitching_blocked',
            progress: 0,
            error: 'Cloud Run stitcher not configured. Please configure CLOUD_RUN_STITCHER_URL.',
            clipCount: clips.length,
            totalDuration,
          },
          last_error: 'CLOUD_RUN_STITCHER_URL not configured',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: "Cloud Run stitcher not configured. Only Google Cloud Run is supported for video stitching.",
          processingTimeMs: Date.now() - startTime,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // forceManifest is deprecated - Cloud Run only
    if (forceManifest) {
      console.warn("[SimpleStitch] forceManifest=true ignored - Cloud Run only mode enabled");
    }

    // Determine stitching mode
    const isChunked = useChunkedStitching && clips.length > CHUNK_SIZE;
    const chunkCount = isChunked ? Math.ceil(clips.length / CHUNK_SIZE) : 1;
    const mode = isChunked ? 'chunked' : 'direct';
    
    // Create or update stitch job
    const stitchAttempts = (project?.stitch_attempts || 0) + 1;
    
    const { data: stitchJob, error: jobError } = await supabase
      .from('stitch_jobs')
      .upsert({
        project_id: projectId,
        user_id: project?.user_id,
        status: 'pending',
        total_clips: clips.length,
        total_chunks: isChunked ? chunkCount : 1,
        completed_chunks: 0,
        chunk_urls: [],
        attempt_number: stitchAttempts,
        mode,
        progress: 5,
        current_step: 'initializing',
        started_at: new Date().toISOString(),
      }, { onConflict: 'project_id' })
      .select()
      .single();

    if (jobError) {
      console.warn(`[SimpleStitch] Failed to create stitch job:`, jobError);
    }

    // Update project status
    await supabase
      .from('movie_projects')
      .update({
        status: 'stitching',
        stitch_attempts: stitchAttempts,
        pending_video_tasks: {
          stage: 'stitching',
          progress: 10,
          mode: isChunked ? 'chunked_cloud_run' : 'cloud_run_background',
          clipCount: clips.length,
          chunkCount: isChunked ? chunkCount : undefined,
          totalDuration,
          stitchingStarted: new Date().toISOString(),
          jobId: stitchJob?.id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(`[SimpleStitch] Mode: ${mode.toUpperCase()} (${clips.length} clips, ${chunkCount} chunk(s))`);

    // Audio config - RESPECT include_narration flag
    const includeNarration = project?.include_narration !== false; // Default to true if not set
    const hasVoice = includeNarration && !!project?.voice_audio_url;
    const hasMusic = !!project?.music_url;
    
    console.log(`[SimpleStitch] Audio: include_narration=${includeNarration}, hasVoice=${hasVoice}, hasMusic=${hasMusic}`);
    
    // Background processing
    const backgroundProcess = async () => {
      const bgSupabase = createClient(supabaseUrl, supabaseKey);
      
      const updateJobProgress = async (status: string, progress: number, step: string, extra?: Record<string, unknown>) => {
        if (stitchJob?.id) {
          await bgSupabase
            .from('stitch_jobs')
            .update({
              status,
              progress,
              current_step: step,
              ...extra,
              updated_at: new Date().toISOString(),
            })
            .eq('id', stitchJob.id);
        }
        
        await bgSupabase
          .from('movie_projects')
          .update({
            pending_video_tasks: {
              stage: 'stitching',
              progress,
              mode: isChunked ? 'chunked_cloud_run' : 'cloud_run_background',
              currentStep: step,
              clipCount: clips.length,
              totalDuration,
              ...extra,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);
      };
      
      try {
        if (isChunked) {
          // ============ CHUNKED STITCHING ============
          console.log(`[SimpleStitch-BG] CHUNKED: ${chunkCount} chunks of up to ${CHUNK_SIZE} clips`);
          
          await updateJobProgress('chunking', 15, 'Processing chunks');
          
          const chunkResults: string[] = [];
          
          for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
            const startIdx = chunkIdx * CHUNK_SIZE;
            const endIdx = Math.min(startIdx + CHUNK_SIZE, clipData.length);
            const chunkClips = clipData.slice(startIdx, endIdx);
            
            console.log(`[SimpleStitch-BG] Chunk ${chunkIdx + 1}/${chunkCount}: clips ${startIdx + 1}-${endIdx}`);
            
            const chunkProgress = 15 + Math.floor((chunkIdx / chunkCount) * 60);
            await updateJobProgress('chunking', chunkProgress, `Processing chunk ${chunkIdx + 1}/${chunkCount}`);
            
            // Call the NEW /stitch-chunk endpoint
            const chunkRequest = {
              projectId,
              chunkIndex: chunkIdx,
              totalChunks: chunkCount,
              clips: chunkClips.map(c => ({
                shotId: c.shotId,
                videoUrl: c.videoUrl,
                durationSeconds: c.durationSeconds,
              })),
              transitionType: 'dissolve',
              transitionDuration: 0.15,
              colorGrading: 'cinematic',
              supabaseUrl: Deno.env.get("EXTERNAL_SUPABASE_URL") || supabaseUrl,
              supabaseServiceKey: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || supabaseKey,
              callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
              callbackServiceKey: supabaseKey,
            };
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min per chunk
            
            try {
              const response = await fetch(`${cloudRunUrl}/stitch-chunk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunkRequest),
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const result = await response.json();
                if (result.success && result.chunkVideoUrl) {
                  chunkResults.push(result.chunkVideoUrl);
                  
                  // Update job with chunk URL
                  if (stitchJob?.id) {
                    await bgSupabase
                      .from('stitch_jobs')
                      .update({
                        completed_chunks: chunkIdx + 1,
                        chunk_urls: chunkResults,
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', stitchJob.id);
                  }
                  
                  console.log(`[SimpleStitch-BG] ✓ Chunk ${chunkIdx + 1} complete`);
                } else {
                  throw new Error(`Chunk ${chunkIdx + 1} returned no video URL`);
                }
              } else {
                const errorText = await response.text();
                throw new Error(`Chunk ${chunkIdx + 1} failed: ${response.status} - ${errorText.substring(0, 100)}`);
              }
            } catch (chunkError) {
              clearTimeout(timeoutId);
              console.error(`[SimpleStitch-BG] Chunk ${chunkIdx + 1} error:`, chunkError);
              
              // Schedule retry or fallback
              await scheduleRetryOrFallback(bgSupabase, supabaseUrl, supabaseKey, projectId, stitchJob?.id, 
                `Chunk ${chunkIdx + 1} failed: ${chunkError instanceof Error ? chunkError.message : 'Unknown'}`,
                project, clipData, clips.length, totalDuration);
              return;
            }
          }
          
          // All chunks complete - merge with audio
          console.log(`[SimpleStitch-BG] All ${chunkCount} chunks complete. Merging with audio...`);
          await updateJobProgress('merging', 80, 'Merging chunks with audio');
          
          // Call the NEW /merge-chunks endpoint
          const mergeRequest = {
            projectId,
            chunkUrls: chunkResults,
            // RESPECT include_narration: only include voice if hasVoice is true
            voiceTrackUrl: hasVoice ? project?.voice_audio_url : null,
            backgroundMusicUrl: project?.music_url || null,
            audioMixParams: {
              musicVolume: hasVoice ? 0.3 : 0.8,
              fadeIn: 1,
              fadeOut: 2,
            },
            transitionType: 'dissolve',
            transitionDuration: 0.15,
            supabaseUrl: Deno.env.get("EXTERNAL_SUPABASE_URL") || supabaseUrl,
            supabaseServiceKey: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || supabaseKey,
            callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
            callbackServiceKey: supabaseKey,
          };
          
          const mergeController = new AbortController();
          const mergeTimeoutId = setTimeout(() => mergeController.abort(), 300000); // 5 min for merge
          
          try {
            const mergeResponse = await fetch(`${cloudRunUrl}/merge-chunks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mergeRequest),
              signal: mergeController.signal,
            });
            
            clearTimeout(mergeTimeoutId);
            
            if (mergeResponse.ok) {
              const mergeResult = await mergeResponse.json();
              if (mergeResult.success && mergeResult.finalVideoUrl) {
                // Success! Update everything
                await completeStitch(bgSupabase, projectId, stitchJob?.id, mergeResult.finalVideoUrl, 
                  mergeResult.durationSeconds || totalDuration, clips.length, chunkCount, 'chunked');
                console.log(`[SimpleStitch-BG] ✅ CHUNKED STITCH COMPLETE`);
                return;
              }
            }
            
            throw new Error('Merge step failed');
          } catch (mergeError) {
            clearTimeout(mergeTimeoutId);
            console.error(`[SimpleStitch-BG] Merge error:`, mergeError);
            await scheduleRetryOrFallback(bgSupabase, supabaseUrl, supabaseKey, projectId, stitchJob?.id,
              `Merge failed: ${mergeError instanceof Error ? mergeError.message : 'Unknown'}`,
              project, clipData, clips.length, totalDuration);
          }
          
        } else {
          // ============ DIRECT STITCHING ============
          console.log("[SimpleStitch-BG] DIRECT Cloud Run stitch...");
          await updateJobProgress('chunking', 20, 'Processing video');
          
          const stitchRequest = {
            projectId,
            projectTitle: project?.title || 'Video',
            clips: clipData.map(c => ({
              shotId: c.shotId,
              videoUrl: c.videoUrl,
              durationSeconds: c.durationSeconds,
              transitionOut: 'fade',
            })),
            audioMixMode: hasVoice ? 'voice_over' : (hasMusic ? 'background_music' : 'mute'),
            // RESPECT include_narration: only include voice if hasVoice is true
            voiceTrackUrl: hasVoice ? project?.voice_audio_url : null,
            backgroundMusicUrl: project?.music_url || null,
            voiceVolume: 1.0,
            musicVolume: hasVoice ? 0.3 : 0.8,
            transitionType: 'dissolve',
            transitionDuration: 0.15,
            colorGrading: 'cinematic',
            callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
            callbackServiceKey: supabaseKey,
            supabaseUrl: Deno.env.get("EXTERNAL_SUPABASE_URL") || supabaseUrl,
            supabaseServiceKey: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || supabaseKey,
          };
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min
          
          const response = await fetch(`${cloudRunUrl}/stitch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stitchRequest),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.finalVideoUrl) {
              await completeStitch(bgSupabase, projectId, stitchJob?.id, result.finalVideoUrl,
                result.durationSeconds || totalDuration, clips.length, 1, 'direct');
              console.log(`[SimpleStitch-BG] ✅ DIRECT STITCH COMPLETE`);
            } else {
              // No manifest fallback - retry with Cloud Run
              console.error(`[SimpleStitch-BG] Cloud Run returned incomplete result - scheduling retry`);
              await scheduleRetryOrFallback(bgSupabase, supabaseUrl, supabaseKey, projectId, stitchJob?.id,
                'Cloud Run returned incomplete result (no finalVideoUrl)',
                project, clipData, clips.length, totalDuration);
            }
          } else {
            const errorText = await response.text();
            console.error(`[SimpleStitch-BG] Cloud Run error: ${response.status} - ${errorText.substring(0, 200)}`);
            await scheduleRetryOrFallback(bgSupabase, supabaseUrl, supabaseKey, projectId, stitchJob?.id,
              `Cloud Run failed: ${response.status} - ${errorText.substring(0, 100)}`,
              project, clipData, clips.length, totalDuration);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SimpleStitch-BG] Cloud Run error:`, errorMessage);
        await scheduleRetryOrFallback(bgSupabase, supabaseUrl, supabaseKey, projectId, stitchJob?.id,
          errorMessage, project, clipData, clips.length, totalDuration);
      }
    };

    EdgeRuntime.waitUntil(backgroundProcess());

    console.log("[SimpleStitch] Returning - processing in background");

    return new Response(
      JSON.stringify({
        success: true,
        mode: isChunked ? 'chunked_cloud_run' : 'cloud_run_background',
        status: 'stitching',
        jobId: stitchJob?.id,
        message: isChunked 
          ? `Chunked stitching: ${chunkCount} chunks of ${CHUNK_SIZE} clips`
          : 'Direct stitching started',
        clipsProcessed: clips.length,
        chunkCount: isChunked ? chunkCount : undefined,
        totalDuration,
        processingTimeMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SimpleStitch] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Simple stitch failed",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Complete stitch successfully
// deno-lint-ignore no-explicit-any
async function completeStitch(
  supabase: any,
  projectId: string,
  jobId: string | undefined,
  videoUrl: string,
  duration: number,
  clipCount: number,
  chunkCount: number,
  mode: string
) {
  if (jobId) {
    await supabase
      .from('stitch_jobs')
      .update({
        status: 'completed',
        progress: 100,
        current_step: 'complete',
        final_video_url: videoUrl,
        final_duration_seconds: duration,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
  
  await supabase
    .from('movie_projects')
    .update({
      status: 'completed',
      video_url: videoUrl,
      pending_video_tasks: {
        stage: 'complete',
        progress: 100,
        mode: `${mode}_stitched`,
        finalVideoUrl: videoUrl,
        clipCount,
        chunkCount,
        totalDuration: duration,
        completedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);
}

// Schedule retry or fall back to manifest
// deno-lint-ignore no-explicit-any
async function scheduleRetryOrFallback(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string,
  jobId: string | undefined,
  errorMessage: string,
  project: { title?: string; voice_audio_url?: string; music_url?: string; stitch_attempts?: number } | null,
  clipData: ClipData[],
  clipCount: number,
  totalDuration: number
) {
  const attempts = project?.stitch_attempts || 1;
  const maxAttempts = 3;
  
  if (attempts < maxAttempts) {
    // Schedule retry with Cloud Run
    const retryDelay = [30, 60, 120][Math.min(attempts - 1, 2)] * 1000;
    const retryAfter = new Date(Date.now() + retryDelay).toISOString();
    
    console.log(`[SimpleStitch] Scheduling Cloud Run retry ${attempts + 1}/${maxAttempts} after ${retryDelay / 1000}s`);
    
    if (jobId) {
      await supabase
        .from('stitch_jobs')
        .update({
          status: 'retry_scheduled',
          last_error: errorMessage,
          retry_after: retryAfter,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
    
    await supabase
      .from('movie_projects')
      .update({
        status: 'retry_scheduled',
        pending_video_tasks: {
          stage: 'retry_scheduled',
          retryAttempt: attempts + 1,
          retryAfter,
          lastError: errorMessage,
          clipCount,
          totalDuration,
          mode: 'cloud_run_retry',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
  } else {
    // Max retries reached - mark as failed (no manifest fallback)
    console.error(`[SimpleStitch] Max Cloud Run retries (${maxAttempts}) reached - stitching failed`);
    
    if (jobId) {
      await supabase
        .from('stitch_jobs')
        .update({
          status: 'failed',
          last_error: `Max retries reached: ${errorMessage}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
    
    await supabase
      .from('movie_projects')
      .update({
        status: 'stitching_failed',
        pending_video_tasks: {
          stage: 'stitching_failed',
          progress: 0,
          lastError: errorMessage,
          attempts: maxAttempts,
          clipCount,
          totalDuration,
          message: 'Cloud Run stitching failed after maximum retries. Please retry manually.',
        },
        last_error: `Stitching failed after ${maxAttempts} attempts: ${errorMessage}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
  }
}

// Fallback to manifest
async function fallbackToManifest(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string,
  project: { title?: string; voice_audio_url?: string; music_url?: string } | null,
  clipData: ClipData[],
  clipCount: number,
  totalDuration: number
) {
  console.log("[SimpleStitch] Creating manifest fallback...");
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const manifest = {
    version: "1.0",
    projectId,
    mode: "client_side_concat",
    createdAt: new Date().toISOString(),
    source: "stitch_fallback",
    clips: clipData.map((clip, index) => ({
      index,
      shotId: clip.shotId,
      videoUrl: clip.videoUrl,
      duration: clip.durationSeconds,
      startTime: clipData.slice(0, index).reduce((sum, c) => sum + c.durationSeconds, 0),
    })),
    totalDuration,
    voiceUrl: project?.voice_audio_url || null,
    musicUrl: project?.music_url || null,
  };

  const fileName = `manifest_${projectId}_${Date.now()}.json`;
  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBytes = new TextEncoder().encode(manifestJson);

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
        clipCount,
        totalDuration,
        note: 'Using manifest playback (Cloud Run unavailable)',
        completedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  console.log(`[SimpleStitch] ✅ Manifest created: ${manifestUrl}`);
}

// Helper for immediate manifest creation
async function createManifestFallback(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string,
  project: { title?: string; voice_audio_url?: string; music_url?: string } | null,
  clipData: ClipData[],
  clipCount: number,
  totalDuration: number,
  startTime: number
) {
  await fallbackToManifest(supabaseUrl, supabaseKey, projectId, project, clipData, clipCount, totalDuration);
  
  const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/manifest_${projectId}_${Date.now()}.json`;
  
  return new Response(
    JSON.stringify({
      success: true,
      mode: 'manifest_playback',
      finalVideoUrl: manifestUrl,
      clipsProcessed: clipCount,
      totalDuration,
      processingTimeMs: Date.now() - startTime,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
