import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { stitchVideos, downloadBlob, uploadStitchedVideo, StitchProgress, StitchOptions } from '@/utils/browserVideoStitcher';
import { toast } from 'sonner';

export interface UseBrowserStitcherOptions {
  projectId: string;
  onComplete?: (videoUrl: string) => void;
  onError?: (error: Error) => void;
}

export interface UseBrowserStitcherResult {
  isStitching: boolean;
  progress: StitchProgress | null;
  stitchedBlob: Blob | null;
  stitchedUrl: string | null;
  startStitching: (clipUrls: string[], options?: Partial<StitchOptions>) => Promise<void>;
  downloadVideo: () => void;
  uploadVideo: () => Promise<string | null>;
  reset: () => void;
}

export function useBrowserStitcher({
  projectId,
  onComplete,
  onError,
}: UseBrowserStitcherOptions): UseBrowserStitcherResult {
  const [isStitching, setIsStitching] = useState(false);
  const [progress, setProgress] = useState<StitchProgress | null>(null);
  const [stitchedBlob, setStitchedBlob] = useState<Blob | null>(null);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null);

  const startStitching = useCallback(async (
    clipUrls: string[],
    options?: Partial<StitchOptions>
  ) => {
    if (clipUrls.length === 0) {
      toast.error('No clips to stitch');
      return;
    }

    setIsStitching(true);
    setStitchedBlob(null);
    setStitchedUrl(null);
    
    toast.info('Starting browser-based stitching...', {
      description: 'This may take 30-90 seconds depending on video length',
    });

    try {
      const blob = await stitchVideos(clipUrls, {
        ...options,
        onProgress: setProgress,
      });

      setStitchedBlob(blob);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(blob);
      setStitchedUrl(previewUrl);

      toast.success('Video stitched successfully!', {
        description: 'You can now download or upload the video',
      });

      onComplete?.(previewUrl);
    } catch (error) {
      console.error('Browser stitching failed:', error);
      const err = error instanceof Error ? error : new Error('Stitching failed');
      
      setProgress({
        phase: 'error',
        currentClip: 0,
        totalClips: clipUrls.length,
        percentComplete: 0,
        message: err.message,
      });
      
      toast.error('Stitching failed', {
        description: err.message,
      });
      
      onError?.(err);
    } finally {
      setIsStitching(false);
    }
  }, [onComplete, onError]);

  const downloadVideo = useCallback(() => {
    if (!stitchedBlob) {
      toast.error('No video to download');
      return;
    }

    const filename = `project-${projectId}-stitched-${Date.now()}.webm`;
    downloadBlob(stitchedBlob, filename);
    toast.success('Download started!');
  }, [stitchedBlob, projectId]);

  const uploadVideo = useCallback(async (): Promise<string | null> => {
    if (!stitchedBlob) {
      toast.error('No video to upload');
      return null;
    }

    try {
      toast.info('Uploading stitched video...');
      
      const url = await uploadStitchedVideo(stitchedBlob, projectId, supabase);
      
      // Update project with new video URL
      const { error } = await supabase
        .from('movie_projects')
        .update({ video_url: url })
        .eq('id', projectId);

      if (error) {
        console.warn('Failed to update project video_url:', error);
      }

      toast.success('Video uploaded successfully!');
      return url;
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }, [stitchedBlob, projectId]);

  const reset = useCallback(() => {
    if (stitchedUrl) {
      URL.revokeObjectURL(stitchedUrl);
    }
    setIsStitching(false);
    setProgress(null);
    setStitchedBlob(null);
    setStitchedUrl(null);
  }, [stitchedUrl]);

  return {
    isStitching,
    progress,
    stitchedBlob,
    stitchedUrl,
    startStitching,
    downloadVideo,
    uploadVideo,
    reset,
  };
}
