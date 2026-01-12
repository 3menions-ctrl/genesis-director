import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Declare EdgeRuntime for Deno Edge Function background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
} | undefined;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Video Stitcher Edge Function - Orchestrator (v2)
 * 
 * IMPROVEMENTS:
 * 1. Health check before stitching
 * 2. Retry logic with exponential backoff (max 3 retries)
 * 3. Progress tracking via pending_video_tasks
 * 4. Error propagation to database
 * 5. Stalled pipeline detection support
 */

interface ShotClip {
  shotId: string;
  videoUrl: string;
  audioUrl?: string;
  durationSeconds: number;
  transitionOut?: string;
}

interface MusicTimingMarker {
  timestamp: number;
  type: 'duck' | 'swell' | 'accent' | 'pause';
  duration: number;
  intensity: number;
}

interface MusicMixingInstructions {
  baseVolume: number;
  duckingForDialogue: boolean;
  duckingAmount: number;
  fadeInDuration: number;
  fadeOutDuration: number;
}

interface MusicSyncPlan {
  timingMarkers?: MusicTimingMarker[];
  mixingInstructions?: MusicMixingInstructions;
  musicCues?: unknown[];
  emotionalBeats?: unknown[];
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
  transitionDuration?: number;
  musicSyncPlan?: MusicSyncPlan;
  colorGradingFilter?: string;
  retryAttempt?: number;
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
  retryScheduled?: boolean;
}

interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = any;

// ==================== HEALTH CHECK ====================

async function checkCloudRunHealth(cloudRunUrl: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for cold start
    
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: `Cloud Run returned ${response.status}`,
      };
    }
    
    const data = await response.json();
    const isHealthy = data.status === 'healthy';
    
    return {
      healthy: isHealthy,
      latencyMs: Date.now() - startTime,
      error: isHealthy ? undefined : 'Cloud Run not healthy',
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Health check failed',
    };
  }
}

// ==================== PROGRESS TRACKING ====================

async function updatePipelineProgress(
  supabase: SupabaseClientAny,
  projectId: string,
  stage: string,
  progress: number,
  error?: string
): Promise<void> {
  try {
    const { data: project }: { data: any } = await supabase
      .from('movie_projects')
      .select('pending_video_tasks')
      .eq('id', projectId)
      .single();
    
    const currentTasks = (project?.pending_video_tasks as Record<string, unknown>) || {};
    
    const updatedTasks = {
      ...currentTasks,
      stage,
      progress,
      error: error || null,
      lastUpdated: new Date().toISOString(),
      stitchingStarted: currentTasks.stitchingStarted || new Date().toISOString(),
    };
    
    await supabase
      .from('movie_projects')
      .update({ 
        pending_video_tasks: updatedTasks,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('id', projectId);
    
    console.log(`[Stitch] Progress update: ${stage} - ${progress}%`);
  } catch (err) {
    console.error('[Stitch] Failed to update progress:', err);
  }
}

// ==================== MANIFEST CREATION (MVP FALLBACK) ====================

async function createVideoManifest(
  clips: ShotClip[],
  projectId: string,
  supabase: SupabaseClientAny
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

// ==================== AUDIO MIXING ====================

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

// ==================== CLOUD RUN FIRE-AND-FORGET (WITH FAILURE HANDLING) ====================

async function fireCloudRunStitcherAsync(
  cloudRunUrl: string,
  request: StitchRequest,
  supabase: SupabaseClientAny
): Promise<void> {
  const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
  const stitchEndpoint = `${normalizedUrl}/stitch`;
  
  console.log(`[Stitch] Firing async Cloud Run request: ${stitchEndpoint}`);
  
  const audioMixParams = buildAudioMixParams(request.musicSyncPlan);
  
  // HYBRID SUPABASE SETUP: Use external Supabase for storage/video operations
  // This ensures Cloud Run always uses the correct, stable Supabase instance
  // regardless of any URL changes in the primary Lovable Cloud instance
  const externalSupabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const externalSupabaseServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  
  // Storage operations use external Supabase (where video-clips bucket lives)
  const storageSupabaseUrl = externalSupabaseUrl || Deno.env.get("SUPABASE_URL")!;
  const storageSupabaseServiceKey = externalSupabaseServiceKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  // CRITICAL: Lovable Cloud credentials for callback (where edge functions live)
  const lovableCloudUrl = Deno.env.get("SUPABASE_URL")!;
  const lovableCloudServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  console.log(`[Stitch] Storage Supabase URL: ${storageSupabaseUrl}`);
  console.log(`[Stitch] External Supabase configured: ${!!externalSupabaseUrl}`);
  console.log(`[Stitch] Callback URL will use: ${lovableCloudUrl}/functions/v1/finalize-stitch`);
  
  const enhancedRequest = {
    ...request,
    audioMixParams,
    colorGradingFilter: request.colorGradingFilter,
    // CRITICAL FIX: callbackUrl points to Lovable Cloud where finalize-stitch edge function lives
    callbackUrl: `${lovableCloudUrl}/functions/v1/finalize-stitch`,
    // Service key for callback must be Lovable Cloud's key to authenticate against Lovable Cloud edge functions
    callbackServiceKey: lovableCloudServiceKey,
    retryAttempt: request.retryAttempt || 0,
    maxRetries: 3,
    // Storage operations use external Supabase config
    supabaseUrl: storageSupabaseUrl,
    supabaseServiceKey: storageSupabaseServiceKey,
  };
  
  try {
    // Use a longer timeout for the actual stitching request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
    
    const response = await fetch(stitchEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enhancedRequest),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Stitch] Cloud Run returned error: ${response.status} - ${errorText}`);
      
      // Update project status to failed if Cloud Run explicitly fails
      await updatePipelineProgress(
        supabase,
        request.projectId,
        'error',
        0,
        `Cloud Run error: ${response.status}`
      );
      
      await supabase
        .from('movie_projects')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', request.projectId);
    } else {
      console.log(`[Stitch] Cloud Run accepted request, processing async`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Stitch] Cloud Run request failed: ${errorMessage}`);
    
    // Handle timeouts and network errors
    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      console.log(`[Stitch] Request timed out - Cloud Run may still be processing`);
      // Don't mark as failed immediately - Cloud Run might still complete
      await updatePipelineProgress(
        supabase,
        request.projectId,
        'processing_async',
        30,
        'Request dispatched, awaiting completion'
      );
    } else {
      // For other errors, mark as failed
      await updatePipelineProgress(
        supabase,
        request.projectId,
        'error',
        0,
        errorMessage
      );
      
      await supabase
        .from('movie_projects')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', request.projectId);
    }
  }
  
  console.log(`[Stitch] Request dispatched to Cloud Run (retry: ${request.retryAttempt || 0})`);
}

