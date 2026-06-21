/**
 * upload-videos-with-thumbnails.ts
 *
 * One-shot, idempotent.
 *   1. Scan ~/Downloads/ for every mp4/mov/webm.
 *   2. For each: extract a first-frame thumbnail via ffmpeg (which
 *      is now installed locally).
 *   3. Upload the video bytes to the `video-clips` bucket (upsert).
 *   4. Upload the thumbnail to the `editor-images` bucket (upsert).
 *   5. Upsert a row in `user_media_assets` via the record_user_media
 *      RPC with thumbnail_url set so the editor's Media Library,
 *      Studio chooser, and any other surface using thumbnails light up.
 *
 * Also runs as a backfill: if a video was already uploaded but the
 * existing row has no thumbnail_url, we generate one and patch it.
 *
 * Run:
 *   bunx tsx scripts/upload-videos-with-thumbnails.ts             # dry-run
 *   bunx tsx scripts/upload-videos-with-thumbnails.ts --apply     # do it
 */
import { readFileSync, readdirSync, statSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { homedir, tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";
const USER_EMAIL = "3menions@gmail.com";
const DOWNLOADS = resolve(homedir(), "Downloads");
const TMP_DIR = resolve(tmpdir(), "video-thumbs");
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".mkv"]);
const APPLY = process.argv.includes("--apply");

function loadServiceKey(): string {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const line = env.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}

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

function mimeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".mp4": return "video/mp4";
    case ".mov": return "video/quicktime";
    case ".webm": return "video/webm";
    case ".mkv": return "video/x-matroska";
    default: return "application/octet-stream";
  }
}

async function findUserId(): Promise<string> {
  const { data } = await supa.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const me = data.users.find((u) => (u.email ?? "").toLowerCase() === USER_EMAIL.toLowerCase());
  if (!me) throw new Error(`No auth user found for ${USER_EMAIL}`);
  return me.id;
}

/**
 * Extract a thumbnail at 0.5s (skipping any pure-black first frame).
 * Returns the local thumbnail path.
 */
function extractThumbnail(videoPath: string, outName: string): string | null {
  const out = resolve(TMP_DIR, `${outName}.jpg`);
  // -ss 0.5 seeks 0.5s in; many AI-generated clips have a black frame
  // at t=0 from a fade-in transition. -frames:v 1 grabs one frame.
  // -q:v 2 keeps quality high without bloating the file.
  const r = spawnSync("ffmpeg", [
    "-y", "-ss", "0.5", "-i", videoPath,
    "-frames:v", "1", "-q:v", "2",
    "-vf", "scale=640:-2",
    out,
  ], { stdio: "pipe" });
  if (r.status !== 0) {
    // eslint-disable-next-line no-console
    console.warn(`  ! ffmpeg failed for ${basename(videoPath)}: ${r.stderr?.toString().split("\n").slice(-3).join("\n")}`);
    return null;
  }
  return existsSync(out) ? out : null;
}

interface VideoFile {
  filename: string;
  localPath: string;
  slug: string;
  ext: string;
  title: string;
  size: number;
}

