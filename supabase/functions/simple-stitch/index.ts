import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Simple Stitch Edge Function
 * 
 * A reliable, no-frills video stitcher that:
 * 1. Skips ALL AI analysis (no vision API calls)
 * 2. Goes directly to Cloud Run FFmpeg
 * 3. Has aggressive timeouts and clear error handling
 * 4. Always calls back to finalize-stitch
 * 
 * Use this when the intelligent pipeline fails.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SimpleStitchRequest {
  projectId: string;
  userId: string;
}

interface ClipData {
  shotId: string;
  videoUrl: string;
  durationSeconds: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { projectId, userId } = await req.json() as SimpleStitchRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[SimpleStitch] Starting for project: ${projectId}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Load all completed clips from database
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

    // Step 2: Get project details
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('title, voice_audio_url, music_url')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.warn(`[SimpleStitch] Could not load project details: ${projectError.message}`);
    }

    const projectTitle = project?.title || 'Untitled Video';

    // Step 3: Prepare clip data
    const clipData: ClipData[] = clips.map(clip => ({
      shotId: clip.id,
      videoUrl: clip.video_url,
      durationSeconds: clip.duration_seconds || 4,
    }));

    // Step 4: Update project status
    await supabase
      .from('movie_projects')
      .update({
        status: 'stitching',
        pending_video_tasks: {
          stage: 'simple_stitch',
          progress: 10,
          mode: 'simple',
          clipsToProcess: clips.length,
          startedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    // Step 5: Check Cloud Run availability
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (!cloudRunUrl) {
      // Fallback: Create manifest for client-side playback
      console.log("[SimpleStitch] No Cloud Run URL, creating manifest fallback...");
      
      const manifest = {
        version: "1.0",
        projectId,
        mode: "simple_concat",
        createdAt: new Date().toISOString(),
        clips: clipData.map((clip, index) => ({
          index,
          shotId: clip.shotId,
          videoUrl: clip.videoUrl,
          duration: clip.durationSeconds,
          startTime: clipData.slice(0, index).reduce((sum, c) => sum + c.durationSeconds, 0),
        })),
        totalDuration: clipData.reduce((sum, c) => sum + c.durationSeconds, 0),
      };

      const fileName = `simple_manifest_${projectId}_${Date.now()}.json`;
      const manifestJson = JSON.stringify(manifest, null, 2);
      const bytes = new TextEncoder().encode(manifestJson);

      await supabase.storage
        .from('temp-frames')
        .upload(fileName, bytes, { contentType: 'application/json', upsert: true });

      const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;

      await supabase
        .from('movie_projects')
        .update({
          status: 'completed',
          video_url: manifestUrl,
          pending_video_tasks: {
            stage: 'complete',
            progress: 100,
            mode: 'manifest_fallback',
            completedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'manifest_fallback',
          finalVideoUrl: manifestUrl,
          clipsProcessed: clips.length,
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 6: Health check Cloud Run with longer timeout
    console.log("[SimpleStitch] Step 2: Checking Cloud Run health...");
    
    let cloudRunHealthy = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s for cold start
      
      const healthResponse = await fetch(cloudRunUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        cloudRunHealthy = healthData.status === 'healthy';
        console.log(`[SimpleStitch] Cloud Run health: ${cloudRunHealthy ? 'OK' : 'UNHEALTHY'}`);
      }
    } catch (err) {
      console.error(`[SimpleStitch] Cloud Run health check failed: ${err}`);
    }

    if (!cloudRunHealthy) {
      // Fallback to manifest
      console.log("[SimpleStitch] Cloud Run unavailable, using manifest fallback...");
      
      const manifest = {
        version: "1.0",
        projectId,
        mode: "cloud_run_unavailable",
        createdAt: new Date().toISOString(),
        clips: clipData.map((clip, index) => ({
          index,
          shotId: clip.shotId,
          videoUrl: clip.videoUrl,
          duration: clip.durationSeconds,
          startTime: clipData.slice(0, index).reduce((sum, c) => sum + c.durationSeconds, 0),
        })),
        totalDuration: clipData.reduce((sum, c) => sum + c.durationSeconds, 0),
      };

      const fileName = `simple_manifest_${projectId}_${Date.now()}.json`;
      const manifestJson = JSON.stringify(manifest, null, 2);
      const bytes = new TextEncoder().encode(manifestJson);

      await supabase.storage
        .from('temp-frames')
        .upload(fileName, bytes, { contentType: 'application/json', upsert: true });

      const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;

      await supabase
        .from('movie_projects')
        .update({
          status: 'completed',
          video_url: manifestUrl,
          pending_video_tasks: {
            stage: 'complete',
            progress: 100,
            mode: 'manifest_fallback',
            reason: 'Cloud Run unavailable',
            completedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'manifest_fallback',
          reason: 'Cloud Run unavailable',
          finalVideoUrl: manifestUrl,
          clipsProcessed: clips.length,
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 7: Call Cloud Run directly
    console.log("[SimpleStitch] Step 3: Dispatching to Cloud Run...");
    
    // CRITICAL: Use the correct Supabase URLs
    // - Edge functions live on Lovable Cloud (SUPABASE_URL)
    // - Storage may be on external Supabase
    const lovableCloudUrl = supabaseUrl; // This is where finalize-stitch lives
    const externalSupabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalSupabaseKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
    
    // For storage operations, use external if configured
    const storageSupabaseUrl = externalSupabaseUrl || supabaseUrl;
    const storageSupabaseKey = externalSupabaseKey || supabaseKey;
    
    console.log(`[SimpleStitch] Callback URL: ${lovableCloudUrl}/functions/v1/finalize-stitch`);
    console.log(`[SimpleStitch] Storage URL: ${storageSupabaseUrl}`);

    const stitchRequest = {
      projectId,
      projectTitle,
      clips: clipData,
      audioMixMode: 'mute',
      transitionType: 'fade',
      transitionDuration: 0.3,
      colorGrading: 'cinematic',
      // CRITICAL: Callback must go to Lovable Cloud where edge functions live
      callbackUrl: `${lovableCloudUrl}/functions/v1/finalize-stitch`,
      // Storage operations use external Supabase if configured
      supabaseUrl: storageSupabaseUrl,
      supabaseServiceKey: storageSupabaseKey,
    };

    // Update progress
    await supabase
      .from('movie_projects')
      .update({
        pending_video_tasks: {
          stage: 'stitching',
          progress: 25,
          mode: 'simple_cloud_run',
          clipsToProcess: clips.length,
          dispatchedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    // Fire and wait for response (with timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout
    
    try {
      const stitchResponse = await fetch(`${cloudRunUrl}/stitch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stitchRequest),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!stitchResponse.ok) {
        const errorText = await stitchResponse.text();
        throw new Error(`Cloud Run returned ${stitchResponse.status}: ${errorText}`);
      }
      
      const stitchResult = await stitchResponse.json();
      console.log(`[SimpleStitch] Cloud Run response:`, stitchResult);
      
      if (stitchResult.success && stitchResult.finalVideoUrl) {
        // Cloud Run completed synchronously
        await supabase
          .from('movie_projects')
          .update({
            status: 'completed',
            video_url: stitchResult.finalVideoUrl,
            pending_video_tasks: {
              stage: 'complete',
              progress: 100,
              mode: 'simple_cloud_run',
              finalVideoUrl: stitchResult.finalVideoUrl,
              completedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);

        return new Response(
          JSON.stringify({
            success: true,
            mode: 'simple_cloud_run',
            finalVideoUrl: stitchResult.finalVideoUrl,
            clipsProcessed: clips.length,
            processingTimeMs: Date.now() - startTime,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Cloud Run accepted but processing async
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'simple_cloud_run_async',
          message: 'Cloud Run processing, will callback when complete',
          clipsProcessed: clips.length,
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      console.error(`[SimpleStitch] Cloud Run fetch failed: ${errorMessage}`);
      
      // If it's a timeout, Cloud Run might still complete
      if (errorMessage.includes('abort')) {
        return new Response(
          JSON.stringify({
            success: true,
            mode: 'simple_cloud_run_timeout',
            message: 'Request timed out but Cloud Run may still complete. Check back in a few minutes.',
            clipsProcessed: clips.length,
            processingTimeMs: Date.now() - startTime,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw fetchError;
    }

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
