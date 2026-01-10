import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Video Stitcher Edge Function - Orchestrator
 * 
 * Routes video stitching requests to Cloud Run FFmpeg service for production processing.
 * Falls back to manifest-based client-side stitching for MVP mode.
 * 
 * Processing Modes:
 * 1. Cloud Run (CLOUD_RUN_STITCHER_URL set): Full FFmpeg processing
 * 2. MVP Mode: Client-side sequential playback via manifest
 */

interface ShotClip {
  shotId: string;
  videoUrl: string;
  audioUrl?: string;
  durationSeconds: number;
  transitionOut?: string;
}

// Music sync timing markers for audio ducking/swells
interface MusicTimingMarker {
  timestamp: number;
  type: 'duck' | 'swell' | 'accent' | 'pause';
  duration: number;
  intensity: number;
}

// Music sync mixing instructions
interface MusicMixingInstructions {
  baseVolume: number;
  duckingForDialogue: boolean;
  duckingAmount: number;
  fadeInDuration: number;
  fadeOutDuration: number;
}

// Music sync plan from sync-music-to-scenes
interface MusicSyncPlan {
  timingMarkers?: MusicTimingMarker[];
  mixingInstructions?: MusicMixingInstructions;
  musicCues?: any[];
  emotionalBeats?: any[];
}

interface StitchRequest {
  projectId: string;
  projectTitle: string;
  clips: ShotClip[];
  audioMixMode: 'full' | 'dialogue-only' | 'music-only' | 'mute';
  backgroundMusicUrl?: string;
  voiceTrackUrl?: string;
  outputFormat?: 'mp4' | 'webm';
  forceMvpMode?: boolean;
  transitionType?: 'fade' | 'fadeblack' | 'fadewhite' | 'dissolve' | 'wipeleft' | 'wiperight' | 'circlecrop';
  transitionDuration?: number; // 0.3 - 1.0 seconds recommended
  // Music synchronization plan
  musicSyncPlan?: MusicSyncPlan;
  // Color grading filter
  colorGradingFilter?: string;
}

interface StitchResult {
  success: boolean;
  finalVideoUrl?: string;
  durationSeconds?: number;
  processingTimeMs?: number;
  clipsProcessed?: number;
  invalidClips?: Array<{ shotId: string; error: string }>;
  requiresRegeneration?: string[];
  mode?: 'cloud-run' | 'mvp-manifest';
  musicSyncApplied?: boolean;
  colorGradingApplied?: boolean;
  error?: string;
}

