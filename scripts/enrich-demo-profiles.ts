/**
 * enrich-demo-profiles.ts — flesh out the 5 demo creators with the
 * full identity kit the Profile page expects:
 *   - real face avatars (i.pravatar.cc)
 *   - cinematic cover images (picsum.photos)
 *   - external links (the social rail on Profile)
 *   - account_type, longer bio, pinned reel
 *
 * Idempotent — re-runnable without producing duplicates.
 *
 * Run:
 *   bunx tsx scripts/enrich-demo-profiles.ts --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";

function loadServiceKey(): string {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const line = env
    .split("\n")
    .find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}

const KEY = loadServiceKey();
const APPLY = process.argv.includes("--apply");

interface Patch {
  email: string;
  displayName: string;        // identity to find the user by email
  bio: string;                 // longer than the seed bio — more profile-page-ready
  tagline: string;
  avatar_url: string;
  cover_url: string;
  account_type: "personal" | "business";
  external_links: Record<string, string>;
}

const PATCHES: Patch[] = [
  {
    email: "demo-mira@smallbridges.test",
    displayName: "Mira Holloway",
    bio: "Cinematographer turned AI director, based in Reykjavík. I shoot long takes in low light, and let weather do half the work. Most of my reels start with a still I couldn't stop looking at.",
    tagline: "Slow cinema, deeply filmed.",
    avatar_url: "https://i.pravatar.cc/600?u=mira-holloway",
    cover_url: "https://picsum.photos/seed/mira-iceland-coastline/2400/1000",
    account_type: "personal",
    external_links: {
      website: "https://miraholloway.example",
      instagram: "https://instagram.com/miraholloway",
      youtube: "https://youtube.com/@miraholloway",
    },
  },
  {
    email: "demo-kenji@smallbridges.test",
    displayName: "Kenji Park",
    bio: "Music videos out of Seoul. I cut tight, score loud, and treat every frame like a sleeve. If it doesn't move on the second beat, it isn't done.",
    tagline: "If it doesn't move, it isn't done.",
    avatar_url: "https://i.pravatar.cc/600?u=kenji-park",
    cover_url: "https://picsum.photos/seed/kenji-neon-seoul/2400/1000",
    account_type: "personal",
    external_links: {
      website: "https://kenjipark.example",
      instagram: "https://instagram.com/kenjipark",
      tiktok: "https://tiktok.com/@kenjipark",
      youtube: "https://youtube.com/@kenjipark",
    },
  },
  {
    email: "demo-amaya@smallbridges.test",
    displayName: "Amaya Rivera",
    bio: "Short-form comedy with doc-style energy. CDMX kid, LA habits. I cast my friends, write in a notebook, and refuse to do reaction shots.",
    tagline: "Quick wit, slow takes, hot soup.",
    avatar_url: "https://i.pravatar.cc/600?u=amaya-rivera",
    cover_url: "https://picsum.photos/seed/amaya-cdmx-street/2400/1000",
    account_type: "personal",
    external_links: {
      website: "https://amayarivera.example",
      instagram: "https://instagram.com/amayarivera",
      tiktok: "https://tiktok.com/@amayarivera",
    },
  },
  {
    email: "demo-otis@smallbridges.test",
    displayName: "Otis Bryne",
    bio: "Eight years at the BBC cutting verité. Now AI-augmenting the same instincts: diegetic only, no captions, no music unless the room had it.",
    tagline: "Truth, shot like fiction.",
    avatar_url: "https://i.pravatar.cc/600?u=otis-bryne",
    cover_url: "https://picsum.photos/seed/otis-scotland-fog/2400/1000",
    account_type: "personal",
    external_links: {
      website: "https://otisbryne.example",
      twitter: "https://twitter.com/otisbryne",
      youtube: "https://youtube.com/@otisbryne",
    },
  },
  {
    email: "demo-zara@smallbridges.test",
    displayName: "Zara Okonkwo",
    bio: "Sci-fi worldbuilding. Born in Lagos, working from Berlin. I score everything before I shoot it — the synth patch dictates the lens.",
    tagline: "Tomorrow, today, and the wires in between.",
    avatar_url: "https://i.pravatar.cc/600?u=zara-okonkwo",
    cover_url: "https://picsum.photos/seed/zara-berlin-brutalism/2400/1000",
    account_type: "personal",
    external_links: {
      website: "https://zaraokonkwo.example",
      instagram: "https://instagram.com/zaraokonkwo",
      twitter: "https://twitter.com/zaraokonkwo",
      github: "https://github.com/zaraokonkwo",
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

async function authAdmin(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AUTH ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function findUserId(email: string): Promise<string> {
  const body = await authAdmin("users?per_page=200");
  const list: Array<{ id: string; email?: string }> = body.users ?? [];
  const match = list.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (!match) throw new Error(`No auth user for ${email}`);
  return match.id;
}

async function findPinnedReelId(userId: string): Promise<string | null> {
  const rows = await rest(
    `published_reels?creator_id=eq.${userId}&select=id&order=created_at.desc&limit=1`,
  );
  return Array.isArray(rows) && rows.length > 0 ? rows[0].id : null;
}

async function main() {
  if (!APPLY) {
    console.log("Dry-run. Re-invoke with --apply.");
    return;
  }
  for (const p of PATCHES) {
    console.log(`▷ ${p.displayName}`);
    const userId = await findUserId(p.email);
    const reelId = await findPinnedReelId(userId);
    await rest(`profiles?id=eq.${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        bio: p.bio,
        tagline: p.tagline,
        avatar_url: p.avatar_url,
        cover_url: p.cover_url,
        account_type: p.account_type,
        external_links: p.external_links,
        pinned_reel_ids: reelId ? [reelId] : [],
        is_discoverable: true,
      }),
    });
    console.log(`  ✓ updated  pinned_reel=${reelId ? reelId.slice(0, 8) + "…" : "—"}`);
  }
  console.log("\n✓ Enriched 5 demo profiles.");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
