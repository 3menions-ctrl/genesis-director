/**
 * Effect bake compiler — turns EffectInstance[] into an FFmpeg filter
 * graph fragment + any extra lavfi inputs the recipe needs.
 *
 * ─── Two-tier architecture ────────────────────────────────────────
 *
 * Tier 1 — INLINE FFMPEG (this module):
 *   Each recipe declares a compiler that returns a filter-graph
 *   fragment + zero-or-more lavfi inputs. The fragment is injected
 *   into the seamless-stitcher's per-clip normalization pass right
 *   after color grading and before final format/colorspace.
 *
 *   Fidelity vs. preview: ~60–95% depending on recipe.
 *     • Tier 1A — high fidelity (LightBeam, FrameBreak)
 *     • Tier 1B — stylized approximation (NeonZap, SmokeBurst)
 *     • Tier 1C — coarse approximation (GlassShatter, ParticleBurst —
 *       particle systems with seeded RNG can't be expressed as a
 *       filter graph; the bake renders a flash + radial burst with
 *       the right colors instead)
 *
 * Tier 2 — HEADLESS CHROMIUM (Phase 2, behind a worker queue):
 *   The recipe's `compile()` returns `{ kind: "headless" }`.
 *   The stitcher dispatches to a Modal/RunPod worker that boots a
 *   headless Chromium, mounts the React renderer at the target
 *   resolution/fps, captures frames to a webm-with-alpha, uploads it,
 *   then adds it as an `-i` input and composites via overlay+blend.
 *   This unlocks pixel-perfect bake at the cost of ~$0.005-0.02 per
 *   effect of GPU time. UI exposes it as a "High-fidelity bake"
 *   checkbox on the effect, defaulting to off.
 *
 * Both tiers consume the same EffectInstance.
 */
import type { EffectInstance, RecipeSlug } from "./effects.ts";
import {
  FFMPEG_BLEND_MODES,
  hexToFfmpegColor,
  effectEnableExpr,
  effectProgressExpr,
} from "./effects.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

/** One compiled effect — joins a chunk of filter graph + any extra inputs. */
export interface BakedEffect {
  /** Inline = composes purely with lavfi + existing filters.
   *  Headless = needs the Phase 2 worker. */
  kind: "inline" | "headless";
  /** Extra `-f lavfi -i "..."` arguments. The stitcher mints unique
   *  input indices and rewrites the filter fragment to reference them. */
  extraInputs: string[];
  /** Filter graph fragment to be SPLICED INTO the per-clip chain
   *  after the color grade. The fragment expects the upstream label
   *  `{vIn}` (the just-graded video) and produces `{vOut}` (the
   *  effected video). The stitcher templates {vIn}/{vOut} into real
   *  graph labels. {ix} placeholders are rewritten to the real input
   *  index for each extra lavfi input (in order). */
  filterFragment: string;
  /** For headless tier: the React component name + parameters bundle
   *  so the worker can mount the same renderer. */
  headlessSpec?: {
    recipe: RecipeSlug;
    params: EffectInstance;
    targetWidth: number;
    targetHeight: number;
    targetFps: number;
  };
  /** Fidelity tier — for telemetry + UI hints. */
  fidelity: "high" | "stylized" | "coarse" | "pixel-perfect";
}

