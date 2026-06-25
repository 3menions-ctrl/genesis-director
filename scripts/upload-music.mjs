#!/usr/bin/env node
/**
 * upload-music.mjs — safely add tracks to the free music library.
 *
 * THE LICENSING RULE: only upload audio you can stand behind for COMMERCIAL use
 * — royalty-free you've licensed, or genuinely public-domain. Do NOT pull from
 * open repositories whose license tags are user-asserted (archive.org will hand
 * you copyrighted game soundtracks mislabeled "public domain"). Provenance is
 * your responsibility; this script just moves bytes + prints registry rows.
 *
 * USAGE
 *   1. Drop .mp3 files into ./music-drop/ (gitignored).
 *   2. Run:  node scripts/upload-music.mjs
 *   3. Paste the printed entries into src/lib/editor/music-library.ts, filling
 *      in `category`, `mood`, `license`, and `tags` for each.
 *
 * It uploads each file (idempotent, x-upsert) to the public video-clips bucket
 * under .../music/<slug>.mp3 and prints a ready-to-edit MusicTrack row with the
 * real public URL + duration (duration needs `ffprobe` on PATH; falls back to
 * 60s with a warning).
 *
 * Env (from .env.local / .env): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const DROP_DIR = resolve(ROOT, "music-drop");
const MUSIC_PREFIX = "8be6d9c9-776e-46af-9ad8-23ad41f0f99c/music";
const BUCKET = "video-clips";

// ── env loading (.env.local overrides .env) ─────────────────────────────────
function loadEnv() {
  const env = {};
  for (const f of [".env", ".env.local"]) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
const URL = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("✖ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env(.local).");
  process.exit(1);
}

function slugify(name) {
  return name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function durationOf(file) {
  try {
    // Use the array form (no shell) so a crafted filename can't inject shell
    // metacharacters — the filename is passed as a single argv entry.
    const res = spawnSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8" },
    );
    if (res.error || res.status !== 0) throw res.error ?? new Error("ffprobe failed");
    const d = Math.round(parseFloat(String(res.stdout).trim()));
    return Number.isFinite(d) && d > 0 ? d : 60;
  } catch {
    console.warn(`  ⚠ ffprobe unavailable — defaulting duration to 60s for ${basename(file)}`);
    return 60;
  }
}

async function uploadOne(file) {
  const slug = slugify(basename(file));
  const path = `${MUSIC_PREFIX}/${slug}.mp3`;
  const bytes = readFileSync(file);
  const res = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
      "x-upsert": "true",
      "Content-Type": "audio/mpeg",
    },
    body: bytes,
  });
  if (!res.ok) {
    console.error(`  ✖ upload failed (${res.status}) for ${basename(file)}: ${await res.text()}`);
    return null;
  }
  const publicUrl = `${URL}/storage/v1/object/public/${BUCKET}/${path}`;
  return { slug, publicUrl, durationSec: durationOf(file) };
}

async function main() {
  if (!existsSync(DROP_DIR)) {
    console.error(`✖ ${DROP_DIR} not found. Create it and drop .mp3 files in.`);
    process.exit(1);
  }
  const files = readdirSync(DROP_DIR).filter((f) => extname(f).toLowerCase() === ".mp3");
  if (files.length === 0) {
    console.error(`✖ No .mp3 files in ${DROP_DIR}.`);
    process.exit(1);
  }
  console.log(`Uploading ${files.length} track(s) → ${BUCKET}/${MUSIC_PREFIX}/\n`);
  const rows = [];
  for (const f of files) {
    const r = await uploadOne(resolve(DROP_DIR, f));
    if (!r) continue;
    console.log(`  ✓ ${f} → ${r.publicUrl}`);
    rows.push(r);
  }

  console.log("\n— Paste into src/lib/editor/music-library.ts (fill in category/mood/license/tags) —\n");
  for (const r of rows) {
    console.log(`  {
    id: "app-${r.slug}",
    title: "${r.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}",
    mood: "TODO",
    category: "cinematic", // cinematic | tension | atmosphere | classical
    url: "${r.publicUrl}",
    durationSec: ${r.durationSec},
    license: "TODO — royalty-free (source) | public domain (composer, year)",
    tags: ["TODO"],
  },`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
