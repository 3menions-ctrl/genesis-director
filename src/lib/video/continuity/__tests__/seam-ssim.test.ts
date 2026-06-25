/**
 * Tests for the edge seam metric (supabase/functions/_shared/seam-ssim.ts).
 * Pure math — runs under vitest unchanged.
 */
import { describe, it, expect } from "vitest";
import { ssim, seamScore, rgbaToGray } from "../../../../../supabase/functions/_shared/seam-ssim";

function gradient(n: number, shift = 0): Float64Array {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.max(0, Math.min(255, (i % 256) + shift));
  return a;
}

describe("ssim", () => {
  it("identical arrays → 1", () => {
    const g = gradient(1024);
    expect(ssim(g, g)).toBeCloseTo(1, 5);
  });

  it("mismatched lengths → 0 (defensive)", () => {
    expect(ssim(new Float64Array(4), new Float64Array(8))).toBe(0);
  });

  it("a small perturbation stays high but below 1", () => {
    const a = gradient(1024);
    const b = gradient(1024, 8);
    const s = ssim(a, b);
    expect(s).toBeGreaterThan(0.8);
    expect(s).toBeLessThan(1);
  });

  it("structurally unrelated content scores lower than a near match", () => {
    const a = gradient(1024);
    const near = gradient(1024, 4);
    const noise = new Float64Array(1024);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 97) % 256; // different structure
    expect(ssim(a, near)).toBeGreaterThan(ssim(a, noise));
  });
});

describe("seamScore (0..100)", () => {
  it("identical frames → 100", () => {
    const g = gradient(1024);
    expect(seamScore(g, g)).toBe(100);
  });

  it("a clean continuation scores high", () => {
    expect(seamScore(gradient(1024), gradient(1024, 3))).toBeGreaterThan(80);
  });

  it("an exposure jump is penalised", () => {
    const clean = seamScore(gradient(1024), gradient(1024, 3));
    const jumped = seamScore(gradient(1024), gradient(1024, 90));
    expect(jumped).toBeLessThan(clean);
  });

  it("empty / mismatched → 0", () => {
    expect(seamScore(new Float64Array(0), new Float64Array(0))).toBe(0);
    expect(seamScore(new Float64Array(4), new Float64Array(8))).toBe(0);
  });
});

describe("rgbaToGray", () => {
  it("converts RGBA → one luma per pixel (Rec.601)", () => {
    // pure white + pure black pixels
    const g = rgbaToGray([255, 255, 255, 255, 0, 0, 0, 255]);
    expect(g).toHaveLength(2);
    expect(Math.round(g[0])).toBe(255);
    expect(Math.round(g[1])).toBe(0);
  });
});
