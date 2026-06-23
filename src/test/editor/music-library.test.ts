/**
 * Free music library — registry integrity + filtering.
 *
 * Guards the licensing/availability contract: every bundled track has an
 * absolute bake-safe URL, a documented license, a known category, and is
 * findable via search.
 */
import { describe, it, expect } from "vitest";
import {
  MUSIC_LIBRARY,
  MUSIC_CATEGORY_LABELS,
  getMusicTrack,
  musicCategories,
  filterMusic,
} from "@/lib/editor/music-library";

describe("MUSIC_LIBRARY — registry integrity", () => {
  it("has tracks, all with unique ids", () => {
    expect(MUSIC_LIBRARY.length).toBeGreaterThan(0);
    const ids = new Set(MUSIC_LIBRARY.map((t) => t.id));
    expect(ids.size).toBe(MUSIC_LIBRARY.length);
  });

  it("every track is well-formed, license-documented, bake-safe", () => {
    for (const t of MUSIC_LIBRARY) {
      expect(t.title.trim().length).toBeGreaterThan(0);
      expect(t.mood.trim().length).toBeGreaterThan(0);
      // Absolute https URL (server-side bake downloads it) ending in an audio ext.
      expect(t.url).toMatch(/^https:\/\/.+\.(mp3|m4a|wav|ogg)$/);
      expect(t.durationSec).toBeGreaterThan(0);
      // Licensing must never be a mystery.
      expect(t.license.trim().length).toBeGreaterThan(0);
      expect(MUSIC_CATEGORY_LABELS[t.category]).toBeDefined();
      expect(Array.isArray(t.tags)).toBe(true);
    }
  });

  it("getMusicTrack resolves by id", () => {
    const first = MUSIC_LIBRARY[0];
    expect(getMusicTrack(first.id)).toBe(first);
    expect(getMusicTrack("nope")).toBeUndefined();
  });

  it("musicCategories only lists categories that have tracks", () => {
    const cats = musicCategories();
    for (const c of cats) {
      expect(MUSIC_LIBRARY.some((t) => t.category === c)).toBe(true);
    }
  });
});

describe("filterMusic", () => {
  it("'all' + empty query returns the whole library", () => {
    expect(filterMusic("all", "")).toHaveLength(MUSIC_LIBRARY.length);
  });

  it("filters by category", () => {
    const cat = MUSIC_LIBRARY[0].category;
    const out = filterMusic(cat, "");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((t) => t.category === cat)).toBe(true);
  });

  it("searches title / mood / tags (case-insensitive, token AND)", () => {
    // Every track matches its own uppercased title.
    for (const t of MUSIC_LIBRARY) {
      const hit = filterMusic("all", t.title.toUpperCase());
      expect(hit.some((x) => x.id === t.id)).toBe(true);
    }
    expect(filterMusic("all", "zzzznotahit")).toHaveLength(0);
  });
});
