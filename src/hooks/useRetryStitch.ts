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

      // =====================================================
      // IRON-CLAD BEST CLIP SELECTION
      // Get ALL completed clips with quality_score, then select BEST per shot_index
      // =====================================================
      const { data: allClips, error: clipsError } = await supabase
        .from('video_clips')
        .select('id, shot_index, video_url, duration_seconds, quality_score, created_at')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('shot_index')
        .order('quality_score', { ascending: false, nullsFirst: false });

      if (clipsError) throw clipsError;
      if (!allClips || allClips.length === 0) throw new Error('No completed clips found');
      
      // Select BEST clip per shot_index
      const bestClipsMap = new Map<number, typeof allClips[0]>();
      
      for (const clip of allClips) {
        const existing = bestClipsMap.get(clip.shot_index);
        
        if (!existing) {
          bestClipsMap.set(clip.shot_index, clip);
        } else {
          const existingScore = existing.quality_score ?? -1;
          const newScore = clip.quality_score ?? -1;
          
          if (newScore > existingScore || 
              (newScore === existingScore && clip.created_at > existing.created_at)) {
            bestClipsMap.set(clip.shot_index, clip);
          }
        }
      }
      
      const clips = Array.from(bestClipsMap.values()).sort((a, b) => a.shot_index - b.shot_index);
      console.log(`[RetryStitch] Selected ${clips.length} BEST clips from ${allClips.length} total versions`);

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
            duration: c.duration_seconds || 6,
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