// Create manifest for client-side sequential playback (MVP fallback)
async function createVideoManifest(
  clips: ShotClip[],
  projectId: string,
  supabase: any
): Promise<string> {
  const manifest = {
    version: "1.0",
    projectId,
    createdAt: new Date().toISOString(),
    clips: clips.map((clip, index) => ({
      index,
      shotId: clip.shotId,
      videoUrl: clip.videoUrl,
      audioUrl: clip.audioUrl,
      duration: clip.durationSeconds,
      transitionOut: clip.transitionOut || 'cut',
      startTime: clips.slice(0, index).reduce((sum, c) => sum + c.durationSeconds, 0),
    })),
    totalDuration: clips.reduce((sum, c) => sum + c.durationSeconds, 0),
  };

  const fileName = `manifest_${projectId}_${Date.now()}.json`;
  const manifestJson = JSON.stringify(manifest, null, 2);
  const bytes = new TextEncoder().encode(manifestJson);

  const { error } = await supabase.storage
    .from('temp-frames')
    .upload(fileName, bytes, {
      contentType: 'application/json',
      upsert: true
    });

  if (error) {
    console.error('[Stitch] Manifest upload error:', error);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;
}

// Build audio mixing parameters from music sync plan
function buildAudioMixParams(musicSyncPlan?: MusicSyncPlan): {
  musicVolume: number;
  duckingEnabled: boolean;
  duckingAmount: number;
  fadeIn: number;
  fadeOut: number;
  timingMarkers?: MusicTimingMarker[];
} {
  if (!musicSyncPlan?.mixingInstructions) {
    return {
      musicVolume: 0.3,
      duckingEnabled: true,
      duckingAmount: 0.6,
      fadeIn: 1,
      fadeOut: 2,
    };
  }

  const { mixingInstructions, timingMarkers } = musicSyncPlan;
  
  return {
    musicVolume: mixingInstructions.baseVolume ?? 0.3,
    duckingEnabled: mixingInstructions.duckingForDialogue ?? true,
    duckingAmount: mixingInstructions.duckingAmount ?? 0.6,
    fadeIn: mixingInstructions.fadeInDuration ?? 1,
    fadeOut: mixingInstructions.fadeOutDuration ?? 2,
    timingMarkers,
  };
}

// Call Cloud Run FFmpeg service for production stitching
// Uses a long timeout (5 minutes) since video processing takes time
async function callCloudRunStitcher(
  cloudRunUrl: string,
  request: StitchRequest
): Promise<StitchResult> {
  // Normalize URL - remove trailing slash and append /stitch
  const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
  const stitchEndpoint = `${normalizedUrl}/stitch`;
  
  console.log(`[Stitch] Calling Cloud Run FFmpeg service: ${stitchEndpoint}`);
  
  // Build audio mix params from music sync plan
  const audioMixParams = buildAudioMixParams(request.musicSyncPlan);
  
  // Enhanced request with music sync params and callback URL for async notification
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const enhancedRequest = {
    ...request,
    audioMixParams,
    colorGradingFilter: request.colorGradingFilter,
    // Provide callback URL for async completion notification
    callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
  };
  
  console.log(`[Stitch] Music sync: volume=${audioMixParams.musicVolume}, ducking=${audioMixParams.duckingEnabled}, markers=${audioMixParams.timingMarkers?.length || 0}`);
  
  // Use a 5 minute timeout for video processing (stitching multiple clips takes time)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes
  
  let response: Response;
  try {
    response = await fetch(stitchEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enhancedRequest),
      signal: controller.signal,
    });
  } catch (fetchError: unknown) {
    clearTimeout(timeoutId);
    // Handle abort/timeout specifically
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      console.log('[Stitch] Cloud Run request timed out after 5 minutes');
      throw new Error('Cloud Run stitching timed out - video may still be processing');
    }
    throw fetchError;
  } finally {
    clearTimeout(timeoutId);
  }
  
  // Handle non-JSON responses gracefully
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const textBody = await response.text();
    console.error('[Stitch] Cloud Run returned non-JSON response:', textBody.substring(0, 500));
    throw new Error(`Cloud Run returned unexpected response: ${response.status} - ${textBody.substring(0, 200)}`);
  }

  const result = await response.json();
  
  if (!response.ok) {
    console.error('[Stitch] Cloud Run error:', result);
    
    // Check if clips need regeneration
    if (result.requiresRegeneration) {
      return {
        success: false,
        error: result.error,
        invalidClips: result.invalidClips,
        requiresRegeneration: result.requiresRegeneration,
        mode: 'cloud-run',
      };
    }
    
    throw new Error(result.error || `Cloud Run returned ${response.status}`);
  }

  console.log(`[Stitch] Cloud Run success: ${result.videoUrl || result.finalVideoUrl || 'processing async'}`);

  return {
    ...result,
    // Normalize the video URL field name
    finalVideoUrl: result.videoUrl || result.finalVideoUrl,
    mode: 'cloud-run',
    musicSyncApplied: !!request.musicSyncPlan,
    colorGradingApplied: !!request.colorGradingFilter,
  };
}

