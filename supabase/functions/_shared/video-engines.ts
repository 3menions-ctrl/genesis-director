/**
 * Video Engine Registry — Single source of truth for all video models.
 *
 * Each engine declares:
 *   • Replicate model identity
 *   • Supported durations (seconds), aspect ratios, image-to-video shape
 *   • Native audio capability
 *   • An input builder that maps our canonical request → model's exact input shape
 *   • A prompt optimizer tuned for that model's strengths
 *
 * Add a new engine? Drop a new entry in ENGINES and `generate-video` picks it up.
 */

export type VideoEngineKey = "wan" | "kling" | "seedance" | "veo" | "sora" | "runway";

export interface CanonicalVideoRequest {
  prompt: string;            // Already-enhanced cinematic prompt
  rawPrompt: string;         // The user's untouched prompt — for engines that prefer it
  negativePrompt: string;
  duration: number;          // Seconds (caller-requested; engine clamps to its legal range)
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | string;
  startImageUrl: string | null;
  referenceImages: string[];
  enableAudio: boolean;
  isAvatarMode: boolean;
}

export interface EngineDefinition {
  key: VideoEngineKey;
  label: string;
  modelOwner: string;
  modelName: string;
  modelId: string;                 // owner/name
  endpoint: string;                // Full Replicate model-predictions URL
  durations: number[];             // Legal durations; nearest is used for caller request
  defaultDuration: number;
  maxDuration: number;
  minDuration: number;
  supportsImageToVideo: boolean;
  supportsNativeAudio: boolean;
  supportsLipSync: boolean;        // Only Kling V3 today
  tagline: string;
  optimizer: (req: CanonicalVideoRequest) => string;
  buildInput: (req: CanonicalVideoRequest) => Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function nearestDuration(allowed: number[], requested: number, fallback: number): number {
  if (!Number.isFinite(requested)) return fallback;
  let best = allowed[0] ?? fallback;
  let bestDiff = Math.abs(best - requested);
  for (const d of allowed) {
    const diff = Math.abs(d - requested);
    if (diff < bestDiff) {
      best = d;
      bestDiff = diff;
    }
  }
  return best;
}

function clampAspect(ar: string, allowed: string[], fallback: string): string {
  return allowed.includes(ar) ? ar : fallback;
}

// ─────────────────────────────────────────────────────────────────────
// Per-engine prompt optimizers
// Each model rewards different prompt grammars. We rewrite minimally —
// the upstream cinematic engine already did heavy lifting.
// ─────────────────────────────────────────────────────────────────────

function optimizeForKling(req: CanonicalVideoRequest): string {
  // Kling V3 likes: lens grammar, lighting, camera move verbs, lip-sync hints
  let p = req.prompt;
  if (req.isAvatarMode) {
    p = `${p}\n\n[CAMERA] 85mm portrait lens, eye-level, subtle handheld breath. [LIP-SYNC] Mouth shapes precisely match the spoken dialogue, natural micro-expressions, blink cadence every 3-5 seconds.`;
  } else {
    p = `${p}\n\n[CAMERA] Cinematic anamorphic lens, deliberate camera movement, natural parallax. [LIGHT] Motivated practicals, soft key, controlled contrast.`;
  }
  return p.slice(0, 1900);
}

function optimizeForSeedance(req: CanonicalVideoRequest): string {
  // Seedance 2.0 wants: motion verbs + lighting nouns, NO camera jargon (it auto-frames)
  // Strip "shot/lens/dolly/pan" — Seedance's internal cinematographer handles that.
  let p = req.prompt
    .replace(/\b(85mm|24mm|35mm|50mm|anamorphic|lens|dolly in|dolly out|pan left|pan right|zoom in|zoom out|crane shot|tracking shot)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Bias toward physical motion + lighting + texture
  p = `${p}\n\nMotion: fluid hyperreal physics, weight and inertia honored. Lighting: photographic, motivated, with believable specular highlights and skin subsurface scattering. Texture: filmic grain, no plastic CGI sheen.`;
  return p.slice(0, 1900);
}

function optimizeForVeo(req: CanonicalVideoRequest): string {
  // Veo 3 generates AUDIO natively — explicit audio cues materially improve output.
  let p = req.prompt;
  const hasAudioCue = /\b(audio|sound|ambient|dialogue|music|voice|whisper|footsteps|wind|rain)\b/i.test(p);
  if (!hasAudioCue) {
    p += `\n\n[AUDIO] Subtle ambient room tone, natural diegetic sound matching the action. No music unless action implies it.`;
  }
  // Veo 3 caps at 8s — pace the prompt accordingly
  p += `\n\n[PACING] Single coherent beat over 8 seconds — establish, develop, resolve. No scene cuts.`;
  return p.slice(0, 1900);
}

function optimizeForSora(req: CanonicalVideoRequest): string {
  // Sora 2 rewards narrative structure: subject → action → camera → light → style
  // It also handles longer coherent shots better than other engines.
  let p = req.prompt;
  // Prepend a structural summary if not already structured
  if (!/\b(subject|action|camera|lighting):/i.test(p)) {
    p = `Narrative beat — ${p}\n\nCamera: deliberate and observational. Lighting: natural and motivated. Style: cinematic, photoreal, 35mm film aesthetic. Audio: ambient diegetic sound.`;
  }
  return p.slice(0, 1900);
}

function optimizeForWan(req: CanonicalVideoRequest): string {
  // Wan 2.5 is the free tier — keep prompts short, action-forward.
  // It performs best with simple subject/verb/setting grammar, not the
  // dense cinematographic stack the cinema engines want.
  let p = req.prompt
    .replace(/\b(85mm|24mm|35mm|50mm|anamorphic|lens|dolly|crane|tracking shot)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (p.length > 700) p = p.slice(0, 700);
  return p;
}

function optimizeForRunway(req: CanonicalVideoRequest): string {
  // Runway Gen-4 Turbo: best-in-class for character continuity; rewards
  // explicit subject anchors. Camera grammar is fine here.
  let p = req.prompt;
  if (req.startImageUrl && !/\b(consistent|same character|matches the reference)\b/i.test(p)) {
    p = `Maintain the exact character / wardrobe / lighting from the reference frame. ${p}`;
  }
  return p.slice(0, 1900);
}

// ─────────────────────────────────────────────────────────────────────
// Engine registry
// ─────────────────────────────────────────────────────────────────────

export const ENGINES: Record<VideoEngineKey, EngineDefinition> = {
  wan: {
    key: "wan",
    label: "Wan 2.5 — Free",
    modelOwner: "wan-video",
    modelName: "wan-2.5-t2v",
    modelId: "wan-video/wan-2.5-t2v",
    endpoint: "https://api.replicate.com/v1/models/wan-video/wan-2.5-t2v/predictions",
    durations: [5, 10],
    defaultDuration: 5,
    minDuration: 5,
    maxDuration: 10,
    supportsImageToVideo: true,
    supportsNativeAudio: false,
    supportsLipSync: false,
    tagline: "Free tier · 1080p · 5-10s",
    optimizer: optimizeForWan,
    buildInput: (req) => {
      const duration = nearestDuration([5, 10], req.duration, 5);
      const ar = clampAspect(req.aspectRatio, ["16:9", "9:16", "1:1"], "16:9");
      const enhanced = optimizeForWan(req);
      const input: Record<string, unknown> = {
        prompt: enhanced,
        duration,
        aspect_ratio: ar,
        resolution: "1080p",
      };
      if (req.startImageUrl) input.image = req.startImageUrl;
      return input;
    },
  },
  kling: {
    key: "kling",
    label: "Kling V3",
    modelOwner: "kwaivgi",
    modelName: "kling-v3-video",
    modelId: "kwaivgi/kling-v3-video",
    endpoint: "https://api.replicate.com/v1/models/kwaivgi/kling-v3-video/predictions",
    durations: [5, 10, 15],
    defaultDuration: 10,
    minDuration: 3,
    maxDuration: 15,
    supportsImageToVideo: true,
    supportsNativeAudio: true,
    supportsLipSync: true,
    tagline: "Cinematic · Native lip-sync",
    optimizer: optimizeForKling,
    buildInput: (req) => {
      const duration = nearestDuration([5, 10, 15], req.duration, 10);
      const ar = clampAspect(req.aspectRatio, ["16:9", "9:16", "1:1"], "16:9");
      const enhanced = optimizeForKling(req);
      const input: Record<string, unknown> = {
        prompt: enhanced,
        negative_prompt: req.negativePrompt.slice(0, 1500),
        aspect_ratio: ar,
        duration,
        mode: "pro",
      };
      if (req.startImageUrl) input.start_image = req.startImageUrl;
      if (req.enableAudio || req.isAvatarMode) input.generate_audio = true;
      return input;
    },
  },
  seedance: {
    key: "seedance",
    label: "Seedance 1 Pro",
    modelOwner: "bytedance",
    modelName: "seedance-1-pro",
    modelId: "bytedance/seedance-1-pro",
    endpoint: "https://api.replicate.com/v1/models/bytedance/seedance-1-pro/predictions",
    durations: [3, 5, 10, 12],
    defaultDuration: 10,
    minDuration: 3,
    maxDuration: 12,
    supportsImageToVideo: true,
    supportsNativeAudio: false,
    supportsLipSync: false,
    tagline: "Premium hyperreal motion",
    optimizer: optimizeForSeedance,
    buildInput: (req) => {
      const duration = nearestDuration([3, 5, 10, 12], req.duration, 10);
      const ar = clampAspect(req.aspectRatio, ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"], "16:9");
      const enhanced = optimizeForSeedance(req);
      const input: Record<string, unknown> = {
        prompt: enhanced,
        duration,
        resolution: "1080p",
        aspect_ratio: ar,
        fps: 24,
        camera_fixed: false,
      };
      if (req.startImageUrl) input.image = req.startImageUrl;
      return input;
    },
  },
  veo: {
    key: "veo",
    label: "Veo 3 Fast",
    modelOwner: "google",
    modelName: "veo-3-fast",
    modelId: "google/veo-3-fast",
    endpoint: "https://api.replicate.com/v1/models/google/veo-3-fast/predictions",
    durations: [4, 6, 8],
    defaultDuration: 8,
    minDuration: 4,
    maxDuration: 8,
    supportsImageToVideo: true,
    supportsNativeAudio: true,
    supportsLipSync: false,
    tagline: "Native audio · 1080p in 8s",
    optimizer: optimizeForVeo,
    buildInput: (req) => {
      const duration = nearestDuration([4, 6, 8], req.duration, 8);
      const ar = clampAspect(req.aspectRatio, ["16:9", "9:16"], "16:9");
      const enhanced = optimizeForVeo(req);
      const input: Record<string, unknown> = {
        prompt: enhanced,
        negative_prompt: req.negativePrompt.slice(0, 1500),
        aspect_ratio: ar,
        duration,
        resolution: "1080p",
        generate_audio: req.enableAudio !== false,
      };
      if (req.startImageUrl) input.image = req.startImageUrl;
      return input;
    },
  },
  sora: {
    key: "sora",
    label: "Sora 2",
    modelOwner: "openai",
    modelName: "sora-2",
    modelId: "openai/sora-2",
    endpoint: "https://api.replicate.com/v1/models/openai/sora-2/predictions",
    durations: [4, 8, 12],
    defaultDuration: 8,
    minDuration: 4,
    maxDuration: 12,
    supportsImageToVideo: true,            // via input_reference
    supportsNativeAudio: true,             // Sora 2 generates audio
    supportsLipSync: false,
    tagline: "Narrative coherence · Long-form shots",
    optimizer: optimizeForSora,
    buildInput: (req) => {
      const seconds = nearestDuration([4, 8, 12], req.duration, 8);
      // Sora 2 uses "portrait" / "landscape" — NOT "16:9" / "9:16"
      const aspect = req.aspectRatio === "9:16" ? "portrait" : "landscape";
      const enhanced = optimizeForSora(req);
      const input: Record<string, unknown> = {
        prompt: enhanced,
        seconds,
        aspect_ratio: aspect,
      };
      if (req.startImageUrl) input.input_reference = req.startImageUrl;
      return input;
    },
  },
  runway: {
    key: "runway",
    label: "Runway Gen-4 Turbo",
    modelOwner: "runwayml",
    modelName: "gen4-turbo",
    modelId: "runwayml/gen4-turbo",
    endpoint: "https://api.replicate.com/v1/models/runwayml/gen4-turbo/predictions",
    durations: [5, 10],
    defaultDuration: 5,
    minDuration: 5,
    maxDuration: 10,
    supportsImageToVideo: true,
    supportsNativeAudio: false,
    supportsLipSync: false,
    tagline: "Best-in-class character continuity",
    optimizer: optimizeForRunway,
    buildInput: (req) => {
      const duration = nearestDuration([5, 10], req.duration, 5);
      const ar = clampAspect(req.aspectRatio, ["16:9", "9:16", "1:1", "4:3", "3:4"], "16:9");
      const enhanced = optimizeForRunway(req);
      const input: Record<string, unknown> = {
        prompt: enhanced,
        duration,
        aspect_ratio: ar,
        resolution: "1080p",
      };
      if (req.startImageUrl) input.image = req.startImageUrl;
      return input;
    },
  },
};

export function getEngine(key: string | undefined | null): EngineDefinition {
  const k = (key as VideoEngineKey) || "kling";
  return ENGINES[k] ?? ENGINES.kling;
}

/**
 * Submit a generation to Replicate using the engine-specific input shape.
 * Returns the prediction ID and the model identity for audit logging.
 */
export async function submitToReplicate(
  engine: EngineDefinition,
  input: Record<string, unknown>,
  apiKey: string,
): Promise<{ success: true; taskId: string; model: string } | { success: false; status: number; error: string }> {
  const resp = await fetch(engine.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait=0",
    },
    body: JSON.stringify({ input }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { success: false, status: resp.status, error: text.slice(0, 500) };
  }

  const data = await resp.json();
  if (!data?.id) {
    return { success: false, status: 502, error: "No prediction id returned" };
  }

  return { success: true, taskId: data.id, model: engine.modelId };
}
