#!/usr/bin/env node
/**
 * Backfill durable final-film URLs (QA audit P0-1).
 *
 * Repairs movie_projects whose `video_url` is an EXPIRING reference (a Supabase
 * signed URL into the private `published-renders` bucket, or a raw
 * replicate.delivery URL) by re-resolving the still-stored master into durable
 * public storage. Films with no recoverable master are FLAGGED for re-stitch.
 *
 * SAFETY: dry-run by default; `--apply` required to write. Idempotent and
 * non-destructive. Run against DEV/STAGING first; NEVER prod without sign-off.
 *
 * Usage:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backfill-durable-video-urls.mjs [--apply] [--limit N] [--project <id>]
 *
 * See qa-audit/BACKFILL-durable-video-urls.md for the full plan.
 */

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : null;
})();
const ONLY_PROJECT = (() => {
  const i = args.indexOf("--project");
  return i >= 0 ? args[i + 1] : null;
})();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env. Aborting.");
  process.exit(1);
}
// Hard guard: refuse to touch the known prod ref unless explicitly forced.
const PROD_REF = "ywcwaumozoejierlfkgj";
if (SUPABASE_URL.includes(PROD_REF) && !args.includes("--i-understand-this-is-prod")) {
  console.error(
    `Refusing to run against prod (${PROD_REF}). Re-run with --i-understand-this-is-prod only after sign-off.`,
  );
  process.exit(1);
}

const RENDERS_BUCKET = "published-renders";
const DURABLE_BUCKET = "video-clips"; // public; same bucket the forward fix persists to
const FRESH_TTL = 60 * 10; // 10 min — only needs to live long enough to download

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Mirror of supabase/functions/_shared/url-durability.ts
function isExpiringUrl(url) {
  if (!url) return false;
  if (url.includes("replicate.delivery")) return true;
  if (url.includes("/storage/v1/object/sign/")) return true;
  return false;
}

