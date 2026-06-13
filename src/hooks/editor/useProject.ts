/**
 * useProject — loads a project (movie_projects + genesis_scenes +
 * video_clips + shot_takes) from supabase into the editor store.
 *
 * Three queries run in parallel:
 *   1. movie_projects row by id
 *   2. genesis_scenes for project_id (ordered by scene_number)
 *   3. video_clips for project_id (ordered by created_at)
 *   4. shot_takes for project_id (for the versions panel)
 *
 * The hook is fire-and-forget — it writes to the editor store via
 * setProject() when ready. Any component using useEditor() will then
 * re-render with the project loaded. No need to thread props.
 *
 * Currently, scene→clip association is by created_at order within
 * the project (since the schema doesn't carry an explicit
 * scene_id on video_clips in every row). When we add explicit
 * scene_id linkage in a later commit, the loader updates to honor
 * it without breaking callers.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setLoading, setProject, setError } from "@/lib/editor/store";
import {
  parseAspectRatio,
  type EditorClip,
  type EditorProject,
  type EditorScene,
  type EditorTake,
} from "@/lib/editor/types";
import { buildDemoProject, isDemoId } from "@/lib/editor/demoProject";

interface MovieProjectRow {
  id: string;
  title: string;
  aspect_ratio: string | null;
  status: string;
  thumbnail_url: string | null;
  target_duration_minutes: number | null;
  script_content: string | null;
  generated_script: string | null;
  mood: string | null;
  genre: string | null;
  setting: string | null;
}

interface SceneRow {
  id: string;
  scene_number: number;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  mood: string | null;
  time_of_day: string | null;
  act_number: number | null;
  is_key_scene: boolean | null;
  visual_prompt: string | null;
  camera_directions: string | null;
}

interface ClipRow {
  id: string;
  prompt: string;
  duration_seconds: number | null;
  video_url: string | null;
  start_image_url: string | null;
  last_frame_url: string | null;
  created_at: string;
  project_id: string;
}

interface TakeRow {
  id: string;
  shot_index: number;
  take_number: number;
  video_url: string | null;
  thumbnail_url: string | null;
  prompt_used: string | null;
  status: string;
  created_at: string;
}

export function useProject(projectId: string | undefined) {
  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    // /editor/demo short-circuits supabase — fully synthetic data
    // loads instantly so every editor view is visibly populated for
    // first-time visitors and contributors who don't have a project
    // of their own yet.
    if (isDemoId(projectId)) {
      setProject(buildDemoProject());
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [projectRes, scenesRes, clipsRes, takesRes] = await Promise.all([
          supabase
            .from("movie_projects")
            .select(
              "id, title, aspect_ratio, status, thumbnail_url, target_duration_minutes, script_content, generated_script, mood, genre, setting",
            )
            .eq("id", projectId)
            .maybeSingle(),
          supabase
            .from("genesis_scenes")
            .select(
              "id, scene_number, title, description, duration_seconds, mood, time_of_day, act_number, is_key_scene, visual_prompt, camera_directions",
            )
            // genesis_scenes is screenplay-scoped, not project-scoped.
            // We'll filter by project via the screenplay link in a
            // later commit when the join is stable.
            .order("scene_number", { ascending: true })
            .limit(0), // intentionally empty for v1 first commit
          supabase
            .from("video_clips")
            .select(
              "id, prompt, duration_seconds, video_url, start_image_url, last_frame_url, created_at, project_id",
            )
            .eq("project_id", projectId)
            .order("created_at", { ascending: true }),
          supabase
            .from("shot_takes")
            .select(
              "id, shot_index, take_number, video_url, thumbnail_url, prompt_used, status, created_at",
            )
            .eq("project_id", projectId)
            .order("shot_index", { ascending: true })
            .order("take_number", { ascending: false }), // newest take first
        ]);

        if (cancelled) return;

        if (projectRes.error || !projectRes.data) {
          setError(projectRes.error?.message ?? "Project not found");
          return;
        }
        const pr = projectRes.data as MovieProjectRow;
        const sceneRows = (scenesRes.data ?? []) as SceneRow[];
        const clipRows = (clipsRes.data ?? []) as ClipRow[];
        const takeRows = (takesRes.data ?? []) as TakeRow[];

        // Build takes lookup by shot_index
        const takesByShot = new Map<number, EditorTake[]>();
        for (const t of takeRows) {
          const list = takesByShot.get(t.shot_index) ?? [];
          list.push({
            id: t.id,
            takeNumber: t.take_number,
            videoUrl: t.video_url,
            thumbnailUrl: t.thumbnail_url,
            promptUsed: t.prompt_used,
            status: t.status,
            createdAt: t.created_at,
          });
          takesByShot.set(t.shot_index, list);
        }

        // Build clips. For v1, since the schema doesn't have an explicit
        // scene_id on video_clips, we put ALL clips into a single
        // synthetic scene. When scene linkage lands, we distribute.
        let timelineCursor = 0;
        const clips: EditorClip[] = clipRows.map((c, i) => {
          const dur = c.duration_seconds ?? 4; // sensible default
          const clip: EditorClip = {
            id: c.id,
            index: i,
            timelineStartSec: timelineCursor,
            durationSec: dur,
            videoUrl: c.video_url,
            thumbnailUrl: c.start_image_url,
            prompt: c.prompt,
            takes: takesByShot.get(i) ?? [],
          };
          timelineCursor += dur;
          return clip;
        });

        // Build scenes
        let scenes: EditorScene[];
        if (sceneRows.length > 0) {
          // Real scenes — distribute clips evenly (until we have
          // scene_id linkage). Placeholder logic for v1.
          scenes = sceneRows.map((s, i) => ({
            id: s.id,
            number: s.scene_number,
            title: s.title,
            description: s.description,
            durationSec: s.duration_seconds ?? 0,
            mood: s.mood,
            timeOfDay: s.time_of_day,
            actNumber: s.act_number,
            isKeyScene: !!s.is_key_scene,
            visualPrompt: s.visual_prompt,
            cameraDirections: s.camera_directions,
            clips: i === 0 ? clips : [], // all clips on first scene for v1
          }));
        } else {
          // No explicit scenes — synthesize a single anchor scene so
          // the rest of the editor model has something to render.
          scenes = [
            {
              id: `synthetic-${pr.id}`,
              number: 1,
              title: pr.title,
              description: null,
              durationSec: timelineCursor,
              mood: pr.mood,
              timeOfDay: null,
              actNumber: null,
              isKeyScene: false,
              visualPrompt: null,
              cameraDirections: null,
              clips,
            },
          ];
        }

        const project: EditorProject = {
          id: pr.id,
          title: pr.title,
          aspectRatio: parseAspectRatio(pr.aspect_ratio),
          status: pr.status,
          thumbnailUrl: pr.thumbnail_url,
          durationSec: timelineCursor || (pr.target_duration_minutes ?? 0) * 60,
          scriptContent: pr.script_content ?? pr.generated_script,
          mood: pr.mood,
          genre: pr.genre,
          setting: pr.setting,
          scenes,
          transitions: [],
        };
        setProject(project);
      } catch (e) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error("[useProject] load failed", e);
        setError(e instanceof Error ? e.message : "Failed to load project");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);
}
