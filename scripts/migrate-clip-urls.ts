/**
 * migrate-clip-urls.ts — fix expired Replicate URLs in the database.
 *
 * The problem this fixes:
 *   Replicate's delivery URLs (replicate.delivery/yhqm/...) expire
 *   ~24 hours after the prediction completes. Many video_clips,
 *   shot_takes, start_image_url, and last_frame_url rows in the
 *   database point at delivery URLs that have since 404'd, so
 *   <video src=...> fails silently and playback breaks for every
 *   project older than a day.
 *
 * What this does:
 *   1. Lists every video_clips and shot_takes row.
 *   2. For each URL field (video_url, start_image_url, last_frame_url,
 *      thumbnail_url), checks whether it points at replicate.delivery
 *      or any other ephemeral host.
 *   3. Attempts to fetch the URL. If it returns 200, uploads the
 *      bytes to our 'video-clips' (or 'editor-images') bucket. If
 *      it 404s, marks the row as `status='failed'` so the editor
 *      shows the "still rendering / failed" empty state instead of
 *      a broken <video>.
 *   4. Updates the row to point at the new stable URL.
 *
 * Idempotency:
 *   Rows whose URL is already a supabase storage URL or any other
 *   non-ephemeral domain are skipped. Re-running the script is
 *   safe and cheap — it just does the GETs needed to confirm.
 *
 * Run:
 *   bunx tsx scripts/migrate-clip-urls.ts             # dry run
 *   bunx tsx scripts/migrate-clip-urls.ts --apply     # actually mutate
 *   bunx tsx scripts/migrate-clip-urls.ts --apply --project=<uuid>
 *                                                    # one project only
 *
 * Safety:
 *   - Dry run is the default. You see every action before it happens.
 *   - --apply requires explicit flag. No accidental writes.
 *   - --project scopes the migration to one project for testing.
 *   - On any unexpected error, the script logs the row id and
 *     continues — never aborts the whole run.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";

// Replicate's CDN — the ephemeral host we care about.
const REPLICATE_HOST_RE = /^https?:\/\/(?:replicate\.delivery|[a-z0-9]+\.weights\.replicate\.delivery)/i;

// Other ephemeral hosts the pipeline may have stored at some point.
const OTHER_EPHEMERAL_HOSTS_RE = /^https?:\/\/(?:storage\.googleapis\.com\/falai|fal\.ai\/cdn|cdn\.openai\.com\/.+\/temp)/i;

function isEphemeralUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return REPLICATE_HOST_RE.test(url) || OTHER_EPHEMERAL_HOSTS_RE.test(url);
}

function loadServiceKey(): string {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const line = env
    .split("\n")
    .find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}

const KEY = loadServiceKey();

interface CliArgs {
  apply: boolean;
  projectId: string | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const projectFlag = args.find((a) => a.startsWith("--project="));
  const projectId = projectFlag ? projectFlag.slice("--project=".length) : null;
  return { apply, projectId };
}

const CLI = parseArgs();

// ─────────────────────────────────────────────────────────────────────────────
// REST helpers — service-role authenticated supabase calls
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers — upload via the storage REST API
// ─────────────────────────────────────────────────────────────────────────────

/** Probe a URL with a HEAD-equivalent GET so we can distinguish a
 *  live URL from a 404 without downloading the whole file when the
 *  URL is dead. We use `Range: bytes=0-0` because some CDNs don't
 *  honor HEAD. */
async function probe(url: string): Promise<{ ok: boolean; status: number; contentType: string | null }> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
    });
    // Consume the body so the socket can be reused.
    try { await res.arrayBuffer(); } catch { /* ignored */ }
    return {
      ok: res.ok || res.status === 206,
      status: res.status,
      contentType: res.headers.get("content-type"),
    };
  } catch {
    return { ok: false, status: 0, contentType: null };
  }
}

/** Download bytes from an ephemeral URL. Returns null when the URL
 *  is dead (404/403/network error). */
