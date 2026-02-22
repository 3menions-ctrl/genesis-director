import { useState, useCallback } from "react";
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

export interface ProjectSummary {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  clipCount: number;
  updatedAt: string;
}

/**
 * On-demand clip loading hook.
 * - listProjects(): lightweight list of user's projects with clip counts
 * - loadProjectClips(projectId): fetches clips + images for a single project
 */
export function useEditorClips() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fetch a lightweight list of the user's projects that have completed clips */
  const listProjects = useCallback(async (): Promise<ProjectSummary[]> => {
    if (!user) return [];
    setLoading(true);
    setError(null);

    try {
      // Get projects with at least one completed clip
      const { data: clips, error: err } = await supabase
        .from("video_clips")
        .select("project_id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("video_url", "is", null);

      if (err) throw err;

      const projectIds = [...new Set((clips || []).map(c => c.project_id))];
      if (projectIds.length === 0) return [];

      // Fetch project details
      const { data: projects, error: pErr } = await supabase
        .from("movie_projects")
        .select("id, title, thumbnail_url, video_url, updated_at")
        .in("id", projectIds)
        .order("updated_at", { ascending: false });

      if (pErr) throw pErr;

      // Count clips per project
      const clipCounts: Record<string, number> = {};
      for (const c of clips || []) {
        clipCounts[c.project_id] = (clipCounts[c.project_id] || 0) + 1;
      }

      return (projects || []).map(p => ({
        id: p.id,
        title: p.title || "Untitled",
        thumbnailUrl: p.thumbnail_url,
        videoUrl: p.video_url,
        clipCount: clipCounts[p.id] || 0,
        updatedAt: p.updated_at,
      }));
    } catch (err: any) {
      console.error("Failed to list projects:", err);
      setError(err.message || "Failed to list projects");
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  /** Load clips + images for a single project (on-demand) */
  const loadProjectClips = useCallback(async (
    projectId: string
  ): Promise<{ clips: EditorClip[]; images: EditorImage[] }> => {
    if (!user) return { clips: [], images: [] };
    setLoading(true);
    setError(null);

    try {
      const [clipsResult, projectResult] = await Promise.all([
        supabase
          .from("video_clips")
          .select("id, project_id, shot_index, video_url, last_frame_url, duration_seconds, prompt, status")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .eq("status", "completed")
          .not("video_url", "is", null)
          .order("shot_index", { ascending: true })
          .limit(200),
        supabase
          .from("movie_projects")
          .select("id, title, source_image_url")
          .eq("id", projectId)
          .single(),
      ]);

      if (clipsResult.error) throw clipsResult.error;

      const projectTitle = projectResult.data?.title || "Untitled";
      const sourceImageUrl = projectResult.data?.source_image_url;

      const clips: EditorClip[] = (clipsResult.data || []).map(c => ({
        id: c.id,
        projectId: c.project_id,
        projectTitle,
        shotIndex: c.shot_index,
        videoUrl: c.video_url!,
        thumbnailUrl: c.last_frame_url,
        durationSeconds: c.duration_seconds,
        prompt: c.prompt,
      }));

      const images: EditorImage[] = [];
      for (const c of clipsResult.data || []) {
        if (c.last_frame_url) {
          images.push({
            id: `frame-${c.id}`,
            url: c.last_frame_url,
            label: `Shot ${c.shot_index + 1} – Frame`,
            source: "frame",
            shotIndex: c.shot_index,
          });
        }
      }

      if (sourceImageUrl) {
        images.push({
          id: `source-${projectId}`,
          url: sourceImageUrl,
          label: "Source Image",
          source: "source_image",
        });
      }

      return { clips, images };
    } catch (err: any) {
      console.error("Failed to load project clips:", err);
      setError(err.message || "Failed to load clips");
      return { clips: [], images: [] };
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { listProjects, loadProjectClips, loading, error };
}
