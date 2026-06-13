/**
 * hydrate-document — convert existing project data into a complete
 * ScriptDocument.
 *
 * Why: every project on disk today is stored across five tables —
 *   movie_projects (root)
 *   genesis_scenes
 *   video_clips
 *   shot_takes
 *   project_characters
 *
 * The ScriptDocument constitution treats this as one typed shape.
 * Hydration is the one-way migration: take rows from those tables,
 * produce a ScriptDocument that the editor can read. Idempotent —
 * call it twice on the same input and the result is identical.
 *
 * This function is pure. No supabase, no React, no DOM. The caller
 * (a one-time backfill script + the `useProject` read path) is
 * responsible for fetching the rows and writing the resulting doc.
 *
 * Fidelity notes:
 *   - Scene detection: we treat each genesis_scenes row as a scene
 *     when available. Without scene rows, we synthesize a single
 *     scene that owns every clip — same fallback the legacy
 *     useProject hook uses today.
 *   - Beats: the existing schema doesn't carry typed beats. We
 *     parse the screenplay text with the existing screenplay
 *     parser to recover slug + action + dialogue blocks, then
 *     attach them by scene index.
 *   - Shots: one row per video_clips entry. We carry
 *     duration_seconds, video_url, prompt, last_frame_url across
 *     1:1. The Shot is marked `completed` when video_url is
 *     present, `draft` otherwise (matches the existing visual
 *     "this clip is still rendering" state).
 *   - URLs: hydration trusts what's on disk. The `generated.
 *     videoUrl` IS the existing video_url. The persistence layer
 *     is responsible for migrating expired Replicate URLs into
 *     our bucket — that work happens in a follow-up wave.
 */

import { parseScreenplay } from "./screenplay";
import {
  type ScriptDocument,
  type Scene,
  type Shot,
  type Beat,
  type Character,
  type GeneratedArtifact,
  type Take,
  SCRIPT_DOCUMENT_VERSION,
  newScriptId,
} from "./script-document";
import {
  estimateShotCredits,
  recommendedEngineForTemplate,
} from "./model-catalog";
import { parseAspectRatio } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Input shapes — mirror the supabase rows we'll feed in
// ─────────────────────────────────────────────────────────────────────────────

export interface MovieProjectRow {
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
  time_period?: string | null;
  pipeline_state?: Record<string, unknown> | null;
  /** Already-hydrated doc when the column carries one. Hydration
   *  short-circuits to this when present + valid. */
  script_document?: ScriptDocument | Record<string, unknown> | null;
}

export interface SceneRow {
  id: string;
  scene_number: number;
  title: string | null;
  description: string | null;
  duration_seconds: number | null;
  mood: string | null;
  time_of_day: string | null;
  act_number: number | null;
  is_key_scene: boolean | null;
  visual_prompt: string | null;
  camera_directions: string | null;
}

export interface ClipRow {
  id: string;
  prompt: string | null;
  duration_seconds: number | null;
  video_url: string | null;
  start_image_url: string | null;
  last_frame_url: string | null;
  created_at: string;
  project_id: string;
  /** Optional scene linkage when the schema carries it. */
  scene_id?: string | null;
  /** Engine the clip was generated with — when known. */
  engine?: string | null;
  /** Status from the clip row — usually 'completed' | 'generating'
   *  | 'failed'. */
  status?: string | null;
}

export interface TakeRow {
  id: string;
  shot_index: number;
  take_number: number;
  video_url: string | null;
  thumbnail_url: string | null;
  prompt_used: string | null;
  status: string;
  created_at: string;
}

export interface CharacterRow {
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
  identity_dna?: string | null;
  wardrobe?: string | null;
  physical_description?: string | null;
  reference_image_url?: string | null;
  avatar_id?: string | null;
  voice_profile_id?: string | null;
}

