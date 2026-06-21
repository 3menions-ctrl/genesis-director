/**
 * upload-downloads-to-media-library.ts
 *
 * One-shot: take the 9 mp4 clips currently in ~/Downloads/ (Cinematic_Short_*,
 * Adorable_Intruder_*, Meet_Hoppy_*), upload them to the `video-clips` bucket
 * under the user's namespace, and register each as a video row in
 * `user_media_assets` so they appear in the editor's Media Library (Mine tab).
 *
 * Idempotent — `record_user_media` upserts on (user_id, asset_url) and the
 * storage upload uses upsert=true. Safe to re-run.
 *
 * Run:
 *   bunx tsx scripts/upload-downloads-to-media-library.ts --apply
 *
 * Without --apply it dry-runs (lists what it would do).
 */
import { readFileSync, statSync, readdirSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";
const USER_EMAIL = "3menions@gmail.com";
const DOWNLOADS = resolve(homedir(), "Downloads");
const PATTERNS = [/^Cinematic_Short_.*\.mp4$/i, /^Adorable_Intruder_.*\.mp4$/i, /^Meet_Hoppy_.*\.mp4$/i];

function loadServiceKey(): string {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const line = env.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}

const APPLY = process.argv.includes("--apply");
const supa = createClient(SUPABASE_URL, loadServiceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function slugify(name: string): string {
  return name
    .replace(/\.[a-zA-Z0-9]{2,5}$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "upload";
}

function titleFromName(name: string): string {
  return name
    .replace(/\.[a-zA-Z0-9]{2,5}$/, "")
    .replace(/[-_.]+/g, " ")
    .trim()
    .slice(0, 80) || "Upload";
}

async function findUserId(): Promise<string> {
  const { data, error } = await supa.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const match = data.users.find((u) => (u.email ?? "").toLowerCase() === USER_EMAIL.toLowerCase());
  if (!match) throw new Error(`No auth user found for ${USER_EMAIL}`);
  return match.id;
}

interface Job {
  localPath: string;
  filename: string;
  storagePath: string;
  title: string;
  size: number;
}

function discoverJobs(userId: string): Job[] {
  const all = readdirSync(DOWNLOADS);
  const matches = all.filter((f) => PATTERNS.some((p) => p.test(f)));
  return matches.map((filename) => {
    const localPath = resolve(DOWNLOADS, filename);
    const size = statSync(localPath).size;
    const ext = (extname(filename) || ".mp4").slice(1).toLowerCase();
    return {
      localPath,
      filename,
      storagePath: `${userId}/downloads/${slugify(filename)}.${ext}`,
      title: titleFromName(filename),
      size,
    };
  });
}

async function uploadOne(job: Job, userId: string): Promise<void> {
  const bytes = readFileSync(job.localPath);
  const up = await supa.storage.from("video-clips").upload(job.storagePath, bytes, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (up.error) throw new Error(`storage upload failed: ${up.error.message}`);

  const pub = supa.storage.from("video-clips").getPublicUrl(job.storagePath);
  const assetUrl = pub.data.publicUrl;

  const { data: id, error: rpcErr } = await supa.rpc("record_user_media", {
    p_user_id: userId,
    p_media_type: "video",
    p_asset_url: assetUrl,
    p_source: "manual-upload",
    p_title: job.title,
    p_file_size_bytes: job.size,
    p_mime_type: "video/mp4",
    p_metadata: { origin: "local-downloads", filename: job.filename },
  });
  if (rpcErr) throw new Error(`record_user_media failed: ${rpcErr.message}`);

  console.log(`  ✓ ${job.filename} → ${assetUrl} (asset id: ${id})`);
}

async function main(): Promise<void> {
  const userId = await findUserId();
  console.log(`User: ${USER_EMAIL} → ${userId}`);

  const jobs = discoverJobs(userId);
  if (jobs.length === 0) {
    console.log("No matching files found in ~/Downloads/");
    return;
  }

  console.log(`\nFound ${jobs.length} file(s) to upload:`);
  for (const j of jobs) {
    console.log(`  • ${j.filename}  (${(j.size / 1048576).toFixed(1)} MB) → video-clips/${j.storagePath}`);
  }

  if (!APPLY) {
    console.log("\n[dry-run] re-run with --apply to upload.");
    return;
  }

  console.log("\nUploading…");
  for (const job of jobs) {
    try {
      await uploadOne(job, userId);
    } catch (e) {
      console.error(`  ✗ ${job.filename}: ${(e as Error).message}`);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
