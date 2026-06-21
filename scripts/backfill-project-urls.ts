/**
 * backfill-project-urls.ts
 *
 * One-shot: for every movie_projects row that has at least one
 * completed video_clip but NULL video_url / thumbnail_url, copy the
 * first clip's URLs onto the project. Unblocks Library cards (which
 * show a placeholder when thumbnail_url is null) and Reel/Theater
 * playback (which says "Still rendering…" when video_url is null).
 *
 * Idempotent — only touches rows with NULL columns.
 *
 * Run:
 *   bunx tsx scripts/backfill-project-urls.ts             # dry-run
 *   bunx tsx scripts/backfill-project-urls.ts --apply     # do it
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";
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

interface Project { id: string; title: string | null; video_url: string | null; thumbnail_url: string | null; }
interface Clip    { project_id: string; video_url: string | null; start_image_url: string | null; shot_index: number; }

async function main() {
  // Find projects missing video_url OR thumbnail_url
  const { data: projects, error } = await supa
    .from("movie_projects")
    .select("id, title, video_url, thumbnail_url")
    .or("video_url.is.null,thumbnail_url.is.null");
  if (error) throw error;
  const candidates = (projects ?? []) as Project[];
  console.log(`Projects missing video_url or thumbnail_url: ${candidates.length}`);
  if (candidates.length === 0) return;

  // For each, find the first completed clip
  let updated = 0, skipped = 0, errs = 0;
  for (const p of candidates) {
    const { data: clips, error: cErr } = await supa
      .from("video_clips")
      .select("project_id, video_url, start_image_url, shot_index")
      .eq("project_id", p.id)
      .eq("status", "completed")
      .not("video_url", "is", null)
      .order("shot_index", { ascending: true })
      .limit(1);
    if (cErr) { errs++; console.warn(`  ! ${p.id}: ${cErr.message}`); continue; }
    const clip = (clips?.[0] ?? null) as Clip | null;
    if (!clip) { skipped++; continue; }
    const patch: Record<string, string> = {};
    if (!p.video_url && clip.video_url) patch.video_url = clip.video_url;
    if (!p.thumbnail_url && clip.start_image_url) patch.thumbnail_url = clip.start_image_url;
    if (Object.keys(patch).length === 0) { skipped++; continue; }

    if (APPLY) {
      const { error: uErr } = await supa.from("movie_projects").update(patch).eq("id", p.id);
      if (uErr) { errs++; console.warn(`  ✗ ${p.id}: ${uErr.message}`); continue; }
    }
    updated++;
    const tag = APPLY ? "✓" : "[dry]";
    console.log(`  ${tag} ${p.title ?? "(untitled)".padEnd(20)}  ${Object.keys(patch).join(", ")}`);
  }
  console.log(`\nDone. ${APPLY ? "updated" : "would update"}=${updated}  skipped=${skipped}  errors=${errs}`);
  if (!APPLY) console.log("Re-run with --apply to commit.");
}

main().catch((e) => { console.error(e); process.exit(1); });
