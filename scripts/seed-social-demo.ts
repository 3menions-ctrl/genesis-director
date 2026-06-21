/**
 * seed-social-demo.ts
 *
 * Seeds the social graph with five demo creators + one published reel
 * each so the Lobby/Feed/Discover-people surfaces have real content
 * to render against on a fresh dev DB.
 *
 *   Creators get diverse `location`, `tags` (interests), and a varied
 *   bio so the upcoming "Discover people" filter has something to
 *   actually filter against.
 *
 *   The five videos are Google's public-domain gtv-videos-bucket
 *   samples — we link them directly (CDN-hosted, no upload needed,
 *   they've outlived every other free-sample CDN for a decade).
 *
 * Run:
 *   bunx tsx scripts/seed-social-demo.ts             # dry run
 *   bunx tsx scripts/seed-social-demo.ts --apply     # actually write
 *
 * Idempotent on the email address — re-running with --apply finds
 * existing demo users by email and updates their profile rows in
 * place rather than spawning duplicates.
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
const APPLY = process.argv.includes("--apply");

interface Demo {
  email: string;
  displayName: string;
  username: string;
  bio: string;
  tagline: string;
  location: string;       // human-readable city, country
  country: string;        // ISO-2-ish; loose
  tags: string[];         // shared-interests filter target
  reel: {
    title: string;
    synopsis: string;
    videoUrl: string;
    thumbnailUrl: string;
    durationSec: number;
    worldSlug: string;
    tags: string[];
  };
}

const DEMOS: Demo[] = [
  {
    email: "demo-mira@smallbridges.test",
    displayName: "Mira Holloway",
    username: "mira_holloway",
    bio: "Cinematographer turned AI director. Slow shots, long lenses, longer silences.",
    tagline: "Slow cinema, deeply filmed.",
    location: "Reykjavík, Iceland",
    country: "IS",
    tags: ["slow-cinema", "documentary", "nature", "experimental"],
    reel: {
      title: "Sintel — Opening Shots",
      synopsis: "A re-cut of Sintel's opening moments, scored for a winter premiere.",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
      thumbnailUrl: "https://picsum.photos/seed/sintel-opening/1280/720",
      durationSec: 60,
      worldSlug: "experi",
      tags: ["slow-cinema", "experimental", "nature"],
    },
  },
  {
    email: "demo-kenji@smallbridges.test",
    displayName: "Kenji Park",
    username: "kenji_park",
    bio: "Music-video director from Seoul. Three-minute eternities. Always running.",
    tagline: "If it doesn't move, it isn't done.",
    location: "Seoul, South Korea",
    country: "KR",
    tags: ["music-videos", "fashion", "neon", "kpop"],
    reel: {
      title: "For Bigger Blazes — Music Cut",
      synopsis: "Quick-cut music edit over a TV-sample short. One verse, one chorus.",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      thumbnailUrl: "https://picsum.photos/seed/blazes-music/1280/720",
      durationSec: 15,
      worldSlug: "music",
      tags: ["music-videos", "neon", "fashion"],
    },
  },
  {
    email: "demo-amaya@smallbridges.test",
    displayName: "Amaya Rivera",
    username: "amaya_rivera",
    bio: "Comedy short-form. Doc-style energy, sitcom timing. Mexico City + LA.",
    tagline: "Quick wit, slow takes, hot soup.",
    location: "Mexico City, Mexico",
    country: "MX",
    tags: ["comedy", "documentary", "shorts", "improv"],
    reel: {
      title: "Big Buck Bunny — Cold Open",
      synopsis: "Comedic cold-open cut of Big Buck Bunny. Good pacing study.",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      thumbnailUrl: "https://picsum.photos/seed/bunny-coldopen/1280/720",
      durationSec: 30,
      worldSlug: "comedy",
      tags: ["comedy", "shorts", "improv"],
    },
  },
  {
    email: "demo-otis@smallbridges.test",
    displayName: "Otis Bryne",
    username: "otis_bryne",
    bio: "Documentary editor. Eight years at the BBC. Now AI-augmenting verité.",
    tagline: "Truth, shot like fiction.",
    location: "Glasgow, Scotland",
    country: "GB",
    tags: ["documentary", "verité", "history", "nature"],
    reel: {
      title: "Elephant's Dream — Field Notes",
      synopsis: "Cut as a verité piece — diegetic only, no music, no captions.",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      thumbnailUrl: "https://picsum.photos/seed/elephant-fieldnotes/1280/720",
      durationSec: 90,
      worldSlug: "docu",
      tags: ["documentary", "verité", "nature"],
    },
  },
  {
    email: "demo-zara@smallbridges.test",
    displayName: "Zara Okonkwo",
    username: "zara_okonkwo",
    bio: "Sci-fi worldbuilder. Lagos → Berlin. Sometimes a sound designer.",
    tagline: "Tomorrow, today, and the wires in between.",
    location: "Berlin, Germany",
    country: "DE",
    tags: ["sci-fi", "worldbuilding", "sound-design", "afrofuturism"],
    reel: {
      title: "Tears of Steel — Hangar",
      synopsis: "Cut from the open-source Tears of Steel set — a hangar sequence stripped to silence.",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
      thumbnailUrl: "https://picsum.photos/seed/tearsofsteel-hangar/1280/720",
      durationSec: 120,
      worldSlug: "scifi",
      tags: ["sci-fi", "worldbuilding", "sound-design"],
    },
  },
];

async function rest(path: string, init: RequestInit = {}): Promise<any> {
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
  if (!res.ok) throw new Error(`REST ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function authAdmin(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AUTH ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function findUserByEmail(email: string): Promise<string | null> {
  // Auth admin list is paginated; for 5 demos this is fine.
  const body = await authAdmin(`users?per_page=200`, { method: "GET" });
  const list: Array<{ id: string; email?: string }> = body.users ?? [];
  const match = list.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

async function ensureUser(d: Demo): Promise<string> {
  const existing = await findUserByEmail(d.email);
  if (existing) {
    console.log(`✓ user exists: ${d.email} (${existing})`);
    return existing;
  }
  const created = await authAdmin("users", {
    method: "POST",
    body: JSON.stringify({
      email: d.email,
      email_confirm: true,
      password: crypto.randomUUID(),
      user_metadata: { display_name: d.displayName, demo: true },
    }),
  });
  const id = created.id as string;
  console.log(`+ created user ${d.email} → ${id}`);
  return id;
}

async function upsertProfile(d: Demo, userId: string) {
  const body = {
    id: userId,
    display_name: d.displayName,
    bio: d.bio,
    tagline: d.tagline,
    location: d.location,
    country: d.country,
    interests: d.tags,
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(d.username)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`,
  };
  await rest(`profiles?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(body),
  });
  console.log(`  profile updated: ${d.displayName} @ ${d.location}`);
}

async function ensureReel(d: Demo, userId: string) {
  // Idempotent: one demo project per user, identified by title.
  const found = await rest(
    `movie_projects?user_id=eq.${userId}&title=eq.${encodeURIComponent(d.reel.title)}&select=id`,
  );
  let projectId: string;
  if (Array.isArray(found) && found.length > 0) {
    projectId = found[0].id;
    console.log(`  project exists (${projectId.slice(0, 8)}…)`);
  } else {
    const proj = await rest(`movie_projects`, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        title: d.reel.title,
        status: "completed",
        is_public: true,
        video_url: d.reel.videoUrl,
        thumbnail_url: d.reel.thumbnailUrl,
        aspect_ratio: "16:9",
        mode: "text-to-video",
        video_engine: "wan",
      }),
    });
    projectId = proj[0].id;
    console.log(`  + project ${projectId.slice(0, 8)}… "${d.reel.title}"`);
  }

  const reelFound = await rest(
    `published_reels?project_id=eq.${projectId}&select=id`,
  );
  if (Array.isArray(reelFound) && reelFound.length > 0) {
    console.log(`  reel exists (${reelFound[0].id.slice(0, 8)}…)`);
    return;
  }
  const reel = await rest(`published_reels`, {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      creator_id: userId,
      title: d.reel.title,
      synopsis: d.reel.synopsis,
      video_url: d.reel.videoUrl,
      thumbnail_url: d.reel.thumbnailUrl,
      duration_sec: d.reel.durationSec,
      world_slug: d.reel.worldSlug,
      tags: d.reel.tags,
      play_count: Math.floor(Math.random() * 4000) + 800,
      like_count: Math.floor(Math.random() * 240) + 12,
      remix_count: Math.floor(Math.random() * 30),
    }),
  });
  console.log(`  + reel ${reel[0].id.slice(0, 8)}… published`);
}

async function main() {
  console.log(`\n▷ ${DEMOS.length} demo creators${APPLY ? " (apply)" : " (dry-run)"}\n`);
  if (!APPLY) {
    console.log("Would create:");
    for (const d of DEMOS) {
      console.log(`  - ${d.displayName} @ ${d.location} [${d.tags.join(", ")}]`);
      console.log(`      reel: ${d.reel.title}`);
    }
    console.log("\nRe-run with --apply to actually write.");
    return;
  }
  for (const d of DEMOS) {
    console.log(`▷ ${d.displayName}`);
    const userId = await ensureUser(d);
    await upsertProfile(d, userId);
    await ensureReel(d, userId);
    console.log();
  }
  console.log("✓ Seeded social demo content.");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
