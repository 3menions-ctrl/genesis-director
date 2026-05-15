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
  dialogue: string;       // verbatim dialogue (preserved)
  speakerId?: string;     // CastMember.id
  lens: "wide" | "medium" | "close" | "macro" | "aerial";
  move: "static" | "dolly" | "pan" | "tilt" | "handheld" | "crane";
  duration: 5 | 10 | 15;
  engine?: EngineId;      // override of project default
  refImageUrl?: string;
  clipUrl?: string;       // rendered HLS or mp4
  posterUrl?: string;
  status: SceneStatus;
  predictionId?: string;
  costEstimate?: number;
}

export interface StudioBrief {
  title: string;
  logline: string;
  style: string;          // free-form mood / genre
  refImageUrl?: string;
  templateId?: string;
  environmentId?: string;
}

export interface StudioDefaults {
  engine: EngineId;
  aspect: "16:9" | "9:16" | "1:1" | "21:9";
  duration: 5 | 10 | 15;
  voiceId?: string;
  mode: "auto" | "director";
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
}

export const EMPTY_DRAFT: StudioDraft = {
  v: 2,
  brief: { title: "", logline: "", style: "Cinematic" },
  defaults: { engine: "kling-v3", aspect: "16:9", duration: 10, mode: "auto" },
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