// ==================== RETRY SCHEDULER ====================

async function scheduleRetry(
  supabase: SupabaseClientAny,
  projectId: string,
  request: StitchRequest,
  _cloudRunUrl: string,
  retryCount: number
): Promise<void> {
  const delays = [30000, 60000, 120000];
  const delay = delays[Math.min(retryCount, delays.length - 1)];
  
  console.log(`[Stitch] Scheduling retry ${retryCount + 1} in ${delay / 1000}s`);
  
  await updatePipelineProgress(
    supabase,
    projectId,
    'stitching_retry_scheduled',
    50,
    `Retry ${retryCount + 1} scheduled in ${delay / 1000}s`
  );
  
  const { data: project }: { data: any } = await supabase
    .from('movie_projects')
    .select('pending_video_tasks')
    .eq('id', projectId)
    .single();
  
  const currentTasks = (project?.pending_video_tasks as Record<string, unknown>) || {};
  
  await supabase
    .from('movie_projects')
    .update({
      pending_video_tasks: {
        ...currentTasks,
        retryScheduled: true,
        retryAttempt: retryCount + 1,
        retryAfter: new Date(Date.now() + delay).toISOString(),
        retryRequest: request,
      },
    } as Record<string, unknown>)
    .eq('id', projectId);
}

// ==================== MAIN PROCESSING ====================

