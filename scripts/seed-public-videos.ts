/**
 * seed-public-videos.ts
 *
 * Seeds the `movie_projects` + `video_clips` tables with three public
 * sample projects so the editor has something to render for every
 * user — even brand-new accounts with zero personal projects.
 *
 * Run: `bunx tsx scripts/seed-public-videos.ts`
 *
 * Idempotent — if a project with the seeded title already exists,
 * the script skips it (no duplicate rows).
 *
 * Uses the service role key for the REST API so it bypasses RLS
 * during insert. Read-side RLS will then return them to any user
 * whose policy allows is_public = true.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";

function loadServiceKey(): string {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const line = env
    .split("\n")
    .find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}

const KEY = loadServiceKey();

async function rest(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`REST ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

interface ClipSeed {
  prompt: string;
  durationSec: number;
  videoUrl: string;
}

interface ProjectSeed {
  title: string;
  synopsis: string;
  mood: string;
  setting: string;
  aspect_ratio: string;
  thumbnail_url: string;
  clips: ClipSeed[];
}

// Each clip uses a W3-tested public MP4. The thumbnails reuse
// picsum.photos for deterministic per-project art.
const SEEDS: ProjectSeed[] = [
  {
    title: "Public · Big Buck Bunny Cut",
    synopsis: "A short cut of the open-source Big Buck Bunny film, set up so any user can press play.",
    mood: "Bright, playful",
    setting: "An open meadow at first light",
    aspect_ratio: "16:9",
    thumbnail_url: "https://picsum.photos/seed/big-buck-public/1280/720",
    clips: [
      { prompt: "Sunrise over the open meadow, wide aerial drift", durationSec: 8, videoUrl: "https://media.w3.org/2010/05/bunny/trailer.mp4" },
      { prompt: "Close on the bunny stretching, golden rim light", durationSec: 6, videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
      { prompt: "Wide chase sequence through the meadow", durationSec: 7, videoUrl: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4" },
    ],
  },
  {
    title: "Public · Sintel Trailer Beat",
    synopsis: "The Sintel teaser, structured as a 3-shot beat for editing practice.",
    mood: "Cathartic, golden",
    setting: "A windswept ridge under a setting sun",
    aspect_ratio: "16:9",
    thumbnail_url: "https://picsum.photos/seed/sintel-public/1280/720",
    clips: [
      { prompt: "Hero shot of Sintel walking against the wind", durationSec: 9, videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4" },
      { prompt: "Push-in on her face, dramatic backlight", durationSec: 5, videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4" },
    ],
  },
  {
    title: "Public · Studio Sampler",
    synopsis: "A three-shot demo reel ready to scrub, trim, and remix.",
    mood: "Quiet, cinematic",
    setting: "Mixed locations · time of day shifts every cut",
    aspect_ratio: "16:9",
    thumbnail_url: "https://picsum.photos/seed/studio-sampler/1280/720",
    clips: [
      { prompt: "Establishing wide of a harbour town", durationSec: 6, videoUrl: "https://media.w3.org/2010/05/video/movie_300.mp4" },
      { prompt: "Lighthouse beam sweeping through fog", durationSec: 5, videoUrl: "https://media.w3.org/2010/05/bunny/trailer.mp4" },
      { prompt: "Final pull-back at golden hour", durationSec: 6, videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4" },
    ],
  },
];

async function getOwnerId(): Promise<string> {
  // Pick the first profile we can find. Any signed-up user works
  // since these projects are flagged is_public for everyone to read.
  const rows = (await rest("profiles?select=id&limit=1")) as Array<{ id: string }>;
  if (!rows.length) {
    throw new Error("No profiles found in DB — sign up first then re-run.");
  }
  return rows[0].id;
}

async function findExistingByTitle(title: string): Promise<string | null> {
  const encoded = encodeURIComponent(`"${title}"`);
  const rows = (await rest(
    `movie_projects?select=id&title=eq.${encoded}&limit=1`,
  )) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

async function seedOne(seed: ProjectSeed, ownerId: string): Promise<void> {
  const existing = await findExistingByTitle(seed.title);
  if (existing) {
    console.log(`  ↺  already exists: ${seed.title}  (${existing.slice(0, 8)})`);
    return;
  }

  const projectInsert = {
    title: seed.title,
    synopsis: seed.synopsis,
    mood: seed.mood,
    setting: seed.setting,
    aspect_ratio: seed.aspect_ratio,
    thumbnail_url: seed.thumbnail_url,
    user_id: ownerId,
    is_public: true,
    status: "completed",
    target_duration_minutes: 1,
  };

  const inserted = (await rest("movie_projects", {
    method: "POST",
    body: JSON.stringify(projectInsert),
  })) as Array<{ id: string }>;
  const projectId = inserted[0].id;
  console.log(`  ✓  inserted: ${seed.title}  (${projectId.slice(0, 8)})`);

  // Insert clips
  const clipsInsert = seed.clips.map((c, i) => ({
    project_id: projectId,
    user_id: ownerId,
    shot_index: i,
    prompt: c.prompt,
    duration_seconds: c.durationSec,
    video_url: c.videoUrl,
    status: "completed",
    start_image_url: seed.thumbnail_url,
  }));

  await rest("video_clips", {
    method: "POST",
    body: JSON.stringify(clipsInsert),
  });
  console.log(`     · ${seed.clips.length} clips`);
}

async function main() {
  console.log("Seeding public movie_projects + video_clips…\n");
  const ownerId = await getOwnerId();
  console.log(`Owner: ${ownerId.slice(0, 8)} (any signed-up user — all rows is_public=true)\n`);

  for (const seed of SEEDS) {
    await seedOne(seed, ownerId);
  }

  console.log("\nVerifying…");
  const all = (await rest(
    "movie_projects?select=id,title,is_public&is_public=eq.true&order=created_at.desc&limit=10",
  )) as Array<{ id: string; title: string; is_public: boolean }>;
  for (const row of all) {
    console.log(`  ${row.id.slice(0, 8)}  ${row.is_public ? "✓ public" : "✗ private"}  ${row.title}`);
  }

  console.log(`\n✓ Done. ${all.length} public project(s) in DB.`);
}

void main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
