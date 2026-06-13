/**
 * script-document — the constitution of a project.
 *
 * Every clip, every voice, every cut, every character, every cost
 * lives here. Generation is deterministic from this document. The
 * editor reads it. The four tabs (Stage / Timeline / Script /
 * Storyboard) are four lenses on the same shape. Director Chat
 * mutates it. The Versions panel snapshots it.
 *
 * Persistence: `movie_projects.script_document` (JSONB).
 *
 * Hierarchy:
 *
 *   ScriptDocument
 *     ├─ meta              project-level metadata
 *     ├─ template          video template (trailer, music-video, …)
 *     ├─ capabilities      target engine + its capability matrix
 *     ├─ cast              characters (visual anchor + voice profile)
 *     ├─ voices            voice profile registry
 *     ├─ music             score / cue list
 *     └─ scenes
 *         ├─ slug          INT./EXT. heading
 *         ├─ beats         ACTION | DIALOGUE | PAREN | VO | SFX | MUSIC_CUE
 *         └─ shots         camera units (1 shot = 1 V1 clip)
 *             ├─ modelPrompt        engineered for the chosen engine
 *             ├─ beatRefs           which beats happen during this shot
 *             ├─ generated          videoUrl + lastFrameUrl + takes
 *             ├─ approvals          { script, shot, audio }
 *             └─ cost               { credits, engine, durationSec }
 *
 * Design constraints:
 *   - Pure types + helper functions. No React. No supabase.
 *   - Forward-compatible: every interface allows additional fields
 *     via well-named optional properties rather than `any`.
 *   - Lossless: hydration (lib/editor/hydrate-document.ts) can
 *     reconstruct a complete document from existing tables.
 *   - Stable IDs: every entity carries a string id that survives
 *     reorders + edits. Generation results are keyed by these.
 */

import type { AspectRatio, TransitionKind } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Document version — bumped only when the schema breaks back-compat.
// Adding new optional fields → no bump. Renaming/removing → bump +
// add a migration in hydrate-document.ts.
// ─────────────────────────────────────────────────────────────────────────────
export const SCRIPT_DOCUMENT_VERSION = 1 as const;

