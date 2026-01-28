/**
 * GENERATION MUTEX SYSTEM
 * 
 * Prevents parallel clip generation by enforcing a project-level lock.
 * Only one clip can be generating at a time per project.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  blockedByClip?: number;
  lockAgeSeconds?: number;
  staleLockReleased?: boolean;
}

export interface ContinuityCheckResult {
  ready: boolean;
  reason?: string;
  lastFrameUrl?: string;
  previousStatus?: string;
  frameExtractionStatus?: string;
  requiredClip?: number;
}

/**
 * Attempt to acquire the generation lock for a project
 * Returns false if another clip is currently generating
 */
export async function acquireGenerationLock(
  supabase: SupabaseClient,
  projectId: string,
  clipIndex: number,
  lockId?: string
): Promise<LockResult> {
  try {
    const { data, error } = await supabase.rpc('acquire_generation_lock', {
      p_project_id: projectId,
      p_clip_index: clipIndex,
      p_lock_id: lockId || crypto.randomUUID(),
    });
    
    if (error) {
      console.error('[Mutex] Failed to acquire lock:', error);
      return { acquired: false };
    }
    
    const result: LockResult = {
      acquired: data?.acquired === true,
      lockId: data?.lock_id,
      blockedByClip: data?.blocked_by_clip,
      lockAgeSeconds: data?.lock_age_seconds,
      staleLockReleased: data?.stale_lock_released,
    };
    
    if (result.acquired) {
      console.log(`[Mutex] ✓ Lock acquired for clip ${clipIndex}, lockId: ${result.lockId}`);
    } else {
      console.log(`[Mutex] ⚠️ Lock blocked by clip ${result.blockedByClip} (age: ${result.lockAgeSeconds}s)`);
    }
    
    return result;
  } catch (err) {
    console.error('[Mutex] Lock acquisition error:', err);
    return { acquired: false };
  }
}

/**
 * Release the generation lock for a project
 */
export async function releaseGenerationLock(
  supabase: SupabaseClient,
  projectId: string,
  lockId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('release_generation_lock', {
      p_project_id: projectId,
      p_lock_id: lockId,
    });
    
    if (error) {
      console.error('[Mutex] Failed to release lock:', error);
      return false;
    }
    
    console.log(`[Mutex] ✓ Lock released for project ${projectId}`);
    return data === true;
  } catch (err) {
    console.error('[Mutex] Lock release error:', err);
    return false;
  }
}

/**
 * FAILSAFE: Force release lock by clearing generation_lock column directly
 * Use when clip is confirmed completed but lock wasn't properly released
 */
export async function forceReleaseLock(
  supabase: SupabaseClient,
  projectId: string,
  reason: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('movie_projects')
      .update({ generation_lock: null })
      .eq('id', projectId);
    
    if (error) {
      console.error('[Mutex] Force release failed:', error);
      return false;
    }
    
    console.log(`[Mutex] ✓ Lock FORCE-RELEASED for project ${projectId}: ${reason}`);
    return true;
  } catch (err) {
    console.error('[Mutex] Force release error:', err);
    return false;
  }
}

/**
 * GUARD RAIL: Check if a completed clip left a stale lock and release it
 * This should be called after confirming a clip has status='completed' and video_url
 */
export async function releaseStaleCompletedLock(
  supabase: SupabaseClient,
  projectId: string,
  completedClipIndex: number
): Promise<boolean> {
  try {
    // Check current lock state
    const { data: project, error } = await supabase
      .from('movie_projects')
      .select('generation_lock')
      .eq('id', projectId)
      .maybeSingle();
    
    if (error || !project) {
      console.warn('[Mutex] Could not check lock state:', error);
      return false;
    }
    
    const lock = project.generation_lock as { locked_by_clip?: number } | null;
    
    // If lock is held by the completed clip, release it
    if (lock && lock.locked_by_clip === completedClipIndex) {
      console.log(`[Mutex] ⚠️ Stale lock detected: clip ${completedClipIndex} is completed but lock not released`);
      return await forceReleaseLock(supabase, projectId, `clip ${completedClipIndex} completed but lock stuck`);
    }
    
    return true; // No stale lock
  } catch (err) {
    console.error('[Mutex] Stale lock check error:', err);
    return false;
  }
}

/**
 * Check if previous clip is ready for continuity (strict sequential enforcement)
 */
export async function checkContinuityReady(
  supabase: SupabaseClient,
  projectId: string,
  clipIndex: number
): Promise<ContinuityCheckResult> {
  try {
    const { data, error } = await supabase.rpc('check_clip_continuity_ready', {
      p_project_id: projectId,
      p_clip_index: clipIndex,
    });
    
    if (error) {
      console.error('[Mutex] Continuity check error:', error);
      return { ready: false, reason: 'database_error' };
    }
    
    const result: ContinuityCheckResult = {
      ready: data?.ready === true,
      reason: data?.reason,
      lastFrameUrl: data?.last_frame_url,
      previousStatus: data?.previous_status,
      frameExtractionStatus: data?.frame_extraction_status,
      requiredClip: data?.required_clip,
    };
    
    if (result.ready) {
      console.log(`[Mutex] ✓ Continuity ready for clip ${clipIndex}`);
    } else {
      console.log(`[Mutex] ⚠️ Continuity NOT ready for clip ${clipIndex}: ${result.reason}`);
    }
    
    return result;
  } catch (err) {
    console.error('[Mutex] Continuity check error:', err);
    return { ready: false, reason: 'exception' };
  }
}

/**
 * Persist full pipeline context to database for reliable resume
 */
export async function persistPipelineContext(
  supabase: SupabaseClient,
  projectId: string,
  context: Record<string, any>
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('persist_pipeline_context', {
      p_project_id: projectId,
      p_context: context,
    });
    
    if (error) {
      console.error('[Mutex] Failed to persist context:', error);
      return false;
    }
    
    console.log(`[Mutex] ✓ Pipeline context persisted (${Object.keys(context).length} keys)`);
    return data === true;
  } catch (err) {
    console.error('[Mutex] Context persistence error:', err);
    return false;
  }
}

/**
 * Load full pipeline context from database
 */
export async function loadPipelineContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<Record<string, any> | null> {
  try {
    const { data, error } = await supabase.rpc('get_pipeline_context', {
      p_project_id: projectId,
    });
    
    if (error) {
      console.error('[Mutex] Failed to load context:', error);
      return null;
    }
    
    console.log(`[Mutex] ✓ Pipeline context loaded (${Object.keys(data || {}).length} keys)`);
    return data;
  } catch (err) {
    console.error('[Mutex] Context load error:', err);
    return null;
  }
}

/**
 * Update frame extraction status for a clip
 */
export async function updateFrameExtractionStatus(
  supabase: SupabaseClient,
  clipId: string,
  status: 'pending' | 'success' | 'failed' | 'fallback_used',
  attempts: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('video_clips')
      .update({
        frame_extraction_status: status,
        frame_extraction_attempts: attempts,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clipId);
    
    if (error) {
      console.error('[Mutex] Failed to update frame extraction status:', error);
      return false;
    }
    
    console.log(`[Mutex] ✓ Frame extraction status: ${status} (attempts: ${attempts})`);
    return true;
  } catch (err) {
    console.error('[Mutex] Frame status update error:', err);
    return false;
  }
}
