/**
 * breakthrough-overlay — the missing compositor primitive.
 *
 * The existing overlay path in `seamless-command.ts` lays an overlay full-frame,
 * time-gated only (no position, no mask). A "breakthrough" needs the opposite:
 * a subject composited ABOVE the chrome at an animating, POSITIONED, MASKED
 * boundary that opens at the break beat. FFmpeg supports all of this — this
 * module just emits it, reusing the same `buildKeyframeExpression` machinery
 * the editor keyframes already bake through.
 *
 * It produces a `-filter_complex` fragment that, given:
 *   [chrome]   layer 0 — the static container still (looped to clip length)
 *   [inner]    layer 1 — the inner video, cropped/placed into the media window
 *   [subject]  layer 2 — the breakthrough subject (alpha, e.g. chroma-keyed)
 *   [aftermath]layer 3 — the outer-space aftermath (alpha/screen-blended)
 * yields a single composited [bt_out] respecting z-order, the animating
 * boundary mask, the destination motion keyframes and the break beat.
 *
 * Pure string emit — no IO — so it is unit-testable and runs inside the same
 * Replicate FFmpeg prediction the rest of the render already uses.
 */

import { buildKeyframeExpression, type BakeKeyframe } from "./keyframe-bake.ts";

export interface NormRect { x: number; y: number; width: number; height: number; }

export type BtMaskShape =
  | "window-rect" | "ellipse" | "shatter" | "liquid" | "torn" | "peel" | "polygon";

export interface BtMask {
  shape: BtMaskShape;
  region: NormRect; // normalized 0..1
  featherPx?: number;
  /** Absolute seconds (clip-local) the mask starts / finishes opening. */
  openStartSec: number;
  openEndSec: number;
}

export interface BtMotionKeyframe {
  property: "positionX" | "positionY" | "scale" | "opacity" | "rotation";
  /** 0..1 within the subject's active window. */
  at: number;
  value: number;
}

export interface BtLayerInput {
  /** filter-graph input label, e.g. "chrome", "inner". */
  label: string;
  kind: "chrome" | "media-window" | "breakthrough" | "aftermath";
}

export interface BreakthroughOverlayOpts {
  outW: number;
  outH: number;
  fps: number;
  /** Output label other chains consume. */
  outLabel?: string;
  chrome: BtLayerInput;
  inner: BtLayerInput;
  subject: BtLayerInput;
  aftermath?: BtLayerInput;
  /** Where the inner video sits within the frame (normalized). */
  mediaWindow: NormRect;
  /** The boundary mask that opens at the break beat. */
  mask: BtMask;
  /** Absolute seconds the subject becomes active (the break beat). */
  subjectActiveFromSec: number;
  /** Absolute seconds the subject's motion ends (scene end). */
  subjectActiveToSec: number;
  /** Destination motion (0..1 within the active window). */
  motion: BtMotionKeyframe[];
  /** Absolute seconds the aftermath activates. */
  aftermathFromSec?: number;
  round?: (n: number) => string;
}

const DEFAULT_ROUND = (n: number): string => {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : r.toFixed(3);
};

/** Map a 0..1 normalized motion track for one property to a clip-local-seconds
 *  FFmpeg expression via the existing keyframe baker. */
function motionExpr(
  motion: BtMotionKeyframe[],
  property: BtMotionKeyframe["property"],
  fromSec: number,
  toSec: number,
  fallback: number,
): string {
  const span = Math.max(0.0001, toSec - fromSec);
  const kfs: BakeKeyframe[] = motion
    .filter((m) => m.property === property)
    .map((m) => ({ property, time: fromSec + m.at * span, value: m.value }));
  return buildKeyframeExpression(kfs, fallback) ?? String(fallback);
}

/**
 * Emit the boundary-mask reveal as an alpha multiplier in [0,1] over clip-local
 * `t`: 0 before openStart, ramping to 1 by openEnd. The geq below multiplies
 * the subject/inner alpha inside the mask region by this reveal, so the window
 * "opens" exactly across [openStart, openEnd].
 */
export function maskRevealExpr(mask: BtMask, round = DEFAULT_ROUND): string {
  const a = round(mask.openStartSec);
  const b = round(Math.max(mask.openEndSec, mask.openStartSec + 0.0001));
  // linear 0→1 across [a,b], clamped
  return `clip((t-${a})/(${b}-${a}),0,1)`;
}

/**
 * Geometry of the mask region in PIXELS, plus a shape test that returns 1
 * inside the opening and 0 outside. Shapes degrade gracefully to a feathered
 * rectangle/ellipse — the expensive shatter/liquid detail is carried by the
 * generated subject video; this mask governs WHERE and WHEN it shows through.
 */
