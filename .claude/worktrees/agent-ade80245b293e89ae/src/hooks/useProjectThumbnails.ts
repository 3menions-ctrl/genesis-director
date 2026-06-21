import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ThumbnailResult {
  projectId: string;
  thumbnailUrl: string | null;
  success: boolean;
}

export function useProjectThumbnails() {
  const [generatingThumbnails, setGeneratingThumbnails] = useState<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());

  const generateThumbnail = useCallback(async (
    projectId: string, 
    videoUrl: string
  ): Promise<ThumbnailResult> => {
    // Prevent duplicate calls for same project
    if (pendingRef.current.has(projectId)) {
      return { projectId, thumbnailUrl: null, success: false };
    }

    pendingRef.current.add(projectId);
    setGeneratingThumbnails(prev => new Set(prev).add(projectId));

    try {
      console.log(`[Thumbnails] Generating thumbnail for project ${projectId}`);
      
      const { data, error } = await supabase.functions.invoke('generate-project-thumbnail', {
        body: { projectId, videoUrl }
      });

      if (error) {
        console.error(`[Thumbnails] Error for ${projectId}:`, error);
        return { projectId, thumbnailUrl: null, success: false };
      }

      if (data?.success && data?.thumbnailUrl) {
        console.log(`[Thumbnails] ✓ Generated thumbnail for ${projectId}`);
        return { projectId, thumbnailUrl: data.thumbnailUrl, success: true };
      }

      if (data?.skipped) {
        console.log(`[Thumbnails] Skipped ${projectId} - already has thumbnail`);
        return { projectId, thumbnailUrl: data.thumbnailUrl, success: true };
      }

      return { projectId, thumbnailUrl: null, success: false };
    } catch (err) {
      console.error(`[Thumbnails] Failed for ${projectId}:`, err);
      return { projectId, thumbnailUrl: null, success: false };
    } finally {
      pendingRef.current.delete(projectId);
      setGeneratingThumbnails(prev => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    }
  }, []);

  const generateMissingThumbnails = useCallback(async (
    projects: Array<{ id: string; video_url: string | null; thumbnail_url: string | null; resolvedClipUrl?: string | null }>
  ) => {
    // Filter projects that need thumbnails - use resolvedClipUrl (mp4) if video_url is a manifest
    const needsThumbnail = projects.filter(p => {
      if (p.thumbnail_url) return false; // Already has thumbnail
      const videoSource = p.resolvedClipUrl || p.video_url;
      return videoSource && videoSource.endsWith('.mp4') && !videoSource.includes('replicate.delivery');
    });

    if (needsThumbnail.length === 0) {
      return;
    }

    console.log(`[Thumbnails] ${needsThumbnail.length} projects need thumbnails`);

    // Process up to 3 at a time to avoid overwhelming the server
    const batchSize = 3;
    for (let i = 0; i < needsThumbnail.length; i += batchSize) {
      const batch = needsThumbnail.slice(i, i + batchSize);
      await Promise.all(
        batch.map(p => generateThumbnail(p.id, (p.resolvedClipUrl || p.video_url)!))
      );
    }
  }, [generateThumbnail]);

  const isGenerating = useCallback((projectId: string) => {
    return generatingThumbnails.has(projectId);
  }, [generatingThumbnails]);

  return {
    generateThumbnail,
    generateMissingThumbnails,
    isGenerating,
    generatingThumbnails
  };
}
