/**
 * keyframe-bake — compile clip-local keyframes into FFmpeg time
 * expressions. Mirrors `getClipPropertyAt` in src/lib/editor/types.ts:
 * before the first kf returns the first value, after the last returns
 * the last, between two linearly interpolates.
 *
 * Per-property emit strategy:
 *   opacity → format=yuva420p,colorchannelmixer=aa='<expr>'
 *   scale   → scale='iw*<expr>:ih*<expr>' (proportional)
 *   volume  → volume='<expr>:eval=frame'
 *
 * Time in expressions is FFmpeg's per-input `t` (seconds since stream
 * start). Because the per-clip normalization stage runs BEFORE the
 * xfade chain, `t` is clip-local — exactly what our keyframe.time
 * field is relative to.
 */

export type BakeEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "step";

export interface BakeKeyframe {
  property: "opacity" | "scale" | "volume" | "positionX" | "positionY" | "rotation";
  time: number;
  value: number;
  easing?: BakeEasing;
}

/** Build an FFmpeg expression that applies an easing curve to the
 *  linear segment ratio. Matches applyEasing() in src/lib/editor/types.ts. */
function easingExpr(tLin: string, easing: BakeEasing): string {
  switch (easing) {
    case "ease-in":     return `(${tLin})*(${tLin})`;
    case "ease-out":    return `(1-(1-(${tLin}))*(1-(${tLin})))`;
    case "ease-in-out": return `if(lt(${tLin},0.5),2*(${tLin})*(${tLin}),1-pow(-2*(${tLin})+2,2)/2)`;
    case "step":        return `0`; // hold previous value
    case "linear":
    default:            return tLin;
  }
}

/** Sort + dedupe keyframes for a single property. */
function sortKfs(kfs: BakeKeyframe[]): BakeKeyframe[] {
  return [...kfs].sort((a, b) => a.time - b.time);
}

/** Build a piecewise-linear FFmpeg expression for a single property.
 *  Returns null when there are no keyframes (caller skips emit). */
export function buildKeyframeExpression(
  kfs: BakeKeyframe[],
  fallbackValue: number,
): string | null {
  const sorted = sortKfs(kfs);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) {
    // Constant value across the whole clip — emit a single literal.
    return sorted[0].value.toFixed(4);
  }
  // Build nested if-chain from the right: the innermost branch is the
  // value AFTER the last keyframe (clamps to last value, matching the
  // preview's getClipPropertyAt). Each outer if covers one segment.
  //
  //   if(lt(t,t0), v0,
  //     if(lt(t,t1), v0 + (v1-v0)*(t-t0)/(t1-t0),
  //       if(lt(t,t2), v1 + (v2-v1)*(t-t1)/(t2-t1),
  //         ... vN)))
  //
  // We construct from the inside out.
  let expr = sorted[sorted.length - 1].value.toFixed(4); // clamp to last
  for (let i = sorted.length - 1; i > 0; i--) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const v0 = a.value.toFixed(4);
    const v1 = b.value.toFixed(4);
    const t0 = a.time.toFixed(4);
    const t1 = b.time.toFixed(4);
    // The easing on `b` describes how we INTERPOLATE INTO b. Default
    // linear keeps the prior behavior.
    const ratio = `((t-${t0})/(${t1}-${t0}))`;
    const eased = easingExpr(ratio, b.easing ?? "linear");
    const segment = `${v0}+(${v1}-${v0})*(${eased})`;
    expr = `if(lt(t,${t1}),${segment},${expr})`;
  }
  // Before-first-kf clamp.
  const first = sorted[0];
  expr = `if(lt(t,${first.time.toFixed(4)}),${first.value.toFixed(4)},${expr})`;
  // Defensive: when the kf list begins with t>0, the value at t<t0 is
  // the first kf's value (preview behavior). Caller may also choose
  // fallbackValue but for parity with getClipPropertyAt we match preview.
  void fallbackValue;
  return expr;
}

/** Build the video-side keyframe filter chain. Returns "" when none. */
export function compileVideoKeyframeChain(
  allKfs: BakeKeyframe[],
): string {
  const opacityKfs   = allKfs.filter((k) => k.property === "opacity");
  const scaleKfs     = allKfs.filter((k) => k.property === "scale");
  const posXKfs      = allKfs.filter((k) => k.property === "positionX");
  const posYKfs      = allKfs.filter((k) => k.property === "positionY");
  const rotationKfs  = allKfs.filter((k) => k.property === "rotation");

  const parts: string[] = [];
  const opacityExpr  = buildKeyframeExpression(opacityKfs, 1);
  const scaleExpr    = buildKeyframeExpression(scaleKfs, 1);
  const posXExpr     = buildKeyframeExpression(posXKfs, 0);
  const posYExpr     = buildKeyframeExpression(posYKfs, 0);
  const rotationExpr = buildKeyframeExpression(rotationKfs, 0);

  if (scaleExpr) {
    // Use a centered scale via scale + pad. scale filter accepts
    // expressions for w/h; we multiply iw/ih by the keyframed
    // factor so a value of 1.3 = 130% size.
    //
    // The scale filter's expression evaluator does NOT see `t` by
    // default — it computes ONCE per frame given the current pts.
    // We must use eval=frame to get per-frame re-evaluation.
    parts.push(
      `scale=w='iw*(${scaleExpr})':h='ih*(${scaleExpr})':eval=frame`,
    );
    // Re-center via crop or pad — scale changes dimensions, which
    // breaks the xfade chain's assumption of fixed canvas size. We
    // crop back to a centered region of the original (iw0, ih0).
    parts.push(`crop=iw0:ih0:(iw-iw0)/2:(ih-ih0)/2`);
  }

  if (rotationExpr) {
    // rotate=angle (radians). Convert degrees → radians inline. Pad
    // with black so corners don't expose source-frame outside the
    // rotated region. ow/oh keeps output dimensions stable for the
    // downstream xfade chain.
    parts.push(
      `rotate=a='(${rotationExpr})*PI/180':c=black@0:ow=iw:oh=ih`,
    );
  }

  if (posXExpr || posYExpr) {
    // Translate via crop with offset expression — moves the visible
    // region of the source by (posX, posY) pixels. Source extends
    // off-canvas in opposite direction; we then pad back to canvas.
    // This is the simplest way to keyframe position without overlay
    // gymnastics. Values are pixel offsets relative to centered.
    const dx = posXExpr ?? "0";
    const dy = posYExpr ?? "0";
    parts.push(
      `pad=iw+abs(2*(${dx})):ih+abs(2*(${dy})):` +
        `(ow-iw)/2-(${dx}):(oh-ih)/2-(${dy}):color=black@0`,
    );
    parts.push(`crop=iw0:ih0:(iw-iw0)/2:(ih-ih0)/2`);
  }

  if (opacityExpr) {
    // alpha via colorchannelmixer. Requires format=yuva420p upstream.
    parts.push(`format=yuva420p`);
    parts.push(`colorchannelmixer=aa='${opacityExpr}':eval=frame`);
  }

  return parts.join(",");
}

/** Build the audio-side volume keyframe chain. Returns "" when none. */
export function compileAudioKeyframeChain(allKfs: BakeKeyframe[]): string {
  const volKfs = allKfs.filter((k) => k.property === "volume");
  const volExpr = buildKeyframeExpression(volKfs, 1);
  if (!volExpr) return "";
  // volume filter supports expression-based evaluation per frame.
  return `volume='${volExpr}':eval=frame`;
}
