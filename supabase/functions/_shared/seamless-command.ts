/**
 * seamless-command — the pure FFmpeg command builder used by the
 * seamless-stitcher edge function.
 *
 * Extracted from `seamless-stitcher/index.ts` so the same compile
 * function is callable from a Vitest test harness without spinning up
 * a Deno runtime. The edge function imports `buildSeamlessCommand`
 * from here; the render-test harness imports it from here too.
 *
 * This file MUST stay pure:
 *   - no `Deno.*` references
 *   - no `https://...` imports
 *   - no top-level side effects
 *
 * Anything that needs Deno (env vars, http server) stays in index.ts.
 */

import type { MasterLoudnessPreset } from "./audio-mix.ts";
import { masterLoudnormFilter } from "./audio-mix-filters.ts";

// ── Canonical pipeline constants ──────────────────────────────────────
// 16:9 native pipeline; aspect-specific dimensions are picked via
// dimensionsForAspect() so 9:16, 1:1, 4:5, 21:9 actually produce
// correctly-shaped output bytes instead of being letterboxed into 1920×1080.
export const TARGET_WIDTH = 1920;
export const TARGET_HEIGHT = 1080;
export const TARGET_FPS = 30;
export const TARGET_SAR = "1"; // square pixels
export const TARGET_COLORSPACE = "bt709";
export const TARGET_SAMPLE_RATE = 48000;
export const TARGET_CHANNELS = "stereo";

export const DEFAULT_TRANSITION_DURATION = 0.4;
export const DEFAULT_TRANSITION_TYPE = "fade"; // any xfade transition name

/** A clip prepared for inclusion in the stitcher graph. The compile
 *  side of the editor (color-grade-filters, effects-bake, audio-mix-
 *  filters, keyframe-bake) emits these per-clip filter chains; this
 *  module knits them into the final filter_complex. */
export interface StitchInput {
  url: string;
  duration: number; // seconds
  isIntro: boolean;
  /** Pre-compiled FFmpeg color-grade filter chain for this clip. */
  colorFilter?: string;
  /** Pre-compiled Crossover-recipe effect bake (Tier 1 inline). */
  effectChain?: string;
  /** Extra `-f lavfi -i "..."` args the effect bake needs. */
  extraInputs?: string[];
  /** Pre-compiled per-clip audio mix filter chain (volume, pan, EQ,
   *  compressor). Comma-joined afilter chain; empty = no work. */
  audioFilter?: string;
  /** Pre-compiled keyframe chains. videoKfChain handles scale +
   *  opacity time-expressions; audioKfChain handles volume rides.
   *  Empty when the clip has no keyframes. */
  videoKfChain?: string;
  audioKfChain?: string;
  /** Soft fade-in over this many seconds at the clip's start. */
  fadeInSec?: number;
  /** Soft fade-out at the clip's tail. */
  fadeOutSec?: number;
  /** Per-clip playback speed multiplier. 1.0 = real-time. */
  speed?: number;
  /** JOIN TRIM (continuity v2): drop this many seconds from the clip's HEAD
   *  before joining. Vendor recipe for frame-chained boundaries: the first
   *  frame of a chained clip duplicates the previous clip's handoff frame —
   *  trim 1 frame (1/30s) so the join doesn't stutter. */
  trimStartSec?: number;
  /** JOIN TRIM: drop this many seconds from the clip's TAIL. Vendor recipe:
   *  6 frames (0.2s) — generation quality decays into the last frames of a
   *  chained segment, and the next clip re-renders that instant anyway. */
  trimEndSec?: number;
}

/** Post-trim playable duration of an input — all offset/fade math uses this. */
export function effectiveDuration(inp: StitchInput): number {
  return Math.max(0.1, inp.duration - (inp.trimStartSec ?? 0) - (inp.trimEndSec ?? 0));
}

/** Round a number to millisecond precision so the produced FFmpeg
 *  expressions are stable across runs and easy to assert in tests. */