/** Parse `<path-within-bucket>` out of a signed published-renders URL. */
function parseRendersPath(url) {
  const marker = `/storage/v1/object/sign/${RENDERS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length);
  return decodeURIComponent(rest.split("?")[0]); // strip token query
}

/** List the first .mp4 object under published-renders/<projectId>/. */
async function findMasterByProject(projectId) {
  const { data, error } = await supabase.storage
    .from(RENDERS_BUCKET)
    .list(projectId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error || !data) return null;
  const mp4 = data.find((o) => o.name.toLowerCase().endsWith(".mp4"));
  return mp4 ? `${projectId}/${mp4.name}` : null;
}

/** Confirm an object exists by HEAD through a fresh signed URL. */
async function objectExists(path) {
  const { data, error } = await supabase.storage
    .from(RENDERS_BUCKET)
    .createSignedUrl(path, FRESH_TTL);
  if (error || !data?.signedUrl) return null;
  try {
    const probe = await fetch(data.signedUrl, { method: "HEAD" });
    return probe.ok ? data.signedUrl : null;
  } catch {
    return null;
  }
}

/** Download the master and re-upload to durable public storage; return public URL. */
async function reResolve(projectId, masterPath, freshSignedUrl) {
  const res = await fetch(freshSignedUrl);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 1000) throw new Error(`too small: ${bytes.byteLength}b`);
  const key = `${projectId}/final_video_backfill_${Date.now()}.mp4`;
  const { error: upErr } = await supabase.storage
    .from(DURABLE_BUCKET)
    .upload(key, bytes, { contentType: "video/mp4", upsert: true });
  if (upErr) throw new Error(`upload: ${upErr.message}`);
  const { data } = supabase.storage.from(DURABLE_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

async function countCompletedClips(projectId) {
  const { count } = await supabase
    .from("video_clips")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("status", "completed")
    .not("video_url", "is", null);
  return count ?? 0;
}

async function main() {
  console.log(
    `[backfill] mode=${APPLY ? "APPLY" : "DRY-RUN"} target=${SUPABASE_URL}${LIMIT ? ` limit=${LIMIT}` : ""}${ONLY_PROJECT ? ` project=${ONLY_PROJECT}` : ""}`,
  );

  let q = supabase
    .from("movie_projects")
    .select("id, video_url, status, pending_video_tasks")
    .or("video_url.ilike.%/object/sign/%,video_url.ilike.%replicate.delivery%");
  if (ONLY_PROJECT) q = q.eq("id", ONLY_PROJECT);
  if (LIMIT) q = q.limit(LIMIT);

  const { data: rows, error } = await q;
  if (error) {
    console.error("[backfill] query failed:", error.message);
    process.exit(1);
  }

  const summary = {
    scanned: rows.length,
    tierA: 0,
    tierB: 0,
    tierC_needs_restitch: [],
    tierD_unrecoverable: [],
    repaired: 0,
    failed: [],
    skipped_durable: 0,
  };

  for (const row of rows) {
    try {
      if (!isExpiringUrl(row.video_url)) {
        summary.skipped_durable++;
        continue;
      }

      // Find a recoverable master object.
      let masterPath = parseRendersPath(row.video_url); // Tier A candidate
      let freshUrl = masterPath ? await objectExists(masterPath) : null;

      if (!freshUrl) {
        // Tier B: maybe a renders object exists under the project even though the
        // stored URL was a (dead) replicate.delivery link or a stale path.
        const found = await findMasterByProject(row.id);
        if (found) {
          masterPath = found;
          freshUrl = await objectExists(found);
        }
      }

      if (freshUrl && masterPath) {
        const tier = parseRendersPath(row.video_url) ? "A" : "B";
        tier === "A" ? summary.tierA++ : summary.tierB++;
        if (APPLY) {
          const publicUrl = await reResolve(row.id, masterPath, freshUrl);
          const { error: updErr } = await supabase
            .from("movie_projects")
            .update({ video_url: publicUrl, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          if (updErr) throw new Error(`update: ${updErr.message}`);
          summary.repaired++;
          console.log(`[backfill] ✓ Tier ${tier} repaired ${row.id}`);
        } else {
          console.log(`[backfill] would repair (Tier ${tier}) ${row.id} ← ${masterPath}`);
        }
        continue;
      }

      // No master object — re-stitch territory.
      const clips = await countCompletedClips(row.id);
      if (clips > 0) {
        summary.tierC_needs_restitch.push(row.id);
        if (APPLY) {
          await supabase
            .from("movie_projects")
            .update({
              pending_video_tasks: { ...(row.pending_video_tasks || {}), needs_restitch: true },
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
        console.log(`[backfill] ⚠ Tier C needs re-stitch ${row.id} (${clips} clips)`);
      } else {
        summary.tierD_unrecoverable.push(row.id);
        console.log(`[backfill] ✗ Tier D unrecoverable ${row.id}`);
      }
    } catch (e) {
      summary.failed.push({ id: row.id, error: e.message });
      console.error(`[backfill] FAILED ${row.id}: ${e.message}`);
    }
  }

  console.log("\n[backfill] SUMMARY");
  console.log(JSON.stringify({
    scanned: summary.scanned,
    skipped_durable: summary.skipped_durable,
    tierA_reresolved: summary.tierA,
    tierB_reresolved_from_storage: summary.tierB,
    tierC_needs_restitch: summary.tierC_needs_restitch.length,
    tierD_unrecoverable: summary.tierD_unrecoverable.length,
    repaired_written: summary.repaired,
    failed: summary.failed.length,
  }, null, 2));
  if (summary.tierC_needs_restitch.length) {
    console.log("Tier C (re-stitch):", summary.tierC_needs_restitch.join(", "));
  }
  if (summary.tierD_unrecoverable.length) {
    console.log("Tier D (manual):", summary.tierD_unrecoverable.join(", "));
  }
  if (summary.failed.length) console.log("Failures:", JSON.stringify(summary.failed, null, 2));
  if (!APPLY) console.log("\nDRY-RUN — nothing written. Re-run with --apply to repair.");
}

main().catch((e) => {
  console.error("[backfill] fatal:", e);
  process.exit(1);
});