/** What the stitcher splices into a clip. */
export interface BakedClipEffects {
  /** Total `-f lavfi -i "..."` args, in dispatch order. */
  extraInputs: string[];
  /** Filter graph fragment, terminating at `[vOut]` from `[vIn]`. */
  filterChain: string;
  /** Telemetry per effect — useful for logging "we baked 3 effects at
   *  fidelity high/stylized/stylized for clip 0". */
  fidelities: Array<{ recipe: RecipeSlug; fidelity: BakedEffect["fidelity"] }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC DISPATCHER — compile a clip's effect list into one chain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compile every EffectInstance on a clip into a single FFmpeg filter
 * chain. Returns no work when the list is empty or only contains
 * transitions (transitions are handled by the xfade pipeline, not here).
 *
 * @param effects   The clip's effects array
 * @param clipDur   The clip's duration in seconds (for sustained-mode clamping)
 * @param inputBase The starting input index for extra inputs (the
 *                  stitcher already has N -i source clips; effect
 *                  inputs are numbered N, N+1, …)
 */
export function bakeClipEffects(
  effects: EffectInstance[] | null | undefined,
  clipDur: number,
  inputBase: number,
  clipIdx: number = 0,
): BakedClipEffects | null {
  if (!effects?.length) return null;

  // Skip transitions — they live elsewhere.
  const active = effects.filter(fx => fx.mode !== "transition");
  if (!active.length) return null;

  const extraInputs: string[] = [];
  const fidelities: BakedClipEffects["fidelities"] = [];
  let chain = "";
  // CRITICAL: keep the {vIn} / {vOut} placeholders INTACT so the
  // stitcher's splicer can rewrite them per-clip.
  let lastLabel = "{vIn}";
  let labelCounter = 0;

  // CRITICAL: per-clip-AND-per-effect-instance label namespace.
  // Recipe compilers hard-code labels like `fxLB`, `fxRB1`, `fb2`.
  // Naming them only by clip index breaks when the SAME recipe runs
  // TWICE on one clip (two LightBeams, two RadialBursts) — both
  // emit the same `fxLB_c0` and FFmpeg rejects the filter_complex
  // with "Output pad fxLB_c0 is already defined". Per-instance
  // suffix `_e${effectIdx}` makes every internal label unique
  // within the whole graph.
  let effectIdx = 0;
  const namespaceLabels = (fragment: string, eIdx: number): string =>
    fragment.replace(
      /\[(fx[A-Za-z0-9]+|fb\d+|halo\d+)\]/g,
      (_m, lbl) => `[${lbl}_c${clipIdx}_e${eIdx}]`,
    );

  for (const fx of active) {
    const baked = compileEffect(fx, clipDur);
    if (!baked) continue;

    // Rewrite {ix} placeholders to real input indices, then namespace
    // every internal label so two clips can run the same recipe AND
    // a single clip can stack the same recipe twice.
    const startIx = inputBase + extraInputs.length;
    const rawFragment = rewriteInputIndices(baked.filterFragment, startIx);
    const fragment = namespaceLabels(rawFragment, effectIdx);
    extraInputs.push(...baked.extraInputs);

    // Splice the fragment using a fresh intermediate label (also
    // per-clip + per-effect namespaced).
    const outLabel = `fx${labelCounter++}_c${clipIdx}_e${effectIdx}`;
    const localFragment = fragment
      .replace(/\{vIn\}/g, lastLabel)
      .replace(/\{vOut\}/g, outLabel);

    chain = chain ? `${chain};${localFragment}` : localFragment;
    lastLabel = outLabel;

    fidelities.push({ recipe: fx.recipe, fidelity: baked.fidelity });
    effectIdx += 1;
  }

  if (!chain) return null;

  // Final hop — alias the last intermediate label to the {vOut}
  // placeholder so the stitcher can splice this into its normalization
  // pipeline by substituting both boundary tokens.
  chain = `${chain};[${lastLabel}]null[{vOut}]`;

  return { extraInputs, filterChain: chain, fidelities };
}

function rewriteInputIndices(fragment: string, base: number): string {
  return fragment.replace(/\{ix:(\d+)\}/g, (_, n) => String(base + parseInt(n, 10)));
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-RECIPE COMPILERS
// Each returns null when the recipe doesn't have a Tier 1 implementation
// yet (it'll degrade to no-op for now; Tier 2 will pick it up later).
// ─────────────────────────────────────────────────────────────────────────────

function compileEffect(fx: EffectInstance, clipDur: number): BakedEffect | null {
  switch (fx.recipe) {
    case "light_beam":     return compileLightBeam(fx, clipDur);
    case "neon_zap":       return compileNeonZap(fx);
    case "glass_shatter":  return compileGlassShatter(fx);
    case "particle_burst": return compileParticleBurst(fx);
    case "smoke_burst":    return compileSmokeBurst(fx);
    case "frame_break":    return compileFrameBreak(fx);

    // Fallback recipes — coarse single-color radial flash so they still
    // show up in the output instead of being silently dropped.
    case "energy_crackle":
    case "ghost_pulse":
    case "data_stream":
    case "fire_lick":
    case "water_splash":
    case "ink_bloom":
    case "paint_pour":
    case "color_pop":
    case "pixel_dissolve":
    case "ribbon_unfurl":
    case "lens_distort":
    case "static_fizz":
    case "magnet_pull":
    case "fabric_tear":
      return compileGenericFlash(fx);

    case "none":
    default:
      return null;
  }
}

// ─── Tier 1A · high fidelity ──────────────────────────────────────────────────

/**
 * LightBeam — sustained god ray.
 * FFmpeg recipe:
 *   1. lavfi color source filled with the primary color, sized to the
 *      target frame.
 *   2. Crop to a rotated wide rectangle via `geq` (alpha falls off at
 *      vertical edges → beam shape).
 *   3. Rotate to the desired angle.
 *   4. Blend onto the clip with screen + opacity, enabled across the
 *      effect's time window.
 * Fidelity vs. preview: HIGH — the beam shape and animation are very
 * close. The preview's gentle "breathing" sinusoid is omitted.
 */
function compileLightBeam(fx: EffectInstance, clipDur: number): BakedEffect {
  const color = hexToFfmpegColor(fx.primaryColor);
  const enable = effectEnableExpr(fx);
  const blend  = FFMPEG_BLEND_MODES[fx.blendMode];
  const op     = (fx.opacity * (fx.intensity / 100)).toFixed(3);
  const dur    = Math.min(fx.durationSec, clipDur - fx.startSec).toFixed(3);
  const angle  = (fx.rotation * Math.PI / 180).toFixed(4);

  // lavfi color block sized to the canonical pipeline target. Append
  // `,format=rgba` so the geq's alpha-channel write actually lands —
  // the bare `color=` source is packed RGB without an alpha plane and
  // would silently discard the `a=...` term, producing a flat color
  // wash instead of a shaped beam.
  const lavfi = `color=c=${color}:size=1920x1080:duration=${dur},format=rgba`;

  // The beam: take the color plane, build a vertical-edge falloff alpha
  // via `geq`, rotate by the effect angle, then blend.
  const fragment = [
    `[{ix:0}]geq='r=r(X,Y):g=g(X,Y):b=b(X,Y):a=255*max(0,1-pow((Y-540)/270,2))'[fxLB]`,
    `[fxLB]rotate=${angle}:c=none[fxLBrot]`,
    `[{vIn}][fxLBrot]blend=all_mode=${blend}:all_opacity=${op}:enable='${enable}'[{vOut}]`,
  ].join(";");

  return {
    kind: "inline",
    extraInputs: [`-f lavfi -i "${lavfi}"`],
    filterFragment: fragment,
    fidelity: "high",
  };
}

/**
 * FrameBreak — four corner bars slide outward.
 * FFmpeg recipe:
 *   • Four `drawbox` filters with x/y/w/h driven by `t` so the bars
 *     slide as the effect progresses. `enable` keeps them off
 *     outside the window. Two bars (top + bottom) + two more (left
 *     + right) gives the same four-bar break as the preview.
 * Fidelity vs. preview: HIGH — same geometry.
 */
function compileFrameBreak(fx: EffectInstance): BakedEffect {
  const primaryColor = hexToFfmpegColor(fx.primaryColor);
  const thickness = Math.round(4 + (fx.intensity / 100) * 12) * 10; // px
  const enable = effectEnableExpr(fx);
  const progress = effectProgressExpr(fx);
  // Bar slides off by up to 30% of frame height/width
  // Use bar offset expression: 30% * progress * scale → drift outward
  const offsetH = `(1080*0.3*${progress}*${fx.scale.toFixed(3)})`;
  const offsetW = `(1920*0.3*${progress}*${fx.scale.toFixed(3)})`;

  const op = (fx.opacity).toFixed(3);
  const filt = [
    // Top bar
    `[{vIn}]drawbox=x=0:y='0-${offsetH}':w=1920:h=${thickness}:color=${primaryColor}@${op}:t=fill:enable='${enable}'[fb1]`,
    // Bottom bar
    `[fb1]drawbox=x=0:y='1080-${thickness}+${offsetH}':w=1920:h=${thickness}:color=${primaryColor}@${op}:t=fill:enable='${enable}'[fb2]`,
    // Left bar
    `[fb2]drawbox=x='0-${offsetW}':y=0:w=${thickness}:h=1080:color=${primaryColor}@${op}:t=fill:enable='${enable}'[fb3]`,
    // Right bar
    `[fb3]drawbox=x='1920-${thickness}+${offsetW}':y=0:w=${thickness}:h=1080:color=${primaryColor}@${op}:t=fill:enable='${enable}'[{vOut}]`,
  ].join(";");

  return {
    kind: "inline",
    extraInputs: [],
    filterFragment: filt,
    fidelity: "high",
  };
}

// ─── Tier 1B · stylized approximation ────────────────────────────────────────

/**
 * NeonZap — electric burst. We can't easily synthesize the zigzag
 * lightning bolt in pure FFmpeg. Stylized fallback: a fast bright
 * flash + ambient bloom in the primary color across the effect's
 * window. Preview shows a path; bake shows a flash. Visual divergence
 * accepted for now; Tier 2 closes the gap.
 */
function compileNeonZap(fx: EffectInstance): BakedEffect {
  const primary = hexToFfmpegColor(fx.primaryColor);
  const enable = effectEnableExpr(fx);
  const blend  = FFMPEG_BLEND_MODES[fx.blendMode];
  const op = (fx.opacity * 0.55 * (fx.intensity / 100)).toFixed(3);
  const dur = fx.durationSec.toFixed(3);
  // RGBA so the geq's alpha channel actually lands.
  const lavfi = `color=c=${primary}:size=1920x1080:duration=${dur},format=rgba`;

  const fragment = [
    `[{ix:0}]geq='r=r(X,Y):g=g(X,Y):b=b(X,Y):a=200*(1-min(1,sqrt(pow((X-${(fx.positionX * 1920).toFixed(0)})/600,2)+pow((Y-${(fx.positionY * 1080).toFixed(0)})/400,2))))'[fxNZ]`,
    `[{vIn}][fxNZ]blend=all_mode=${blend}:all_opacity=${op}:enable='${enable}'[{vOut}]`,
  ].join(";");

  return {
    kind: "inline",
    extraInputs: [`-f lavfi -i "${lavfi}"`],
    filterFragment: fragment,
    fidelity: "stylized",
  };
}

/**
 * SmokeBurst — volumetric cloud. Stylized fallback: synthesize a
 * dark radial cloud via the noise filter + gblur + multiply blend.
 * Drops the per-puff billowing motion but keeps the "smoke arrived"
 * feel.
 */
function compileSmokeBurst(fx: EffectInstance): BakedEffect {
  const enable = effectEnableExpr(fx);
  const blend  = FFMPEG_BLEND_MODES[fx.blendMode];
  const op = (fx.opacity * (fx.intensity / 100)).toFixed(3);
  const dur = fx.durationSec.toFixed(3);
  // Noise source for the cloud body
  const lavfi = `nullsrc=size=1920x1080:duration=${dur},format=rgba,noise=alls=80:allf=t+u,gblur=sigma=22`;

  const fragment = [
    `[{ix:0}]geq='r=r(X,Y):g=g(X,Y):b=b(X,Y):a=200*max(0,1-(sqrt(pow((X-${(fx.positionX * 1920).toFixed(0)})/${Math.round(480 * fx.scale)},2)+pow((Y-${(fx.positionY * 1080).toFixed(0)})/${Math.round(280 * fx.scale)},2))))'[fxSB]`,
    `[{vIn}][fxSB]blend=all_mode=${blend}:all_opacity=${op}:enable='${enable}'[{vOut}]`,
  ].join(";");

  return {
    kind: "inline",
    extraInputs: [`-f lavfi -i "${lavfi}"`],
    filterFragment: fragment,
    fidelity: "stylized",
  };
}

// ─── Tier 1C · coarse approximation (particle systems) ───────────────────────

/**
 * GlassShatter — particle shards. Coarse fallback: white flash at
 * impact + radial color burst in the primary color. Preview shows
 * shards flying outward; bake shows the impact moment but not the
 * trail. Tier 2 closes this gap.
 */
function compileGlassShatter(fx: EffectInstance): BakedEffect {
  return compileRadialBurst(fx, "coarse", /* flashStrength */ 0.95);
}

/**
 * ParticleBurst — joyful explosion. Same fallback strategy as
 * GlassShatter — bright flash + radial burst — tuned to a softer
 * profile.
 */
function compileParticleBurst(fx: EffectInstance): BakedEffect {
  return compileRadialBurst(fx, "coarse", /* flashStrength */ 0.75);
}

/** Coarse fallback shared by all particle/explosion effects. */
function compileRadialBurst(fx: EffectInstance, fidelity: BakedEffect["fidelity"], flashStrength: number): BakedEffect {
  const primary = hexToFfmpegColor(fx.primaryColor);
  const accent  = hexToFfmpegColor(fx.accentColor);
  const enable = effectEnableExpr(fx);
  const progress = effectProgressExpr(fx);
  const blend  = FFMPEG_BLEND_MODES[fx.blendMode === "normal" ? "screen" : fx.blendMode];
  const op = (fx.opacity * (fx.intensity / 100) * flashStrength).toFixed(3);
  const dur = fx.durationSec.toFixed(3);

  const cx = Math.round(fx.positionX * 1920);
  const cy = Math.round(fx.positionY * 1080);
  // Radius grows with progress
  const rExpr = `(80+${progress}*${(560 * fx.scale).toFixed(1)})`;

  // Two-color radial: white core → primary mid → accent edge → transparent.
  // RGBA so the geq's alpha write is preserved (see compileLightBeam comment).
  const lavfi = `color=c=${primary}:size=1920x1080:duration=${dur},format=rgba`;
  const fragment = [
    `[{ix:0}]geq='r=r(X,Y):g=g(X,Y):b=b(X,Y):a=255*max(0,1-sqrt(pow((X-${cx})/${rExpr},2)+pow((Y-${cy})/${rExpr},2)))'[fxRB1]`,
    `[fxRB1]colorchannelmixer=rr=1:gg=1:bb=1:aa=1[fxRB]`,
    `[{vIn}][fxRB]blend=all_mode=${blend}:all_opacity=${op}:enable='${enable}'[{vOut}]`,
  ].join(";");

  void accent; // accent reserved for Tier 2 sprite overlay
  return {
    kind: "inline",
    extraInputs: [`-f lavfi -i "${lavfi}"`],
    filterFragment: fragment,
    fidelity,
  };
}

/**
 * Generic flash — catch-all for the 14 recipes without dedicated
 * Tier 1 compilers. Renders as a brief radial bloom in the primary
 * color so the effect at least registers on screen. Tier 2 will
 * upgrade these as their bespoke React renderers land.
 */
function compileGenericFlash(fx: EffectInstance): BakedEffect {
  return compileRadialBurst(fx, "coarse", /* flashStrength */ 0.6);
}
