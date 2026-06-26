/**
 * breakthrough-command — assembles the FULL FFmpeg command for a 4-layer
 * breakthrough composite, runnable through the same Replicate FFmpeg path
 * (`runFfmpeg`) the seamless stitcher already uses.
 *
 * Unlike the seamless stitcher (which CONCATENATES clips with xfade), this
 * STACKS four layers:
 *   file1  chrome still  (looped to clip length)      → [0:v]
 *   file2  inner video   (placed into the media window)→ [1:v]
 *   file3  subject video (chroma-keyed → alpha)        → [2:v]
 *   file4  aftermath     (optional, screen-blended)    → [3:v]
 * plus optional music (fileM) and a break-beat SFX (fileS) mixed on the audio
 * side, with the SFX delayed to the break beat so the hit lands on the mask
 * opening.
 *
 * The visual stack is emitted by `buildBreakthroughOverlay` (positioned +
 * masked + motion-animated). This module adds input wiring, the chromakey
 * matting stage, audio mux and the encode tail. Pure string emit → unit-tested.
 */

import {
  buildBreakthroughOverlay,
  type BtMask,
  type BtMotionKeyframe,
  type NormRect,
} from "./breakthrough-overlay.ts";
import {
  dimensionsForAspect,
  encodeProfileFor,
  round,
  TARGET_FPS,
  TARGET_SAMPLE_RATE,
} from "./seamless-command.ts";

export interface ChromakeyOpts {
  /** Key colour, e.g. "#00B140". */
  color: string;
  /** 0..1 colour-distance tolerance (default 0.30). */
  similarity?: number;
  /** 0..1 edge blend (default 0.10). */
  blend?: number;
}

export interface BreakthroughCommandOpts {
  aspectRatio?: string;
  resolution?: string;
  format?: string;
  crf?: number;
  durationSec: number;

  // Layer sources (resolved URLs).
  chromeUrl: string;
  innerUrl: string;
  subjectUrl: string;
  aftermathUrl?: string;

  // Geometry + timing.
  mediaWindow: NormRect;
  mask: BtMask;
  motion: BtMotionKeyframe[];
  subjectActiveFromSec: number;
  subjectActiveToSec: number;
  aftermathFromSec?: number;

  // Matting for the moving subject.
  chromakey?: ChromakeyOpts;

  // Audio.
  musicUrl?: string;
  /** Optional break-beat SFX + the absolute second it fires. */
  sfx?: { url: string; atSec: number };
}

export interface BreakthroughCommand {
  command: string;
  /** filename → source URL, consumed by runFfmpeg's `inputs`. */
  inputs: Record<string, string>;
  outputName: string;
}

