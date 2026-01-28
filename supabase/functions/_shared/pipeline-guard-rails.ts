/**
 * PIPELINE GUARD RAILS - Comprehensive protection against pipeline stalls
 * 
 * This module provides:
 * 1. Automatic stale mutex detection and release
 * 2. Clip 0 reference image guarantees
 * 3. Frame extraction fallback chains
 * 4. Stuck clip detection and recovery triggers
 * 5. Pipeline health monitoring
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// =====================================================
// CONFIGURATION
// =====================================================
export const GUARD_RAIL_CONFIG = {
  // Mutex settings
  MUTEX_STALE_THRESHOLD_MS: 10 * 60 * 1000, // 10 minutes - auto-release stale locks
  MUTEX_WARNING_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes - log warning
  
  // Clip 0 settings
  CLIP_0_ALWAYS_USE_REFERENCE: true, // Clip 0 always uses uploaded reference image
  
  // Stuck clip detection
  CLIP_STUCK_THRESHOLD_MS: 3 * 60 * 1000, // 3 minutes before considering stuck
  CLIP_GENERATING_MAX_AGE_MS: 8 * 60 * 1000, // 8 minutes max for any clip generation
  
  // Frame extraction
  FRAME_EXTRACTION_MAX_RETRIES: 3,
  FRAME_EXTRACTION_BACKOFF_MS: 1500,
  
  // Recovery settings
  AUTO_RECOVERY_ENABLED: true,
  MAX_RECOVERY_ATTEMPTS_PER_CLIP: 3,
};

// =====================================================
// TYPES
// =====================================================
export interface GuardRailResult {
  action: 'proceed' | 'wait' | 'recover' | 'fail';
  reason: string;
  recoveryAction?: 'release_mutex' | 'use_fallback_frame' | 'retry_clip' | 'skip_to_next';
  data?: Record<string, any>;
}

export interface ClipHealthStatus {
  clipIndex: number;
  status: 'healthy' | 'stuck' | 'failed' | 'missing';
  ageMs: number;
  hasPredictionId: boolean;
  hasVideoUrl: boolean;
  hasLastFrame: boolean;
  suggestedAction?: string;
}

export interface PipelineHealthReport {
  projectId: string;
  overallStatus: 'healthy' | 'degraded' | 'stalled' | 'failed';
  mutexStatus: 'free' | 'held' | 'stale';
  clipStatuses: ClipHealthStatus[];
  completedCount: number;
  failedCount: number;
  stuckCount: number;
  recommendations: string[];
}

// =====================================================
// CLIP 0 REFERENCE IMAGE GUARANTEE
// =====================================================

/**
 * For Clip 0, ALWAYS return the user's uploaded reference image.
 * This ensures the first clip anchors to the original character/scene.
 */
export function getClip0StartImage(
  referenceImageUrl: string | undefined,
  sceneImageUrl: string | undefined,
  identityBibleImageUrl: string | undefined
): { imageUrl: string | null; source: string } {
  // Priority order for Clip 0
  const sources = [
    { url: referenceImageUrl, source: 'reference_image' },
    { url: identityBibleImageUrl, source: 'identity_bible' },
    { url: sceneImageUrl, source: 'scene_image' },
  ];
  
  for (const { url, source } of sources) {
    if (url && isValidImageUrl(url)) {
      console.log(`[GuardRails] Clip 0 start image: ${source}`);
      return { imageUrl: url, source };
    }
  }
  
  console.warn(`[GuardRails] ⚠️ No valid start image for Clip 0!`);
  return { imageUrl: null, source: 'none' };
}

/**
 * For Clip 0 LAST FRAME, PREFER the extracted frame over reference image.
 * This ensures Clip 1 starts from where Clip 0 actually ended, not the original upload.
 * 
 * CRITICAL FIX: The previous implementation incorrectly prioritized reference image,
 * which caused clip 1 to show the uploaded picture instead of continuing from clip 0.
 */
export function getClip0LastFrame(
  referenceImageUrl: string | undefined,
  extractedFrameUrl: string | undefined
): { frameUrl: string | null; source: string; confidence: 'high' | 'medium' | 'low' } {
  // PRIORITIZE extracted frame - this is the actual end of clip 0's video
  if (extractedFrameUrl && isValidImageUrl(extractedFrameUrl)) {
    console.log(`[GuardRails] Clip 0 last frame: using EXTRACTED frame (correct behavior)`);
    return { frameUrl: extractedFrameUrl, source: 'extracted_frame', confidence: 'high' };
  }
  
  // Fallback to reference image only if extraction failed
  if (referenceImageUrl && isValidImageUrl(referenceImageUrl)) {
    console.log(`[GuardRails] Clip 0 last frame: using reference image (fallback)`);
    return { frameUrl: referenceImageUrl, source: 'reference_image', confidence: 'medium' };
  }
  
  console.error(`[GuardRails] ❌ No valid last frame for Clip 0!`);
  return { frameUrl: null, source: 'none', confidence: 'low' };
}