async function download(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/** Upload bytes to a supabase storage bucket. Returns the public URL
 *  on success. Uses upsert so re-runs replace any partial uploads
 *  cleanly. */
async function upload(
  bucket: string,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!res.ok) {
    const t = await res.text();
    console.warn(`  ⚠  upload ${path} → ${res.status}: ${t}`);
    return null;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration core
// ─────────────────────────────────────────────────────────────────────────────

interface ClipRow {
  id: string;
  project_id: string;
  user_id: string;
  video_url: string | null;
  start_image_url: string | null;
  last_frame_url: string | null;
  status: string | null;
}

interface TakeRow {
  id: string;
  project_id: string;
  shot_index: number;
  take_number: number;
  video_url: string | null;
  thumbnail_url: string | null;
  status: string | null;
}

interface MigrationReport {
  rowsScanned: number;
  rowsTouched: number;
  rowsFailed: number;
  urlsMigrated: number;
  urlsDead: number;
  urlsSkipped: number;
}

const report: MigrationReport = {
  rowsScanned: 0,
  rowsTouched: 0,
  rowsFailed: 0,
  urlsMigrated: 0,
  urlsDead: 0,
  urlsSkipped: 0,
};

/** Pick the right bucket + path for a given URL kind. Videos go in
 *  video-clips; images (start_image / thumbnail / last_frame) go in
 *  editor-images so the buckets stay coherent. */
function targetForUrl(
  userId: string,
  rowId: string,
  field: "video_url" | "start_image_url" | "last_frame_url" | "thumbnail_url",
  contentType: string | null,
): { bucket: string; path: string; contentType: string } {
  const isVideo =
    field === "video_url" ||
    (contentType?.startsWith("video/") ?? false);
  if (isVideo) {
    return {
      bucket: "video-clips",
      path: `${userId}/migrated/${rowId}.mp4`,
      contentType: contentType ?? "video/mp4",
    };
  }
  return {
    bucket: "editor-images",
    path: `${userId}/migrated/${rowId}-${field}.png`,
    contentType: contentType ?? "image/png",
  };
}

/** Migrate one URL field on a row. Returns the new URL when changed,
 *  null when the URL was dead, or the original URL when it was
 *  already stable. */
async function migrateField(
  url: string | null,
  userId: string,
  rowId: string,
  field: "video_url" | "start_image_url" | "last_frame_url" | "thumbnail_url",
): Promise<{ kind: "ok" | "dead" | "skip"; newUrl: string | null }> {
  if (!url) return { kind: "skip", newUrl: null };
  if (!isEphemeralUrl(url)) {
    report.urlsSkipped += 1;
    return { kind: "skip", newUrl: url };
  }

  const head = await probe(url);
  if (!head.ok) {
    console.log(`  ✗  DEAD  ${field}  ${url.slice(0, 90)}…  (status ${head.status})`);
    report.urlsDead += 1;
    return { kind: "dead", newUrl: null };
  }

  if (!CLI.apply) {
    console.log(`  ↻  WOULD-MIGRATE  ${field}  ${url.slice(0, 90)}…`);
    report.urlsMigrated += 1;
    return { kind: "ok", newUrl: url }; // pretend
  }

  const bytes = await download(url);
  if (!bytes) {
    console.log(`  ✗  FAILED-DL  ${field}  ${url.slice(0, 90)}…`);
    report.urlsDead += 1;
    return { kind: "dead", newUrl: null };
  }
  const target = targetForUrl(userId, rowId, field, head.contentType);
  const newUrl = await upload(target.bucket, target.path, bytes, target.contentType);
  if (!newUrl) {
    return { kind: "dead", newUrl: null };
  }
  console.log(`  ✓  MIGRATED  ${field}  →  ${target.bucket}/${target.path}`);
  report.urlsMigrated += 1;
  return { kind: "ok", newUrl };
}

async function migrateClip(row: ClipRow): Promise<void> {
  report.rowsScanned += 1;

  const videoResult = await migrateField(row.video_url, row.user_id, row.id, "video_url");
  const startResult = await migrateField(row.start_image_url, row.user_id, row.id, "start_image_url");
  const lastResult = await migrateField(row.last_frame_url, row.user_id, row.id, "last_frame_url");

  const patch: Record<string, string | null> = {};
  if (videoResult.kind === "ok" && videoResult.newUrl !== row.video_url) {
    patch.video_url = videoResult.newUrl;
  }
  if (videoResult.kind === "dead") {
    patch.video_url = null;
    patch.status = "failed";
  }
  if (startResult.kind === "ok" && startResult.newUrl !== row.start_image_url) {
    patch.start_image_url = startResult.newUrl;
  }
  if (startResult.kind === "dead") {
    patch.start_image_url = null;
  }
  if (lastResult.kind === "ok" && lastResult.newUrl !== row.last_frame_url) {
    patch.last_frame_url = lastResult.newUrl;
  }
  if (lastResult.kind === "dead") {
    patch.last_frame_url = null;
  }

  if (Object.keys(patch).length === 0) return;

  if (!CLI.apply) {
    console.log(`  ↻  WOULD-PATCH  clip ${row.id.slice(0, 8)}  ${JSON.stringify(patch).slice(0, 120)}`);
    report.rowsTouched += 1;
    return;
  }

  try {
    await rest(`video_clips?id=eq.${row.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    report.rowsTouched += 1;
  } catch (e) {
    report.rowsFailed += 1;
    console.warn(`  ⚠  PATCH-FAIL  clip ${row.id.slice(0, 8)}:`, e);
  }
}

async function migrateTake(row: TakeRow): Promise<void> {
  report.rowsScanned += 1;

  const videoResult = await migrateField(row.video_url, "system", row.id, "video_url");
  const thumbResult = await migrateField(row.thumbnail_url, "system", row.id, "thumbnail_url");

  const patch: Record<string, string | null> = {};
  if (videoResult.kind === "ok" && videoResult.newUrl !== row.video_url) {
    patch.video_url = videoResult.newUrl;
  }
  if (videoResult.kind === "dead") {
    patch.video_url = null;
    patch.status = "failed";
  }
  if (thumbResult.kind === "ok" && thumbResult.newUrl !== row.thumbnail_url) {
    patch.thumbnail_url = thumbResult.newUrl;
  }
  if (thumbResult.kind === "dead") {
    patch.thumbnail_url = null;
  }

  if (Object.keys(patch).length === 0) return;

  if (!CLI.apply) {
    console.log(`  ↻  WOULD-PATCH  take ${row.id.slice(0, 8)}  ${JSON.stringify(patch).slice(0, 120)}`);
    report.rowsTouched += 1;
    return;
  }

  try {
    await rest(`shot_takes?id=eq.${row.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    report.rowsTouched += 1;
  } catch (e) {
    report.rowsFailed += 1;
    console.warn(`  ⚠  PATCH-FAIL  take ${row.id.slice(0, 8)}:`, e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver
// ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("─── Replicate URL migration ───");
  console.log(`Mode: ${CLI.apply ? "APPLY (will write)" : "DRY RUN (no writes)"}`);
  if (CLI.projectId) console.log(`Scope: project ${CLI.projectId}`);
  else console.log("Scope: all projects");
  console.log("");

  // Pull every video_clips row, scoped by project when --project flag set.
  const clipFilter = CLI.projectId ? `project_id=eq.${CLI.projectId}` : "";
  const clipQuery = clipFilter
    ? `video_clips?select=id,project_id,user_id,video_url,start_image_url,last_frame_url,status&${clipFilter}&order=created_at.asc`
    : `video_clips?select=id,project_id,user_id,video_url,start_image_url,last_frame_url,status&order=created_at.asc`;
  console.log("Fetching clips…");
  const clips = (await rest(clipQuery)) as ClipRow[];
  console.log(`  ${clips.length} clip rows`);

  for (let i = 0; i < clips.length; i++) {
    const row = clips[i];
    process.stdout.write(`  [${i + 1}/${clips.length}] clip ${row.id.slice(0, 8)}\n`);
    await migrateClip(row);
  }

  // Pull every shot_takes row.
  console.log("");
  console.log("Fetching takes…");
  const takeFilter = CLI.projectId ? `project_id=eq.${CLI.projectId}` : "";
  const takeQuery = takeFilter
    ? `shot_takes?select=id,project_id,shot_index,take_number,video_url,thumbnail_url,status&${takeFilter}&order=created_at.asc`
    : `shot_takes?select=id,project_id,shot_index,take_number,video_url,thumbnail_url,status&order=created_at.asc`;
  const takes = (await rest(takeQuery)) as TakeRow[];
  console.log(`  ${takes.length} take rows`);

  for (let i = 0; i < takes.length; i++) {
    const row = takes[i];
    process.stdout.write(`  [${i + 1}/${takes.length}] take ${row.id.slice(0, 8)}\n`);
    await migrateTake(row);
  }

  console.log("");
  console.log("─── Done ───");
  console.log(`Rows scanned : ${report.rowsScanned}`);
  console.log(`Rows touched : ${report.rowsTouched}`);
  console.log(`Rows failed  : ${report.rowsFailed}`);
  console.log(`URLs migrated: ${report.urlsMigrated}`);
  console.log(`URLs dead    : ${report.urlsDead}`);
  console.log(`URLs skipped : ${report.urlsSkipped} (already stable)`);
  console.log("");
  if (!CLI.apply) {
    console.log("This was a DRY RUN. Re-run with --apply to actually write.");
  }
}

void main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
