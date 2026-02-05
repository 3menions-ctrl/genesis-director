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
 * 
 * GUARD RAIL: Automatically releases stale locks from completed clips
 */
export async function acquireGenerationLock(
  supabase: SupabaseClient,
  projectId: string,
  clipIndex: number,
  lockId?: string
): Promise<LockResult> {
  try {
    // GUARD RAIL: First check if the blocking clip is already completed
    // If so, the lock was orphaned and should be released
    const { data: project } = await supabase
      .from('movie_projects')
      .select('generation_lock')
      .eq('id', projectId)
      .maybeSingle();
    
    const currentLock = project?.generation_lock as { locked_by_clip?: number; locked_at?: string } | null;
    
    if (currentLock && typeof currentLock.locked_by_clip === 'number') {
      const { data: blockingClip } = await supabase
        .from('video_clips')
        .select('status, video_url')
        .eq('project_id', projectId)
        .eq('shot_index', currentLock.locked_by_clip)
        .maybeSingle();
      
      // If the blocking clip is completed, force release the orphaned lock
      if (blockingClip?.status === 'completed' && blockingClip?.video_url) {
        console.log(`[Mutex] 🔓 AUTO-RELEASING orphaned lock: clip ${currentLock.locked_by_clip} is completed but lock wasn't released`);
        await supabase
          .from('movie_projects')
          .update({ generation_lock: null })
          .eq('id', projectId);
        // Continue to acquire the lock below
      }
    }
    
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

/**
 * STATUS RECONCILIATION UTILITY
 * 
 * Checks if project status matches clip reality and fixes discrepancies.
 * This is the GUARD RAIL against "false failure" states.
 * 
 * Call this after any clip completion to ensure consistency.
 */
export async function reconcileProjectStatus(
  supabase: SupabaseClient,
  projectId: string
): Promise<{
  reconciled: boolean;
  action?: string;
  previousStatus?: string;
  newStatus?: string;
  clipStats?: { total: number; completed: number; failed: number; generating: number };
}> {
  try {
    // Get current project status
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('id, status, pipeline_stage')
      .eq('id', projectId)
      .maybeSingle();
    
    if (projectError || !project) {
      console.error('[Mutex] Reconciliation failed - project not found:', projectError);
      return { reconciled: false };
    }
    
    // Get clip statuses
    const { data: clips, error: clipsError } = await supabase
      .from('video_clips')
      .select('status')
      .eq('project_id', projectId);
    
    if (clipsError || !clips || clips.length === 0) {
      console.log('[Mutex] No clips to reconcile');
      return { reconciled: false };
    }
    
    const clipStats = {
      total: clips.length,
      completed: clips.filter(c => c.status === 'completed').length,
      failed: clips.filter(c => c.status === 'failed').length,
      generating: clips.filter(c => c.status === 'generating').length,
    };
    
    console.log(`[Mutex] Reconciliation check: project='${project.status}', clips=${JSON.stringify(clipStats)}`);
    
    // RULE 1: If ALL clips completed but project shows failed/error → fix it
    if (clipStats.completed === clipStats.total && 
        (project.status === 'failed' || project.status === 'error')) {
      console.log(`[Mutex] ⚠️ RECONCILIATION NEEDED: All ${clipStats.total} clips complete but project is '${project.status}'`);
      
      await supabase
        .from('movie_projects')
        .update({
          status: 'stitching', // Trigger final assembly on next poll
          pipeline_stage: 'stitching',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
      
      return {
        reconciled: true,
        action: 'cleared_false_failure',
        previousStatus: project.status,
        newStatus: 'stitching',
        clipStats,
      };
    }
    
    // RULE 2: If project is 'generating' but no clips are generating and some failed → mark appropriately
    if (project.status === 'generating' && 
        clipStats.generating === 0 && 
        clipStats.failed > 0 && 
        clipStats.completed < clipStats.total) {
      console.log(`[Mutex] ⚠️ RECONCILIATION NEEDED: No clips generating but ${clipStats.failed} failed`);
      
      await supabase
        .from('movie_projects')
        .update({
          status: 'failed',
          pipeline_stage: 'generation_error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
      
      return {
        reconciled: true,
        action: 'marked_failed_correctly',
        previousStatus: project.status,
        newStatus: 'failed',
        clipStats,
      };
    }
    
    // No reconciliation needed
    return {
      reconciled: false,
      clipStats,
    };
  } catch (err) {
    console.error('[Mutex] Reconciliation error:', err);
    return { reconciled: false };
  }
}
