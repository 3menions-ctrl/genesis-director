/**
 * seam-ssim — the seam continuity metric.
 *
 * Measures how well clip N+1's FIRST frame matches clip N's LAST frame
 * across a CONTINUOUS boundary — the "does the cut actually match?"
 * signal the validation stack didn't have. Pure math over two equal-
 * length grayscale arrays so it's unit-testable; the edge function
 * decodes + resizes the JPEGs and calls in here.
 *
 * Global SSIM (single window over the whole downscaled frame) plus a
 * luma-shift penalty. Cheap, no model, deterministic.
 */

/** Grayscale luma from RGBA bytes (Rec. 601). Returns one value per pixel. */
export function rgbaToGray(rgba: Uint8Array | Uint8ClampedArray | number[]): Float64Array {
  const n = Math.floor(rgba.length / 4);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    out[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return out;
}

function stats(a: ArrayLike<number>) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i];
  const mean = sum / a.length;
  let varr = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - mean;
    varr += d * d;
  }
  return { mean, varr: varr / a.length };
}

/**
 * Global SSIM between two equal-length grayscale arrays (0..255).
 * Returns a value in [-1, 1] (1 = identical).
 */
export function ssim(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  const L = 255;
  const C1 = (0.01 * L) ** 2;
  const C2 = (0.03 * L) ** 2;

  const sa = stats(a);
  const sb = stats(b);

  // Covariance.
  let cov = 0;
  for (let i = 0; i < a.length; i++) cov += (a[i] - sa.mean) * (b[i] - sb.mean);
  cov /= a.length;

  const num = (2 * sa.mean * sb.mean + C1) * (2 * cov + C2);
  const den = (sa.mean ** 2 + sb.mean ** 2 + C1) * (sa.varr + sb.varr + C2);
  return den === 0 ? 1 : num / den;
}

/**
 * Combine SSIM with a mean-luma-shift penalty into a 0..100 seam score.
 * A perfect frame match scores 100; an exposure jump or a structural
 * mismatch pulls it down.
 */
export function seamScore(grayA: ArrayLike<number>, grayB: ArrayLike<number>): number {
  if (grayA.length === 0 || grayA.length !== grayB.length) return 0;
  const s = ssim(grayA, grayB); // [-1, 1]
  const structural = Math.max(0, s); // negative correlation → 0

  const ma = stats(grayA).mean;
  const mb = stats(grayB).mean;
  const lumaShift = Math.abs(ma - mb) / 255; // 0..1
  const exposurePenalty = Math.min(1, lumaShift * 2.5); // a 40% shift fully penalises

  const score = structural * (1 - 0.35 * exposurePenalty);
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}