// =====================================================
// FRAME URL VALIDATION
// =====================================================

export function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  
  const lower = url.toLowerCase();
  
  // Must be HTTP/HTTPS
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }
  
  // Must NOT be a video file
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.avi')) {
    return false;
  }
  
  // Must NOT be from video-clips bucket (those are videos, not frames)
  if (lower.includes('/video-clips/')) {
    return false;
  }
  
  // Should be an image format or unrecognized (API might return without extension)
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
  const hasImageExt = imageExtensions.some(ext => lower.endsWith(ext));
  const hasNoExt = !lower.includes('.') || lower.split('.').pop()!.length > 5; // No extension or weird extension
  
  return hasImageExt || hasNoExt || lower.includes('temp-frames') || lower.includes('user-uploads');
}

// =====================================================
// STUCK CLIP DETECTION
// =====================================================

export async function detectStuckClips(
  supabase: SupabaseClient,
  projectId: string
): Promise<ClipHealthStatus[]> {
  const { data: clips, error } = await supabase
    .from('video_clips')
    .select('id, shot_index, status, video_url, last_frame_url, veo_operation_name, updated_at, created_at')
    .eq('project_id', projectId)
    .order('shot_index');
  
  if (error || !clips) {
    console.error(`[GuardRails] Failed to fetch clips:`, error);
    return [];
  }
  
  const now = Date.now();
  const statuses: ClipHealthStatus[] = [];
  
  for (const clip of clips) {
    const ageMs = now - new Date(clip.updated_at).getTime();
    const createdAgeMs = now - new Date(clip.created_at).getTime();
    
    let status: ClipHealthStatus['status'] = 'healthy';
    let suggestedAction: string | undefined;
    
    if (clip.status === 'completed' && clip.video_url) {
      status = 'healthy';
    } else if (clip.status === 'failed') {
      status = 'failed';
      suggestedAction = 'retry_clip';
    } else if (clip.status === 'generating') {
      // Check if stuck
      if (ageMs > GUARD_RAIL_CONFIG.CLIP_GENERATING_MAX_AGE_MS) {
        status = 'stuck';
        suggestedAction = clip.veo_operation_name ? 'check_prediction' : 'retry_clip';
      } else if (ageMs > GUARD_RAIL_CONFIG.CLIP_STUCK_THRESHOLD_MS) {
        status = 'stuck';
        suggestedAction = 'wait_or_check';
      }
    } else if (clip.status === 'pending' && createdAgeMs > GUARD_RAIL_CONFIG.CLIP_STUCK_THRESHOLD_MS) {
      status = 'stuck';
      suggestedAction = 'trigger_generation';
    }
    
    statuses.push({
      clipIndex: clip.shot_index,
      status,
      ageMs,
      hasPredictionId: !!clip.veo_operation_name,
      hasVideoUrl: !!clip.video_url,
      hasLastFrame: !!clip.last_frame_url,
      suggestedAction,
    });
  }
  
  return statuses;
}

// =====================================================
// AUTOMATIC MUTEX RECOVERY
// =====================================================

