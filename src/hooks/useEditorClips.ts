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

/**
 * Fetches the user's completed video clips, optionally filtered by project.
 * Returns clips ready for the editor media panel.
 */
export function useEditorClips(projectId?: string | null) {
  const { user } = useAuth();
  const [clips, setClips] = useState<EditorClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setClips([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchClips() {
      setLoading(true);
      setError(null);

      try {
        // Fetch completed clips with project info
        let query = supabase
          .from("video_clips")
          .select("id, project_id, shot_index, video_url, last_frame_url, duration_seconds, prompt, status")
          .eq("user_id", user!.id)
          .eq("status", "completed")
          .not("video_url", "is", null)
          .order("shot_index", { ascending: true });

        if (projectId) {
          query = query.eq("project_id", projectId);
        }

        const { data: clipsData, error: clipsErr } = await query.limit(200);

        if (clipsErr) throw clipsErr;
        if (cancelled) return;

        // Get unique project IDs to fetch titles
        const projectIds = [...new Set((clipsData || []).map((c) => c.project_id))];

        let projectMap: Record<string, string> = {};
        if (projectIds.length > 0) {
          const { data: projects } = await supabase
            .from("movie_projects")
            .select("id, title")
            .in("id", projectIds);

          if (projects) {
            projectMap = Object.fromEntries(projects.map((p) => [p.id, p.title || "Untitled"]));
          }
        }

        if (cancelled) return;

        const mapped: EditorClip[] = (clipsData || []).map((c) => ({
          id: c.id,
          projectId: c.project_id,
          projectTitle: projectMap[c.project_id] || "Untitled",
          shotIndex: c.shot_index,
          videoUrl: c.video_url!,
          thumbnailUrl: c.last_frame_url,
          durationSeconds: c.duration_seconds,
          prompt: c.prompt,
        }));

        setClips(mapped);
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

  return { clips, loading, error, refetch: () => {} };
}
