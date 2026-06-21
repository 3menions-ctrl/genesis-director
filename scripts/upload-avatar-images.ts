/**
 * upload-avatar-images.ts
 *
 * Bulk upload the avatar reference images from
 *   ~/Downloads/bucket-avatars-files-2 2/
 * into the live Supabase `avatars` storage bucket, then patch each
 * matching `avatar_templates` row's image URL columns.
 *
 * Filename format observed:
 *   <name-slug>-<view>-<timestamp>.png
 *     name-slug   = "aaliya-patel", "alex-thompson", "afrobeats-star-kemi"
 *     view        = "front" | "side" | "back" | "fullbody" | "animated-fullbody"
 *     timestamp   = epoch ms (just disambiguates)
 *
 * Matching:
 *   For each file, derive name-slug. Find avatar_templates row whose
 *   slugify(name) starts with or equals name-slug. Patch:
 *     front     → front_image_url, face_image_url, thumbnail_url
 *     side      → side_image_url
 *     back      → back_image_url
 *     fullbody  → face_image_url (best guess — fullbody implies framing,
 *                 not a separate view column)
 *     animated  → skipped (no column for animated; logged for later)
 *
 * Idempotent — storage upload uses upsert=true, DB UPDATE uses
 * COALESCE-style "only set if currently empty OR pointing at old project".
 *
 * Run:
 *   bunx tsx scripts/upload-avatar-images.ts            # dry-run
 *   bunx tsx scripts/upload-avatar-images.ts --apply    # do it
 *   bunx tsx scripts/upload-avatar-images.ts --apply --overwrite  # replace existing URLs too
 */