// ─────────────────────────────────────────────────────────────────────────────
// Top-level
// ─────────────────────────────────────────────────────────────────────────────
export interface ScriptDocument {
  /** Schema version — see SCRIPT_DOCUMENT_VERSION. */
  schemaVersion: number;
  meta: ScriptMeta;
  template: VideoTemplate;
  capabilities: ModelCapabilities;
  cast: Character[];
  voices: VoiceProfile[];
  music: MusicCue[];
  scenes: Scene[];
  /** Free-form notes the user/director keep alongside the doc.
   *  Not surfaced in any generator path. */
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────
export interface ScriptMeta {
  /** Stable project id (== movie_projects.id). */
  projectId: string;
  title: string;
  /** Short one-line synopsis — the "logline." */
  logline: string;
  /** Long-form synopsis if any. */
  synopsis?: string;
  genre?: string;
  mood?: string;
  setting?: string;
  timePeriod?: string;
  aspectRatio: AspectRatio;
  /** Target total runtime. The sum of every Shot.durationSec aims at
   *  this number; the editor surfaces variance as a budget delta. */
  targetDurationSec: number;
  /** When the document was created/most recently authored. ISO 8601. */
  authoredAt: string;
  /** Tooling/agent that produced the most recent significant edit.
   *  e.g. "user", "director-chat", "generate-script", "hydration". */
  authoredBy: AuthorshipSource;
}

export type AuthorshipSource =
  | "user"
  | "director-chat"
  | "generate-script"
  | "mode-router"
  | "hydration"
  | "manual-edit";

// ─────────────────────────────────────────────────────────────────────────────
// Template — the shape of the video being produced
// ─────────────────────────────────────────────────────────────────────────────
export type TemplateId =
  | "trailer"
  | "music-video"
  | "documentary"
  | "wedding-cinematic"
  | "tiktok-reel"
  | "brand-promo"
  | "festival-indie"
  | "brutalist-drop"
  | "custom";

export interface VideoTemplate {
  id: TemplateId;
  name: string;
  /** Slow / medium / fast — surfaced in the cost preview to explain
   *  per-shot duration choices. */
  pacing: "languid" | "medium" | "punchy" | "frantic";
  /** Default transition between clips when none is explicit. */
  defaultTransition: { kind: TransitionKind; durationSec: number };
  /** Target average shot length — used by the AI script writer +
   *  the cost preview's variance calc. */
  averageShotLengthSec: number;
  /** Pacing constraint between shots — surfaced as guidance to the
   *  AI scriptwriter. */
  structureGuide: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Capabilities — what the chosen engine can do
// ─────────────────────────────────────────────────────────────────────────────
export type ModelEngine =
  | "seedance-1-pro"
  | "kling-2-master"
  | "kling-1-6-pro"
  | "veo-3-pro"
  | "veo-2"
  | "sora-2"
  | "wan-2-1"
  | "comfy-local"
  | "runway-gen-4";

export interface ModelCapabilities {
  /** Default engine for new shots. Each Shot can override per-shot. */
  defaultEngine: ModelEngine;
  /** Selected quality tier for the project. Engine + tier together
   *  resolve a cost-per-second from the model catalog. */
  qualityTier: "studio" | "pro" | "draft";
}

// ─────────────────────────────────────────────────────────────────────────────
// Cast — characters with visual + voice identity
// ─────────────────────────────────────────────────────────────────────────────
export interface Character {
  id: string;
  name: string;
  role: "protagonist" | "antagonist" | "supporting" | "narrator" | "ensemble";
  description: string;
  /** Distilled identity prompt — appears as a continuity lock in
   *  every Shot.modelPrompt that features this character. */
  identityDNA?: string;
  /** Wardrobe / costume rules. */
  wardrobe?: string;
  /** Physical description — used by the AI generator for face-lock. */
  physicalDescription?: string;
  /** Reference image URL — when set, the engine uses it as a face/
   *  identity anchor (image-to-video flows). */
  referenceImageUrl?: string;
  /** Optional avatar id — when this character is voiced by a
   *  cloned avatar from project_characters / avatars. */
  avatarId?: string;
  /** Voice profile id (references VoiceProfile.id). */
  voiceProfileId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice profiles
// ─────────────────────────────────────────────────────────────────────────────
export type VoiceProvider =
  | "elevenlabs"
  | "avatar-clone"
  | "openai-tts"
  | "system-fallback";

export interface VoiceProfile {
  id: string;
  /** Human-readable name surfaced in the inspector. */
  name: string;
  provider: VoiceProvider;
  /** Provider-specific id — elevenlabs voice id, avatar voice id, etc. */
  providerVoiceId: string;
  /** Emotional registers the voice is capable of — used by the AI
   *  script writer to choose the right voice per dialogue beat. */
  registers?: Array<
    | "calm"
    | "warm"
    | "urgent"
    | "whisper"
    | "rage"
    | "amused"
    | "deadpan"
    | "narrative"
  >;
  /** Sample audio URL for QA. */
  previewUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Music — score cue list
// ─────────────────────────────────────────────────────────────────────────────
export interface MusicCue {
  id: string;
  /** Scene id this cue is anchored to. */
  sceneId: string;
  /** Description of the cue — used as the prompt for the music
   *  generator (Suno-equivalent) and surfaced in the inspector. */
  intent: string;
  /** Tempo in BPM if specified. */
  bpm?: number;
  /** Where the cue lives — A2 in the editor's bus model. */
  bus: "A2";
  /** Generated music URL when ready. */
  generatedUrl?: string;
  /** Stems for advanced mixing (drum/bass/melody). */
  stems?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene — the narrative unit
// ─────────────────────────────────────────────────────────────────────────────
export interface Scene {
  id: string;
  /** Ordinal within the document (1-based). Recomputed after reorder. */
  number: number;
  /** Slug-line: "INT. KITCHEN - NIGHT" etc. */
  slug: string;
  /** Action description visible in the screenplay above the beats. */
  description: string;
  mood?: string;
  timeOfDay?: string;
  actNumber?: number;
  isKeyScene?: boolean;
  /** Sequential beats — what happens, who speaks. Shots reference
   *  these by id. */
  beats: Beat[];
  /** Camera units — one shot generates one V1 clip. */
  shots: Shot[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Beats — what HAPPENS or who SPEAKS
// ─────────────────────────────────────────────────────────────────────────────
export type BeatKind =
  | "action"
  | "dialogue"
  | "paren"
  | "vo"      // voice-over
  | "sfx"     // ambient/foley
  | "music-cue"
  | "transition";

export interface Beat {
  id: string;
  kind: BeatKind;
  text: string;
  /** Character id when kind is dialogue / vo / paren. */
  characterId?: string;
  /** Voice profile override — when set, takes precedence over the
   *  character's default voiceProfileId. */
  voiceProfileId?: string;
  /** When in the scene this beat starts (seconds, relative to scene
   *  start). Optional — derived from shot mapping when absent. */
  startSec?: number;
  durationSec?: number;
  /** Which audio bus the beat lands on. */
  audioBus?: "A1" | "A2" | "A3";
  /** Production directions (whisper, urgent, etc) — used by the
   *  TTS generator when this beat goes through voice generation. */
  voiceDirection?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shots — camera units. ONE SHOT GENERATES ONE V1 CLIP.
// ─────────────────────────────────────────────────────────────────────────────
export type ShotFraming =
  | "wide"
  | "establishing"
  | "medium"
  | "close"
  | "extreme-close"
  | "over-shoulder"
  | "pov"
  | "overhead"
  | "low-angle"
  | "high-angle"
  | "two-shot"
  | "insert";

export interface Shot {
  id: string;
  /** Ordinal within the scene. */
  number: number;
  /** Beats this shot covers — ids reference Scene.beats. */
  beatRefs: string[];
  /** Camera framing. */
  framing: ShotFraming;
  /** Camera movement / direction. */
  cameraDirection: string;
  /** Lens intent — "anamorphic 50mm shallow DOF" etc. Surfaced as a
   *  hint to the engine + visible in the inspector. */
  lensIntent?: string;
  /** Target duration. Final clip's durationSec lands at this value
   *  (clamped to engine maxDurationSec). */
  durationSec: number;
  /** Engine override for this specific shot. When absent, document's
   *  capabilities.defaultEngine is used. */
  engineOverride?: ModelEngine;
  /** Fully-engineered prompt passed to the engine. Built from the
   *  framing + camera direction + lens intent + character identity
   *  DNA + beat texts. */
  modelPrompt: string;
  /** Engine-specific input payload — kept open so each engine can
   *  carry its own shape (image url, last-frame url, ref images,
   *  ComfyUI graph, etc.). */
  modelInput?: Record<string, unknown>;
  /** Continuity chain — when set, the previous shot's last frame
   *  feeds this shot as the initial image. */
  inheritsFromShotId?: string;
  /** Result of the generation cycle. */
  generated?: GeneratedArtifact;
  /** Approval state — ONE GATE per project: this is it. */
  approval: ShotApproval;
  /** Cost / budget metadata. */
  cost: ShotCost;
  /** Free-form notes the user / director keep on the shot. */
  notes?: string;
}

export interface GeneratedArtifact {
  /** Stable video URL — MUST be a long-lived storage URL, never a
   *  Replicate delivery URL (which expires after ~24h). The
   *  hydration + generator layers enforce this by re-uploading. */
  videoUrl: string;
  /** Persisted storage URL for the clip's final frame — used as
   *  the continuity chain anchor for the NEXT shot. */
  lastFrameUrl?: string;
  /** Persisted storage URL for the dialogue track when TTS was
   *  generated for this shot's beats. */
  audioUrl?: string;
  /** Poster / thumbnail. */
  thumbnailUrl?: string;
  /** When the generation completed. ISO 8601. */
  completedAt: string;
  /** Predictions ledger — every take is logged here so the user
   *  can switch between alternates. */
  takes: Take[];
}

export interface Take {
  id: string;
  takeNumber: number;
  videoUrl: string;
  thumbnailUrl?: string;
  /** Prompt used for this specific take — important when the
   *  prompt evolved between takes. */
  promptUsed: string;
  engine: ModelEngine;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}

export type ShotApprovalState =
  | "draft"            // newly written, not yet ready to ship to engine
  | "ready"            // user said "go" — engine may render
  | "rendering"        // engine is working on it
  | "completed"        // engine returned, artifact persisted
  | "needs-regen"      // user edited beats after approval — re-confirm to re-render
  | "failed";          // last attempt errored

export interface ShotApproval {
  state: ShotApprovalState;
  /** When the state was set. */
  changedAt: string;
  /** Who changed it — surfaces in the Versions panel. */
  changedBy: AuthorshipSource;
  /** Optional note — e.g. "approved with the revised final line." */
  reason?: string;
}

export interface ShotCost {
  /** Credits this shot will burn at the chosen engine + tier. */
  credits: number;
  /** Cached engine the cost was computed against — change the
   *  engine and the editor recomputes. */
  computedFor: { engine: ModelEngine; tier: ModelCapabilities["qualityTier"] };
  /** Storage cost estimate (currently zero — included for
   *  future-proofing tiered storage). */
  storageCredits?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Empty document — used when a brand-new project initializes. */
export function emptyDocument(projectId: string, title: string, aspectRatio: AspectRatio): ScriptDocument {
  return {
    schemaVersion: SCRIPT_DOCUMENT_VERSION,
    meta: {
      projectId,
      title,
      logline: "",
      aspectRatio,
      targetDurationSec: 60,
      authoredAt: new Date(0).toISOString(),
      authoredBy: "user",
    },
    template: {
      id: "custom",
      name: "Custom",
      pacing: "medium",
      defaultTransition: { kind: "fade", durationSec: 0.4 },
      averageShotLengthSec: 6,
      structureGuide: "",
    },
    capabilities: {
      defaultEngine: "seedance-1-pro",
      qualityTier: "pro",
    },
    cast: [],
    voices: [],
    music: [],
    scenes: [],
  };
}

/** Generate a stable, sortable id for any entity within the doc.
 *  Combines time + nonce so concurrent edits don't collide. */
export function newScriptId(prefix: string): string {
  const time = Math.floor(Date.now()).toString(36);
  const nonce = Math.floor(Math.random() * 1e6).toString(36);
  return `${prefix}-${time}-${nonce}`;
}

/** Walk the document, accumulating every shot in scene order. */
export function flatShots(doc: ScriptDocument): Shot[] {
  return doc.scenes.flatMap((s) => s.shots);
}

/** Walk the document, accumulating every beat in scene order. */
export function flatBeats(doc: ScriptDocument): Beat[] {
  return doc.scenes.flatMap((s) => s.beats);
}

/** Sum of all shot durations — the document's authored runtime. */
export function totalDurationSec(doc: ScriptDocument): number {
  return flatShots(doc).reduce((s, shot) => s + shot.durationSec, 0);
}

/** Total credits committed across all shots that are not in the
 *  `draft` state — used by the budget preview. */
export function totalCommittedCredits(doc: ScriptDocument): number {
  return flatShots(doc)
    .filter((s) => s.approval.state !== "draft")
    .reduce((sum, s) => sum + s.cost.credits, 0);
}

/** All credits the doc could spend if every shot is approved. */
export function totalPotentialCredits(doc: ScriptDocument): number {
  return flatShots(doc).reduce((sum, s) => sum + s.cost.credits, 0);
}

/** Find a shot by id anywhere in the doc. */
export function findShot(doc: ScriptDocument, shotId: string): Shot | null {
  for (const s of doc.scenes) {
    const hit = s.shots.find((sh) => sh.id === shotId);
    if (hit) return hit;
  }
  return null;
}

/** Find a beat by id anywhere in the doc. */
export function findBeat(doc: ScriptDocument, beatId: string): Beat | null {
  for (const s of doc.scenes) {
    const hit = s.beats.find((b) => b.id === beatId);
    if (hit) return hit;
  }
  return null;
}

/** Find the shot that owns a given beat. */
export function findShotForBeat(doc: ScriptDocument, beatId: string): Shot | null {
  for (const s of doc.scenes) {
    const hit = s.shots.find((sh) => sh.beatRefs.includes(beatId));
    if (hit) return hit;
  }
  return null;
}

/** Find the character a beat is voiced by, resolving the voice
 *  profile override chain. */
export function resolveVoiceProfile(
  doc: ScriptDocument,
  beat: Beat,
): VoiceProfile | null {
  const profileId =
    beat.voiceProfileId ??
    (beat.characterId
      ? doc.cast.find((c) => c.id === beat.characterId)?.voiceProfileId
      : undefined);
  if (!profileId) return null;
  return doc.voices.find((v) => v.id === profileId) ?? null;
}
