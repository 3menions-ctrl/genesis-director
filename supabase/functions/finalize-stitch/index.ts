import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Finalize Stitch Edge Function (v2)
 * 
 * IMPROVEMENTS:
 * 1. Video integrity verification (file size, content-type)
 * 2. Error storage in pending_video_tasks
 * 3. Retry triggering for failed stitches
 * 4. Progress tracking
 */

interface FinalizeRequest {
  projectId: string;
  videoUrl?: string;
  durationSeconds?: number;
  clipsProcessed?: number;
  status?: 'completed' | 'failed';
  errorMessage?: string;
  retryAttempt?: number;
}

interface VideoValidation {
  valid: boolean;
  fileSize?: number;
  contentType?: string;
  error?: string;
}

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = any;

// ==================== VIDEO INTEGRITY CHECK ====================

async function validateVideoUrl(videoUrl: string): Promise<VideoValidation> {
  try {
    console.log(`[FinalizeStitch] Validating video: ${videoUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(videoUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return {
        valid: false,
        error: `Video URL returned ${response.status}`,
      };
    }
    
    const contentType = response.headers.get('content-type') || undefined;
    const contentLength = response.headers.get('content-length');
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;
    
    if (contentType && !contentType.includes('video/')) {
      return {
        valid: false,
        contentType,
        fileSize,
        error: `Invalid content type: ${contentType}`,
      };
    }
    
    if (fileSize < 100000) {
      return {
        valid: false,
        contentType,
        fileSize,
        error: `File too small (${fileSize} bytes) - likely corrupt`,
      };
    }
    
    console.log(`[FinalizeStitch] Video valid: ${fileSize} bytes, ${contentType}`);
    
    return {
      valid: true,
      fileSize,
      contentType,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

// ==================== RETRY LOGIC ====================

async function triggerRetry(
  supabase: SupabaseClientAny,
  projectId: string,
  retryAttempt: number,
  errorMessage: string
): Promise<boolean> {
  const maxRetries = 3;
  
  if (retryAttempt >= maxRetries) {
    console.log(`[FinalizeStitch] Max retries (${maxRetries}) reached for project ${projectId}`);
    return false;
  }
  
  console.log(`[FinalizeStitch] Scheduling retry ${retryAttempt + 1} for project ${projectId}`);
  
  const { data: project }: { data: any } = await supabase
    .from('movie_projects')
    .select('pending_video_tasks')
    .eq('id', projectId)
    .single();
  
  const currentTasks = (project?.pending_video_tasks as Record<string, unknown>) || {};
  
  const delays = [30000, 60000, 120000];
  const delay = delays[Math.min(retryAttempt, delays.length - 1)];
  
  await supabase
    .from('movie_projects')
    .update({
      status: 'retry_scheduled',
      pending_video_tasks: {
        ...currentTasks,
        stage: 'retry_scheduled',
        retryScheduled: true,
        retryAttempt: retryAttempt + 1,
        retryAfter: new Date(Date.now() + delay).toISOString(),
        lastError: errorMessage,
        lastUpdated: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('id', projectId);
  
  return true;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      projectId, 
      videoUrl, 
      durationSeconds, 
      clipsProcessed,
      status = 'completed',
      errorMessage,
      retryAttempt = 0,
    } = await req.json() as FinalizeRequest;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'projectId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FinalizeStitch] Finalizing project ${projectId} with status: ${status}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { data: currentProject }: { data: any } = await supabase
      .from('movie_projects')
      .select('pending_video_tasks')
      .eq('id', projectId)
      .single();
    
    const currentTasks = (currentProject?.pending_video_tasks as Record<string, unknown>) || {};

    // Handle failure case
    if (status === 'failed') {
      console.log(`[FinalizeStitch] Project ${projectId} failed: ${errorMessage}`);
      
      const retryScheduled = await triggerRetry(supabase, projectId, retryAttempt, errorMessage || 'Unknown error');
      
      if (retryScheduled) {
        return new Response(
          JSON.stringify({
            success: true,
            retryScheduled: true,
            message: `Retry ${retryAttempt + 1} scheduled`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      await supabase
        .from('movie_projects')
        .update({
          status: 'failed',
          pending_video_tasks: {
            ...currentTasks,
            stage: 'error',
            progress: 0,
            error: errorMessage,
            finalError: true,
            retriesExhausted: true,
            lastUpdated: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', projectId);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          retriesExhausted: true,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle success case
    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: 'videoUrl is required for completed status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate video integrity
    console.log(`[FinalizeStitch] Validating video integrity...`);
    const validation = await validateVideoUrl(videoUrl);
    
    if (!validation.valid) {
      console.error(`[FinalizeStitch] Video validation failed: ${validation.error}`);
      
      const retryScheduled = await triggerRetry(
        supabase,
        projectId,
        retryAttempt,
        `Video validation failed: ${validation.error}`
      );
      
      if (retryScheduled) {
        return new Response(
          JSON.stringify({
            success: false,
            error: validation.error,
            retryScheduled: true,
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      await supabase
        .from('movie_projects')
        .update({
          status: 'failed',
          pending_video_tasks: {
            ...currentTasks,
            stage: 'error',
            error: `Video validation failed: ${validation.error}`,
            retriesExhausted: true,
            lastUpdated: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', projectId);
      
      return new Response(
        JSON.stringify({ error: validation.error, retriesExhausted: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update project with valid video URL
    console.log(`[FinalizeStitch] Video validated, updating project...`);
    
    const { data, error } = await supabase
      .from('movie_projects')
      .update({
        status: 'completed',
        video_url: videoUrl,
        pending_video_tasks: {
          ...currentTasks,
          stage: 'complete',
          progress: 100,
          finalVideoUrl: videoUrl,
          fileSizeBytes: validation.fileSize,
          durationSeconds,
          clipsProcessed,
          completedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('[FinalizeStitch] Error updating project:', error);
      return new Response(
        JSON.stringify({ error: `Failed to update project: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FinalizeStitch] Project ${projectId} completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        project: data,
        videoUrl,
        durationSeconds,
        clipsProcessed,
        fileSizeBytes: validation.fileSize,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('[FinalizeStitch] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