export async function checkAndRecoverStaleMutex(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ wasStale: boolean; releasedClip?: number }> {
  const { data: project, error } = await supabase
    .from('movie_projects')
    .select('generation_lock')
    .eq('id', projectId)
    .single();
  
  if (error || !project?.generation_lock) {
    return { wasStale: false };
  }
  
  const lock = project.generation_lock as {
    locked_at: string;
    locked_by_clip: number;
    lock_id: string;
  };
  
  const lockAgeMs = Date.now() - new Date(lock.locked_at).getTime();
  
  if (lockAgeMs > GUARD_RAIL_CONFIG.MUTEX_STALE_THRESHOLD_MS) {
    console.log(`[GuardRails] 🔓 Releasing stale mutex (age: ${Math.round(lockAgeMs / 1000)}s, clip: ${lock.locked_by_clip})`);
    
    await supabase
      .from('movie_projects')
      .update({
        generation_lock: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
    
    return { wasStale: true, releasedClip: lock.locked_by_clip };
  }
  
  if (lockAgeMs > GUARD_RAIL_CONFIG.MUTEX_WARNING_THRESHOLD_MS) {
    console.warn(`[GuardRails] ⚠️ Mutex held for ${Math.round(lockAgeMs / 1000)}s by clip ${lock.locked_by_clip}`);
  }
  
  return { wasStale: false };
}

// =====================================================
// PIPELINE HEALTH CHECK
// =====================================================

export async function checkPipelineHealth(
  supabase: SupabaseClient,
  projectId: string
): Promise<PipelineHealthReport> {
  const recommendations: string[] = [];
  
  // Check mutex status
  const mutexResult = await checkAndRecoverStaleMutex(supabase, projectId);
  const mutexStatus: 'free' | 'held' | 'stale' = mutexResult.wasStale ? 'stale' : 'free';
  
  if (mutexResult.wasStale) {
    recommendations.push(`Released stale mutex from clip ${mutexResult.releasedClip}`);
  }
  
  // Check clip statuses
  const clipStatuses = await detectStuckClips(supabase, projectId);
  
  const completedCount = clipStatuses.filter(c => c.status === 'healthy').length;
  const failedCount = clipStatuses.filter(c => c.status === 'failed').length;
  const stuckCount = clipStatuses.filter(c => c.status === 'stuck').length;
  
  // Determine overall status
  let overallStatus: PipelineHealthReport['overallStatus'] = 'healthy';
  
  if (stuckCount > 0) {
    overallStatus = 'stalled';
    recommendations.push(`${stuckCount} clip(s) appear stuck - check predictions or retry`);
  } else if (failedCount > 0) {
    overallStatus = 'degraded';
    recommendations.push(`${failedCount} clip(s) failed - consider retry`);
  }
  
  // Check for clips without last frames (breaks continuity chain)
  const missingFrames = clipStatuses.filter(c => c.status === 'healthy' && !c.hasLastFrame);
  if (missingFrames.length > 0) {
    recommendations.push(`${missingFrames.length} completed clip(s) missing last frame - run frame extraction`);
  }
  
  return {
    projectId,
    overallStatus,
    mutexStatus,
    clipStatuses,
    completedCount,
    failedCount,
    stuckCount,
    recommendations,
  };
}

// =====================================================
// FRAME EXTRACTION WITH GUARANTEED FALLBACK
// =====================================================

/**
 * Get a valid last frame URL with fallback chain
 * NEVER returns null if ANY fallback source is available
 */
export function getGuaranteedLastFrame(
  shotIndex: number,
  sources: {
    extractedFrame?: string;
    referenceImageUrl?: string;
    sceneImageUrl?: string;
    previousClipLastFrame?: string;
    identityBibleImageUrl?: string;
  }
): { frameUrl: string | null; source: string; confidence: 'high' | 'medium' | 'low' } {
  // CLIP 0 SPECIAL CASE: Always use reference image
  if (shotIndex === 0) {
    return getClip0LastFrame(sources.referenceImageUrl, sources.extractedFrame);
  }
  
  // CLIP 1+ FALLBACK CHAIN
  const chain = [
    { url: sources.extractedFrame, source: 'extracted_frame', confidence: 'high' as const },
    { url: sources.previousClipLastFrame, source: 'previous_clip_frame', confidence: 'high' as const },
    { url: sources.sceneImageUrl, source: 'scene_image', confidence: 'medium' as const },
    { url: sources.referenceImageUrl, source: 'reference_image', confidence: 'medium' as const },
    { url: sources.identityBibleImageUrl, source: 'identity_bible', confidence: 'low' as const },
  ];
  
  for (const { url, source, confidence } of chain) {
    if (url && isValidImageUrl(url)) {
      console.log(`[GuardRails] Last frame for clip ${shotIndex}: ${source} (${confidence})`);
      return { frameUrl: url, source, confidence };
    }
  }
  
  console.error(`[GuardRails] ❌ No valid last frame for clip ${shotIndex}!`);
  return { frameUrl: null, source: 'none', confidence: 'low' };
}

// =====================================================
// AUTOMATIC RECOVERY TRIGGERS
// =====================================================

export interface RecoveryAction {
  type: 'release_mutex' | 'check_prediction' | 'use_fallback_frame' | 'retry_clip' | 'trigger_watchdog';
  projectId: string;
  clipIndex?: number;
  data?: Record<string, any>;
}

export async function determineRecoveryActions(
  supabase: SupabaseClient,
  projectId: string
): Promise<RecoveryAction[]> {
  const actions: RecoveryAction[] = [];
  const healthReport = await checkPipelineHealth(supabase, projectId);
  
  // 1. Stale mutex recovery
  if (healthReport.mutexStatus === 'stale') {
    actions.push({
      type: 'release_mutex',
      projectId,
    });
  }
  
  // 2. Stuck clips with predictions - check if completed
  for (const clip of healthReport.clipStatuses) {
    if (clip.status === 'stuck' && clip.hasPredictionId) {
      actions.push({
        type: 'check_prediction',
        projectId,
        clipIndex: clip.clipIndex,
      });
    }
  }
  
  // 3. Clips missing last frame - use fallback
  for (const clip of healthReport.clipStatuses) {
    if (clip.status === 'healthy' && !clip.hasLastFrame) {
      actions.push({
        type: 'use_fallback_frame',
        projectId,
        clipIndex: clip.clipIndex,
      });
    }
  }
  
  // 4. Failed clips - retry
  for (const clip of healthReport.clipStatuses) {
    if (clip.status === 'failed') {
      actions.push({
        type: 'retry_clip',
        projectId,
        clipIndex: clip.clipIndex,
      });
    }
  }
  
  return actions;
}

// =====================================================
// PRE-GENERATION VALIDATION
// =====================================================

export interface PreGenerationCheckResult {
  canProceed: boolean;
  blockers: string[];
  warnings: string[];
  resolvedFrameUrl?: string;
  resolvedFrameSource?: string;
}

export async function runPreGenerationChecks(
  supabase: SupabaseClient,
  projectId: string,
  shotIndex: number,
  context: {
    referenceImageUrl?: string;
    sceneImageUrl?: string;
    previousClipLastFrame?: string;
    identityBibleImageUrl?: string;
  }
): Promise<PreGenerationCheckResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  
  // 1. Check for stale mutex and recover
  const mutexResult = await checkAndRecoverStaleMutex(supabase, projectId);
  if (mutexResult.wasStale) {
    warnings.push(`Released stale mutex from clip ${mutexResult.releasedClip}`);
  }
  
  // 2. For clip 1+, verify previous clip is complete with frame
  if (shotIndex > 0) {
    const { data: prevClip } = await supabase
      .from('video_clips')
      .select('status, video_url, last_frame_url')
      .eq('project_id', projectId)
      .eq('shot_index', shotIndex - 1)
      .maybeSingle();
    
    if (!prevClip) {
      blockers.push(`Previous clip (${shotIndex - 1}) does not exist`);
    } else if (prevClip.status !== 'completed') {
      blockers.push(`Previous clip (${shotIndex - 1}) is not completed (status: ${prevClip.status})`);
    } else if (!prevClip.last_frame_url && !context.previousClipLastFrame) {
      // Try to use reference image as fallback
      if (context.referenceImageUrl && isValidImageUrl(context.referenceImageUrl)) {
        warnings.push(`Previous clip missing last frame - using reference image as fallback`);
        context.previousClipLastFrame = context.referenceImageUrl;
      } else {
        blockers.push(`Previous clip (${shotIndex - 1}) has no last frame and no fallback available`);
      }
    }
  }
  
  // 3. Resolve start frame for this clip
  const frameResult = getGuaranteedLastFrame(
    shotIndex === 0 ? 0 : shotIndex - 1, // For clip 0, get clip 0's start; for others, get previous clip's last
    {
      extractedFrame: context.previousClipLastFrame,
      referenceImageUrl: context.referenceImageUrl,
      sceneImageUrl: context.sceneImageUrl,
      identityBibleImageUrl: context.identityBibleImageUrl,
    }
  );
  
  if (!frameResult.frameUrl) {
    blockers.push(`No valid start frame available for clip ${shotIndex}`);
  }
  
  return {
    canProceed: blockers.length === 0,
    blockers,
    warnings,
    resolvedFrameUrl: frameResult.frameUrl || undefined,
    resolvedFrameSource: frameResult.source,
  };
}

// =====================================================
// ORPHANED VIDEO RECOVERY - Scans storage for videos
// that exist but aren't linked to clip records
// =====================================================

export interface OrphanedVideoResult {
  found: boolean;
  videoUrl?: string;
  storagePath?: string;
  createdAt?: string;
}

/**
 * Check if a video already exists in storage for a given clip
 * This recovers clips where the video was stored but DB update failed
 */
export async function findOrphanedVideo(
  supabase: SupabaseClient,
  projectId: string,
  shotIndex: number
): Promise<OrphanedVideoResult> {
  try {
    // List files in the project's video-clips folder
    const { data: files, error } = await supabase.storage
      .from('video-clips')
      .list(projectId, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
    
    if (error || !files) {
      console.warn(`[GuardRails] Failed to list storage files:`, error);
      return { found: false };
    }
    
    // Look for clips matching this shot index
    // File naming pattern: clip_${projectId}_${clipIndex}_${timestamp}.mp4
    const matchingFile = files.find(f => 
      f.name.includes(`_${shotIndex}_`) && 
      f.name.endsWith('.mp4')
    );
    
    if (matchingFile) {
      const storagePath = `${projectId}/${matchingFile.name}`;
      const { data: { publicUrl } } = supabase.storage
        .from('video-clips')
        .getPublicUrl(storagePath);
      
      console.log(`[GuardRails] ✓ Found orphaned video for clip ${shotIndex + 1}: ${matchingFile.name}`);
      
      return {
        found: true,
        videoUrl: publicUrl,
        storagePath,
        createdAt: matchingFile.created_at,
      };
    }
    
    return { found: false };
  } catch (err) {
    console.error(`[GuardRails] Orphaned video scan error:`, err);
    return { found: false };
  }
}

/**
 * Recover a stuck clip by checking storage for existing video
 * and updating the database record accordingly
 */
export async function recoverStuckClip(
  supabase: SupabaseClient,
  projectId: string,
  shotIndex: number,
  clipId: string,
  referenceImageUrl?: string
): Promise<{ recovered: boolean; videoUrl?: string; reason?: string }> {
  try {
    console.log(`[GuardRails] Attempting to recover stuck clip ${shotIndex + 1} (${clipId})...`);
    
    // Step 1: Check if video already exists in storage
    const orphanedVideo = await findOrphanedVideo(supabase, projectId, shotIndex);
    
    if (orphanedVideo.found && orphanedVideo.videoUrl) {
      console.log(`[GuardRails] ✓ Found existing video in storage - updating clip record`);
      
      // Update clip record with the found video
      const updateData: Record<string, any> = {
        status: 'completed',
        video_url: orphanedVideo.videoUrl,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        frame_extraction_status: 'pending', // Will need to extract frame
      };
      
      // For Clip 0, use reference image as last_frame_url
      if (shotIndex === 0 && referenceImageUrl && isValidImageUrl(referenceImageUrl)) {
        updateData.last_frame_url = referenceImageUrl;
        console.log(`[GuardRails] ✓ Set Clip 0 last_frame_url to reference image`);
      }
      
      await supabase
        .from('video_clips')
        .update(updateData)
        .eq('id', clipId);
      
      // Release any stale mutex
      await supabase
        .from('movie_projects')
        .update({
          generation_lock: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
      
      console.log(`[GuardRails] ✓ Clip ${shotIndex + 1} recovered and mutex released`);
      
      return { 
        recovered: true, 
        videoUrl: orphanedVideo.videoUrl,
        reason: 'Found existing video in storage',
      };
    }
    
    console.log(`[GuardRails] No orphaned video found for clip ${shotIndex + 1}`);
    return { recovered: false, reason: 'No video in storage' };
  } catch (err) {
    console.error(`[GuardRails] Clip recovery error:`, err);
    return { recovered: false, reason: `Error: ${err}` };
  }
}

/**
 * Aggressively detect and recover ALL stuck clips for a project
 * This should be called by the watchdog for comprehensive recovery
 */
export async function recoverAllStuckClips(
  supabase: SupabaseClient,
  projectId: string,
  referenceImageUrl?: string
): Promise<{ recoveredCount: number; details: Array<{ clipIndex: number; result: string }> }> {
  const details: Array<{ clipIndex: number; result: string }> = [];
  let recoveredCount = 0;
  
  // Find all clips stuck in "generating" for more than 2 minutes
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  
  const { data: stuckClips, error } = await supabase
    .from('video_clips')
    .select('id, shot_index, status, video_url, updated_at')
    .eq('project_id', projectId)
    .eq('status', 'generating')
    .lt('updated_at', twoMinutesAgo)
    .order('shot_index');
  
  if (error || !stuckClips || stuckClips.length === 0) {
    return { recoveredCount: 0, details };
  }
  
  console.log(`[GuardRails] Found ${stuckClips.length} stuck clips to recover`);
  
  for (const clip of stuckClips) {
    const result = await recoverStuckClip(
      supabase, 
      projectId, 
      clip.shot_index, 
      clip.id,
      referenceImageUrl
    );
    
    if (result.recovered) {
      recoveredCount++;
      details.push({ 
        clipIndex: clip.shot_index, 
        result: `Recovered: ${result.reason}`,
      });
    } else {
      details.push({ 
        clipIndex: clip.shot_index, 
        result: `Not recovered: ${result.reason}`,
      });
    }
  }
  
  return { recoveredCount, details };
}
