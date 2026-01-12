import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Simple Stitch Edge Function v5 - CHUNKED PROCESSING FOR 2-MIN VIDEOS
 * 
 * STRATEGY: Chunk-based stitching for Growth/Agency tiers (up to 30 clips)
 * 1. Detect if chunked stitching is needed (>10 clips AND tier supports it)
 * 2. Stitch clips in batches of 10
 * 3. Merge batch outputs into final video
 * 4. Fallback to manifest if any step fails
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SimpleStitchRequest {
  projectId: string;
  userId?: string;
  forceManifest?: boolean; // Skip Cloud Run and use manifest playback directly
  forceChunked?: boolean; // Force chunked processing even for small clip counts
}

interface ClipData {
  shotId: string;
  videoUrl: string;
  durationSeconds: number;
}

// Chunked stitching config
const CHUNK_SIZE = 10; // Stitch 10 clips per batch
const MAX_DIRECT_STITCH_CLIPS = 15; // Below this, use single stitch call

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { projectId, forceManifest, forceChunked } = await req.json() as SimpleStitchRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[SimpleStitch] Starting stitch for project: ${projectId}`);

    // Initialize Supabase
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

    // Get project details including user's tier
    const { data: project } = await supabase
      .from('movie_projects')
      .select('title, voice_audio_url, music_url, user_id')
      .eq('id', projectId)
      .single();

    // Check user tier for chunked stitching support
    let useChunkedStitching = forceChunked || false;
    if (project?.user_id && clips.length > MAX_DIRECT_STITCH_CLIPS) {
      try {
        const { data: tierData } = await supabase.rpc('get_user_tier_limits', { 
          p_user_id: project.user_id 
        });
        
        if (tierData?.chunked_stitching) {
          useChunkedStitching = true;
          console.log(`[SimpleStitch] User tier (${tierData.tier}) supports chunked stitching`);
        } else {
          console.log(`[SimpleStitch] User tier does not support chunked stitching - will use manifest if needed`);
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

    // Check for Cloud Run - or use forceManifest to skip it
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (forceManifest) {
      console.log("[SimpleStitch] forceManifest=true - skipping Cloud Run, using manifest");
      return await createManifestFallback(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration, startTime);
    }
    
    if (!cloudRunUrl) {
      console.warn("[SimpleStitch] CLOUD_RUN_STITCHER_URL not configured - using manifest fallback");
      return await createManifestFallback(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration, startTime);
    }

    // Update project status to stitching
    const isChunked = useChunkedStitching && clips.length > CHUNK_SIZE;
    const chunkCount = isChunked ? Math.ceil(clips.length / CHUNK_SIZE) : 1;
    
    await supabase
      .from('movie_projects')
      .update({
        status: 'stitching',
        pending_video_tasks: {
          stage: 'stitching',
          progress: 50,
          mode: isChunked ? 'chunked_cloud_run' : 'cloud_run_background',
          clipCount: clips.length,
          chunkCount: isChunked ? chunkCount : undefined,
          totalDuration,
          stitchingStarted: new Date().toISOString(),
          expectedCompletionTime: new Date(Date.now() + (isChunked ? 10 : 5) * 60 * 1000).toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(`[SimpleStitch] Stitching mode: ${isChunked ? 'CHUNKED' : 'DIRECT'} (${clips.length} clips, ${chunkCount} chunk(s))`);

    // Determine audio mode based on available tracks
    const hasVoice = !!project?.voice_audio_url;
    const hasMusic = !!project?.music_url;
    const audioMixMode = hasVoice ? 'voice_over' : (hasMusic ? 'background_music' : 'mute');
    
    console.log(`[SimpleStitch] Audio config: voice=${hasVoice}, music=${hasMusic}, mode=${audioMixMode}`);

    // Background task - handles both chunked and direct stitching
    const backgroundProcess = async () => {
      const bgSupabase = createClient(supabaseUrl, supabaseKey);
      
      try {
        if (isChunked) {
          // CHUNKED STITCHING: Process in batches of CHUNK_SIZE
          console.log(`[SimpleStitch-BG] Starting CHUNKED processing: ${chunkCount} chunks of up to ${CHUNK_SIZE} clips`);
          
          const chunkResults: string[] = [];
          
          for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
            const startIdx = chunkIdx * CHUNK_SIZE;
            const endIdx = Math.min(startIdx + CHUNK_SIZE, clipData.length);
            const chunkClips = clipData.slice(startIdx, endIdx);
            
            console.log(`[SimpleStitch-BG] Processing chunk ${chunkIdx + 1}/${chunkCount}: clips ${startIdx + 1}-${endIdx}`);
            
            // Update progress
            const chunkProgress = 50 + Math.floor((chunkIdx / chunkCount) * 40);
            await bgSupabase
              .from('movie_projects')
              .update({
                pending_video_tasks: {
                  stage: 'stitching',
                  progress: chunkProgress,
                  mode: 'chunked_cloud_run',
                  currentChunk: chunkIdx + 1,
                  chunkCount,
                  clipCount: clips.length,
                  totalDuration,
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', projectId);
            
            const chunkRequest = {
              projectId: `${projectId}_chunk_${chunkIdx}`,
              projectTitle: `${project?.title || 'Video'} (Part ${chunkIdx + 1})`,
              clips: chunkClips.map(c => ({
                shotId: c.shotId,
                videoUrl: c.videoUrl,
                durationSeconds: c.durationSeconds,
                transitionOut: 'fade',
              })),
              audioMixMode: 'mute', // Don't add audio to chunks - add in final merge
              transitionType: 'fade',
              transitionDuration: 0.3,
              colorGrading: 'cinematic',
              supabaseUrl: Deno.env.get("EXTERNAL_SUPABASE_URL") || supabaseUrl,
              supabaseServiceKey: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || supabaseKey,
              skipCallback: true, // Don't call finalize for chunks
            };
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min per chunk
            
            try {
              const response = await fetch(`${cloudRunUrl}/stitch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunkRequest),
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const result = await response.json();
                if (result.success && result.finalVideoUrl) {
                  chunkResults.push(result.finalVideoUrl);
                  console.log(`[SimpleStitch-BG] ✓ Chunk ${chunkIdx + 1} complete: ${result.finalVideoUrl.substring(0, 60)}...`);
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
              // Fall back to manifest if any chunk fails
              await fallbackToManifest(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration);
              return;
            }
          }
          
          // All chunks complete - now merge them with audio
          console.log(`[SimpleStitch-BG] All ${chunkCount} chunks complete. Merging final video with audio...`);
          
          await bgSupabase
            .from('movie_projects')
            .update({
              pending_video_tasks: {
                stage: 'stitching',
                progress: 92,
                mode: 'chunked_merging',
                chunkCount,
                totalDuration,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', projectId);
          
          // Merge chunks with audio
          const mergeRequest = {
            projectId,
            projectTitle: project?.title || 'Video',
            clips: chunkResults.map((url, idx) => ({
              shotId: `chunk_${idx}`,
              videoUrl: url,
              durationSeconds: clipData.slice(idx * CHUNK_SIZE, (idx + 1) * CHUNK_SIZE)
                .reduce((sum, c) => sum + c.durationSeconds, 0),
              transitionOut: 'cut', // No transition between chunks (already have fade at boundaries)
            })),
            audioMixMode,
            voiceAudioUrl: project?.voice_audio_url || null,
            musicAudioUrl: project?.music_url || null,
            voiceVolume: 1.0,
            musicVolume: hasVoice ? 0.3 : 0.8,
            transitionType: 'cut',
            transitionDuration: 0,
            colorGrading: 'none', // Already graded in chunks
            callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
            supabaseUrl: Deno.env.get("EXTERNAL_SUPABASE_URL") || supabaseUrl,
            supabaseServiceKey: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || supabaseKey,
          };
          
          const mergeController = new AbortController();
          const mergeTimeoutId = setTimeout(() => mergeController.abort(), 180000);
          
          try {
            const mergeResponse = await fetch(`${cloudRunUrl}/stitch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mergeRequest),
              signal: mergeController.signal,
            });
            
            clearTimeout(mergeTimeoutId);
            
            if (mergeResponse.ok) {
              const mergeResult = await mergeResponse.json();
              if (mergeResult.success && mergeResult.finalVideoUrl) {
                await bgSupabase
                  .from('movie_projects')
                  .update({
                    status: 'completed',
                    video_url: mergeResult.finalVideoUrl,
                    pending_video_tasks: {
                      stage: 'complete',
                      progress: 100,
                      mode: 'chunked_stitched',
                      finalVideoUrl: mergeResult.finalVideoUrl,
                      clipCount: clips.length,
                      chunkCount,
                      totalDuration,
                      stitchedAt: new Date().toISOString(),
                    },
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', projectId);
                
                console.log(`[SimpleStitch-BG] ✅ CHUNKED STITCH COMPLETE: ${mergeResult.finalVideoUrl}`);
                return;
              }
            }
            
            throw new Error('Merge step failed');
          } catch (mergeError) {
            clearTimeout(mergeTimeoutId);
            console.error(`[SimpleStitch-BG] Merge error:`, mergeError);
            await fallbackToManifest(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration);
          }
          
        } else {
          // DIRECT STITCHING: Single Cloud Run call
          console.log("[SimpleStitch-BG] Starting DIRECT Cloud Run stitch...");
          
          const stitchRequest = {
            projectId,
            projectTitle: project?.title || 'Video',
            clips: clipData.map(c => ({
              shotId: c.shotId,
              videoUrl: c.videoUrl,
              durationSeconds: c.durationSeconds,
              transitionOut: 'fade',
            })),
            audioMixMode,
            voiceAudioUrl: project?.voice_audio_url || null,
            musicAudioUrl: project?.music_url || null,
            voiceVolume: 1.0,
            musicVolume: hasVoice ? 0.3 : 0.8,
            transitionType: 'fade',
            transitionDuration: 0.3,
            colorGrading: 'cinematic',
            callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
            supabaseUrl: Deno.env.get("EXTERNAL_SUPABASE_URL") || supabaseUrl,
            supabaseServiceKey: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || supabaseKey,
          };
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
          
          const response = await fetch(`${cloudRunUrl}/stitch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stitchRequest),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const result = await response.json();
            console.log(`[SimpleStitch-BG] Cloud Run success: ${JSON.stringify(result).substring(0, 300)}`);
            
            if (result.success && result.finalVideoUrl) {
              await bgSupabase
                .from('movie_projects')
                .update({
                  status: 'completed',
                  video_url: result.finalVideoUrl,
                  pending_video_tasks: {
                    stage: 'complete',
                    progress: 100,
                    mode: 'cloud_run_stitched',
                    finalVideoUrl: result.finalVideoUrl,
                    clipCount: clips.length,
                    totalDuration,
                    stitchedAt: new Date().toISOString(),
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq('id', projectId);
              
              console.log(`[SimpleStitch-BG] ✅ Project ${projectId} completed with Cloud Run video`);
            } else {
              console.warn(`[SimpleStitch-BG] Cloud Run incomplete result, using fallback`);
              await fallbackToManifest(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration);
            }
          } else {
            const errorText = await response.text();
            console.error(`[SimpleStitch-BG] Cloud Run error (${response.status}): ${errorText.substring(0, 200)}`);
            await fallbackToManifest(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
        console.error(`[SimpleStitch-BG] ${isTimeout ? 'Cloud Run timeout' : 'Background process error'}:`, errorMessage);
        await fallbackToManifest(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration);
      }
    };

    // Use waitUntil for background processing
    EdgeRuntime.waitUntil(backgroundProcess());

    console.log("[SimpleStitch] Returning immediately - processing in background");

    return new Response(
      JSON.stringify({
        success: true,
        mode: isChunked ? 'chunked_cloud_run' : 'cloud_run_background',
        status: 'stitching',
        message: isChunked 
          ? `Chunked stitching started: ${chunkCount} chunks of ${CHUNK_SIZE} clips`
          : 'Cloud Run stitching started in background',
        clipsProcessed: clips.length,
        chunkCount: isChunked ? chunkCount : undefined,
        totalDuration,
        processingTimeMs: Date.now() - startTime,
        note: isChunked ? 'Video will be ready in ~5-10 minutes' : 'Video will be ready in ~2-5 minutes',
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
// Fallback function to create manifest
async function fallbackToManifest(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string,
  project: { title?: string; voice_audio_url?: string; music_url?: string } | null,
  clipData: ClipData[],
  clipCount: number,
  totalDuration: number
) {
  console.log("[SimpleStitch-BG] Creating manifest fallback...");
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const manifest = {
    version: "1.0",
    projectId,
    mode: "client_side_concat",
    createdAt: new Date().toISOString(),
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
        note: 'Cloud Run failed - using manifest playback',
        completedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  console.log(`[SimpleStitch-BG] ✅ Fallback manifest created: ${manifestUrl}`);
}

// Helper for immediate manifest creation (when Cloud Run not configured)
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
  console.log("[SimpleStitch] Creating manifest (no Cloud Run configured)...");
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const manifest = {
    version: "1.0",
    projectId,
    mode: "client_side_concat",
    createdAt: new Date().toISOString(),
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
        completedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

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
