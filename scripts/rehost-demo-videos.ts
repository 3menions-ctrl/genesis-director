/**
 * rehost-demo-videos.ts — upload the 5 downloaded CC0 films into the
 * `final-videos` Supabase bucket and swap each `published_reels.video_url`
 * (+ matching `movie_projects.video_url`) to point at the rehosted asset.
 *
 *   Assumes the .mp4/.mov files already exist in /tmp/sb-demo/ (run the
 *   curl block in the README first, or just curl them in this shell).
 *
 * Idempotent: re-uploading the same path overwrites.
 *
 * Run:
 *   bunx tsx scripts/rehost-demo-videos.ts --apply
 */
import { readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

interface Job {
  /** the local file already on disk */
  localPath: string;
  /** how we'll name it inside the bucket (storage key) */
  storagePath: string;
  contentType: string;
  /** reel + project to retarget */
  reelId: string;
  projectId: string;
  /** display label for logs */
  label: string;
}

// Reel IDs are stable from the earlier seed pass.
const JOBS: Job[] = [
  {
    localPath: "/tmp/sb-demo/bbb.mp4",
    storagePath: "demo/big-buck-bunny-720p.mp4",
    contentType: "video/mp4",
    reelId: "15229b98-65b3-4e2a-9eee-c9f0e8e1ee08",        // resolved at runtime via title-lookup if needed
    projectId: "f90f7b9e-0000-0000-0000-000000000000",
    label: "Big Buck Bunny",
  },
  {
    localPath: "/tmp/sb-demo/sintel.mp4",
    storagePath: "demo/sintel-1080p-trailer.mp4",
    contentType: "video/mp4",
    reelId: "8bd5b6c9-0000-0000-0000-000000000000",
    projectId: "5d0ac06e-0000-0000-0000-000000000000",
    label: "Sintel",
  },
  {
    localPath: "/tmp/sb-demo/ed.mp4",
    storagePath: "demo/elephants-dream-hd.mp4",
    contentType: "video/mp4",
    reelId: "eb18123c-0000-0000-0000-000000000000",
    projectId: "f5e32cba-0000-0000-0000-000000000000",
    label: "Elephant's Dream",
  },
  {
    localPath: "/tmp/sb-demo/tos.mov",
    storagePath: "demo/tears-of-steel-720p.mov",
    contentType: "video/quicktime",
    reelId: "4cfd8446-0000-0000-0000-000000000000",
    projectId: "97f75ed4-0000-0000-0000-000000000000",
    label: "Tears of Steel",
  },
  {
    localPath: "/tmp/sb-demo/sintel-720.mp4",
    storagePath: "demo/sintel-720p-trailer.mp4",
    contentType: "video/mp4",
    reelId: "9d8362be-0000-0000-0000-000000000000",
    projectId: "5dd1a321-0000-0000-0000-000000000000",
    label: "For Bigger Blazes (replaced w/ Sintel 720p trailer)",
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

/** Resolve reel + project ids by title since the seed UUIDs aren't pinned. */
async function resolveRealIds() {
  const reels = await rest(
    `published_reels?select=id,title,project_id&order=created_at.desc&limit=20`,
  );
  const byTitle = new Map<string, { id: string; project_id: string }>();
  for (const r of reels as Array<{ id: string; title: string; project_id: string }>) {
    byTitle.set(r.title, { id: r.id, project_id: r.project_id });
  }
  const swap = (label: string, fragment: string) => {
    for (const [t, info] of byTitle) {
      if (t.toLowerCase().includes(fragment.toLowerCase())) return info;
    }
    throw new Error(`No reel found matching "${fragment}" for ${label}`);
  };
  JOBS[0] = { ...JOBS[0], ...swap(JOBS[0].label, "Big Buck Bunny") };
  JOBS[1] = { ...JOBS[1], ...swap(JOBS[1].label, "Sintel — Opening") };
  JOBS[2] = { ...JOBS[2], ...swap(JOBS[2].label, "Elephant") };
  JOBS[3] = { ...JOBS[3], ...swap(JOBS[3].label, "Tears of Steel") };
  JOBS[4] = { ...JOBS[4], ...swap(JOBS[4].label, "For Bigger Blazes") };

  // Patch the renamed 5th reel so the title fits its new content.
  await rest(
    `published_reels?id=eq.${JOBS[4].reelId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        title: "Sintel — Trailer Cut",
        synopsis: "A 50s 720p trailer cut of Sintel, swapped in for the original For Bigger Blazes placeholder.",
      }),
    },
  );
}

async function uploadFile(job: Job): Promise<string> {
  const bytes = readFileSync(job.localPath);
  const size = statSync(job.localPath).size;
  console.log(`  uploading ${job.storagePath} (${(size / 1024 / 1024).toFixed(1)} MB)…`);
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/final-videos/${job.storagePath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        "Content-Type": job.contentType,
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!res.ok) {
    throw new Error(`upload ${job.storagePath} → ${res.status}: ${await res.text()}`);
  }
  // final-videos is a public bucket; the canonical URL is /object/public/<path>
  return `${SUPABASE_URL}/storage/v1/object/public/final-videos/${job.storagePath}`;
}

async function main() {
  if (!APPLY) {
    console.log("Dry-run — re-invoke with --apply to actually rehost.");
    return;
  }
  console.log("▷ Resolving reel/project ids…");
  await resolveRealIds();

  for (const job of JOBS) {
    console.log(`\n▷ ${job.label}`);
    const url = await uploadFile(job);
    await rest(`published_reels?id=eq.${job.reelId}`, {
      method: "PATCH",
      body: JSON.stringify({ video_url: url }),
    });
    await rest(`movie_projects?id=eq.${job.projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ video_url: url }),
    });
    console.log(`  ✓ swapped → ${url.slice(0, 80)}…`);
  }
  console.log("\n✓ All 5 reels now point at the rehosted assets.");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