function discover(): VideoFile[] {
  return readdirSync(DOWNLOADS)
    .filter((f) => VIDEO_EXTS.has(extname(f).toLowerCase()))
    .map((filename) => {
      const localPath = resolve(DOWNLOADS, filename);
      return {
        filename,
        localPath,
        slug: slugify(filename),
        ext: extname(filename).toLowerCase(),
        title: titleFromName(filename),
        size: statSync(localPath).size,
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

async function uploadVideo(v: VideoFile, userId: string): Promise<string> {
  const storagePath = `${userId}/downloads/${v.slug}${v.ext}`;
  const bytes = readFileSync(v.localPath);
  const up = await supa.storage.from("video-clips").upload(storagePath, bytes, {
    contentType: mimeFor(v.ext),
    upsert: true,
  });
  if (up.error) throw new Error(`video upload: ${up.error.message}`);
  return supa.storage.from("video-clips").getPublicUrl(storagePath).data.publicUrl;
}

async function uploadThumbnail(thumbPath: string, userId: string, slug: string): Promise<string> {
  const storagePath = `${userId}/downloads/${slug}.jpg`;
  const bytes = readFileSync(thumbPath);
  const up = await supa.storage.from("video-thumbnails").upload(storagePath, bytes, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (up.error) throw new Error(`thumb upload: ${up.error.message}`);
  return supa.storage.from("video-thumbnails").getPublicUrl(storagePath).data.publicUrl;
}

interface ExistingAsset {
  id: string;
  asset_url: string;
  thumbnail_url: string | null;
}

async function fetchExistingAssets(userId: string): Promise<Map<string, ExistingAsset>> {
  const map = new Map<string, ExistingAsset>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supa
      .from("user_media_assets")
      .select("id, asset_url, thumbnail_url")
      .eq("user_id", userId)
      .eq("media_type", "video")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data as ExistingAsset[]) map.set(r.asset_url, r);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

async function main() {
  const userId = await findUserId();
  console.log(`User: ${USER_EMAIL} (${userId})\n`);

  const files = discover();
  console.log(`Found ${files.length} video file(s) in ~/Downloads`);

  const existing = await fetchExistingAssets(userId);
  console.log(`Existing user_media_assets video rows: ${existing.size}\n`);

  // Build a plan: for each local video, derive its expected public URL.
  // If that URL is already in existing → just need a thumbnail backfill
  // (if missing). Otherwise: full upload + thumb + insert.
  interface Plan { v: VideoFile; expectedUrl: string; existingId: string | null; needsVideoUpload: boolean; needsThumb: boolean; }
  const plan: Plan[] = files.map((v) => {
    const expectedUrl = `${SUPABASE_URL}/storage/v1/object/public/video-clips/${userId}/downloads/${v.slug}${v.ext}`;
    const ex = existing.get(expectedUrl);
    return {
      v,
      expectedUrl,
      existingId: ex?.id ?? null,
      needsVideoUpload: !ex,
      needsThumb: !ex || !ex.thumbnail_url || ex.thumbnail_url.startsWith("data:"),
    };
  });

  const newUploads = plan.filter((p) => p.needsVideoUpload).length;
  const thumbBackfills = plan.filter((p) => !p.needsVideoUpload && p.needsThumb).length;
  const allGood = plan.filter((p) => !p.needsVideoUpload && !p.needsThumb).length;

  console.log(`Plan:`);
  console.log(`  new video uploads:        ${newUploads}`);
  console.log(`  thumbnail backfills only: ${thumbBackfills}`);
  console.log(`  already complete:         ${allGood}`);
  console.log(`\nFiles needing work:`);
  for (const p of plan) {
    if (p.needsVideoUpload || p.needsThumb) {
      const tag = p.needsVideoUpload ? "[NEW]" : "[thumb]";
      console.log(`  ${tag.padEnd(8)} ${p.v.filename}  (${(p.v.size / 1048576).toFixed(1)} MB)`);
    }
  }

  if (!APPLY) {
    console.log(`\n[dry-run] re-run with --apply to upload + backfill.`);
    return;
  }

  let ok = 0, errs = 0;
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    if (!p.needsVideoUpload && !p.needsThumb) continue;
    try {
      let videoUrl = p.expectedUrl;
      if (p.needsVideoUpload) {
        videoUrl = await uploadVideo(p.v, userId);
      }
      let thumbUrl: string | null = null;
      if (p.needsThumb) {
        const localThumb = extractThumbnail(p.v.localPath, p.v.slug);
        if (localThumb) {
          thumbUrl = await uploadThumbnail(localThumb, userId, p.v.slug);
          try { unlinkSync(localThumb); } catch { /* ignore cleanup */ }
        }
      }
      if (p.needsVideoUpload) {
        // Insert (upsert) the user_media_assets row
        const { error: rpcErr } = await supa.rpc("record_user_media", {
          p_user_id:       userId,
          p_media_type:    "video",
          p_asset_url:     videoUrl,
          p_thumbnail_url: thumbUrl,
          p_source:        "manual-upload",
          p_title:         p.v.title,
          p_file_size_bytes: p.v.size,
          p_mime_type:     mimeFor(p.v.ext),
          p_metadata:      { origin: "local-downloads", filename: p.v.filename },
        });
        if (rpcErr) throw new Error(`record_user_media: ${rpcErr.message}`);
      } else if (thumbUrl && p.existingId) {
        // Backfill: patch the existing row's thumbnail_url
        const { error } = await supa
          .from("user_media_assets")
          .update({ thumbnail_url: thumbUrl })
          .eq("id", p.existingId);
        if (error) throw new Error(`thumb patch: ${error.message}`);
      }

      // Also mirror onto any matching video_clips row(s) so the editor's
      // timeline filmstrip + Library hover preview pick up the thumbnail.
      // start_image_url is the column the editor reads for poster frames.
      if (thumbUrl) {
        await supa
          .from("video_clips")
          .update({ start_image_url: thumbUrl })
          .eq("video_url", videoUrl)
          .is("start_image_url", null);
      }

      ok++;
      console.log(`  ✓ ${p.v.filename}`);
    } catch (e) {
      errs++;
      console.error(`  ✗ ${p.v.filename}: ${(e as Error).message}`);
    }
  }
  console.log(`\nDone. ok=${ok}  errors=${errs}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
