import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EditorClip {
  id: string;
  projectId: string;
  projectTitle: string;
  shotIndex: number;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  prompt: string;
}

export interface EditorImage {
  id: string;
  url: string;
  label: string;
  source: "frame" | "source_image";
  shotIndex?: number;
}

/**
 * Fetches completed video clips AND associated images for a single project.
 * Requires a projectId — returns nothing if not provided.
 */
export function useEditorClips(projectId?: string | null) {
  const { user } = useAuth();
  const [clips, setClips] = useState<EditorClip[]>([]);
  const [images, setImages] = useState<EditorImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !projectId) {
      setClips([]);
      setImages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchClips() {
      setLoading(true);
      setError(null);

      try {
        // Fetch clips for this specific project only
        const [clipsResult, projectResult] = await Promise.all([
          supabase
            .from("video_clips")
            .select("id, project_id, shot_index, video_url, last_frame_url, duration_seconds, prompt, status")
            .eq("project_id", projectId!)
            .eq("user_id", user!.id)
            .eq("status", "completed")
            .not("video_url", "is", null)
            .order("shot_index", { ascending: true })
            .limit(200),
          supabase
            .from("movie_projects")
            .select("id, title, source_image_url")
            .eq("id", projectId!)
            .single(),
        ]);

        if (clipsResult.error) throw clipsResult.error;
        if (cancelled) return;

        const projectTitle = projectResult.data?.title || "Untitled";
        const sourceImageUrl = projectResult.data?.source_image_url;

        // Map clips
        const mapped: EditorClip[] = (clipsResult.data || []).map((c) => ({
          id: c.id,
          projectId: c.project_id,
          projectTitle,
          shotIndex: c.shot_index,
          videoUrl: c.video_url!,
          thumbnailUrl: c.last_frame_url,
          durationSeconds: c.duration_seconds,
          prompt: c.prompt,
        }));

        // Collect images: last_frame_url from each clip + source_image_url from project
        const collectedImages: EditorImage[] = [];

        for (const c of clipsResult.data || []) {
          if (c.last_frame_url) {
            collectedImages.push({
              id: `frame-${c.id}`,
              url: c.last_frame_url,
              label: `Shot ${c.shot_index + 1} – Frame`,
              source: "frame",
              shotIndex: c.shot_index,
            });
          }
        }

        if (sourceImageUrl) {
          collectedImages.push({
            id: `source-${projectId}`,
            url: sourceImageUrl,
            label: "Source Image",
            source: "source_image",
          });
        }

        if (!cancelled) {
          setClips(mapped);
          setImages(collectedImages);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Failed to fetch editor clips:", err);
          setError(err.message || "Failed to load clips");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchClips();
    return () => { cancelled = true; };
  }, [user, projectId]);

  return { clips, images, loading, error, refetch: () => {} };
}
