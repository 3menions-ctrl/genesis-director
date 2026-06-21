import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Last-resort safety net.
 *
 * Webhook + poll-replicate-prediction are the primary completion paths,
 * but if BOTH fail (e.g. webhook signature mis-config, edge function crash),
 * clips can stay 'processing' forever and the UI never updates.
 *
 * This hook polls the user's own video_clips rows that are still
 * 'processing' (or 'generating') with a known prediction id, and calls
 * check-video-status with autoComplete=true so the clip flips to
 * 'completed' as soon as Replicate confirms success.
 *
 * Cheap: only fires when there is at least one pending clip.
 */
export function usePendingVideoRecovery(intervalMs = 20000) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const { data: pending } = await supabase
          .from('video_clips')
          .select('id, project_id, shot_index, replicate_prediction_id, veo_operation_name, status')
          .eq('user_id', userId)
          .in('status', ['processing', 'generating'])
          .order('updated_at', { ascending: true })
          .limit(20);

        if (cancelled || !pending || pending.length === 0) return;

        await Promise.allSettled(
          pending.map(async (clip: any) => {
            const taskId = clip.replicate_prediction_id || clip.veo_operation_name;
            if (!taskId) return;
            try {
              await supabase.functions.invoke('check-video-status', {
                body: {
                  taskId,
                  provider: 'replicate',
                  projectId: clip.project_id,
                  shotIndex: clip.shot_index,
                  userId,
                  autoComplete: true,
                },
              });
            } catch (err) {
              // swallow — safety net should never throw
              console.debug('[PendingVideoRecovery] check-video-status failed:', err);
            }
          })
        );
      } catch (err) {
        console.debug('[PendingVideoRecovery] poll error:', err);
      } finally {
        inFlightRef.current = false;
      }
    };

    // Run once immediately, then on interval
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [userId, intervalMs]);
}
