/**
 * Free music library — the curated, license-clear beds every project can score
 * with, before a user uploads their own. Surfaced in the editor's MusicPicker
 * ("App" tab) and reused by the one-click timeline templates.
 *
 * ── Licensing discipline ─────────────────────────────────────────────────────
 * Every track here is either (a) royalty-free and bundled/cleared by Small
 * Bridges, or (b) genuinely public-domain. We do NOT bulk-import from open
 * repositories whose license tags are user-asserted and unreliable (e.g.
 * archive.org happily serves copyrighted game soundtracks mislabeled "public
 * domain"). New tracks are added deliberately via scripts/upload-music.mjs with
 * a documented `license` + `source`. This array is the single source of truth.
 *
 * All URLs are absolute + bake-safe (the seamless-stitcher downloads them
 * server-side), hosted in the platform's public `video-clips` bucket.
 */

const BUCKET =
  "https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/object/public/video-clips";
const MUSIC_DIR = `${BUCKET}/8be6d9c9-776e-46af-9ad8-23ad41f0f99c/music`;

export type MusicCategory =
  | "cinematic"
  | "tension"
  | "atmosphere"
  | "classical";

export const MUSIC_CATEGORY_LABELS: Record<MusicCategory, string> = {
  cinematic: "Cinematic",
  tension: "Tension",
  atmosphere: "Atmosphere",
  classical: "Classical",
};

export interface MusicTrack {
  id: string;
  title: string;
  /** Short display mood. */
  mood: string;
  category: MusicCategory;
  url: string;
  durationSec: number;
  /** Human-readable license — surfaced so the provenance is never a mystery. */
  license: string;
  /** Free-text tags for search. */
  tags: string[];
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  {
    id: "app-strings",
    title: "Dramatic Strings",
    mood: "Tension",
    category: "tension",
    url: `${MUSIC_DIR}/66793761-9fb0-40ce-91a9-7f74d7c184c3.mp3`,
    durationSec: 56,
    license: "Royalty-free · bundled with Small Bridges",
    tags: ["strings", "dramatic", "tension", "trailer", "orchestral"],
  },
  {
    id: "app-mountain",
    title: "Elegant Mountain",
    mood: "Cinematic",
    category: "cinematic",
    url: `${MUSIC_DIR}/c518f90c-d4e0-4862-9ec5-c464f51d227d.mp3`,
    durationSec: 142,
    license: "Royalty-free · bundled with Small Bridges",
    tags: ["cinematic", "uplifting", "epic", "score", "orchestral"],
  },
  {
    id: "app-swell",
    title: "Ambient Swell",
    mood: "Atmosphere",
    category: "atmosphere",
    url: `${MUSIC_DIR}/27eac7fc-de97-45ce-8346-104b81dc0a01.mp3`,
    durationSec: 178,
    license: "Royalty-free · bundled with Small Bridges",
    tags: ["ambient", "calm", "atmosphere", "drone", "lofi"],
  },
  {
    id: "app-mountainking",
    title: "Hall of the Mountain King",
    mood: "Playful · classical",
    category: "classical",
    url: `${MUSIC_DIR}/mountainking-musicbox.mp3`,
    durationSec: 64,
    // Composition: Edvard Grieg, 1875 — public domain. Music-box rendition.
    license: "Public domain (Grieg, 1875) · music-box rendition",
    tags: ["classical", "playful", "music box", "grieg", "whimsical", "build"],
  },
];

/** Lookup by id. */
export function getMusicTrack(id: string): MusicTrack | undefined {
  return MUSIC_LIBRARY.find((t) => t.id === id);
}

/** Distinct categories present in the library, in display order. */
export function musicCategories(): MusicCategory[] {
  const order: MusicCategory[] = ["cinematic", "tension", "atmosphere", "classical"];
  const present = new Set(MUSIC_LIBRARY.map((t) => t.category));
  return order.filter((c) => present.has(c));
}

/** Filter by category + free-text query (title / mood / tags). */
export function filterMusic(category: MusicCategory | "all", query: string): MusicTrack[] {
  const q = query.trim().toLowerCase();
  return MUSIC_LIBRARY.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (!q) return true;
    const hay = `${t.title} ${t.mood} ${t.tags.join(" ")}`.toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });
}