export function maskShapeTest(
  mask: BtMask,
  outW: number,
  outH: number,
  round = DEFAULT_ROUND,
): string {
  // Compute pixel edges as NUMBERS, then round to strings for emission.
  const left = mask.region.x * outW;
  const top = mask.region.y * outH;
  const right = (mask.region.x + mask.region.width) * outW;
  const bottom = (mask.region.y + mask.region.height) * outH;

  const x0 = round(left);
  const y0 = round(top);
  const x1 = round(right);
  const y1 = round(bottom);
  const cx = round((mask.region.x + mask.region.width / 2) * outW);
  const cy = round((mask.region.y + mask.region.height / 2) * outH);
  const rx = round((mask.region.width / 2) * outW);
  const ry = round((mask.region.height / 2) * outH);

  switch (mask.shape) {
    case "ellipse":
    case "shatter": // shatter radiates from center → ellipse envelope
      return `lte((pow((X-${cx})/${rx},2)+pow((Y-${cy})/${ry},2)),1)`;
    case "liquid": // a spill front advancing downward within the region
      return `gte(Y,${y0})*lte(Y,${y1})*gte(X,${x0})*lte(X,${x1})`;
    case "window-rect":
    case "torn":
    case "peel":
    case "polygon":
    default:
      return `gte(X,${x0})*lte(X,${x1})*gte(Y,${y0})*lte(Y,${y1})`;
  }
}

/**
 * Build the full positioned + masked breakthrough overlay chain.
 * Returns the list of filter_complex segments and the final output label.
 */
export function buildBreakthroughOverlay(
  opts: BreakthroughOverlayOpts,
): { segments: string[]; outLabel: string } {
  const round = opts.round ?? DEFAULT_ROUND;
  const { outW, outH, fps } = opts;
  const outLabel = opts.outLabel ?? "bt_out";
  const segments: string[] = [];

  // ── Layer 0: chrome still → canvas-sized base ─────────────────────────────
  segments.push(
    `[${opts.chrome.label}]scale=${outW}:${outH},setsar=1,fps=${fps},format=yuva420p[bt_l0]`,
  );

  // ── Layer 1: inner video → placed into the media window ───────────────────
  const mw = opts.mediaWindow;
  const iw = round(mw.width * outW);
  const ih = round(mw.height * outH);
  const ix = round(mw.x * outW);
  const iy = round(mw.y * outH);
  segments.push(
    `[${opts.inner.label}]scale=${iw}:${ih},setsar=1,fps=${fps},format=yuva420p[bt_inner]`,
  );
  segments.push(`[bt_l0][bt_inner]overlay=x=${ix}:y=${iy}:format=auto[bt_l1]`);

  // ── Layer 2: breakthrough subject, masked + positioned + animated ─────────
  // The subject is masked so it only shows through the OPENING region as the
  // mask reveals (alpha = shapeTest * revealRamp), then positioned by the
  // destination motion keyframes (positionX/Y in normalized canvas units).
  const reveal = maskRevealExpr(opts.mask, round);
  const shape = maskShapeTest(opts.mask, outW, outH, round);
  const feather = opts.mask.featherPx ?? 8;

  // Subject alpha gate: inside the shape AND past the reveal ramp. We also gate
  // by activation time so nothing shows before the break beat.
  const from = round(opts.subjectActiveFromSec);
  segments.push(
    `[${opts.subject.label}]scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
      `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,fps=${fps},format=yuva420p,` +
      // multiply existing alpha by (shape * reveal), gated after the break beat
      `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':` +
      `a='alpha(X,Y)*(${shape})*(${reveal})*gte(t,${from})'[bt_subj_m]`,
  );
  if (feather > 0) {
    segments.push(`[bt_subj_m]boxblur=lr=0:cr=0:ar=${round(feather)}:ah=${round(feather)}[bt_subj]`);
  } else {
    segments.push(`[bt_subj_m]null[bt_subj]`);
  }

  // Position via destination motion → overlay x/y expressions (canvas units).
  const xExpr = motionExpr(opts.motion, "positionX", opts.subjectActiveFromSec, opts.subjectActiveToSec, 0);
  const yExpr = motionExpr(opts.motion, "positionY", opts.subjectActiveFromSec, opts.subjectActiveToSec, 0);
  // positionX/Y are fractions of canvas; convert to pixels and center-anchor.
  const xPix = `(W-w)/2+(${xExpr})*${outW}`;
  const yPix = `(H-h)/2+(${yExpr})*${outH}`;
  segments.push(
    `[bt_l1][bt_subj]overlay=x='${xPix}':y='${yPix}':` +
      `enable='gte(t,${from})':format=auto[bt_l2]`,
  );

  // ── Layer 3: aftermath (screen-blended over the outer space) ──────────────
  let last = "bt_l2";
  if (opts.aftermath) {
    const af = round(opts.aftermathFromSec ?? opts.subjectActiveFromSec);
    segments.push(
      `[${opts.aftermath.label}]scale=${outW}:${outH},setsar=1,fps=${fps},format=yuva420p[bt_after]`,
    );
    segments.push(
      `[bt_l2][bt_after]overlay=x=0:y=0:enable='gte(t,${af})':format=auto[${outLabel}]`,
    );
    last = outLabel;
  } else {
    segments.push(`[bt_l2]null[${outLabel}]`);
    last = outLabel;
  }

  return { segments, outLabel: last };
}
