/**
 * scripts/seed-avatars-from-presets.ts
 *
 * One-shot seeder: pulls every preset out of the seed-avatar-library and
 * seed-avatar-batch-v2 edge function source files and bulk-inserts them
 * into the avatar_templates table on the active Supabase project.
 *
 * The presets are written with placeholder face_image_url values
 * (placehold.co svg's). The user sees every row immediately in the
 * Avatars vault — they render via OptimizedAvatarImage's shimmer
 * fallback. When the user is ready to spend Lovable AI credits to
 * generate real portraits, they can call the cron-tick-db action on
 * the (deployed) seed-avatar-library function or run the existing
 * generate-avatar-image edge function per row.
 *
 * Run with:
 *   tsx scripts/seed-avatars-from-presets.ts
 *
 * Reads:
 *   .env / .env.local — SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL
 *
 * Idempotent: uses upsert with onConflict on name.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Load env ────────────────────────────────────────────────────────────────
function loadEnv() {
  const env: Record<string, string> = { ...process.env };
  for (const file of [".env", ".env.local"]) {
    try {
      const text = readFileSync(resolve(file), "utf8");
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const k = m[1];
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!env[k]) env[k] = v;
      }
    } catch {
      // file missing — fine
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env / .env.local");
  process.exit(1);
}

// ─── Parsers ─────────────────────────────────────────────────────────────────
// V1 preset shape (seed-avatar-library):
//   { name: "X", gender: "X", ageRange: "X", ethnicity: "X", style: "X",
//     personality: "X", clothing: "X" }
interface V1Preset {
  name: string;
  gender: string;
  ageRange: string;
  ethnicity: string;
  style: string;
  personality: string;
  clothing: string;
}

// V2 preset shape adds avatarType / category / tags.
interface V2Preset extends V1Preset {
  avatarType: "realistic" | "animated";
  category: string;
  tags: string[];
}

/** Parse a flat list of `{ name: "...", ... }` object literals out of a TS
 *  source by regex. Cheap but robust for the controlled author style used
 *  in seed-avatar-library and seed-avatar-batch-v2. */
function parseV1Presets(src: string): V1Preset[] {
  const rows: V1Preset[] = [];
  // Match the AVATAR_PRESETS = [...] block first to avoid grabbing
  // unrelated object literals in the rest of the file.
  const block = src.match(/const AVATAR_PRESETS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!block) return rows;
  const body = block[1];
  // Greedy per-line entries — each row is on its own line:
  //   { name: "X", gender: "X", ... },
  const rowRe = /\{\s*name:\s*"([^"]+)"\s*,\s*gender:\s*"([^"]+)"\s*,\s*ageRange:\s*"([^"]+)"\s*,\s*ethnicity:\s*"([^"]+)"\s*,\s*style:\s*"([^"]+)"\s*,\s*personality:\s*"([^"]+)"\s*,\s*clothing:\s*"([^"]+)"\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(body)) !== null) {
    rows.push({
      name: m[1],
      gender: m[2],
      ageRange: m[3],
      ethnicity: m[4],
      style: m[5],
      personality: m[6],
      clothing: m[7],
    });
  }
  return rows;
}

function parseV2Presets(src: string): V2Preset[] {
  const rows: V2Preset[] = [];
  const block = src.match(/const AVATAR_PRESETS_V2[^=]*=\s*\[([\s\S]*?)\n\];/);
  if (!block) return rows;
  const body = block[1];
  // V2 is multi-line object literals. Split by `},` boundaries then
  // re-parse each chunk.
  const chunks = body.split(/\}\s*,/).map((c) => c.trim());
  for (const chunkRaw of chunks) {
    if (!chunkRaw || chunkRaw.startsWith("//")) continue;
    const name = chunkRaw.match(/name:\s*"([^"]+)"/)?.[1];
    if (!name) continue;
    const gender = chunkRaw.match(/gender:\s*"([^"]+)"/)?.[1] ?? "neutral";
    const ageRange = chunkRaw.match(/ageRange:\s*"([^"]+)"/)?.[1] ?? "young-adult";
    const ethnicity = chunkRaw.match(/ethnicity:\s*"([^"]+)"/)?.[1] ?? "Mixed";
    const style = chunkRaw.match(/style:\s*"([^"]+)"/)?.[1] ?? "creative";
    const personality = chunkRaw.match(/personality:\s*"([^"]+)"/)?.[1] ?? "";
    const clothing = chunkRaw.match(/clothing:\s*"([^"]+)"/)?.[1] ?? "";
    const avatarType = (chunkRaw.match(/avatarType:\s*"([^"]+)"/)?.[1] ?? "animated") as
      | "realistic"
      | "animated";
    const category = chunkRaw.match(/category:\s*"([^"]+)"/)?.[1] ?? "";
    const tagsBlock = chunkRaw.match(/tags:\s*\[([^\]]*)\]/)?.[1] ?? "";
    const tags = Array.from(tagsBlock.matchAll(/"([^"]+)"/g)).map((t) => t[1]);
    rows.push({
      name,
      gender,
      ageRange,
      ethnicity,
      style,
      personality,
      clothing,
      avatarType,
      category,
      tags,
    });
  }
  return rows;
}

