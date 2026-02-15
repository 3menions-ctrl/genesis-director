import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StuckClip {
  id: string;
  shot_index: number;
  veo_operation_name: string | null;
  status: string;
  updated_at: string;
}

interface RecoveryResult {
  recovered: number;
  checked: number;
  errors: string[];
}

/**
 * Hook to proactively detect and recover stuck clips on page load
 * This catches clips that completed on Replicate but weren't saved to the DB
 */
export function useClipRecovery(projectId: string | null, userId: string | null) {
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastRecovery, setLastRecovery] = useState<RecoveryResult | null>(null);
  const hasRunRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // Mount guard
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkAndRecoverClips = useCallback(async (): Promise<RecoveryResult> => {
    if (!projectId || !userId || !isMountedRef.current) {
      return { recovered: 0, checked: 0, errors: [] };
    }

    const result: RecoveryResult = { recovered: 0, checked: 0, errors: [] };
    if (isMountedRef.current) setIsRecovering(true);

    try {
      // Find clips stuck in "generating" for more than 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      const { data: stuckClips, error } = await supabase
        .from('video_clips')
        .select('id, shot_index, veo_operation_name, status, updated_at')
        .eq('project_id', projectId)
        .eq('status', 'generating')
        .lt('updated_at', twoMinutesAgo);

      if (!isMountedRef.current) return result;
      
      if (error || !stuckClips || stuckClips.length === 0) {
        if (isMountedRef.current) setIsRecovering(false);
        return result;
      }

      console.log(`[ClipRecovery] Found ${stuckClips.length} stuck clips to check`);

      // Check each stuck clip with a prediction ID
      for (const clip of stuckClips as StuckClip[]) {
        if (!clip.veo_operation_name || !isMountedRef.current) continue;
        
        result.checked++;

        try {
          // Call check-video-status with autoComplete to recover
          const { data: statusData, error: statusError } = await supabase.functions.invoke(
            'check-video-status',
            {
              body: {
                taskId: clip.veo_operation_name,
                provider: 'replicate',
                projectId,
                userId,
                shotIndex: clip.shot_index,
                autoComplete: true,
              },
            }
          );

          if (statusError) {
            console.debug(`[ClipRecovery] Error checking clip ${clip.shot_index + 1}:`, statusError.message);
            result.errors.push(`Clip ${clip.shot_index + 1}: ${statusError.message}`);
            continue;
          }

          if (statusData?.status === 'SUCCEEDED' && statusData?.autoCompleted) {
            console.log(`[ClipRecovery] ✓ Recovered clip ${clip.shot_index + 1}`);
            result.recovered++;
          } else if (statusData?.status === 'FAILED') {
            console.log(`[ClipRecovery] Clip ${clip.shot_index + 1} failed: ${statusData.error}`);
          } else if (statusData?.status === 'RUNNING') {
            console.log(`[ClipRecovery] Clip ${clip.shot_index + 1} still processing`);
          }
        } catch (err) {
          console.debug(`[ClipRecovery] Recovery error for clip ${clip.shot_index + 1}:`, err);
          result.errors.push(`Clip ${clip.shot_index + 1}: recovery failed`);
        }
      }

      if (!isMountedRef.current) return result;
      
      // If we recovered any clips, trigger continue-production to resume pipeline
      if (result.recovered > 0) {
        toast.success(`Recovered ${result.recovered} stuck clip(s)`, {
          description: 'Pipeline will continue automatically',
        });

        // Get latest clip statuses to determine next action
        const { data: allClips } = await supabase
          .from('video_clips')
          .select('shot_index, status')
          .eq('project_id', projectId)
          .order('shot_index');

        const completedCount = (allClips || []).filter(c => c.status === 'completed').length;
        const lastCompleted = Math.max(
          -1,
          ...(allClips || [])
            .filter(c => c.status === 'completed')
            .map(c => c.shot_index)
        );

        // Trigger continue-production
        try {
          await supabase.functions.invoke('continue-production', {
            body: {
              projectId,
              userId,
              completedClipIndex: lastCompleted,
              totalClips: (allClips || []).length,
            },
          });
          console.log(`[ClipRecovery] Triggered continue-production from clip ${lastCompleted + 1}`);
        } catch (err) {
          console.warn(`[ClipRecovery] Failed to trigger continue-production:`, err);
        }
      }

      if (isMountedRef.current) setLastRecovery(result);
      return result;
    } catch (err) {
      console.debug('[ClipRecovery] Error:', err);
      result.errors.push('Recovery check failed');
      return result;
    } finally {
      if (isMountedRef.current) setIsRecovering(false);
    }
  }, [projectId, userId]);

  // Run recovery check once on mount
  useEffect(() => {
    if (!projectId || !userId || hasRunRef.current) return;
    
    hasRunRef.current = true;
    
    // Delay slightly to let the page load first
    const timeout = setTimeout(() => {
      checkAndRecoverClips().then(result => {
        if (result.recovered > 0) {
          console.log(`[ClipRecovery] Initial recovery: ${result.recovered}/${result.checked}`);
        }
      });
    }, 1500);

    return () => clearTimeout(timeout);
  }, [projectId, userId, checkAndRecoverClips]);

  return {
    isRecovering,
    lastRecovery,
    checkAndRecoverClips,
  };
}
