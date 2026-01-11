import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Simple Stitch Edge Function v2
 * 
 * STRATEGY: Manifest-first approach
 * 1. ALWAYS create a manifest immediately for client-side playback
 * 2. Mark project as "completed" right away
 * 3. Optionally try Cloud Run in background (fire-and-forget)
 * 
 * This ensures the user ALWAYS gets a working video, even if Cloud Run fails.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SimpleStitchRequest {
  projectId: string;
  userId?: string;
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
    const { projectId } = await req.json() as SimpleStitchRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[SimpleStitch] Starting for project: ${projectId}`);

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

    // Get project details
    const { data: project } = await supabase
      .from('movie_projects')
      .select('title, voice_audio_url, music_url')
      .eq('id', projectId)
      .single();

    // Prepare clip data
    const clipData: ClipData[] = clips.map(clip => ({
      shotId: clip.id,
      videoUrl: clip.video_url,
      durationSeconds: clip.duration_seconds || 4,
    }));

    // Step 2: Create manifest for IMMEDIATE playback
    console.log("[SimpleStitch] Step 2: Creating manifest for immediate playback...");
    
    const totalDuration = clipData.reduce((sum, c) => sum + c.durationSeconds, 0);
    
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

    const { error: uploadError } = await supabase.storage
      .from('temp-frames')
      .upload(fileName, manifestBytes, { contentType: 'application/json', upsert: true });
    
    if (uploadError) {
      console.error(`[SimpleStitch] Manifest upload failed: ${uploadError.message}`);
      throw new Error(`Manifest upload failed: ${uploadError.message}`);
    }

    const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;
    console.log(`[SimpleStitch] ✅ Manifest created: ${manifestUrl}`);

    // Step 3: Update project as COMPLETED immediately
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
          completedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(`[SimpleStitch] ✅ Project marked complete with manifest`);

    // Step 4: Try Cloud Run in background (optional, fire-and-forget)
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (cloudRunUrl) {
      // Fire-and-forget: Don't wait for Cloud Run
      console.log("[SimpleStitch] Step 4: Dispatching to Cloud Run (background)...");
      
      const stitchRequest = {
        projectId,
        projectTitle: project?.title || 'Video',
        clips: clipData.map(c => ({
          shotId: c.shotId,
          videoUrl: c.videoUrl,
          durationSeconds: c.durationSeconds,
          transitionOut: 'fade',
        })),
        audioMixMode: 'mute',
        transitionType: 'fade',
        transitionDuration: 0.3,
        colorGrading: 'cinematic',
        callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
        supabaseUrl: Deno.env.get("EXTERNAL_SUPABASE_URL") || supabaseUrl,
        supabaseServiceKey: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || supabaseKey,
      };

      // Use waitUntil for background processing (doesn't block response)
      const backgroundTask = async () => {
        try {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 120000); // 2 min timeout
          
          const response = await fetch(`${cloudRunUrl}/stitch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stitchRequest),
            signal: controller.signal,
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`[SimpleStitch] Background: Cloud Run responded: ${JSON.stringify(result).substring(0, 100)}`);
            
            // If Cloud Run returned a real video URL, update the project
            if (result.success && result.finalVideoUrl && !result.finalVideoUrl.includes('manifest')) {
              await supabase
                .from('movie_projects')
                .update({
                  video_url: result.finalVideoUrl,
                  pending_video_tasks: {
                    stage: 'complete',
                    progress: 100,
                    mode: 'cloud_run_stitched',
                    finalVideoUrl: result.finalVideoUrl,
                    manifestUrl,
                    upgradedAt: new Date().toISOString(),
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq('id', projectId);
              console.log(`[SimpleStitch] Background: Upgraded to Cloud Run video!`);
            }
          }
        } catch (err) {
          console.warn(`[SimpleStitch] Background: Cloud Run failed (manifest still works): ${err}`);
        }
      };
      
      // Use waitUntil for background processing
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions runtime
      const runtime = globalThis.EdgeRuntime;
      if (runtime && typeof runtime.waitUntil === 'function') {
        runtime.waitUntil(backgroundTask());
      } else {
        // Fallback: just fire and don't wait
        backgroundTask().catch(console.error);
      }
    }

    // Return immediately with manifest URL
    return new Response(
      JSON.stringify({
        success: true,
        mode: 'manifest_playback',
        finalVideoUrl: manifestUrl,
        clipsProcessed: clips.length,
        totalDuration,
        processingTimeMs: Date.now() - startTime,
        note: 'Video ready for immediate playback. Cloud Run may upgrade to a stitched MP4 later.',
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
