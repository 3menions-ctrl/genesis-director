/**
 * document-to-editor — bridge from ScriptDocument → EditorProject.
 *
 * Wave 2 keeps the existing editor surfaces (Stage / Timeline /
 * Script / Storyboard) unchanged. They consume `EditorProject` —
 * the legacy shape with scenes/clips/transitions. This bridge
 * converts the new ScriptDocument constitution to that shape so
 * future read paths can use the document without rewriting every
 * surface in the same wave.
 *
 * The conversion is lossy in one direction:
 *   ScriptDocument carries cast, voices, music, approvals, costs,
 *   per-shot engine overrides — none of which the legacy editor
 *   model has fields for. Those facts stay in the document; the
 *   wave 6 rewrite of the editor surfaces reads them directly.
 *
 * Conversion that IS preserved:
 *   doc.meta.{title, aspectRatio, mood, genre, setting, targetDur}
 *     → EditorProject root
 *   doc.scenes
 *     → EditorScene[] (one-to-one)
 *   doc.scenes[].shots
 *     → EditorClip[] inside each EditorScene (Shot.id == EditorClip.id)
 *   doc.scenes[].shots[].generated.takes
 *     → EditorClip.takes (one-to-one)
 *   doc.template.defaultTransition
 *     → EditorProject.transitions[] (one entry per V1 boundary)
 *
 * Pure — no React, no supabase.
 */

import type {
  ScriptDocument,
  Shot,
} from "./script-document";
import type {
  EditorProject,
  EditorScene,
  EditorClip,
  EditorTake,
  ClipTransition,
} from "./types";

/**
 * Convert a ScriptDocument to the EditorProject shape the existing
 * editor surfaces consume.
 */
export function documentToEditorProject(doc: ScriptDocument): EditorProject {
  const scenes: EditorScene[] = doc.scenes.map((scene) => {
    const clips = sceneShotsToClips(scene.shots);
    return {
      id: scene.id,
      number: scene.number,
      title: scene.slug,
      description: scene.description ?? null,
      durationSec: clips.reduce((sum, c) => sum + c.durationSec, 0),
      mood: scene.mood ?? null,
      timeOfDay: scene.timeOfDay ?? null,
      actNumber: scene.actNumber ?? null,
      isKeyScene: !!scene.isKeyScene,
      visualPrompt: null,
      cameraDirections: null,
      clips,
    } satisfies EditorScene;
  });

  // ── Transitions ─────────────────────────────────────────────────
  // The document carries `template.defaultTransition` (one rule for
  // every boundary). Expand that into explicit per-boundary
  // ClipTransition rows so the editor's existing transitions panel
  // + crossfade renderer work unchanged. Per-shot overrides will
  // land in a later wave when shots can declare their own transition.
  const transitions = buildTransitions(scenes, doc);

  // Total runtime = sum of every V1 clip's durationSec (matches
  // the existing recompute() in store.ts).
  const durationSec = scenes.reduce(
    (sum, s) =>
      sum +
      s.clips
        .filter((c) => c.kind !== "title")
        .reduce((cs, c) => cs + c.durationSec, 0),
    0,
  );

  return {
    id: doc.meta.projectId,
    title: doc.meta.title,
    aspectRatio: doc.meta.aspectRatio,
    status: "ready",
    thumbnailUrl: pickProjectThumbnail(scenes),
    durationSec,
    scriptContent: doc.meta.synopsis ?? null,
    mood: doc.meta.mood ?? null,
    genre: doc.meta.genre ?? null,
    setting: doc.meta.setting ?? null,
    scenes,
    transitions,
  } satisfies EditorProject;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

function sceneShotsToClips(shots: Shot[]): EditorClip[] {
  let cursor = 0;
  return shots.map((shot, i) => {
    const takes: EditorTake[] =
      shot.generated?.takes.map((t) => ({
        id: t.id,
        takeNumber: t.takeNumber,
        videoUrl: t.videoUrl || null,
        thumbnailUrl: t.thumbnailUrl ?? null,
        promptUsed: t.promptUsed,
        status: t.status,
        createdAt: t.createdAt,
      })) ?? [];

    const clip: EditorClip = {
      id: shot.id,
      kind: "video",
      index: i,
      timelineStartSec: cursor,
      durationSec: shot.durationSec,
      videoUrl: shot.generated?.videoUrl ?? null,
      thumbnailUrl: shot.generated?.thumbnailUrl ?? null,
      prompt: shot.modelPrompt,
      takes,
    };
    cursor += shot.durationSec;
    return clip;
  });
}

function buildTransitions(
  scenes: EditorScene[],
  doc: ScriptDocument,
): ClipTransition[] {
  const transitions: ClipTransition[] = [];
  const allV1 = scenes
    .flatMap((s) => s.clips)
    .filter((c) => c.kind !== "title");
  for (let i = 0; i < allV1.length - 1; i++) {
    const from = allV1[i];
    const to = allV1[i + 1];
    const maxDur = Math.max(
      0.05,
      Math.min(from.durationSec, to.durationSec) / 2,
    );
    transitions.push({
      id: `xfade-${from.id}-${to.id}`,
      fromClipId: from.id,
      toClipId: to.id,
      kind: doc.template.defaultTransition.kind,
      durationSec: Math.min(maxDur, doc.template.defaultTransition.durationSec),
    });
  }
  return transitions;
}

function pickProjectThumbnail(scenes: EditorScene[]): string | null {
  for (const s of scenes) {
    for (const c of s.clips) {
      if (c.thumbnailUrl) return c.thumbnailUrl;
    }
  }
  return null;
}
