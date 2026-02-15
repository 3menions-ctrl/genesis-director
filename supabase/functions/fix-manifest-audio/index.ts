import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fix Manifest Audio - Updates existing manifests to have correct masterAudioUrl
 * 
 * This is a utility function to fix manifests that were generated before
 * the audio continuity fix was deployed.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const { projectId } = await req.json();

    if (!projectId) {
      throw new Error("projectId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get project data
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('pending_video_tasks, voice_audio_url, pipeline_state')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }

    const tasks = project.pending_video_tasks as Record<string, unknown> | null;
    const manifestUrl = tasks?.manifestUrl as string | null;
    
    if (!manifestUrl) {
      throw new Error("No manifest URL found in project");
    }

    // Fetch existing manifest
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`);
    }

    const manifest = await manifestResponse.json();
    
    // Get master audio URL from voice_audio_url or pipeline_state
    const pipelineState = project.pipeline_state as Record<string, unknown> | null;
    const masterAudioUrl = pipelineState?.masterAudioUrl as string || project.voice_audio_url || null;

    if (!masterAudioUrl) {
      throw new Error("No master audio URL found");
    }

    // Update manifest with correct audio config
    const updatedManifest = {
      ...manifest,
      masterAudioUrl,
      voiceUrl: masterAudioUrl,
      audioConfig: {
        muteClipAudio: true,  // CRITICAL: Mute embedded clip audio
        musicVolume: manifest.audioConfig?.musicVolume || 0.3,
      },
    };

    console.log("[FixManifest] Updated audio config:", {
      masterAudioUrl: masterAudioUrl.substring(0, 60),
      muteClipAudio: true,
    });

    // Upload updated manifest
    const timestamp = Date.now();
    const manifestFileName = `manifest_fixed_${projectId}_${timestamp}.json`;
    const manifestBytes = new TextEncoder().encode(JSON.stringify(updatedManifest, null, 2));

    const { error: uploadError } = await supabase.storage
      .from('temp-frames')
      .upload(manifestFileName, manifestBytes, { 
        contentType: 'application/json',
        upsert: true 
      });

    if (uploadError) {
      throw new Error(`Failed to upload manifest: ${uploadError.message}`);
    }

    const newManifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${manifestFileName}`;

    // Update project with new manifest URL
    await supabase.from('movie_projects').update({
      pending_video_tasks: {
        ...tasks,
        manifestUrl: newManifestUrl,
        masterAudioUrl,
      },
      video_url: newManifestUrl,
    }).eq('id', projectId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Manifest updated with correct audio config",
        newManifestUrl,
        masterAudioUrl,
        muteClipAudio: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[FixManifest] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
