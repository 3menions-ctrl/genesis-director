/**
 * create-orphan-avatar-templates.ts
 *
 * Pass 2 of the avatar restore: for each PNG in
 * ~/Downloads/bucket-avatars-files-2 2/ whose name-slug has NO
 * matching `avatar_templates` row, create a new template AND upload
 * the file. Multiple files with the same slug coalesce into ONE
 * template; per-view URLs (front/side/back) land in the matching
 * columns; "fullbody" files patch face_image_url; "animated" variants
 * get logged for later manual review.
 *
 * Required column on insert: face_image_url (NOT NULL). All other
 * columns have defaults — name is derived from the slug
 * ("alex-turner" → "Alex Turner").
 *
 * Idempotent — checks live DB for any pre-existing row with the
 * derived name BEFORE inserting. Storage uploads use upsert=true.
 *
 *   bunx tsx scripts/create-orphan-avatar-templates.ts             # dry-run
 *   bunx tsx scripts/create-orphan-avatar-templates.ts --apply     # do it
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";
const SOURCE_DIR = resolve(homedir(), "Downloads/bucket-avatars-files-2 2");
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

const VIEW_RE = /^(.+?)-(front|side|back|fullbody|animated-fullbody|animated)(?:-(\d+))?\.png$/i;

type View = "front" | "side" | "back" | "fullbody" | "animated-fullbody" | "animated";

interface ParsedFile {
  filename: string;
  nameSlug: string;
  view: View;
  timestamp: number;
  localPath: string;
}

function parseFilename(filename: string): ParsedFile | null {
  const m = VIEW_RE.exec(filename);
  if (!m) return null;
  return {
    filename,
    nameSlug: m[1].toLowerCase(),
    view: m[2].toLowerCase() as View,
    timestamp: m[3] ? parseInt(m[3], 10) : 0,
    localPath: resolve(SOURCE_DIR, filename),
  };
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchExistingSlugs(): Promise<Set<string>> {
  const all = new Set<string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supa
      .from("avatar_templates")
      .select("name")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) all.add(slugifyName((row as { name: string }).name ?? ""));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function uploadOne(p: ParsedFile): Promise<string> {
  const bytes = readFileSync(p.localPath);
  const storagePath = `batch-v2/${p.filename}`;
  const up = await supa.storage.from("avatars").upload(storagePath, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (up.error) throw new Error(`storage: ${up.error.message}`);
  return supa.storage.from("avatars").getPublicUrl(storagePath).data.publicUrl;
}

interface GroupPlan {
  nameSlug: string;
  derivedName: string;
  files: ParsedFile[];
  // First file we'd use to seed the row (preferred order: front, fullbody, anything)
  primary: ParsedFile;
}

function planForGroup(nameSlug: string, files: ParsedFile[]): GroupPlan {
  // Prefer "front" over "fullbody" over "animated*" — front is what the UI shows in card grids.
  const order: View[] = ["front", "fullbody", "side", "back", "animated-fullbody", "animated"];
  const ranked = [...files].sort((a, b) => {
    const ra = order.indexOf(a.view), rb = order.indexOf(b.view);
    if (ra !== rb) return ra - rb;
    return b.timestamp - a.timestamp; // newer first within same view
  });
  return {
    nameSlug,
    derivedName: titleCaseFromSlug(nameSlug),
    files,
    primary: ranked[0],
  };
}

async function main() {
  console.log(`Scanning ${SOURCE_DIR}`);
  const files = readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith(".png"))
    .map(parseFilename)
    .filter((f): f is ParsedFile => !!f);
  console.log(`Total parsed files: ${files.length}`);

  const existing = await fetchExistingSlugs();
  console.log(`Existing template slugs in live DB: ${existing.size}`);

  // Group files by slug, then keep only groups whose slug is NOT in DB
  const byGroup = new Map<string, ParsedFile[]>();
  for (const f of files) {
    const arr = byGroup.get(f.nameSlug) ?? [];
    arr.push(f);
    byGroup.set(f.nameSlug, arr);
  }
  const orphans: GroupPlan[] = [];
  for (const [slug, groupFiles] of byGroup) {
    // The slug from the filename might match a template slug exactly,
    // OR be a prefix of one (e.g. "kemi" → "afrobeats-star-kemi"). The
    // first script's matcher handled this; here we need the same logic
    // to avoid creating dupes.
    const exactMatch = existing.has(slug);
    const prefixMatch = !exactMatch && [...existing].some(
      (t) => t.startsWith(slug + "-") || slug.startsWith(t + "-"),
    );
    if (exactMatch || prefixMatch) continue;
    orphans.push(planForGroup(slug, groupFiles));
  }

  console.log(`\nOrphan groups (no template): ${orphans.length}`);
  console.log(`Total orphan files: ${orphans.reduce((s, g) => s + g.files.length, 0)}`);
  console.log(`\nFirst 15 groups:`);
  for (const g of orphans.slice(0, 15)) {
    console.log(`  • ${g.derivedName.padEnd(40)} ${g.files.length} file(s)  [${g.files.map((f) => f.view).join(", ")}]`);
  }

  if (!APPLY) {
    console.log(`\n[dry-run] re-run with --apply to upload + insert templates.`);
    return;
  }

  // For each orphan group: upload primary, insert template, upload remaining views, patch view columns
  let created = 0, uploaded = 0, errors = 0;
  for (let i = 0; i < orphans.length; i++) {
    const g = orphans[i];
    try {
      // 1. Upload primary first to get a face_image_url for the insert
      const primaryUrl = await uploadOne(g.primary);
      uploaded++;

      // 2. Insert the template row
      const insertRow: Record<string, unknown> = {
        name:            g.derivedName,
        face_image_url:  primaryUrl,
        thumbnail_url:   primaryUrl,
        // Both NOT NULL — defaults match existing rows in the DB.
        // User can edit per-avatar in the admin UI later.
        voice_id:        "alloy",
        voice_provider:  "openai",
        avatar_type:     "realistic",
        is_active:       true,
        is_premium:      false,
        tags:            [],
        character_bible: {},
      };
      if (g.primary.view === "front") insertRow.front_image_url = primaryUrl;
      const { data: inserted, error: insErr } = await supa
        .from("avatar_templates")
        .insert(insertRow as never)
        .select("id")
        .single();
      if (insErr) throw new Error(`insert: ${insErr.message}`);
      created++;
      const newId = (inserted as { id: string }).id;

      // 3. Upload + patch remaining variants
      const remaining = g.files.filter((f) => f !== g.primary);
      const patch: Record<string, string> = {};
      for (const f of remaining) {
        const url = await uploadOne(f);
        uploaded++;
        if (f.view === "front" && !patch.front_image_url) patch.front_image_url = url;
        else if (f.view === "side" && !patch.side_image_url) patch.side_image_url = url;
        else if (f.view === "back" && !patch.back_image_url) patch.back_image_url = url;
      }
      if (Object.keys(patch).length) {
        const { error } = await supa.from("avatar_templates").update(patch).eq("id", newId);
        if (error) throw new Error(`patch: ${error.message}`);
      }

      if ((i + 1) % 10 === 0) {
        console.log(`  ${i + 1}/${orphans.length}  (created ${created}, uploaded ${uploaded}, errors ${errors})`);
      }
    } catch (e) {
      errors++;
      console.error(`  ✗ ${g.derivedName}: ${(e as Error).message}`);
    }
  }
  console.log(`\nDone. created=${created}  uploaded=${uploaded}  errors=${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
