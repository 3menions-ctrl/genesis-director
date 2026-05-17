/**
 * Studio v2 — unified linear creation experience.
 * Persisted into creation_canvases.nodes (jsonb) as a single StudioDraft object.
 */
import type { EngineId } from "@/lib/video/engines";

export type SceneStatus = "idle" | "queued" | "generating" | "done" | "failed";

export interface CastMember {
  id: string;            // avatar_template id or local uuid
  name: string;
  imageUrl: string;
  voiceId?: string;
  source: "library" | "saved" | "generated";
}

export interface SceneDraft {
  id: string;
  index: number;
  location: string;       // INT/EXT — Location — Time
  beat: string;           // 1-line action description
  parenthetical?: string; // (whispered), (off-screen), (V.O.)
  dialogue: string;       // verbatim dialogue (preserved)
  speakerId?: string;     // CastMember.id
  notes?: string;         // director notes (not sent to renderer)
  lens: "wide" | "medium" | "close" | "macro" | "aerial";
  move: "static" | "dolly" | "pan" | "tilt" | "handheld" | "crane";
  duration: 5 | 10 | 12 | 15;
  engine?: EngineId;      // override of project default
  refImageUrl?: string;
  clipUrl?: string;       // rendered HLS or mp4
  posterUrl?: string;
  status: SceneStatus;
  predictionId?: string;
  costEstimate?: number;
  /**
   * When this scene is gated behind a predecessor (chain continuity), we
   * stash the predecessor sceneId here so the UI can surface "waiting on
   * scene N" and so the gate watcher can resume automatically when the
   * predecessor reaches a terminal state.
   */
  waitingOnSceneId?: string;
  /**
   * Human-readable reason set whenever `status === "failed"`. Surfaced on
   * the clip card and stage preview so users can see why a render was
   * rejected (insufficient credits, engine lock error, predecessor failure,
   * backend exception, etc.). Cleared whenever the scene re-enters a
   * non-terminal state.
   */
  errorReason?: string;
  /**
   * Continuity link to the previous scene. When `true` (default), the renderer
   * inherits the previous scene's last frame as this scene's start image and
   * carries character/identity locks forward. When `false`, this scene is
   * treated as a standalone shot — no frame chaining, no identity inheritance,
   * no environment carry-over. Use for anthologies, cutaways, or hard cuts to
   * an unrelated location/character.
   */
  chainFromPrevious?: boolean;
  /**
   * Server-side credit reservation id. Set when the scene successfully
   * reserves credits via `reserve-credits` and cleared once the hold is
   * consumed (on success) or released (on failure). Persisting this on
   * the scene lets every terminal-state code path — poll failure, gate
   * skip, abort — release the hold so retries don't pile up phantom
   * reservations that make the user appear out of credits.
   */
  creditHoldId?: string;
}

export interface StudioBrief {
  title: string;
  logline: string;
  style: string;          // free-form mood / genre
  styleId?: string;       // selected preset id from StylesDrawer
  styleModifier?: string; // prompt modifier appended at render time
  refImageUrl?: string;
  templateId?: string;
  environmentId?: string;
}

export interface StudioDefaults {
  engine: EngineId;
  aspect: "16:9" | "9:16" | "1:1" | "21:9";
  duration: 5 | 10 | 12 | 15;
  voiceId?: string;
  mode: "auto" | "director";
  /** Selected quality profile id (resolves to engine.qualityProfiles entry). */
  qualityProfileId?: string;
  /** Planned scene count for auto-script. Defaults to engine.recommendedScenes. */
  sceneCount?: number;
}

export interface StudioAudio {
  scoreUrl?: string;
  scorePrompt?: string;
  sfx: { id: string; sceneId: string; url: string; label: string }[];
}

export interface StudioDraft {
  v: 2;
  brief: StudioBrief;
  defaults: StudioDefaults;
  cast: CastMember[];
  scenes: SceneDraft[];
  audio: StudioAudio;
  activeSceneId?: string;
  /** Customer must explicitly approve the generated/edited script and the
   *  current credit estimate before any render can reserve or deduct credits. */
  scriptApprovedAt?: string;
  creditEstimateApprovedAt?: string;
  approvedCreditTotal?: number;
  approvedSceneSignature?: string;
  /** Lazy-bound `movie_projects.id` — created on first generate so backend
   *  pipelines (engine lock, mutex, credits, watchdog) can attach. */
  projectId?: string;
}

export const EMPTY_DRAFT: StudioDraft = {
  v: 2,
  brief: { title: "", logline: "", style: "Cinematic" },
  defaults: { engine: "kling-v3", aspect: "16:9", duration: 10, mode: "auto", sceneCount: 4 },
  cast: [],
  scenes: [],
  audio: { sfx: [] },
};

export function newScene(index: number): SceneDraft {
  return {
    id: crypto.randomUUID(),
    index,
    location: "EXT. UNTITLED — DAY",
    beat: "",
    dialogue: "",
    lens: "medium",
    move: "static",
    duration: 10,
    status: "idle",
  };
}