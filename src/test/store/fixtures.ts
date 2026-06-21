/**
 * Fixture builder for editor store unit tests.
 *
 * Keeps tests focused — every test calls `makeProject([...clipSpecs])`
 * instead of hand-rolling the full EditorProject / Scene / Clip
 * graph. The result is dropped into the store via `setProject(...)`.
 */

import type {
  EditorProject,
  EditorScene,
  EditorClip,
  EditorTrack,
} from "@/lib/editor/types";
import { buildDefaultTracks } from "@/lib/editor/types";

export type ClipSpec = {
  id: string;
  durationSec: number;
  kind?: "video" | "title";
  trackId?: string;
  index?: number;
};

export function makeClip(spec: ClipSpec, timelineStartSec: number): EditorClip {
  return {
    id: spec.id,
    kind: spec.kind ?? "video",
    index: spec.index ?? 0,
    timelineStartSec,
    durationSec: spec.durationSec,
    videoUrl: spec.kind === "title" ? null : `file://${spec.id}.mp4`,
    thumbnailUrl: null,
    prompt: `prompt for ${spec.id}`,
    takes: [],
    properties: spec.trackId ? { trackId: spec.trackId } : undefined,
  };
}

export function makeProject(specs: ClipSpec[], tracks?: EditorTrack[]): EditorProject {
  let cursor = 0;
  const clips: EditorClip[] = specs.map((s, i) => {
    const clip = makeClip({ ...s, index: s.index ?? i }, cursor);
    if (s.kind !== "title") cursor += s.durationSec;
    return clip;
  });
  const scene: EditorScene = {
    id: "scene-1",
    number: 1,
    title: "Scene 1",
    description: null,
    durationSec: cursor,
    mood: null,
    timeOfDay: null,
    actNumber: null,
    isKeyScene: false,
    visualPrompt: null,
    cameraDirections: null,
    clips,
  };
  return {
    id: "project-1",
    title: "Test Project",
    aspectRatio: "16:9",
    status: "draft",
    thumbnailUrl: null,
    durationSec: cursor,
    scriptContent: null,
    mood: null,
    genre: null,
    setting: null,
    scenes: [scene],
    transitions: [],
    tracks: tracks ?? buildDefaultTracks(),
  };
}

/** Flatten the first scene's clips for assertions. Tests treat
 *  scene[0] as the canonical timeline (per the editor's synthetic
 *  one-scene model). */
export function flatClips(project: EditorProject | null): EditorClip[] {
  if (!project) return [];
  return project.scenes.flatMap((s) => s.clips);
}
