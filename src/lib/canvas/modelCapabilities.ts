/**
 * Model capability matrix.
 * Each entry declares what a Replicate model can do, so the Inspector
 * only renders inputs the model actually supports.
 */
import type { ReplicateModelRef } from './types';

export type ModelCategory = 'video' | 'image' | 'audio' | 'voice' | 'other';

export interface ModelCaps {
  category: ModelCategory;
  t2v?: boolean;            // text → video
  i2v?: boolean;            // image → video (start frame)
  endFrame?: boolean;       // supports end frame (frame chaining)
  nativeAudio?: boolean;    // generates audio inline
  dialogue?: boolean;       // accepts spoken-line script
  maxDurationSec?: number;
  aspectRatios?: string[];
  resolution?: string[];
  notes?: string;
}

export interface CuratedModel extends ReplicateModelRef {
  category: ModelCategory;
  blurb: string;
  caps: ModelCaps;
  badge?: 'flagship' | 'fast' | 'new' | 'pro';
}

export const CURATED_MODELS: CuratedModel[] = [
  // ───────── Video ─────────
  {
    owner: 'kwaivgi', name: 'kling-v2.1-master', label: 'Kling V2.1 Master',
    category: 'video', badge: 'flagship',
    blurb: 'Cinematic motion, native audio, frame chaining.',
    caps: { category: 'video', t2v: true, i2v: true, endFrame: true, nativeAudio: true, dialogue: true,
      maxDurationSec: 10, aspectRatios: ['16:9', '9:16', '1:1'], resolution: ['1080p'] },
  },
  {
    owner: 'bytedance', name: 'seedance-2-pro', label: 'Seedance 2 Pro',
    category: 'video', badge: 'pro',
    blurb: 'High-fidelity character motion, no native audio.',
    caps: { category: 'video', t2v: true, i2v: true, endFrame: false, nativeAudio: false,
      maxDurationSec: 8, aspectRatios: ['16:9', '9:16'] },
  },
  {
    owner: 'google', name: 'veo-3', label: 'Veo 3',
    category: 'video', badge: 'flagship',
    blurb: 'Cinema-grade T2V with synced dialogue + score.',
    caps: { category: 'video', t2v: true, i2v: false, nativeAudio: true, dialogue: true,
      maxDurationSec: 8, aspectRatios: ['16:9'], resolution: ['1080p'] },
  },
  {
    owner: 'runwayml', name: 'gen4-turbo', label: 'Runway Gen-4 Turbo',
    category: 'video', badge: 'fast',
    blurb: 'Fast image-to-video with strong identity hold.',
    caps: { category: 'video', i2v: true, endFrame: true, maxDurationSec: 10,
      aspectRatios: ['16:9', '9:16', '1:1'] },
  },
  {
    owner: 'openai', name: 'sora-2', label: 'Sora 2',
    category: 'video', badge: 'new',
    blurb: 'Long-form text-to-video with physics-aware motion.',
    caps: { category: 'video', t2v: true, nativeAudio: true, maxDurationSec: 20,
      aspectRatios: ['16:9', '9:16'] },
  },
  {
    owner: 'minimax', name: 'hailuo-02', label: 'Hailuo 02',
    category: 'video', badge: 'fast',
    blurb: 'Snappy I2V, great for short beats.',
    caps: { category: 'video', t2v: true, i2v: true, maxDurationSec: 6, aspectRatios: ['16:9', '9:16'] },
  },
  // ───────── Image ─────────
  {
    owner: 'black-forest-labs', name: 'flux-1.1-pro-ultra', label: 'FLUX 1.1 Pro Ultra',
    category: 'image', badge: 'flagship',
    blurb: 'Reference-quality stills for environments & posters.',
    caps: { category: 'image', aspectRatios: ['16:9', '9:16', '1:1', '21:9', '4:5'], resolution: ['4MP'] },
  },
  {
    owner: 'google', name: 'nano-banana', label: 'Nano Banana',
    category: 'image', badge: 'new',
    blurb: 'Conversational image edits, character consistency.',
    caps: { category: 'image', i2v: false, aspectRatios: ['1:1', '16:9', '9:16'] },
  },
  {
    owner: 'black-forest-labs', name: 'flux-fill-pro', label: 'FLUX Fill Pro',
    category: 'image',
    blurb: 'Outpaint and aspect-ratio expansion.',
    caps: { category: 'image' },
  },
  // ───────── Audio / Voice ─────────
  {
    owner: 'meta', name: 'musicgen-stereo-large', label: 'MusicGen Stereo',
    category: 'audio', badge: 'flagship',
    blurb: 'Cinematic score generation up to 30s.',
    caps: { category: 'audio', maxDurationSec: 30 },
  },
  {
    owner: 'lucataco', name: 'xtts-v2', label: 'XTTS v2 (Voice)',
    category: 'voice',
    blurb: 'Multilingual voice cloning for dialogue.',
    caps: { category: 'voice', dialogue: true },
  },
  {
    owner: 'jaaari', name: 'kokoro-82m', label: 'Kokoro (TTS)',
    category: 'voice', badge: 'fast',
    blurb: 'Lightweight neural TTS for VO scratch tracks.',
    caps: { category: 'voice', dialogue: true },
  },
];

const BY_KEY = new Map(CURATED_MODELS.map((m) => [`${m.owner}/${m.name}`, m]));

export function lookupCurated(ref?: ReplicateModelRef | null): CuratedModel | undefined {
  if (!ref) return undefined;
  return BY_KEY.get(`${ref.owner}/${ref.name}`);
}

/** Infer best-effort caps from a Replicate model name when not curated. */
export function inferCaps(ref: ReplicateModelRef): ModelCaps {
  const n = `${ref.owner}/${ref.name}`.toLowerCase();
  const isVideo = /(video|kling|veo|sora|seedance|gen[-_]?[34]|hailuo|wan|cogvideo|hunyuan|ltx)/.test(n);
  const isAudio = /(music|audio|sfx|musicgen|stable[-_]?audio)/.test(n);
  const isVoice = /(tts|voice|xtts|elevenlabs|whisper|kokoro|bark)/.test(n);
  if (isVideo) return { category: 'video', t2v: true, i2v: true, maxDurationSec: 6, aspectRatios: ['16:9', '9:16'] };
  if (isVoice) return { category: 'voice', dialogue: true };
  if (isAudio) return { category: 'audio', maxDurationSec: 30 };
  return { category: 'image', aspectRatios: ['1:1', '16:9', '9:16'] };
}

export function capsFor(ref?: ReplicateModelRef | null): ModelCaps | undefined {
  if (!ref) return undefined;
  return lookupCurated(ref)?.caps ?? inferCaps(ref);
}

export function capChips(caps?: ModelCaps): string[] {
  if (!caps) return [];
  const out: string[] = [];
  if (caps.t2v) out.push('T2V');
  if (caps.i2v) out.push('I2V');
  if (caps.endFrame) out.push('Chain');
  if (caps.nativeAudio) out.push('Audio');
  if (caps.dialogue) out.push('Dialogue');
  if (caps.maxDurationSec) out.push(`${caps.maxDurationSec}s`);
  return out;
}