import { readFileSync, statSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";
const SOURCE_DIR = resolve(homedir(), "Downloads/bucket-avatars-files-2 2");

function loadServiceKey(): string {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const line = env.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}

const APPLY = process.argv.includes("--apply");
const OVERWRITE = process.argv.includes("--overwrite");

const supa = createClient(SUPABASE_URL, loadServiceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VIEW_RE = /^(.+?)-(front|side|back|fullbody|animated-fullbody|animated)(?:-(\d+))?\.png$/i;

interface ParsedFile {
  filename: string;
  nameSlug: string;
  view: "front" | "side" | "back" | "fullbody" | "animated-fullbody" | "animated";
  localPath: string;
}

function parseFilename(filename: string): ParsedFile | null {
  const m = VIEW_RE.exec(filename);
  if (!m) return null;
  return {
    filename,
    nameSlug: m[1].toLowerCase(),
    view: m[2].toLowerCase() as ParsedFile["view"],
    localPath: resolve(SOURCE_DIR, filename),
  };
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface TemplateRow {
  id: string;
  name: string;
  slug: string;
  face_image_url: string | null;
  thumbnail_url: string | null;
  front_image_url: string | null;
  side_image_url: string | null;
  back_image_url: string | null;
}

async function fetchTemplates(): Promise<TemplateRow[]> {
  const all: TemplateRow[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supa
      .from("avatar_templates")
      .select("id, name, face_image_url, thumbnail_url, front_image_url, side_image_url, back_image_url")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      all.push({ ...(row as TemplateRow), slug: slugifyName((row as TemplateRow).name ?? "") });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/**
 * Match a filename's name-slug to a template. The slug from
 * "afrobeats-star-kemi" might match "Afrobeats Star Kemi" (whole-name)
 * or just "Kemi" (single-name). Pass 1: exact equality on full slug.
 * Pass 2: filename slug is a prefix of template slug. Pass 3: template
 * slug is a prefix of filename slug. Ambiguous matches go to a
 * "needs review" pile.
 */
function matchTemplate(
  nameSlug: string,
  templatesBySlug: Map<string, TemplateRow[]>,
  templatesByPrefix: TemplateRow[],
): { match: TemplateRow | null; ambiguous: boolean } {
  const exact = templatesBySlug.get(nameSlug);
  if (exact?.length === 1) return { match: exact[0], ambiguous: false };
  if (exact && exact.length > 1) return { match: exact[0], ambiguous: true };

  // Prefix matches: filename slug is contained in template slug or vice versa.
  const prefix = templatesByPrefix.filter(
    (t) => t.slug.startsWith(nameSlug + "-") || nameSlug.startsWith(t.slug + "-"),
  );
  if (prefix.length === 1) return { match: prefix[0], ambiguous: false };
  if (prefix.length > 1) {
    // Prefer the longest matching slug (most specific).
    const sorted = [...prefix].sort((a, b) => b.slug.length - a.slug.length);
    return { match: sorted[0], ambiguous: sorted[0].slug.length === sorted[1].slug.length };
  }
  return { match: null, ambiguous: false };
}

async function uploadOne(p: ParsedFile): Promise<string> {
  const bytes = readFileSync(p.localPath);
  const storagePath = `batch-v2/${p.filename}`;
  const up = await supa.storage.from("avatars").upload(storagePath, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (up.error) throw new Error(`storage: ${up.error.message}`);
  const pub = supa.storage.from("avatars").getPublicUrl(storagePath);
  return pub.data.publicUrl;
}

function pickUpdates(view: ParsedFile["view"], url: string, row: TemplateRow): Record<string, string> | null {
  // Decide which columns to write. If OVERWRITE flag is set, always
  // patch. Otherwise only patch when the column is null, a data: URI
  // placeholder, or points at the old supabase project.
  const OLD_HOST = "ahlikyhgcqvrdvbtkghh.supabase.co";
  const isStale = (current: string | null) =>
    OVERWRITE || !current || current.startsWith("data:") || current.includes(OLD_HOST);

  const patch: Record<string, string> = {};
  if (view === "front") {
    if (isStale(row.front_image_url)) patch.front_image_url = url;
    if (isStale(row.face_image_url))  patch.face_image_url  = url;
    if (isStale(row.thumbnail_url))   patch.thumbnail_url   = url;
  } else if (view === "side") {
    if (isStale(row.side_image_url))  patch.side_image_url  = url;
  } else if (view === "back") {
    if (isStale(row.back_image_url))  patch.back_image_url  = url;
  } else if (view === "fullbody") {
    if (isStale(row.face_image_url))  patch.face_image_url  = url;
  } else {
    // animated / animated-fullbody — no column; caller logs.
    return null;
  }
  return Object.keys(patch).length ? patch : null;
}

async function main() {
  console.log(`Source: ${SOURCE_DIR}`);
  const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".png"));
  const parsed = files.map(parseFilename).filter((p): p is ParsedFile => !!p);
  const skipped = files.length - parsed.length;
  console.log(`Files: ${files.length} (parsed: ${parsed.length}, skipped: ${skipped})`);

  console.log(`Loading avatar_templates from Supabase…`);
  const templates = await fetchTemplates();
  console.log(`Templates: ${templates.length}`);

  // Build lookups
  const bySlug = new Map<string, TemplateRow[]>();
  for (const t of templates) {
    const arr = bySlug.get(t.slug) ?? [];
    arr.push(t);
    bySlug.set(t.slug, arr);
  }

  // Plan
  type Plan = { file: ParsedFile; match: TemplateRow; ambiguous: boolean };
  const plan: Plan[] = [];
  const unmatched: ParsedFile[] = [];
  for (const p of parsed) {
    const { match, ambiguous } = matchTemplate(p.nameSlug, bySlug, templates);
    if (match) plan.push({ file: p, match, ambiguous });
    else unmatched.push(p);
  }

  // Summary
  const byView = new Map<string, number>();
  for (const x of plan) byView.set(x.file.view, (byView.get(x.file.view) ?? 0) + 1);
  console.log(`\nPlan:`);
  console.log(`  matched files:   ${plan.length}`);
  console.log(`  unmatched files: ${unmatched.length}`);
  console.log(`  ambiguous: ${plan.filter((p) => p.ambiguous).length}`);
  for (const [v, n] of byView) console.log(`    ${v}: ${n}`);

  if (unmatched.length) {
    console.log(`\nFirst 10 unmatched files (no template):`);
    for (const u of unmatched.slice(0, 10)) console.log(`  • ${u.filename}  → slug="${u.nameSlug}"`);
  }

  if (!APPLY) {
    console.log(`\n[dry-run] re-run with --apply to upload + patch.`);
    console.log(`          add --overwrite to replace URLs currently pointing at the old project.`);
    return;
  }

  console.log(`\nUploading…`);
  let uploaded = 0, patched = 0, errors = 0;
  for (let i = 0; i < plan.length; i++) {
    const { file, match } = plan[i];
    try {
      const url = await uploadOne(file);
      uploaded++;
      const updates = pickUpdates(file.view, url, match);
      if (updates) {
        const { error } = await supa.from("avatar_templates").update(updates).eq("id", match.id);
        if (error) throw new Error(`update: ${error.message}`);
        patched++;
      }
      if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${plan.length}  (uploaded ${uploaded}, patched ${patched}, errors ${errors})`);
    } catch (e) {
      errors++;
      console.error(`  ✗ ${file.filename}: ${(e as Error).message}`);
    }
  }
  console.log(`\nDone. uploaded=${uploaded}  patched=${patched}  errors=${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