// ─── Placeholder generator ───────────────────────────────────────────────────
function placeholderUrl(name: string, gender: string, style: string): string {
  const palette: Record<string, string> = {
    male: "3b82f6",
    female: "ec4899",
    neutral: "8b5cf6",
    "non-binary": "8b5cf6",
  };
  const fg = palette[gender] ?? "60a5fa";
  const initial = name.charAt(0).toUpperCase();
  return `https://placehold.co/512x768/1a1a2e/${fg}?text=${encodeURIComponent(initial)}`;
}

// ─── Insert ──────────────────────────────────────────────────────────────────
interface AvatarRow {
  name: string;
  description: string;
  personality: string;
  gender: string;
  age_range: string;
  ethnicity: string;
  style: string;
  avatar_type: "realistic" | "animated";
  face_image_url: string;
  thumbnail_url: string;
  front_image_url: string;
  voice_id: string;
  voice_provider: string;
  voice_name: string;
  voice_description: string;
  tags: string[];
  is_active: boolean;
  is_premium: boolean;
  sort_order: number;
}

function v1ToRow(p: V1Preset, sort: number): AvatarRow {
  const url = placeholderUrl(p.name, p.gender, p.style);
  // V1 has no explicit type; infer from style hint.
  const animatedStyleHints = [
    "creative",
    "influencer",
    "fantasy",
    "folk-horror",
    "gothic-horror",
    "psychological-horror",
    "body-horror",
    "analog-horror",
    "animated",
    "voxel",
    "chibi",
    "anime",
    "pixel-art",
    "claymation",
  ];
  const isAnimated = animatedStyleHints.some((h) => p.style.toLowerCase().includes(h));
  return {
    name: p.name,
    description: p.clothing,
    personality: p.personality,
    gender: p.gender,
    age_range: p.ageRange,
    ethnicity: p.ethnicity,
    style: p.style,
    avatar_type: isAnimated ? "animated" : "realistic",
    face_image_url: url,
    thumbnail_url: url,
    front_image_url: url,
    voice_id: "alloy",
    voice_provider: "openai",
    voice_name: "Alloy",
    voice_description: "Default voice — replace per avatar in cron processing",
    tags: [p.style, p.gender, p.ageRange, p.ethnicity.toLowerCase()].filter(Boolean),
    is_active: true,
    is_premium: false,
    sort_order: sort,
  };
}

function v2ToRow(p: V2Preset, sort: number): AvatarRow {
  const url = placeholderUrl(p.name, p.gender, p.style);
  return {
    name: p.name,
    description: p.clothing,
    personality: p.personality,
    gender: p.gender,
    age_range: p.ageRange,
    ethnicity: p.ethnicity,
    style: p.style,
    avatar_type: p.avatarType,
    face_image_url: url,
    thumbnail_url: url,
    front_image_url: url,
    voice_id: "alloy",
    voice_provider: "openai",
    voice_name: "Alloy",
    voice_description: "Default voice — replace per avatar in cron processing",
    tags: [
      ...p.tags,
      p.category,
      p.gender,
      p.ageRange,
      p.ethnicity.toLowerCase(),
    ].filter(Boolean),
    is_active: true,
    is_premium: false,
    sort_order: sort,
  };
}

async function upsertBatch(rows: AvatarRow[], from: number, to: number) {
  const slice = rows.slice(from, to);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/avatar_templates?on_conflict=name`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(slice),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Batch ${from}-${to} failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
}

async function main() {
  const v1Src = readFileSync(
    resolve("supabase/functions/seed-avatar-library/index.ts"),
    "utf8",
  );
  const v2Src = readFileSync(
    resolve("supabase/functions/seed-avatar-batch-v2/index.ts"),
    "utf8",
  );

  const v1 = parseV1Presets(v1Src);
  const v2 = parseV2Presets(v2Src);
  console.log(`Parsed: v1=${v1.length}  v2=${v2.length}  total=${v1.length + v2.length}`);

  // Dedup by name (V2 takes precedence)
  const byName = new Map<string, AvatarRow>();
  v1.forEach((p, i) => byName.set(p.name, v1ToRow(p, 1000 + i)));
  v2.forEach((p, i) => byName.set(p.name, v2ToRow(p, 2000 + i)));
  const rows = Array.from(byName.values());
  console.log(`After dedup: ${rows.length} unique rows to upsert`);

  // Chunk to 50 per request to stay under PostgREST payload limits.
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const end = Math.min(rows.length, i + CHUNK);
    process.stdout.write(`Upserting ${i + 1}–${end}…`);
    try {
      await upsertBatch(rows, i, end);
      process.stdout.write(" ok\n");
    } catch (e) {
      process.stdout.write(" FAIL\n");
      console.error(e);
      process.exit(1);
    }
  }

  // Confirm count.
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/avatar_templates?select=count`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const cr = countRes.headers.get("content-range");
  console.log(`\nDone. avatar_templates count: ${cr ?? "unknown"}`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