async function processStitching(
  request: StitchRequest,
  supabase: SupabaseClientAny
): Promise<StitchResult> {
  const startTime = Date.now();
  const retryCount = request.retryAttempt || 0;
  
  try {
    const validClips = request.clips.filter(c => c.videoUrl && c.videoUrl.startsWith('http'));
    
    if (validClips.length === 0) {
      throw new Error("No valid video clips to stitch");
    }

    console.log(`[Stitch] Processing ${validClips.length} clips for project ${request.projectId}`);

    const totalDuration = validClips.reduce((sum, c) => sum + c.durationSeconds, 0);

    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    // CRITICAL: Cloud Run is REQUIRED - no manifest fallback
    if (!cloudRunUrl) {
      console.error("[Stitch] CLOUD_RUN_STITCHER_URL not configured - stitching not possible");
      
      await supabase
        .from('movie_projects')
        .update({ 
          status: 'stitching_blocked',
          last_error: 'Cloud Run stitcher not configured',
          pending_video_tasks: {
            stage: 'stitching_blocked',
            progress: 0,
            error: 'CLOUD_RUN_STITCHER_URL environment variable not set',
            message: 'Google Cloud Run is required for video stitching',
          },
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', request.projectId);
      
      return {
        success: false,
        error: 'Cloud Run stitcher not configured. Only Google Cloud Run is supported.',
        processingTimeMs: Date.now() - startTime,
      };
    }
    
    console.log("[Stitch] Step 1: Checking Cloud Run health...");
    await updatePipelineProgress(supabase, request.projectId, 'health_check', 10);
    
    const healthCheck = await checkCloudRunHealth(cloudRunUrl);
    
    if (!healthCheck.healthy) {
      console.error(`[Stitch] Cloud Run unhealthy: ${healthCheck.error}`);
      
      if (retryCount < 3) {
        await scheduleRetry(supabase, request.projectId, request, cloudRunUrl, retryCount);
        
        return {
          success: false,
          error: `Cloud Run unavailable: ${healthCheck.error}. Retry scheduled.`,
          retryScheduled: true,
          processingTimeMs: Date.now() - startTime,
        };
      }
      
      // Max retries exceeded - fail without manifest fallback
      console.error("[Stitch] Max retries exceeded, Cloud Run stitching failed");
      
      await supabase
        .from('movie_projects')
        .update({ 
          status: 'stitching_failed',
          last_error: `Cloud Run unavailable after ${retryCount} retries: ${healthCheck.error}`,
          pending_video_tasks: {
            stage: 'stitching_failed',
            progress: 0,
            error: healthCheck.error,
            retries: retryCount,
            message: 'Cloud Run stitching failed. Please retry manually.',
          },
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', request.projectId);
      
      return {
        success: false,
        error: `Cloud Run stitching failed after ${retryCount} retries: ${healthCheck.error}`,
        processingTimeMs: Date.now() - startTime,
      };
    }
    
    console.log(`[Stitch] Cloud Run healthy (latency: ${healthCheck.latencyMs}ms)`);
    console.log("[Stitch] Step 2: Dispatching to Cloud Run FFmpeg service");
    await updatePipelineProgress(supabase, request.projectId, 'stitching', 25);
    
    await supabase
      .from('movie_projects')
      .update({ 
        status: 'stitching',
        updated_at: new Date().toISOString(),
        pending_video_tasks: {
          stage: 'stitching',
          progress: 25,
          mode: 'cloud_run',
          stitchingStarted: new Date().toISOString(),
          expectedCompletionTime: new Date(Date.now() + 300000).toISOString(), // 5 min timeout marker
          lastUpdated: new Date().toISOString(),
        },
      } as Record<string, unknown>)
      .eq('id', request.projectId);
    
    // Use EdgeRuntime.waitUntil for background processing
    const stitchPromise = fireCloudRunStitcherAsync(cloudRunUrl, {
      ...request,
      clips: validClips,
    }, supabase);
    
    // Use waitUntil if available (Deno Edge Runtime feature)
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(stitchPromise);
    } else {
      // Fallback: await the promise
      await stitchPromise;
    }
    
    return {
      success: true,
      mode: 'cloud-run',
      processingTimeMs: Date.now() - startTime,
      clipsProcessed: validClips.length,
      durationSeconds: totalDuration,
      finalVideoUrl: undefined,
    };

  } catch (error) {
    console.error("[Stitch] Processing error:", error);
    
    await updatePipelineProgress(
      supabase,
      request.projectId,
      'error',
      0,
      error instanceof Error ? error.message : "Stitching failed"
    );
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Stitching failed",
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ==================== HTTP SERVER ====================

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[Stitch] Starting video stitching for project: ${request.projectId}`);
    console.log(`[Stitch] Clips to process: ${request.clips.length}`);
    console.log(`[Stitch] Audio mix mode: ${request.audioMixMode}`);
    console.log(`[Stitch] Retry attempt: ${request.retryAttempt || 0}`);
    
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    console.log(`[Stitch] Mode: ${cloudRunUrl ? 'Cloud Run FFmpeg (async)' : 'MVP Manifest'}`);

    const result = await processStitching(request, supabase);

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