export function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Map a UI aspect-ratio string to encoded dimensions, scaled by a
 *  resolution preset. Returns the 16:9/1080p default if either input
 *  is unrecognized. */
export function dimensionsForAspect(
  aspect: string | undefined,
  resolution: string | undefined = "1080p",
): { w: number; h: number } {
  let base: { w: number; h: number };
  switch ((aspect ?? "").trim()) {
    case "9:16":  base = { w: 1080, h: 1920 }; break;
    case "1:1":   base = { w: 1080, h: 1080 }; break;
    case "4:5":   base = { w: 1080, h: 1350 }; break;
    case "4:3":   base = { w: 1440, h: 1080 }; break;
    case "21:9":  base = { w: 2560, h: 1080 }; break;
    case "16:9":
    default:      base = { w: 1920, h: 1080 }; break;
  }
  const mult = (() => {
    switch ((resolution ?? "").trim()) {
      case "720p":  return 720 / 1080;
      case "1080p": return 1;
      case "1440p": return 1440 / 1080;
      case "2k":    return 1440 / 1080;
      case "4k":
      case "2160p": return 2160 / 1080;
      case "8k":
      case "4320p": return 4320 / 1080;
      default:      return 1;
    }
  })();
  // H.264 requires even dimensions on most chroma subsampling profiles.
  const even = (n: number) => Math.round(n / 2) * 2;
  return { w: even(base.w * mult), h: even(base.h * mult) };
}

/** Map an export format choice to a final encode profile. */
export function encodeProfileFor(format: string | undefined): {
  vcodec: string;
  acodec: string | null;
  ext: string;
  extraOut: string;
} {
  switch ((format ?? "mp4").toLowerCase()) {
    case "mov":
      return {
        vcodec: "prores_ks -profile:v 3 -vendor apl0",
        acodec: "pcm_s16le",
        ext: "mov",
        extraOut: "",
      };
    case "webm":
      return {
        vcodec: "libvpx-vp9 -b:v 0 -crf 32 -row-mt 1 -tile-columns 2 -threads 4",
        acodec: "libopus -b:a 128k",
        ext: "webm",
        extraOut: "",
      };
    case "gif":
      return {
        vcodec: "gif",
        acodec: null, // GIF has no audio
        ext: "gif",
        extraOut: "",
      };
    case "mp4":
    default:
      return {
        vcodec: "libx264 -preset slow -crf 18 -profile:v high -level:v 4.1",
        acodec: "aac -b:a 192k",
        ext: "mp4",
        extraOut: "-movflags +faststart",
      };
  }
}

/** Map UI transition kind to the xfade transition argument. */
export function xfadeKindFor(kind: string | undefined, fallback: string): string {
  if (!kind) return fallback;
  const k = kind.toLowerCase();
  const allow = new Set([
    "fade", "fadeblack", "fadewhite", "dissolve", "wipeleft", "wiperight",
    "wipeup", "wipedown", "slideleft", "slideright", "slideup", "slidedown",
    "circlecrop", "rectcrop", "distance", "radial", "smoothleft",
    "smoothright", "smoothup", "smoothdown", "circleopen", "circleclose",
    "vertopen", "vertclose", "horzopen", "horzclose", "pixelize",
  ]);
  if (allow.has(k)) return k;
  // Real hard cut — handled as a concat join (no xfade) in the chain builder.
  // (Previously mapped to "fade", which BLURRED matched-frame chained
  // boundaries instead of cutting cleanly on them.)
  if (k === "cut" || k === "hardcut") return "cut";
  if (k === "crossfade") return "fade";
  return fallback;
}

