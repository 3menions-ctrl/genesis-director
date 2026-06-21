/**
 * scripts/seed-character-avatars.ts
 *
 * Regenerates the 10 stock training-video avatars as full-body
 * photoreal renders via Pollinations.ai (free FLUX.1 endpoint, no API
 * key), uploads each PNG to the public `training-avatars` Supabase
 * storage bucket, and rewrites `src/lib/training/character-blueprint.ts`
 * to point each `image:` field at the new public URL.
 *
 * Why:
 *   The previous avatars were Unsplash photos fetched with
 *   `?crop=faces`, which means the source CDN crops to a face — useless
 *   for "head-to-toe" containers. These regenerated avatars are framed
 *   full-body with explicit prompt language so the entire figure fits
 *   inside the avatar card's portrait container without face-clipping.
 *
 * Run:
 *   npx tsx scripts/seed-character-avatars.ts
 *
 * Reads from .env / .env.local:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent: re-running overwrites files in the bucket and re-rewrites
 * the same URLs. Pollinations seeds are deterministic per character id,
 * so visual identity is stable across runs unless a `--reseed` flag is
 * passed (rotates the seed salt to force fresh renders).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Load env ────────────────────────────────────────────────────────────────
function loadEnv() {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
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
      // missing file — fine
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "training-avatars";
const RESEED = process.argv.includes("--reseed");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env / .env.local");
  process.exit(1);
}

// ─── Character roster (kept in sync with character-blueprint.ts) ─────────────
interface AvatarSpec {
  id: string;
  name: string;
  archetypeLabel: string;
  persona: string;
  bio: string;
  styleNote: string;
}

const ROSTER: AvatarSpec[] = [
  {
    id: "elena-chen",
    name: "Elena Chen",
    archetypeLabel: "Executive / CEO",
    persona: "CEO archetype · poised, decisive, charismatic",
    bio: "Founder energy. Pitches to boardrooms and 10,000-person conferences. Composed but warm enough to disarm.",
    styleNote: "East Asian woman, late thirties, structured shoulder-length hair, tailored navy blazer over silk blouse, calm direct gaze",
  },
  {
    id: "marcus-blackwood",
    name: "Marcus Blackwood",
    archetypeLabel: "Executive Director",
    persona: "Executive director · seasoned authority",
    bio: "The kind of leader people stand up for. Silver hair, dark suit, unhurried delivery, legacy-brand prestige.",
    styleNote: "White man, mid fifties, silver hair swept back, charcoal three-piece suit with crisp white shirt, classical gentleman gravitas, unhurried expression",
  },
  {
    id: "priya-rao",
    name: "Priya Rao",
    archetypeLabel: "Corporate Trainer",
    persona: "Corporate trainer · warm, clear, encouraging",
    bio: "The L&D lead every team wants. Approachable, articulate, brilliant at making dense material feel doable.",
    styleNote: "South Asian woman, early thirties, long dark hair, smart-casual cream blouse and tailored trousers, friendly direct gaze, mid-gesture with one hand",
  },
  {
    id: "daniel-kane",
    name: "Daniel Kane",
    archetypeLabel: "Fitness Coach",
    persona: "Fitness + life coach · energetic and direct",
    bio: "The trainer who actually gets you moving. Fit, modern wardrobe, high-energy delivery without losing warmth.",
    styleNote: "White man, early thirties, short brown hair, fitted black athleisure henley and slim joggers, athletic build, confident smile, energetic posture",
  },
  {
    id: "maya-thompson",
    name: "Maya Thompson",
    archetypeLabel: "Lifestyle Creator",
    persona: "Lifestyle creator · radiant, relatable, fashion-forward",
    bio: "The influencer everyone wants to collab with. Bright energy, on-trend wardrobe, talks to camera like a friend.",
    styleNote: "Black woman, mid twenties, long natural curls, on-trend cropped knit and high-waist denim, natural makeup, radiant warm smile",
  },
  {
    id: "jordan-pierce",
    name: "Jordan Pierce",
    archetypeLabel: "Podcast Host",
    persona: "Podcast host · thoughtful and conversational",
    bio: "The podcast host who actually listens. Warm, considered delivery, deep-cut topics rendered approachable.",
    styleNote: "Latino man, early thirties, short dark hair, slim tortoise-shell glasses, crisp white button-down rolled at the sleeves with dark chinos, slight head tilt, intelligent attentive eyes",
  },
  {
    id: "alex-rivera",
    name: "Alex Rivera",
    archetypeLabel: "News Anchor",
    persona: "News anchor · authoritative and articulate",
    bio: "Built for the broadcast desk. Sharp tailored wardrobe, measured eye contact, the cadence of a lead-story veteran.",
    styleNote: "Latino man, late thirties, sharp side-parted dark hair, tailored navy suit jacket over crisp white shirt, news-desk authoritative gaze",
  },
  {
    id: "sara-kim",
    name: "Sara Kim",
    archetypeLabel: "TV Host",
    persona: "TV host · poised and luminous",
    bio: "Holds the camera like a seasoned host. Bright but composed, warmth dialed up just shy of formal.",
    styleNote: "Korean woman, early thirties, polished shoulder-length hair, elegant cream silk blouse and tailored skirt, prestige TV-host energy, luminous warm smile",
  },
  {
    id: "dr-patel",
    name: "Dr. Patel",
    archetypeLabel: "University Professor",
    persona: "University professor · thoughtful, articulate, expert",
    bio: "The professor whose office hours actually fill up. Cardigan-level approachable but rigorously thoughtful.",
    styleNote: "South Asian man, late forties, salt-and-pepper hair, wire-frame glasses, tweed blazer over knit cardigan and oxford shirt, contemplative head tilt, intelligent expression",
  },
  {
    id: "ms-okafor",
    name: "Ms. Okafor",
    archetypeLabel: "K-12 Teacher",
    persona: "K-12 teacher · warm, encouraging, deeply patient",
    bio: "Every favorite teacher you ever had. Bright wardrobe, generous smile, telegraphs she has all day to make sure you understand.",
    styleNote: "Black woman, early forties, natural shoulder-length hair, bright friendly mustard cardigan over patterned dress, gentle warm direct gaze, generous smile",
  },
];

// ─── Prompt builder ─────────────────────────────────────────────────────────
// Frames each spec as a full-body editorial portrait so the model
// renders head-to-toe inside the avatar's portrait container. Lots of
// "full body" / "head to toe" language up-front because FLUX honors
// framing directives strongly in the first 30 tokens.
function buildPrompt(spec: AvatarSpec): string {
  return [
    "full body editorial portrait photograph, head to toe visible, entire figure framed from hair to shoes",
    `${spec.name}, ${spec.archetypeLabel}.`,
    spec.persona,
    spec.styleNote,
    "standing pose, three-quarter angle, hands relaxed at sides or one hand in pocket",
    "neutral seamless light-gray studio backdrop, soft cinematic key light with subtle rim, no harsh shadows",
    "shot on 85mm portrait lens, f/2.8, shallow depth of field, sharp focus on subject",
    "ultra-high detail skin texture, natural color grading, magazine-cover editorial quality",
    "8k, photorealistic, professional retouching",
  ].join(", ");
}

// ─── Seed (per-id, deterministic) ───────────────────────────────────────────
function seedFor(id: string): number {
  // Simple hash → 1..999999. RESEED salt rotates output if forced.
  const salt = RESEED ? Math.floor(Math.random() * 1_000_000) : 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ((h + salt) % 1_000_000) + 1;
}

// ─── Pollinations fetch ─────────────────────────────────────────────────────
async function generateImage(spec: AvatarSpec): Promise<Buffer> {
  const prompt = buildPrompt(spec);
  const seed = seedFor(spec.id);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=832&height=1216&model=flux&nologo=true&seed=${seed}`;
  // Pollinations renders synchronously and returns the PNG directly.
  // Set a generous timeout — FLUX renders can take ~20-40s.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Pollinations ${res.status}: ${await res.text().catch(() => "")}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Supabase storage upload ────────────────────────────────────────────────
async function uploadAvatar(id: string, png: Buffer): Promise<string> {
  const path = `${id}.png`;
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY!,
      "Content-Type": "image/png",
      "x-upsert": "true",
    },
    body: png,
  });
  if (!res.ok) {
    throw new Error(`Upload ${path}: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ─── Rewrite character-blueprint.ts ─────────────────────────────────────────
function rewriteBlueprintFile(idToUrl: Record<string, string>) {
  const path = resolve("src/lib/training/character-blueprint.ts");
  let src = readFileSync(path, "utf8");
  let touched = 0;

  // For each character object, replace the `image: u("…")` line with a
  // static public URL. Anchor on `id: "x-y"` so we never mis-target a
  // different character. The regex is scoped per-character to keep
  // local context tight.
  for (const [id, url] of Object.entries(idToUrl)) {
    const escId = id.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    // Match the object that contains this id, then replace its
    // following `image: ...` line. We do this by walking forward from
    // the id match to the next `image:` line (must be within ~6 lines
    // — character objects are tightly grouped).
    const idRe = new RegExp(`id:\\s*"${escId}",`);
    const idMatch = src.match(idRe);
    if (!idMatch || idMatch.index === undefined) {
      console.warn(`  ⚠️  Could not locate id:"${id}" in character-blueprint.ts`);
      continue;
    }
    const tail = src.slice(idMatch.index);
    const imageLineRe = /image:\s*[^\n]+,/;
    const imgMatch = tail.match(imageLineRe);
    if (!imgMatch || imgMatch.index === undefined) {
      console.warn(`  ⚠️  Could not find image: line for id:"${id}"`);
      continue;
    }
    const absIdx = idMatch.index + imgMatch.index;
    src = src.slice(0, absIdx) + `image: "${url}",` + src.slice(absIdx + imgMatch[0].length);
    touched++;
  }

  writeFileSync(path, src, "utf8");
  return touched;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🎨 Seeding ${ROSTER.length} full-body avatars via Pollinations.ai → Supabase\n`);
  const idToUrl: Record<string, string> = {};

  for (let i = 0; i < ROSTER.length; i++) {
    const spec = ROSTER[i];
    const tag = `[${i + 1}/${ROSTER.length}] ${spec.name.padEnd(22)}`;
    process.stdout.write(`${tag} generating… `);
    const t0 = Date.now();
    try {
      const png = await generateImage(spec);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      process.stdout.write(`✓ ${(png.length / 1024).toFixed(0)}KB in ${dt}s → uploading… `);
      const publicUrl = await uploadAvatar(spec.id, png);
      idToUrl[spec.id] = publicUrl;
      console.log("✓");
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`);
    }
  }

  if (Object.keys(idToUrl).length === 0) {
    console.error("\n❌ Nothing succeeded — bailing without touching the blueprint file.");
    process.exit(1);
  }

  console.log(`\n📝 Rewriting character-blueprint.ts (${Object.keys(idToUrl).length} URLs)…`);
  const touched = rewriteBlueprintFile(idToUrl);
  console.log(`   ✓ Replaced ${touched} image: lines`);

  console.log(`\n✅ Done. Sample URL: ${Object.values(idToUrl)[0]}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
