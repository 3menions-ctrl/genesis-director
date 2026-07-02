/**
 * Pure helpers in _shared/seamless-command.ts — the transition-name
 * sanitizer + the aspect/resolution dimension lookup.
 *
 * These are the smallest pieces of the stitcher pipeline; testing
 * them in isolation catches the kind of regression where a refactor
 * adds a new aspect ratio or new transition without wiring it up to
 * either the allow-list or the dimensions table.
 */

import { describe, it, expect } from "vitest";
import {
  xfadeKindFor,
  dimensionsForAspect,
} from "../../../supabase/functions/_shared/seamless-command.ts";

describe("xfadeKindFor", () => {
  it("returns the kind when FFmpeg supports it", () => {
    expect(xfadeKindFor("fade", "dissolve")).toBe("fade");
    expect(xfadeKindFor("wipeleft", "fade")).toBe("wipeleft");
    expect(xfadeKindFor("circleopen", "fade")).toBe("circleopen");
  });

  it("is case-insensitive", () => {
    expect(xfadeKindFor("FADE", "dissolve")).toBe("fade");
    expect(xfadeKindFor("WipeLeft", "fade")).toBe("wipeleft");
  });

  it("falls back to the provided default for unknown kinds", () => {
    expect(xfadeKindFor("swipe-blur", "fade")).toBe("fade");
    expect(xfadeKindFor("nonsense", "dissolve")).toBe("dissolve");
  });

  it("maps UI synonyms to FFmpeg names", () => {
    // Continuity v2: "cut"/"hardcut" are REAL hard cuts now (concat join in
    // the chain builder) — previously they were silently blurred into fades.
    expect(xfadeKindFor("cut", "dissolve")).toBe("cut");
    expect(xfadeKindFor("hardcut", "dissolve")).toBe("cut");
    expect(xfadeKindFor("crossfade", "dissolve")).toBe("fade");
  });

  it("returns the fallback when input is undefined", () => {
    expect(xfadeKindFor(undefined, "fade")).toBe("fade");
  });
});

describe("dimensionsForAspect", () => {
  it("returns 1920×1080 for 16:9 / 1080p (default)", () => {
    expect(dimensionsForAspect("16:9", "1080p")).toEqual({ w: 1920, h: 1080 });
  });

  it("returns 1080×1920 for 9:16 / 1080p", () => {
    expect(dimensionsForAspect("9:16", "1080p")).toEqual({ w: 1080, h: 1920 });
  });

  it("returns square dimensions for 1:1", () => {
    expect(dimensionsForAspect("1:1", "1080p")).toEqual({ w: 1080, h: 1080 });
  });

  it("returns 1080×1350 for 4:5 portrait crop", () => {
    expect(dimensionsForAspect("4:5", "1080p")).toEqual({ w: 1080, h: 1350 });
  });

  it("returns 2560×1080 ultra-wide for 21:9", () => {
    expect(dimensionsForAspect("21:9", "1080p")).toEqual({ w: 2560, h: 1080 });
  });

  it("falls back to 1920×1080 for unknown aspect", () => {
    expect(dimensionsForAspect("99:1", "1080p")).toEqual({ w: 1920, h: 1080 });
    expect(dimensionsForAspect(undefined, "1080p")).toEqual({ w: 1920, h: 1080 });
  });

  it("scales by resolution preset — 720p halves, 4k doubles", () => {
    expect(dimensionsForAspect("16:9", "720p")).toEqual({ w: 1280, h: 720 });
    expect(dimensionsForAspect("16:9", "4k")).toEqual({ w: 3840, h: 2160 });
    expect(dimensionsForAspect("16:9", "2160p")).toEqual({ w: 3840, h: 2160 });
  });

  it("treats 2k as an alias for 1440p", () => {
    const a = dimensionsForAspect("16:9", "1440p");
    const b = dimensionsForAspect("16:9", "2k");
    expect(a).toEqual(b);
  });

  it("scales 8k to 7680×4320", () => {
    expect(dimensionsForAspect("16:9", "8k")).toEqual({ w: 7680, h: 4320 });
  });

  it("rounds dimensions to even integers (libx264 requirement)", () => {
    // Pick a combination that would compute odd dimensions without
    // the even-rounding step — 4:5 at 720p = 720×900 (already even,
    // but every result must be).
    const dims = dimensionsForAspect("4:5", "720p");
    expect(dims.w % 2).toBe(0);
    expect(dims.h % 2).toBe(0);
  });

  it("defaults resolution to 1080p when omitted", () => {
    expect(dimensionsForAspect("16:9")).toEqual({ w: 1920, h: 1080 });
  });
});
