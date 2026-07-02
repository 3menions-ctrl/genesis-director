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
import { setLoading, setProject, setError, hydrateMarkers } from "@/lib/editor/store";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import {
  parseAspectRatio,
  buildDefaultTracks,
  type EditorClip,
  type EditorProject,
  type EditorScene,
  type EditorTake,
  type EditorTrack,
} from "@/lib/editor/types";
import { buildDemoProject, isDemoId } from "@/lib/editor/demoProject";
import { coerceScreenplay } from "@/lib/editor/screenplay";
import type { MasterLoudnessPreset } from "@/lib/editor/audio-mix";

function parseMasterLoudness(v: string | null): MasterLoudnessPreset | undefined {
  if (v === "off" || v === "streaming" || v === "podcast" || v === "broadcast" || v === "cinema") return v;
  return undefined;
}

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
  master_loudness: string | null;
  music_url: string | null;
  editor_state: unknown;
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
  properties: unknown;
  effects: unknown;
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
    // Clear the previous project + error before loading a new one (audit D30).
    // Without this, navigating /editor/A -> /editor/B kept project A truthy
    // during B's load, so EditorShell's `loading && !project` shimmer never
    // showed (A's timeline rendered under B's URL) and a failed B load left
    // the `error && !project` not-found UI unreachable.
    setProject(null);
    setError(null);
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [projectRes, scenesRes, clipsRes, takesRes] = await Promise.all([
          supabase
            .from("movie_projects")
            .select(
              "id, title, aspect_ratio, status, thumbnail_url, target_duration_minutes, script_content, generated_script, mood, genre, setting, master_loudness, music_url, editor_state",
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
              "id, prompt, duration_seconds, video_url, start_image_url, last_frame_url, created_at, project_id, properties, effects",
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
          setError(safeErrorMessage(projectRes.error, "Project not found"));
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
        // World-class rule: only clips with a working video_url are
        // dropped onto the timeline. A row that's still pending /
        // failed / had its URL stripped renders as a frozen black
        // frame in the player — confusing and unfixable from inside
        // the editor. Filter them out here so the timeline only
        // contains things that actually play.
        const playableRows = clipRows.filter((c) => typeof c.video_url === "string" && c.video_url.length > 0);
        let timelineCursor = 0;
        const clips: EditorClip[] = playableRows.map((c, i) => {
          const dur = c.duration_seconds ?? 4; // sensible default
          // Hydrate per-clip post-prod state from JSONB. The columns
          // hold raw JSON — we trust the editor was the only writer
          // (it round-trips its own state) and let the typed mutators
          // re-normalize on the next change.
          const rawProps = (c.properties && typeof c.properties === "object")
            ? c.properties as Record<string, unknown> & { keyframes?: unknown }
            : null;
          // Keyframes are nested under properties.keyframes for storage
          // but live as a top-level field on the in-memory clip. Lift
          // them out and strip from properties so the store doesn't
          // see a stale duplicate.
          let keyframes: EditorClip["keyframes"] | undefined;
          let properties: EditorClip["properties"] | undefined;
          if (rawProps) {
            if (Array.isArray(rawProps.keyframes)) {
              keyframes = rawProps.keyframes as EditorClip["keyframes"];
            }
            const { keyframes: _kf, ...rest } = rawProps;
            void _kf;
            properties = Object.keys(rest).length > 0
              ? (rest as EditorClip["properties"])
              : undefined;
          }
          const effects = Array.isArray(c.effects)
            ? (c.effects as EditorClip["effects"])
            : undefined;
          const clip: EditorClip = {
            id: c.id,
            index: i,
            timelineStartSec: timelineCursor,
            durationSec: dur,
            videoUrl: c.video_url,
            thumbnailUrl: c.start_image_url,
            prompt: c.prompt,
            takes: takesByShot.get(i) ?? [],
            properties,
            effects,
            keyframes,
          };
          timelineCursor += dur;
          return clip;
        });

        // LEGACY SCORE: a project generated by the production pipeline
        // carries movie_projects.music_url but never got an A2
        // video_clips row, so the editor's Music track stayed empty and
        // the score wouldn't re-export. When music_url is set AND no
        // clip is already routed to sys:A2, synthesize an A2 clip from
        // it so the score shows on the timeline and round-trips through
        // export. The synthetic clip is keyed off the project id so it
        // stays stable across reloads (and so an explicit A2 upload /
        // generated score, which DOES carry a real video_clips row,
        // wins and suppresses this fallback).
        const hasA2Clip = clips.some(
          (c) => (c.properties as { trackId?: string } | undefined)?.trackId === "sys:A2",
        );
        if (pr.music_url && !hasA2Clip) {
          clips.push({
            id: `score-${pr.id}`,
            index: clips.length,
            timelineStartSec: timelineCursor,
            // Duration is unknown from movie_projects alone; default to
            // the generate-music edge function's 30s bed. The user can
            // trim it on the timeline; the seamless-stitcher loops /
            // trims A2 to the master length at export regardless.
            durationSec: 30,
            videoUrl: pr.music_url,
            thumbnailUrl: null,
            prompt: "Score",
            takes: [],
            properties: { trackId: "sys:A2" },
          });
        }

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

        // Hydrate transitions + title clips from movie_projects.editor_state.
        // Both were in-memory only before — closing the tab wiped every
        // transition + every title overlay. The shape is permissive:
        // unknown fields are ignored so old/new client revisions stay
        // forwards-compatible.
        const es = (pr.editor_state && typeof pr.editor_state === "object")
          ? pr.editor_state as { transitions?: unknown; titles?: unknown; textOverlays?: unknown; tracks?: unknown; clips?: unknown; markers?: unknown }
          : null;
        // Restore timeline markers (were store-only → lost on reload).
        hydrateMarkers(Array.isArray(es?.markers) ? (es!.markers as never[]) : []);
        const restoredTransitions = Array.isArray(es?.transitions)
          ? (es!.transitions as EditorProject["transitions"])
          : [];
        const restoredTitles = Array.isArray(es?.titles)
          ? (es!.titles as EditorClip[])
          : [];
        // DURABLE TIMELINE: when the user has saved an explicit clip
        // arrangement (splits, trims, reorders, per-clip effects), it
        // lives in editor_state.clips and is the source of truth on
        // reload — the video_clips-derived `clips` above is only the
        // first-load fallback for projects that have never been edited.
        const restoredClips = Array.isArray(es?.clips) && (es!.clips as unknown[]).length > 0
          ? (es!.clips as EditorClip[])
          : null;
        if (restoredClips && scenes.length > 0) {
          // Re-seat all clips onto the anchor scene; titles already live
          // inside restoredClips so we must NOT also append them below.
          // LEGACY SCORE on an EDITED project: the saved arrangement
          // wins, but if it carries no A2 clip and the project still has
          // a music_url, fold the synthesized score in so the Music
          // track isn't silently dropped when the user reopens an edit.
          const restoredHasA2 = restoredClips.some(
            (c) => (c.properties as { trackId?: string } | undefined)?.trackId === "sys:A2",
          );
          const seated = (pr.music_url && !restoredHasA2)
            ? [
                ...restoredClips,
                {
                  id: `score-${pr.id}`,
                  index: restoredClips.length,
                  timelineStartSec: 0, // recompute reseats this
                  durationSec: 30,
                  videoUrl: pr.music_url,
                  thumbnailUrl: null,
                  prompt: "Score",
                  takes: [],
                  properties: { trackId: "sys:A2" },
                } satisfies EditorClip,
              ]
            : restoredClips;
          scenes[0] = { ...scenes[0], clips: seated };
        }
        const restoredTextOverlays = Array.isArray(es?.textOverlays)
          ? (es!.textOverlays as EditorProject["textOverlays"])
          : [];
        // Tracks — if the saved array is present + non-empty, use it
        // verbatim. Otherwise build the 5 system defaults so existing
        // projects light up tracks for the first time without a manual
        // migration.
        const restoredTracks: EditorTrack[] = Array.isArray(es?.tracks) && (es!.tracks as unknown[]).length > 0
          ? (es!.tracks as EditorTrack[])
          : buildDefaultTracks();
        // Title clips live in scene[0].clips alongside video clips so
        // every existing mutator (move, trim, delete, properties)
        // sees them. The Timeline filters by kind === "title" when it
        // needs to render the overlay layer specifically.
        // Only re-append titles from the legacy `titles` field when we
        // did NOT restore the full clip list (which already includes
        // them) — otherwise titles would double up.
        if (!restoredClips && restoredTitles.length > 0 && scenes.length > 0) {
          scenes[0] = { ...scenes[0], clips: [...scenes[0].clips, ...restoredTitles] };
        }

        // Recompute total timeline duration from whatever clip set we
        // ended up with (restored or row-derived) so the player + ruler
        // span the real edit.
        const effectiveDurationSec = (restoredClips ?? clips)
          .filter((c) => c.kind !== "title")
          .reduce((a, c) => a + (c.durationSec || 0), 0);

        const project: EditorProject = {
          id: pr.id,
          title: pr.title,
          aspectRatio: parseAspectRatio(pr.aspect_ratio),
          status: pr.status,
          thumbnailUrl: pr.thumbnail_url,
          durationSec: effectiveDurationSec || timelineCursor || (pr.target_duration_minutes ?? 0) * 60,
          scriptContent: coerceScreenplay(pr.script_content ?? pr.generated_script),
          mood: pr.mood,
          genre: pr.genre,
          setting: pr.setting,
          masterLoudness: parseMasterLoudness(pr.master_loudness),
          scenes,
          transitions: restoredTransitions,
          textOverlays: restoredTextOverlays,
          tracks: restoredTracks,
        };
        setProject(project);
      } catch (e) {
        if (cancelled) return;
        console.error("[useProject] load failed", e);
        setError(safeErrorMessage(e, "Failed to load project"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);
}
