import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseRetryStitchOptions {
  projectId: string | null;
  userId: string | undefined;
  onSuccess?: (videoUrl: string) => void;
  onStatusChange?: (status: string) => void;
}

export function useRetryStitch({ projectId, userId, onSuccess, onStatusChange }: UseRetryStitchOptions) {
  const [isRetrying, setIsRetrying] = useState(false);

  const retryStitch = useCallback(async () => {
    if (!projectId || !userId || isRetrying) return;

    setIsRetrying(true);
    toast.info('Creating playback manifest...', { description: 'This should complete in a few seconds' });

    try {
      // Update project status to stitching
      const { error: updateError } = await supabase
        .from('movie_projects')
        .update({ 
          status: 'stitching',
          pending_video_tasks: {
            stage: 'stitching',
            progress: 10,
            stitchingStarted: new Date().toISOString(),
          }
        })
        .eq('id', projectId);

      if (updateError) throw updateError;
      
      onStatusChange?.('stitching');

      // Call simple-stitch edge function for manifest creation
      const { data, error: stitchError } = await supabase.functions.invoke('simple-stitch', {
        body: {
          projectId,
          userId,
        },
      });

      if (stitchError) throw stitchError;

      if (data?.success && data?.finalVideoUrl) {
        toast.success('Manifest created successfully!');
        onSuccess?.(data.finalVideoUrl);
        onStatusChange?.('completed');
      } else {
        throw new Error(data?.error || 'Stitch returned no result');
      }
    } catch (err) {
      console.error('Retry stitch failed:', err);
      toast.error('Stitch retry failed', { 
        description: 'Please try again shortly' 
      });
      
      // Reset status to failed
      await supabase
        .from('movie_projects')
        .update({ status: 'stitching_failed' })
        .eq('id', projectId);
      
      onStatusChange?.('stitching_failed');
    } finally {
      setIsRetrying(false);
    }
  }, [projectId, userId, isRetrying, onSuccess, onStatusChange]);

  return { retryStitch, isRetrying };
}