function hexToFfmpeg(hex: string): string {
  return hex.trim().replace(/^#/, "0x");
}

export function buildBreakthroughCommand(
  opts: BreakthroughCommandOpts,
): BreakthroughCommand {
  const { w: outW, h: outH } = dimensionsForAspect(opts.aspectRatio, opts.resolution);
  const fps = TARGET_FPS;
  const profile = encodeProfileFor(opts.format);
  const dur = round(opts.durationSec);

  // ── Input wiring (1-indexed filenames; 0-indexed filtergraph streams) ─────
  const inputs: Record<string, string> = {
    file1: opts.chromeUrl,
    file2: opts.innerUrl,
    file3: opts.subjectUrl,
  };
  const inputArgs: string[] = [
    `-loop 1 -t ${dur} -i file1`, // chrome still, looped to clip length
    `-i file2`, // inner video
    `-i file3`, // subject video
  ];
  let nextStream = 3; // streams 0,1,2 used

  // Aftermath (optional).
  let aftermathLabel: string | undefined;
  if (opts.aftermathUrl) {
    inputs.file4 = opts.aftermathUrl;
    inputArgs.push(`-i file4`);
    aftermathLabel = `${nextStream}:v`;
    nextStream++;
  }

  // ── Matting: chromakey + despill the subject before it is overlaid ────────
  const pre: string[] = [];
  let subjectLabel = "2:v";
  if (opts.chromakey) {
    const sim = opts.chromakey.similarity ?? 0.3;
    const bl = opts.chromakey.blend ?? 0.1;
    pre.push(
      `[2:v]chromakey=${hexToFfmpeg(opts.chromakey.color)}:${sim}:${bl},` +
        `despill=type=green:mix=0.5:expand=0.3,format=yuva420p[bt_subj_keyed]`,
    );
    subjectLabel = "bt_subj_keyed";
  }

  // ── Visual stack (positioned + masked + animated) ─────────────────────────
  const { segments, outLabel } = buildBreakthroughOverlay({
    outW,
    outH,
    fps,
    chrome: { label: "0:v", kind: "chrome" },
    inner: { label: "1:v", kind: "media-window" },
    subject: { label: subjectLabel, kind: "breakthrough" },
    aftermath: aftermathLabel ? { label: aftermathLabel, kind: "aftermath" } : undefined,
    mediaWindow: opts.mediaWindow,
    mask: opts.mask,
    subjectActiveFromSec: opts.subjectActiveFromSec,
    subjectActiveToSec: opts.subjectActiveToSec,
    motion: opts.motion,
    aftermathFromSec: opts.aftermathFromSec,
  });

  // ── Audio: optional music bed + break-beat SFX (delayed to the hit) ───────
  const audioChain: string[] = [];
  let audioMapLabel: string | null = null;
  const audioStreams: string[] = [];
  if (opts.musicUrl && profile.acodec) {
    inputs[`file${objectSize(inputs) + 1}`] = opts.musicUrl;
    const musicStream = nextStream;
    inputArgs.push(`-i file${objectSize(inputs)}`);
    nextStream++;
    audioChain.push(
      `[${musicStream}:a]atrim=0:${dur},asetpts=PTS-STARTPTS,volume=0.7[bt_mus]`,
    );
    audioStreams.push("[bt_mus]");
  }
  if (opts.sfx && profile.acodec) {
    inputs[`file${objectSize(inputs) + 1}`] = opts.sfx.url;
    const sfxStream = nextStream;
    inputArgs.push(`-i file${objectSize(inputs)}`);
    nextStream++;
    const delayMs = Math.max(0, Math.round(opts.sfx.atSec * 1000));
    audioChain.push(
      `[${sfxStream}:a]adelay=${delayMs}|${delayMs},asetpts=PTS-STARTPTS[bt_sfx]`,
    );
    audioStreams.push("[bt_sfx]");
  }
  if (audioStreams.length === 1) {
    // single source → relabel
    audioChain.push(`${audioStreams[0]}aresample=${TARGET_SAMPLE_RATE}[bt_aout]`);
    audioMapLabel = "bt_aout";
  } else if (audioStreams.length > 1) {
    audioChain.push(
      `${audioStreams.join("")}amix=inputs=${audioStreams.length}:duration=first:dropout_transition=0,` +
        `aresample=${TARGET_SAMPLE_RATE}[bt_aout]`,
    );
    audioMapLabel = "bt_aout";
  }

  const filter = [...pre, ...segments, ...audioChain].join(";");

  // ── Encode ────────────────────────────────────────────────────────────────
  const crfClamped =
    typeof opts.crf === "number" ? Math.max(0, Math.min(51, Math.round(opts.crf))) : null;
  const vcodec =
    crfClamped !== null &&
    (profile.vcodec.includes("libx264") || profile.vcodec.includes("libvpx-vp9"))
      ? profile.vcodec.replace(/-crf\s+\d+/, `-crf ${crfClamped}`)
      : profile.vcodec;
  const pixFmt = profile.vcodec.includes("libx264") ? " -pix_fmt yuv420p" : "";

  const audioArgs =
    audioMapLabel && profile.acodec
      ? `-map "[${audioMapLabel}]" -c:a ${profile.acodec} -ar ${TARGET_SAMPLE_RATE} -ac 2`
      : "-an";

  const command =
    `ffmpeg ${inputArgs.join(" ")} ` +
    `-filter_complex "${filter}" ` +
    `-map "[${outLabel}]" ${audioArgs} ` +
    `-t ${dur} ` +
    `-c:v ${vcodec}${pixFmt} ` +
    `-g ${TARGET_FPS * 2} ` +
    `${profile.extraOut} ` +
    `output1`;

  return { command, inputs, outputName: `breakthrough.${profile.ext}` };
}

function objectSize(o: Record<string, unknown>): number {
  return Object.keys(o).length;
}