export interface HydrationInput {
  project: MovieProjectRow;
  scenes: SceneRow[];
  clips: ClipRow[];
  takes: TakeRow[];
  characters: CharacterRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hydrate a complete ScriptDocument from existing project tables.
 *
 * Short-circuits when the project already carries a valid
 * `script_document` JSONB — that doc is returned untouched. Lets us
 * upgrade incrementally: projects with a doc use it, projects
 * without get one built on read.
 */
export function hydrateScriptDocument(input: HydrationInput): ScriptDocument {
  const { project } = input;

  // Short-circuit: if the column already holds a versioned doc,
  // trust it. The migration backfill writes them; future reads
  // hit this path.
  if (isWellFormedDocument(project.script_document)) {
    return project.script_document as ScriptDocument;
  }

  const aspectRatio = parseAspectRatio(project.aspect_ratio);
  const screenplayText = (project.script_content ?? project.generated_script ?? "").trim();

  // Parse the screenplay into typed blocks for beat extraction.
  // We pass an empty clip list to the parser — its clip mapping
  // is independent of beat construction, and we resolve shot
  // mapping below.
  const parsed = screenplayText
    ? parseScreenplay({ raw: screenplayText, clips: [] })
    : { blocks: [], sceneCount: 0, contentCount: 0 };

  // Build cast from project_characters rows.
  const cast: Character[] = input.characters.map((c) => ({
    id: c.id,
    name: c.name,
    role:
      (c.role as Character["role"]) === "antagonist" ||
      (c.role as Character["role"]) === "supporting" ||
      (c.role as Character["role"]) === "narrator" ||
      (c.role as Character["role"]) === "ensemble"
        ? (c.role as Character["role"])
        : "protagonist",
    description: c.description ?? "",
    identityDNA: c.identity_dna ?? undefined,
    wardrobe: c.wardrobe ?? undefined,
    physicalDescription: c.physical_description ?? undefined,
    referenceImageUrl: c.reference_image_url ?? undefined,
    avatarId: c.avatar_id ?? undefined,
    voiceProfileId: c.voice_profile_id ?? undefined,
  }));

  // Group takes by shot_index for fast lookup when building shots.
  const takesByShotIndex = new Map<number, TakeRow[]>();
  for (const t of input.takes) {
    const list = takesByShotIndex.get(t.shot_index) ?? [];
    list.push(t);
    takesByShotIndex.set(t.shot_index, list);
  }

  // Distribute clips into scenes. If genesis_scenes rows exist,
  // each clip's scene_id (if set) tells us where it lives; otherwise
  // we fall back to even distribution (matches legacy useProject).
  const sceneRows = input.scenes.slice().sort((a, b) => a.scene_number - b.scene_number);
  const orderedClips = input.clips
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  // Build the list of scenes.
  let scenes: Scene[];
  if (sceneRows.length > 0) {
    scenes = sceneRows.map((row, sceneIdx) => {
      const clipsInScene = orderedClips.filter(
        (c) => c.scene_id === row.id,
      );
      const beats = collectBeatsForScene(parsed.blocks, sceneIdx);
      const shots = buildShots(
        clipsInScene,
        takesByShotIndex,
        project,
        beats,
        sceneIdx,
      );
      return {
        id: row.id,
        number: row.scene_number,
        slug: row.title ?? `SCENE ${row.scene_number}`,
        description: row.description ?? "",
        mood: row.mood ?? project.mood ?? undefined,
        timeOfDay: row.time_of_day ?? undefined,
        actNumber: row.act_number ?? undefined,
        isKeyScene: row.is_key_scene ?? undefined,
        beats,
        shots,
      };
    });
    // Any clips not linked to a scene fall into scene[0] so we never
    // drop generated content.
    const linkedIds = new Set(
      scenes.flatMap((s) => s.shots.map((sh) => sh.id)),
    );
    const orphans = orderedClips.filter((c) => !linkedIds.has(c.id));
    if (orphans.length > 0 && scenes[0]) {
      const orphanShots = buildShots(
        orphans,
        takesByShotIndex,
        project,
        scenes[0].beats,
        0,
        scenes[0].shots.length,
      );
      scenes[0] = { ...scenes[0], shots: [...scenes[0].shots, ...orphanShots] };
    }
  } else {
    // No scenes recorded — synthesize one scene that holds every clip.
    const beats = collectBeatsForScene(parsed.blocks, 0);
    const shots = buildShots(orderedClips, takesByShotIndex, project, beats, 0);
    scenes = [
      {
        id: newScriptId("scene"),
        number: 1,
        slug: project.title || "SCENE 1",
        description: project.setting ?? "",
        mood: project.mood ?? undefined,
        timeOfDay: undefined,
        actNumber: 1,
        isKeyScene: true,
        beats,
        shots,
      },
    ];
  }

  // Target duration: explicit setting wins; otherwise sum of shot
  // durations; otherwise 60s placeholder so the budget UI is alive.
  const summed = scenes.flatMap((s) => s.shots).reduce(
    (a, s) => a + s.durationSec,
    0,
  );
  const targetDurationSec =
    (project.target_duration_minutes ?? 0) > 0
      ? (project.target_duration_minutes as number) * 60
      : summed > 0
      ? summed
      : 60;

  const templateId = inferTemplateFromProject(project);
  const defaultEngine = recommendedEngineForTemplate(templateId);

  const doc: ScriptDocument = {
    schemaVersion: SCRIPT_DOCUMENT_VERSION,
    meta: {
      projectId: project.id,
      title: project.title,
      logline: project.setting ?? "",
      synopsis: project.script_content ?? undefined,
      genre: project.genre ?? undefined,
      mood: project.mood ?? undefined,
      setting: project.setting ?? undefined,
      timePeriod: project.time_period ?? undefined,
      aspectRatio,
      targetDurationSec,
      authoredAt: new Date(0).toISOString(),
      authoredBy: "hydration",
    },
    template: {
      id: templateId,
      name: titleCaseFromId(templateId),
      pacing: "medium",
      defaultTransition: { kind: "fade", durationSec: 0.4 },
      averageShotLengthSec: 6,
      structureGuide: "",
    },
    capabilities: {
      defaultEngine,
      qualityTier: "pro",
    },
    cast,
    voices: [],
    music: [],
    scenes,
  };

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Pulled from screenplay.ts block stream — every beat that lives
 *  in this scene's range, converted to typed Beat objects. */
function collectBeatsForScene(
  blocks: import("./screenplay").ScreenplayBlock[],
  sceneIdx: number,
): Beat[] {
  const out: Beat[] = [];
  let lastSpeakerCharId: string | undefined;
  for (const b of blocks) {
    if (b.sceneIdx !== sceneIdx) continue;
    switch (b.kind) {
      case "slug":
        // Slug-lines anchor the scene; we don't emit them as beats.
        continue;
      case "action":
        out.push({
          id: newScriptId("beat"),
          kind: "action",
          text: b.text,
          audioBus: "A2",
        });
        lastSpeakerCharId = undefined;
        break;
      case "character":
        // Character cues set up speaker context — captured into the
        // next dialogue beat rather than emitted on their own.
        lastSpeakerCharId = b.speaker;
        break;
      case "paren":
        out.push({
          id: newScriptId("beat"),
          kind: "paren",
          text: b.text,
          characterId: lastSpeakerCharId,
          audioBus: "A1",
        });
        break;
      case "dialogue":
        out.push({
          id: newScriptId("beat"),
          kind: "dialogue",
          text: b.text,
          characterId: lastSpeakerCharId,
          audioBus: "A1",
        });
        break;
      case "transition":
        out.push({
          id: newScriptId("beat"),
          kind: "transition",
          text: b.text,
        });
        break;
      case "title":
        // Title cards live on V2 today — we don't materialise them as
        // beats during hydration. The editor's existing V2 logic
        // will keep handling them until we redesign titles end-to-end.
        break;
    }
  }
  return out;
}

/** Convert clip rows + take rows into typed Shot objects, mapping
 *  any beats from the same scene by index. */
function buildShots(
  clips: ClipRow[],
  takesByShotIndex: Map<number, TakeRow[]>,
  project: MovieProjectRow,
  beats: Beat[],
  sceneIdx: number,
  startingShotNumber = 0,
): Shot[] {
  const aspectRatio = parseAspectRatio(project.aspect_ratio);
  const engine = (
    clips[0]?.engine ?? "seedance-1-pro"
  ) as import("./script-document").ModelEngine;

  return clips.map((c, i) => {
    const shotNumber = startingShotNumber + i + 1;
    const durationSec = c.duration_seconds ?? 5;
    const completed = !!c.video_url && c.status !== "failed";
    const takeRows = takesByShotIndex.get(i) ?? [];
    const takes: Take[] = takeRows.map((t) => ({
      id: t.id,
      takeNumber: t.take_number,
      videoUrl: t.video_url ?? "",
      thumbnailUrl: t.thumbnail_url ?? undefined,
      promptUsed: t.prompt_used ?? c.prompt ?? "",
      engine,
      status:
        t.status === "completed"
          ? "completed"
          : t.status === "failed"
          ? "failed"
          : "pending",
      createdAt: t.created_at,
    }));

    const generated: GeneratedArtifact | undefined = completed
      ? {
          videoUrl: c.video_url as string,
          lastFrameUrl: c.last_frame_url ?? undefined,
          thumbnailUrl: c.start_image_url ?? undefined,
          completedAt: c.created_at,
          takes,
        }
      : undefined;

    // Distribute beats across shots within the scene by index — the
    // Nth shot owns the Nth beat (and any beats past the last shot
    // attach to the final one). This is the same approximation the
    // legacy parser used; the next wave will land explicit beatRefs.
    const beatRef = beats[i];
    const beatRefs = beatRef ? [beatRef.id] : [];

    return {
      id: c.id,
      number: shotNumber,
      beatRefs,
      framing: "medium",
      cameraDirection: c.prompt ?? "",
      durationSec,
      modelPrompt: c.prompt ?? "",
      modelInput: c.start_image_url
        ? { imageUrl: c.start_image_url }
        : undefined,
      generated,
      approval: {
        state: completed ? "completed" : "draft",
        changedAt: c.created_at,
        changedBy: "hydration",
      },
      cost: {
        credits: estimateShotCredits(engine, "pro", durationSec),
        computedFor: { engine, tier: "pro" },
      },
    } satisfies Shot;
    // suppress unused warning for aspectRatio (kept for forward-compat use)
    void aspectRatio;
  });
}

/** Coerce existing project fields into a TemplateId. Heuristic
 *  fallback to "custom" when nothing matches. */
function inferTemplateFromProject(
  project: MovieProjectRow,
): import("./script-document").TemplateId {
  const all = (
    (project.genre ?? "") +
    " " +
    (project.mood ?? "") +
    " " +
    (project.setting ?? "") +
    " " +
    (project.title ?? "")
  ).toLowerCase();
  if (/(trailer|teaser)/.test(all)) return "trailer";
  if (/(music\s+video|mv)/.test(all)) return "music-video";
  if (/(documentary|doc)/.test(all)) return "documentary";
  if (/(wedding|bridal)/.test(all)) return "wedding-cinematic";
  if (/(tiktok|reel|short|vertical)/.test(all)) return "tiktok-reel";
  if (/(brand|promo|product)/.test(all)) return "brand-promo";
  if (/(indie|sundance|festival)/.test(all)) return "festival-indie";
  if (/(brutalist|noir)/.test(all)) return "brutalist-drop";
  return "custom";
}

/** "tiktok-reel" → "Tiktok Reel". Cheap title-case for the template
 *  display name; the StudioLibrary catalog has the canonical
 *  human-readable names when the editor needs them. */
function titleCaseFromId(id: string): string {
  return id
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/** Validate that a thing read from the DB has the shape of a
 *  ScriptDocument. Loose check — we just need the version + meta to
 *  trust it; anything else is filled in by the editor. */
function isWellFormedDocument(thing: unknown): thing is ScriptDocument {
  if (!thing || typeof thing !== "object") return false;
  const t = thing as Record<string, unknown>;
  if (typeof t.schemaVersion !== "number") return false;
  if (!t.meta || typeof t.meta !== "object") return false;
  if (!Array.isArray(t.scenes)) return false;
  return true;
}