/**
 * Compile the multi-input filter_complex + ffmpeg command for the
 * seamless-stitcher project flow.
 *
 * Graph stages, in order:
 *   1. Per-input normalize: scale → pad → setsar → fps → color grade →
 *      effect bake → format → colorspace.
 *   2. Per-clip audio normalize: aresample → aformat → speed → micro-fade →
 *      artistic fade → mix.
 *   3. Chained xfade for video + acrossfade for audio.
 *   4. Title overlay drawtext chain (with shadow approximation).
 *   5. V2/V3 overlay composition.
 *   6. A2+ aux audio amix (optionally with sidechain auto-ducking).
 *   7. Master loudnorm.
 *   8. Encode profile applied (libx264 / prores / libvpx / gif).
 */
export function buildSeamlessCommand({
  inputs,
  transitionDuration,
  transitionType,
  masterLoudness,
  aspectRatio,
  resolution,
  format,
  crf,
  autoDuck,
  perBoundaryTransitions,
  titleClips,
  overlays,
  auxAudio,
  silentAudio,
}: {
  inputs: StitchInput[];
  transitionDuration: number;
  transitionType: string;
  masterLoudness?: MasterLoudnessPreset;
  aspectRatio?: string;
  resolution?: string;
  format?: string;
  crf?: number;
  autoDuck?: boolean;
  perBoundaryTransitions?: Array<{ kind: string; durationSec: number }>;
  titleClips?: Array<{
    text: string;
    color: string;
    startSec: number;
    durationSec: number;
    x?: number;
    y?: number;
    sizePct?: number;
    bold?: boolean;
  }>;
  overlays?: Array<{ timelineStartSec: number; durationSec: number }>;
  /** Extra audio tracks. `kind:"voice"` (A1 voiceover) mixes into the master at
   *  FULL level — it IS the narration. `kind:"music"` (A2+, the default) is
   *  amixed and, with autoDuck, sidechain-ducked under the voice+master. */
  auxAudio?: Array<{ timelineStartSec: number; durationSec: number; kind?: "music" | "voice" }>;
  /** Fallback for inputs with NO audio stream (e.g. kling t2v with music/
   *  narration off): `[i:a]` in the graph fails with "Stream specifier ':a'
   *  matches no streams", so each per-input audio stage is replaced by an
   *  anullsrc silence source of the clip's duration. The rest of the audio
   *  graph (acrossfade, aux-audio mix, loudnorm) is unchanged. */
  silentAudio?: boolean;
}): { command: string } {
  const n = inputs.length;
  if (n < 1) {
    throw new Error("buildSeamlessCommand: at least one input required");
  }
  const X = transitionDuration;
  const T = transitionType;
  const { w: outW, h: outH } = dimensionsForAspect(aspectRatio, resolution);
  const profile = encodeProfileFor(format);

  // ── Per-input normalize ────────────────────────────────────────────
  const normalizeChunks: string[] = [];
  for (let i = 0; i < n; i++) {
    const cf = (inputs[i].colorFilter ?? "").trim();
    const efx = (inputs[i].effectChain ?? "").trim();
    const gradeStage = cf ? `${cf},` : "";
    // JOIN TRIM: drop head/tail seconds BEFORE any other processing so every
    // downstream stage (speed, fades, xfade offsets) sees the trimmed clip.
    const tS = round(inputs[i].trimStartSec ?? 0);
    const tE = round(inputs[i].trimEndSec ?? 0);
    const trimVStage = (tS > 0 || tE > 0)
      ? `trim=start=${tS}:end=${round(inputs[i].duration - tE)},setpts=PTS-STARTPTS,`
      : "";
    const trimAStage = (tS > 0 || tE > 0)
      ? `atrim=start=${tS}:end=${round(inputs[i].duration - tE)},asetpts=PTS-STARTPTS,`
      : "";
    const sp = inputs[i].speed ?? 1;
    const speedVStage = sp !== 1 ? `setpts=PTS/${sp.toFixed(4)},` : "";
    const atempoStages: string[] = [];
    if (sp !== 1) {
      let remain = sp;
      while (remain > 2) { atempoStages.push("atempo=2"); remain /= 2; }
      while (remain < 0.5) { atempoStages.push("atempo=0.5"); remain *= 2; }
      atempoStages.push(`atempo=${remain.toFixed(4)}`);
    }
    const audioSpeedChain = atempoStages.length ? `,${atempoStages.join(",")}` : "";
    const fIn = inputs[i].fadeInSec ?? 0;
    const fOut = inputs[i].fadeOutSec ?? 0;
    const effDur = effectiveDuration(inputs[i]);
    const fadeVStage = (() => {
      const parts: string[] = [];
      if (fIn > 0.001) parts.push(`fade=t=in:st=0:d=${round(fIn)}`);
      if (fOut > 0.001) {
        const st = round(Math.max(0, effDur - fOut));
        parts.push(`fade=t=out:st=${st}:d=${round(fOut)}`);
      }
      return parts.length ? `${parts.join(",")},` : "";
    })();
    const fadeAfStage = (() => {
      const parts: string[] = [];
      if (fIn > 0.001) parts.push(`afade=t=in:st=0:d=${round(fIn)}`);
      if (fOut > 0.001) {
        const st = round(Math.max(0, effDur - fOut));
        parts.push(`afade=t=out:st=${st}:d=${round(fOut)}`);
      }
      return parts.length ? `,${parts.join(",")}` : "";
    })();

    const vKf = (inputs[i].videoKfChain ?? "").trim();
    const aKf = (inputs[i].audioKfChain ?? "").trim();
    const vKfStage = vKf ? `${vKf},` : "";
    const aKfStage = aKf ? `,${aKf}` : "";

    if (efx) {
      normalizeChunks.push(
        `[${i}:v]${trimVStage}${speedVStage}scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
        `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:` +
        `setsar=${TARGET_SAR},fps=${TARGET_FPS},` +
        `${gradeStage}` +
        `format=rgba[vG${i}]`,
      );
      const splicedEfx = efx
        .replace(/\{vIn\}/g, `vG${i}`)
        .replace(/\{vOut\}/g, `vE${i}`);
      normalizeChunks.push(splicedEfx);
      normalizeChunks.push(
        `[vE${i}]${fadeVStage}${vKfStage}format=yuv420p,` +
        `colorspace=all=${TARGET_COLORSPACE}:iall=${TARGET_COLORSPACE}:fast=1[v${i}]`,
      );
    } else {
      normalizeChunks.push(
        `[${i}:v]${trimVStage}${speedVStage}scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
        `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:color=black,` +
        `setsar=${TARGET_SAR},fps=${TARGET_FPS},` +
        `${gradeStage}` +
        `${fadeVStage}` +
        `${vKfStage}` +
        `format=yuv420p,` +
        `colorspace=all=${TARGET_COLORSPACE}:iall=${TARGET_COLORSPACE}:fast=1[v${i}]`,
      );
    }

    const af = (inputs[i].audioFilter ?? "").trim();
    const mixStage = af ? `,${af}` : "";
    const clipDur = effectiveDuration(inputs[i]);
    const fadeDur = 0.005;
    const fadeOutStart = Math.max(0, round(clipDur - fadeDur));
    const microFades = `,afade=t=in:st=0:d=${fadeDur},afade=t=out:st=${fadeOutStart}:d=${fadeDur}`;
    if (silentAudio) {
      // Input has no audio stream — synthesize silence of the clip's
      // (post-trim) duration so the downstream acrossfade/mix graph is
      // untouched. clipDur is effectiveDuration(), so join-trim stays
      // in sync for silent inputs too.
      normalizeChunks.push(
        `anullsrc=r=${TARGET_SAMPLE_RATE}:cl=${TARGET_CHANNELS}:d=${clipDur}[a${i}]`,
      );
    } else {
      normalizeChunks.push(
        `[${i}:a]${trimAStage}aresample=${TARGET_SAMPLE_RATE},aformat=sample_fmts=fltp:channel_layouts=${TARGET_CHANNELS}${audioSpeedChain}${microFades}${fadeAfStage}${mixStage}${aKfStage}[a${i}]`,
      );
    }
  }

  // ── Chained xfade ──────────────────────────────────────────────────
  const videoChain: string[] = [];
  const audioChain: string[] = [];
  // `cumulative` is the running edit duration as we walk the joins.
  // Used both for offset math and for the trailing log line — note
  // the bug fix here: the original used a `runningDuration` name that
  // was never declared, throwing ReferenceError once execution reached
  // the end of the function.
  let cumulative = effectiveDuration(inputs[0]);
  let sumXPrev = 0;

  for (let k = 0; k < n - 1; k++) {
    const boundary = perBoundaryTransitions?.[k];
    const Tk = boundary?.kind ?? T;
    const inA = k === 0 ? "v0" : `vx${k - 1}`;
    const inB = `v${k + 1}`;
    const outLabel = `vx${k}`;
    const inAa = k === 0 ? "a0" : `ax${k - 1}`;
    const inBa = `a${k + 1}`;
    const outLabelA = `ax${k}`;

    if (Tk === "cut") {
      // HARD CUT (continuity v2): frame-chained boundaries join on a matched
      // frame — a crossfade would BLEND two near-identical frames and render
      // any residual mismatch as ghosting. Concat cuts cleanly; the per-clip
      // 5ms audio micro-fades already prevent clicks. Consumes no overlap.
      videoChain.push(`[${inA}][${inB}]concat=n=2:v=1:a=0[${outLabel}]`);
      audioChain.push(`[${inAa}][${inBa}]concat=n=2:v=0:a=1[${outLabelA}]`);
      cumulative += effectiveDuration(inputs[k + 1]);
      continue;
    }

    const Xreq = boundary?.durationSec ?? X;
    const minAdjacent = Math.min(effectiveDuration(inputs[k]), effectiveDuration(inputs[k + 1]));
    const Xk = round(Math.max(0.05, Math.min(Xreq, minAdjacent - 0.05)));
    const offset = round(cumulative - sumXPrev - Xk);
    videoChain.push(
      `[${inA}][${inB}]xfade=transition=${Tk}:duration=${Xk}:offset=${offset}[${outLabel}]`,
    );
    audioChain.push(
      `[${inAa}][${inBa}]acrossfade=d=${Xk}:c1=tri:c2=tri[${outLabelA}]`,
    );
    cumulative += effectiveDuration(inputs[k + 1]);
    sumXPrev += Xk;
  }

  // For n === 1 the chains stay empty; the labels resolve to v0/a0
  // straight from normalization. For n === 2 the only join's output
  // is vx0/ax0. For n >= 3 it's vx{n-2}/ax{n-2}.
  let finalVideoLabel = n === 1 ? "v0" : (n === 2 ? "vx0" : `vx${n - 2}`);
  let finalAudioLabel = n === 1 ? "a0" : (n === 2 ? "ax0" : `ax${n - 2}`);

  // ── Title overlay drawtext chain ──────────────────────────────────
  const titleChain: string[] = [];
  if (titleClips && titleClips.length > 0) {
    let lastLabel = finalVideoLabel;
    for (let i = 0; i < titleClips.length; i++) {
      const tc = titleClips[i];
      const endSec = tc.startSec + tc.durationSec;
      const safeText = tc.text
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'")
        .replace(/%/g, "\\%")
        .replace(/\n/g, "\\n");
      const safeColor = /^#?[0-9a-fA-F]{6}$/.test(tc.color) ? tc.color.replace(/^#?/, "0x") : "white";
      const sizePctClamped = Math.max(1, Math.min(40, tc.sizePct ?? 6));
      const fontSize = Math.round(outH * (sizePctClamped / 100));
      const hasPos = typeof tc.x === "number" && typeof tc.y === "number";
      const xExpr = hasPos
        ? `${Math.round((tc.x ?? 0.5) * outW)}-text_w/2`
        : `(w-text_w)/2`;
      const yExpr = hasPos
        ? `${Math.round((tc.y ?? 0.5) * outH)}-text_h/2`
        : `(h-text_h)/2`;
      const shadowOffset = Math.max(2, Math.round(fontSize * 0.05));
      const shadowLabel = `vts${i}`;
      const outLabel = `vt${i}`;
      titleChain.push(
        `[${lastLabel}]drawtext=text='${safeText}':` +
          `fontcolor=black@0.55:` +
          `fontsize=${fontSize}:` +
          `x=${xExpr}+${shadowOffset}:y=${yExpr}+${shadowOffset}:` +
          `enable='between(t,${round(tc.startSec)},${round(endSec)})'[${shadowLabel}]`,
      );
      titleChain.push(
        `[${shadowLabel}]drawtext=text='${safeText}':` +
          `fontcolor=${safeColor}:` +
          `fontsize=${fontSize}:` +
          (tc.bold ? `borderw=2:bordercolor=${safeColor}:` : ``) +
          `x=${xExpr}:y=${yExpr}:` +
          `enable='between(t,${round(tc.startSec)},${round(endSec)})'[${outLabel}]`,
      );
      lastLabel = outLabel;
    }
    finalVideoLabel = lastLabel;
  }

  // ── V2/V3 overlay composition ─────────────────────────────────────
  const overlayChain: string[] = [];
  if (overlays && overlays.length > 0) {
    let lastLabel = finalVideoLabel;
    for (let i = 0; i < overlays.length; i++) {
      const ov = overlays[i];
      const slotIdx = inputs.length + i;
      const normLabel = `ovN${i}`;
      const outLabel = `ovX${i}`;
      overlayChain.push(
        `[${slotIdx}:v]scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
          `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:color=black@0,` +
          `setsar=${TARGET_SAR},fps=${TARGET_FPS},format=yuva420p,` +
          `setpts=PTS-STARTPTS+${round(ov.timelineStartSec)}/TB[${normLabel}]`,
      );
      const endSec = round(ov.timelineStartSec + ov.durationSec);
      overlayChain.push(
        `[${lastLabel}][${normLabel}]overlay=enable='between(t,${round(ov.timelineStartSec)},${endSec})':eof_action=pass[${outLabel}]`,
      );
      lastLabel = outLabel;
    }
    finalVideoLabel = lastLabel;
  }

  // ── A1 voiceover + A2+ aux audio mix ──────────────────────────────
  // Voice (A1) is part of the master narration → mixed at FULL level.
  // Music (A2+) is amixed and, with autoDuck, ducked under the voice+master.
  const auxChain: string[] = [];
  if (auxAudio && auxAudio.length > 0) {
    const overlayCount = overlays?.length ?? 0;
    const voiceLabels: string[] = [];
    const musicLabels: string[] = [];
    for (let i = 0; i < auxAudio.length; i++) {
      const aux = auxAudio[i];
      const slotIdx = inputs.length + overlayCount + i;
      const normLabel = `auxN${i}`;
      const delayMs = Math.round(aux.timelineStartSec * 1000);
      auxChain.push(
        `[${slotIdx}:a]aresample=${TARGET_SAMPLE_RATE},` +
          `aformat=sample_fmts=fltp:channel_layouts=${TARGET_CHANNELS},` +
          `adelay=delays=${delayMs}:all=1[${normLabel}]`,
      );
      (aux.kind === "voice" ? voiceLabels : musicLabels).push(normLabel);
    }

    // 1) Fold A1 voiceover into the master at full level.
    if (voiceLabels.length > 0) {
      const n = 1 + voiceLabels.length;
      auxChain.push(
        `[${finalAudioLabel}]${voiceLabels.map((l) => `[${l}]`).join("")}amix=inputs=${n}:duration=longest:dropout_transition=0:normalize=0[aWithVoice]`,
      );
      finalAudioLabel = "aWithVoice";
    }

    // 2) Music: duck under the voice+master (autoDuck) or amix at full level.
    if (musicLabels.length > 0) {
      if (autoDuck) {
        const splitOuts: string[] = ["aMainKeep", ...musicLabels.map((_, i) => `aSc${i}`)];
        auxChain.push(
          `[${finalAudioLabel}]asplit=${splitOuts.length}${splitOuts.map((l) => `[${l}]`).join("")}`,
        );
        const duckedLabels: string[] = [];
        for (let i = 0; i < musicLabels.length; i++) {
          const out = `auxD${i}`;
          duckedLabels.push(out);
          auxChain.push(
            `[${musicLabels[i]}][aSc${i}]` +
              `sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300:level_sc=1.0[${out}]`,
          );
        }
        const n = 1 + duckedLabels.length;
        auxChain.push(
          `[aMainKeep]${duckedLabels.map((l) => `[${l}]`).join("")}amix=inputs=${n}:duration=longest:dropout_transition=0:normalize=0[aWithAux]`,
        );
      } else {
        const n = 1 + musicLabels.length;
        auxChain.push(
          `[${finalAudioLabel}]${musicLabels.map((l) => `[${l}]`).join("")}amix=inputs=${n}:duration=longest:dropout_transition=0:normalize=0[aWithAux]`,
        );
      }
      finalAudioLabel = "aWithAux";
    }
  }

  // ── Master loudnorm ───────────────────────────────────────────────
  const masterChain: string[] = [];
  if (masterLoudness && masterLoudness !== "off") {
    const lnFilter = masterLoudnormFilter(masterLoudness);
    if (lnFilter) {
      const outLabel = "aMaster";
      masterChain.push(`[${finalAudioLabel}]${lnFilter}[${outLabel}]`);
      finalAudioLabel = outLabel;
    }
  }

  const filter_complex = [
    ...normalizeChunks,
    ...videoChain,
    ...audioChain,
    ...titleChain,
    ...overlayChain,
    ...auxChain,
    ...masterChain,
  ].join(";");

  // ── Input list ─────────────────────────────────────────────────────
  const clipInputs = inputs.map((_, i) => `-i file${i + 1}`).join(" ");
  const overlayInputs = (overlays ?? []).map((_, i) => `-i file${inputs.length + i + 1}`).join(" ");
  const overlayCount = overlays?.length ?? 0;
  const auxInputs = (auxAudio ?? []).map((_, i) => `-i file${inputs.length + overlayCount + i + 1}`).join(" ");
  const extraLavfi = inputs.flatMap(inp => inp.extraInputs ?? []).join(" ");
  const inputArgs = [clipInputs, overlayInputs, auxInputs, extraLavfi]
    .filter((s) => s.trim().length > 0)
    .join(" ");

  // ── Encode ─────────────────────────────────────────────────────────
  const crfClamped = typeof crf === "number"
    ? Math.max(0, Math.min(51, Math.round(crf)))
    : null;
  const vcodecArg = crfClamped !== null && (profile.vcodec.includes("libx264") || profile.vcodec.includes("libvpx-vp9"))
    ? profile.vcodec.replace(/-crf\s+\d+/, `-crf ${crfClamped}`)
    : profile.vcodec;
  const pixFmt = profile.vcodec.includes("libx264") ? " -pix_fmt yuv420p" : "";
  const audioArgs = profile.acodec
    ? `-c:a ${profile.acodec} -ar ${TARGET_SAMPLE_RATE} -ac 2`
    : "-an";
  const audioMapArg = profile.acodec ? `-map "[${finalAudioLabel}]"` : "";
  const command = `ffmpeg ${inputArgs} ` +
    `-filter_complex "${filter_complex}" ` +
    `-map "[${finalVideoLabel}]" ${audioMapArg} ` +
    `-c:v ${vcodecArg}${pixFmt} ` +
    `-g ${TARGET_FPS * 2} ` +
    `${audioArgs} ` +
    `${profile.extraOut} ` +
    `output1`;

  return { command };
}
