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
    toast.info('Retrying video stitching...', { description: 'This may take 1-3 minutes' });

    try {
      // First, update project status to stitching
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

      // Get all completed clips
      const { data: clips, error: clipsError } = await supabase
        .from('video_clips')
        .select('id, shot_index, video_url, duration_seconds')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('shot_index');

      if (clipsError) throw clipsError;
      if (!clips || clips.length === 0) throw new Error('No completed clips found');

      // Get project title
      const { data: project } = await supabase
        .from('movie_projects')
        .select('title')
        .eq('id', projectId)
        .maybeSingle();

      // Call simple-stitch edge function
      const { data, error: stitchError } = await supabase.functions.invoke('simple-stitch', {
        body: {
          projectId,
          userId,
          projectTitle: project?.title || 'Untitled',
          clips: clips.map(c => ({
            url: c.video_url,
            duration: c.duration_seconds || 4,
          })),
        },
      });

      if (stitchError) throw stitchError;

      if (data?.success && data?.finalVideoUrl) {
        toast.success('Video stitched successfully!');
        onSuccess?.(data.finalVideoUrl);
        onStatusChange?.('completed');
      } else if (data?.mode === 'async' || data?.stitchMode === 'cloud-run-async') {
        toast.info('Stitching in progress', { 
          description: 'Cloud Run is processing. Will complete in 1-3 minutes.' 
        });
      } else {
        throw new Error(data?.error || 'Stitch returned no result');
      }
    } catch (err: any) {
      console.error('Retry stitch failed:', err);
      toast.error('Stitch retry failed', { 
        description: err.message || 'Please try again' 
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