// Fire and forget Cloud Run call - returns immediately, Cloud Run calls finalize-stitch when done
async function fireCloudRunStitcherAsync(
  cloudRunUrl: string,
  request: StitchRequest
): Promise<void> {
  const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
  const stitchEndpoint = `${normalizedUrl}/stitch`;
  
  console.log(`[Stitch] Firing async Cloud Run request: ${stitchEndpoint}`);
  
  const audioMixParams = buildAudioMixParams(request.musicSyncPlan);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  
  const enhancedRequest = {
    ...request,
    audioMixParams,
    colorGradingFilter: request.colorGradingFilter,
    // Cloud Run will call this when done
    callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
  };
  
  // Fire request without waiting for response
  fetch(stitchEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(enhancedRequest),
  }).then(async (response) => {
    console.log(`[Stitch] Cloud Run responded with status: ${response.status}`);
    if (!response.ok) {
      const text = await response.text();
      console.error(`[Stitch] Cloud Run error: ${text}`);
    }
  }).catch((error) => {
    console.error(`[Stitch] Cloud Run request failed:`, error);
  });
}

// Main processing logic
async function processStitching(
  request: StitchRequest,
  supabase: any
): Promise<StitchResult> {
  const startTime = Date.now();
  
  try {
    // Validate clips
    const validClips = request.clips.filter(c => c.videoUrl && c.videoUrl.startsWith('http'));
    
    if (validClips.length === 0) {
      throw new Error("No valid video clips to stitch");
    }

    console.log(`[Stitch] Processing ${validClips.length} clips for project ${request.projectId}`);

    const totalDuration = validClips.reduce((sum, c) => sum + c.durationSeconds, 0);

    // Check for Cloud Run URL (production mode) - skip if forceMvpMode is set
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (cloudRunUrl && !request.forceMvpMode) {
      console.log("[Stitch] Using Cloud Run FFmpeg service (async mode)");
      
      // Update project status to 'stitching' 
      await supabase
        .from('movie_projects')
        .update({ status: 'stitching' })
        .eq('id', request.projectId);
      
      // Fire async request - Cloud Run will call finalize-stitch when done
      // Use EdgeRuntime.waitUntil to keep the background task running
      const asyncRequest = {
        ...request,
        clips: validClips,
      };
      
      // Start the Cloud Run request in background
      EdgeRuntime.waitUntil(fireCloudRunStitcherAsync(cloudRunUrl, asyncRequest));
      
      // Return immediately with processing status
      return {
        success: true,
        mode: 'cloud-run',
        processingTimeMs: Date.now() - startTime,
        clipsProcessed: validClips.length,
        durationSeconds: totalDuration,
        // Indicate async processing
        finalVideoUrl: undefined,
      };
    }

    // MVP fallback: Manifest-based client-side sequential playback
    console.log("[Stitch] Using manifest-based client-side stitching (MVP mode)");

    const manifestUrl = await createVideoManifest(validClips, request.projectId, supabase);
    
    // Update project with manifest URL
    await supabase
      .from('movie_projects')
      .update({ 
        status: 'completed',
        video_url: manifestUrl 
      })
      .eq('id', request.projectId);

    return {
      success: true,
      finalVideoUrl: manifestUrl,
      durationSeconds: totalDuration,
      clipsProcessed: validClips.length,
      processingTimeMs: Date.now() - startTime,
      mode: 'mvp-manifest',
    };

  } catch (error) {
    console.error("[Stitch] Processing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Stitching failed",
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// Declare EdgeRuntime for TypeScript
declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: StitchRequest = await req.json();

    if (!request.clips || request.clips.length === 0) {
      throw new Error("No clips provided for stitching");
    }

    if (!request.projectId) {
      throw new Error("Project ID is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[Stitch] Starting video stitching for project: ${request.projectId}`);
    console.log(`[Stitch] Clips to process: ${request.clips.length}`);
    console.log(`[Stitch] Audio mix mode: ${request.audioMixMode}`);
    
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    console.log(`[Stitch] Mode: ${cloudRunUrl ? 'Cloud Run FFmpeg (async)' : 'MVP Manifest'}`);

    const result = await processStitching(request, supabase);

    // If clips need regeneration, return 422 with details
    if (!result.success && result.requiresRegeneration) {
      return new Response(
        JSON.stringify(result),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Stitch] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
